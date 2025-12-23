import { NextRequest } from 'next/server'

/**
 * Get cookie configuration for authentication cookies.
 * Sets domain to allow subdomain sharing (e.g., .containa.io)
 * Uses 'lax' SameSite to allow cookies on subdomains while maintaining CSRF protection
 */
export function getAuthCookieOptions(request?: NextRequest): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'lax' | 'strict' | 'none'
  maxAge: number
  domain?: string
  path: string
} {
  const defaultHost = process.env.DEFAULT_HOST || 'containa.io'
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Extract hostname from request if available
  let hostname: string | null = null
  if (request) {
    hostname = request.headers.get('host')?.split(':')[0] || null
  }
  
  // For localhost or dev environments, don't set domain (allows localhost subdomains)
  // For production, set domain with leading dot to enable subdomain sharing
  // Check if hostname contains localhost (handles both localhost and tenant.localhost)
  const isLocalhost = hostname === 'localhost' || hostname?.includes('.localhost') || !isProduction
  
  const domain = isLocalhost
      ? undefined
      : `.${defaultHost}`
  
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax', // Changed from 'strict' to allow subdomain sharing
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    ...(domain && { domain }), // Only set domain if not localhost
  }
}





