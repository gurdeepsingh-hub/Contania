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
      return NextResponse.json({ message: 'No tenant context' }, { status: 401 })
    }

    const { user } = await payload.auth({
      headers: request.headers,
    })

    if (!user) {
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
        role: role,
        userGroup: (user as { userGroup?: string }).userGroup, // Keep for backward compatibility
      },
    })
  } catch (error) {
    console.error('Error fetching tenant user:', error)
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }
}
