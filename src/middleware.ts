import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
  // Example: guru-nanak-machine-tools.localhost:3000/ -> /guru-nanak-machine-tools/
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

