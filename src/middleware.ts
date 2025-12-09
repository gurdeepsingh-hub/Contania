import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { rateLimit } from '@/lib/rate-limit'

// Initialize rate limiter (10 requests per minute per subdomain)
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

// Cache for tenant validation (5 minute TTL)
const tenantCache = new Map<string, { valid: boolean; expires: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''
  
  // Extract subdomain from hostname
  // Format: subdomain.domain.com or subdomain.localhost:3000
  const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
  const subdomain = subdomainMatch ? subdomainMatch[1] : null
  
  // If no subdomain, allow access to main domain routes
  if (!subdomain || subdomain === 'www' || subdomain === 'localhost') {
    return NextResponse.next()
  }

  // SECURITY: Rate limiting to prevent subdomain enumeration
  try {
    await limiter.check(10, subdomain) // 10 requests per minute per subdomain
  } catch {
    return NextResponse.json(
      { message: 'Too many requests' },
      { status: 429 }
    )
  }

  // SECURITY: Early tenant validation with caching
  // Check cache first
  const cacheKey = subdomain.toLowerCase()
  const cached = tenantCache.get(cacheKey)
  const now = Date.now()

  let isValidTenant = false

  if (cached && cached.expires > now) {
    isValidTenant = cached.valid
  } else {
    // Validate tenant exists and is approved
    try {
      const payload = await getPayload({ config })
      const tenantResult = await payload.find({
        collection: 'tenants',
        where: {
          and: [
            {
              subdomain: {
                equals: subdomain.toLowerCase(),
              },
            },
            {
              approved: {
                equals: true,
              },
            },
          ],
        },
        limit: 1,
      })

      isValidTenant = tenantResult.docs.length > 0

      // Cache the result
      tenantCache.set(cacheKey, {
        valid: isValidTenant,
        expires: now + CACHE_TTL,
      })

      // Clean up expired cache entries periodically
      if (tenantCache.size > 1000) {
        for (const [key, value] of tenantCache.entries()) {
          if (value.expires <= now) {
            tenantCache.delete(key)
          }
        }
      }
    } catch (error) {
      // On error, log but allow through (fail open to prevent DoS)
      console.error('Middleware tenant validation error:', error)
      isValidTenant = true // Fail open to prevent breaking legitimate requests
    }
  }

  // If tenant doesn't exist or isn't approved, return 404 early
  if (!isValidTenant) {
    return NextResponse.json(
      { message: 'Not found' },
      { status: 404 }
    )
  }

  // Add subdomain to headers for use in API routes and page components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-subdomain', subdomain)

  // For API routes, static files, and Next.js internal routes, just pass through with headers
  if (
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/favicon.ico')
  ) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  // Rewrite the URL to include subdomain as a path segment
  // This allows Next.js routing to match the [subdomain] route
  // Example: tenant.containa.io/ -> /tenant/
  const newPath = `/${subdomain}${url.pathname === '/' ? '' : url.pathname}`
  url.pathname = newPath

  return NextResponse.rewrite(url, {
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

