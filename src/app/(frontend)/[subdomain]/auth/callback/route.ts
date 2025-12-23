import { NextRequest, NextResponse } from 'next/server'
import { getAuthCookieOptions } from '@/lib/cookie-config'

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token')
    
    if (!token) {
      return NextResponse.redirect(new URL('/signin', request.url))
    }

    // Construct redirect URL to stay on the same subdomain
    // Explicitly construct from hostname to ensure subdomain is preserved
    const hostname = request.headers.get('host') || ''
    const protocol = request.headers.get('x-forwarded-proto') || (hostname.includes('localhost') ? 'http' : 'https')
    const dashboardUrl = `${protocol}://${hostname}/dashboard`
    const response = NextResponse.redirect(dashboardUrl)
    
    // Use the same cookie config as the login route
    const cookieOptions = getAuthCookieOptions(request)
    
    // Set the cookie
    response.cookies.set('payload-token', token, cookieOptions)
    
    // Log for debugging
    console.log('Auth callback - Setting cookie:', {
      hostname: request.headers.get('host'),
      domain: cookieOptions.domain,
      path: cookieOptions.path,
      sameSite: cookieOptions.sameSite,
      secure: cookieOptions.secure,
    })

    return response
  } catch (error) {
    console.error('Auth callback error:', error)
    return NextResponse.redirect(new URL('/signin', request.url))
  }
}
