import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()
    let subdomain = request.headers.get('x-tenant-subdomain')

    // If subdomain not in header (client-side fetch), extract from hostname
    if (!subdomain) {
      const hostname = request.headers.get('host') || ''
      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      subdomain = subdomainMatch ? subdomainMatch[1] : null

      // Ignore 'www' and 'localhost' as subdomains
      if (subdomain === 'www' || subdomain === 'localhost') {
        subdomain = null
      }
    }

    if (!subdomain) {
      return NextResponse.json({ message: 'Subdomain required' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    // First, verify the tenant exists and is approved
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

    if (tenantResult.docs.length === 0) {
      return NextResponse.json({ message: 'Tenant not found or not approved' }, { status: 404 })
    }

    const tenant = tenantResult.docs[0]

    // Attempt login with tenant-users collection
    const result = await payload.login({
      collection: 'tenant-users',
      data: {
        email,
        password,
      },
    })

    if (result.token && result.user) {
      // Verify the user belongs to this tenant
      const tenantUser = result.user as { tenantId?: number | { id: number } }
      const tenantUserId =
        typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

      if (tenantUserId !== tenant.id) {
        return NextResponse.json(
          { message: 'User does not belong to this tenant' },
          { status: 403 },
        )
      }

      const response = NextResponse.json({
        success: true,
        user: result.user,
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tenant-users/login/route.ts:88',
          message: 'Setting cookie before',
          data: {
            hostname: request.headers.get('host'),
            subdomain,
            hasToken: !!result.token,
            cookieDomain: 'NOT_SET',
            sameSite: 'strict',
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {})
      // #endregion

      response.cookies.set('payload-token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tenant-users/login/route.ts:96',
          message: 'Setting cookie after',
          data: { hostname: request.headers.get('host'), subdomain, hasToken: !!result.token },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {})
      // #endregion

      return response
    } else {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 })
    }
  } catch (error) {
    console.error('Tenant login error:', error)
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
