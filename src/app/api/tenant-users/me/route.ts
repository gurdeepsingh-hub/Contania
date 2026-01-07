import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tenant-users/me/route.ts:23',
          message: 'No subdomain found',
          data: {
            hostname: request.headers.get('host'),
            xTenantSubdomain: request.headers.get('x-tenant-subdomain'),
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'B',
        }),
      }).catch(() => {})
      // #endregion
      return NextResponse.json({ message: 'No tenant context' }, { status: 401 })
    }

    // #region agent log
    const cookieHeader = request.headers.get('cookie') || ''
    const hasPayloadToken = cookieHeader.includes('payload-token')
    fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'tenant-users/me/route.ts:26',
        message: 'Before payload.auth',
        data: {
          hostname: request.headers.get('host'),
          subdomain,
          hasCookie: hasPayloadToken,
          cookieLength: cookieHeader.length,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'C',
      }),
    }).catch(() => {})
    // #endregion

    const { user } = await payload.auth({
      headers: request.headers,
    })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: 'tenant-users/me/route.ts:35',
        message: 'After payload.auth',
        data: {
          hostname: request.headers.get('host'),
          subdomain,
          hasUser: !!user,
          userId: user?.id,
          userCollection: (user as { collection?: string })?.collection,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'pre-fix',
        hypothesisId: 'C',
      }),
    }).catch(() => {})
    // #endregion

    if (!user) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'tenant-users/me/route.ts:40',
          message: 'User is null - returning 401',
          data: { hostname: request.headers.get('host'), subdomain, hasCookie: hasPayloadToken },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'pre-fix',
          hypothesisId: 'C',
        }),
      }).catch(() => {})
      // #endregion
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
    }

    // Verify user is from tenant-users collection
    if ((user as { collection?: string }).collection !== 'tenant-users') {
      return NextResponse.json({ message: 'Invalid user type' }, { status: 403 })
    }

    // Verify user belongs to the tenant from subdomain
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: {
          equals: subdomain.toLowerCase(),
        },
      },
      limit: 1,
    })

    if (tenantResult.docs.length === 0) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    const tenant = tenantResult.docs[0]
    const tenantUser = user as { tenantId?: number | { id: number } }
    const tenantUserId =
      typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

    if (tenantUserId !== tenant.id) {
      return NextResponse.json({ message: 'User does not belong to this tenant' }, { status: 403 })
    }

    // Fetch user with role populated (depth 2 to ensure permissions are included)
    const fullUser = await payload.findByID({
      collection: 'tenant-users',
      id: user.id as number,
      depth: 2,
    })

    // Extract role with permissions
    const role = (
      fullUser as {
        role?:
          | number
          | string
          | { id: number; name?: string; permissions?: Record<string, boolean> }
      }
    ).role

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: (user as { fullName?: string }).fullName,
        phoneMobile: (user as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (user as { phoneFixed?: string }).phoneFixed,
        ddi: (user as { ddi?: string }).ddi,
        role: role,
        userGroup: (user as { userGroup?: string }).userGroup, // Keep for backward compatibility
      },
    })
  } catch (error) {
    console.error('Error fetching tenant user:', error)
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }
}

// Helper function to get tenant context for authenticated user (no admin permission required)
async function getTenantUserContext(request: NextRequest) {
  const payload = await getPayload({ config })
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
    return { error: 'No tenant context', status: 401 }
  }

  // Verify user is authenticated
  const { user } = await payload.auth({
    headers: request.headers,
  })

  if (!user) {
    return { error: 'Not authenticated', status: 401 }
  }

  // Verify user is from tenant-users collection
  if ((user as { collection?: string }).collection !== 'tenant-users') {
    return { error: 'Invalid user type', status: 403 }
  }

  // Get tenant from subdomain
  const tenantResult = await payload.find({
    collection: 'tenants',
    where: {
      subdomain: {
        equals: subdomain.toLowerCase(),
      },
    },
    limit: 1,
  })

  if (tenantResult.docs.length === 0) {
    return { error: 'Tenant not found', status: 404 }
  }

  const tenant = tenantResult.docs[0]

  // Verify user belongs to the tenant
  const tenantUser = user as { tenantId?: number | { id: number } }
  const tenantUserId =
    typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

  if (tenantUserId !== tenant.id) {
    return { error: 'User does not belong to this tenant', status: 403 }
  }

  return { payload, tenant, currentUser: user }
}

export async function PATCH(request: NextRequest) {
  try {
    const context = await getTenantUserContext(request)
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, currentUser } = context
    const body = await request.json()

    // Only allow updating specific fields (prevent role, status, email changes)
    const allowedFields = ['fullName', 'phoneMobile', 'phoneFixed', 'ddi']
    const updateData: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] || undefined
      }
    }

    // Update user
    const updatedUser = await payload.update({
      collection: 'tenant-users',
      id: currentUser.id as number,
      data: updateData,
      depth: 1,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: (updatedUser as { fullName?: string }).fullName,
        phoneMobile: (updatedUser as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (updatedUser as { phoneFixed?: string }).phoneFixed,
        ddi: (updatedUser as { ddi?: string }).ddi,
      },
    })
  } catch (error) {
    console.error('Error updating tenant user:', error)
    return NextResponse.json(
      { message: 'Failed to update account information' },
      { status: 500 }
    )
  }
}
