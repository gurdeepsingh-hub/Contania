import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'


export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone()
  const hostname = request.headers.get('host') || ''

  // Extract subdomain from hostname
  // Format: subdomain.domain.com or subdomain.localhost:3000
  const defaultHost = process.env.DEFAULT_HOST || 'containa.io'
  const cleanHostname = hostname.split(':')[0]
  
  let subdomain: string | null = null

  // Check if we are on the root domain or localhost
  if (
    cleanHostname === defaultHost || 
    cleanHostname === 'www.' + defaultHost || 
    cleanHostname === 'localhost'
  ) {
    subdomain = null
  } else {
    const subdomainMatch = cleanHostname.match(/^([^.]+)\.(.+)$/)
    if (subdomainMatch) {
       // Check if the suffix matches the default host
       if (subdomainMatch[2] === defaultHost) {
           subdomain = subdomainMatch[1]
       } else if (cleanHostname !== 'localhost') {
           // Fallback for dev environments like tenant.localhost
           subdomain = subdomainMatch[1]
       }
    }
  }
  
  // If no subdomain, allow access to main domain routes
  if (!subdomain || subdomain === 'www') {
    return NextResponse.next()
  }

  

  // Note: Tenant validation is handled in API routes and page components
  // to avoid importing server-only modules (Payload) in Edge runtime.
  // The middleware only handles rate limiting and URL rewriting.

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
