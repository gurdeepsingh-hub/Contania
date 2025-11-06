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

    // Verify user is authenticated
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
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    const tenant = tenantResult.docs[0]

    // Verify user belongs to the tenant
    const tenantUser = user as { tenantId?: number | { id: number } }
    const tenantUserId = typeof tenantUser.tenantId === 'object' 
      ? tenantUser.tenantId.id 
      : tenantUser.tenantId

    if (tenantUserId !== tenant.id) {
      return NextResponse.json({ message: 'User does not belong to this tenant' }, { status: 403 })
    }

    // Fetch all tenant users for this tenant
    const tenantUsersResult = await payload.find({
      collection: 'tenant-users',
      where: {
        tenantId: {
          equals: tenant.id,
        },
      },
      limit: 1000, // Adjust as needed
    })

    // Format user data
    const users = tenantUsersResult.docs.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: (user as { fullName?: string }).fullName || '',
      userGroup: (user as { userGroup?: string }).userGroup || '',
      createdAt: user.createdAt,
    }))

    return NextResponse.json({
      success: true,
      users,
      total: tenantUsersResult.totalDocs,
    })
  } catch (error) {
    console.error('Error fetching tenant users:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant users' },
      { status: 500 }
    )
  }
}

