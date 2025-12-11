import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { canManageRoles } from '@/lib/permissions'

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

    // Verify user is from tenant-users collection (or super admin)
    const userCollection = (user as { collection?: string }).collection
    if (userCollection !== 'tenant-users' && (user as { role?: string }).role !== 'superadmin') {
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
    
    // For tenant users, verify they belong to the tenant
    if (userCollection === 'tenant-users') {
      const tenantUser = user as { tenantId?: number | { id: number } }
      const tenantUserId = typeof tenantUser.tenantId === 'object' 
        ? tenantUser.tenantId.id 
        : tenantUser.tenantId

      if (tenantUserId !== tenant.id) {
        return NextResponse.json({ message: 'User does not belong to this tenant' }, { status: 403 })
      }
    }

    // Fetch all roles for this tenant
    const rolesResult = await payload.find({
      collection: 'tenant-roles',
      where: {
        tenantId: {
          equals: tenant.id,
        },
      },
      limit: 1000,
    })

    // Format role data
    const roles = rolesResult.docs.map((role) => ({
      id: role.id,
      name: (role as { name?: string }).name || '',
      description: (role as { description?: string }).description || '',
      isSystemRole: (role as { isSystemRole?: boolean }).isSystemRole || false,
      isActive: (role as { isActive?: boolean }).isActive !== false,
      permissions: (role as { permissions?: Record<string, boolean> }).permissions || {},
    }))

    return NextResponse.json({
      success: true,
      roles,
      total: rolesResult.totalDocs,
    })
  } catch (error) {
    console.error('Error fetching tenant roles:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant roles' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    // Verify user is from tenant-users collection (or super admin)
    const userCollection = (user as { collection?: string }).collection
    const isSuperAdmin = (user as { role?: string }).role === 'superadmin'
    
    if (userCollection !== 'tenant-users' && !isSuperAdmin) {
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
    
    // For tenant users, verify they belong to the tenant and have permission
    if (userCollection === 'tenant-users') {
      const tenantUser = user as { tenantId?: number | { id: number } }
      const tenantUserId = typeof tenantUser.tenantId === 'object' 
        ? tenantUser.tenantId.id 
        : tenantUser.tenantId

      if (tenantUserId !== tenant.id) {
        return NextResponse.json({ message: 'User does not belong to this tenant' }, { status: 403 })
      }

      // Fetch user with role populated to check permissions
      const fullUser = await payload.findByID({
        collection: 'tenant-users',
        id: user.id as number,
        depth: 1,
      })

      if (!canManageRoles(fullUser as unknown as import('@/lib/permissions').UserWithRole)) {
        return NextResponse.json({ message: 'Insufficient permissions to manage roles' }, { status: 403 })
      }
    }

    const body = await request.json()
    const { name, description, permissions, isActive } = body

    if (!name || !permissions) {
      return NextResponse.json({ message: 'Name and permissions are required' }, { status: 400 })
    }

    // Create new role
    const newRole = await payload.create({
      collection: 'tenant-roles',
      data: {
        name,
        description: description || '',
        tenantId: tenant.id,
        isSystemRole: false,
        permissions: permissions || {},
        isActive: isActive !== false,
      },
    })

    return NextResponse.json({
      success: true,
      role: {
        id: newRole.id,
        name: (newRole as { name?: string }).name || '',
        description: (newRole as { description?: string }).description || '',
        isSystemRole: (newRole as { isSystemRole?: boolean }).isSystemRole || false,
        isActive: (newRole as { isActive?: boolean }).isActive !== false,
        permissions: (newRole as { permissions?: Record<string, boolean> }).permissions || {},
      },
    })
  } catch (error) {
    console.error('Error creating tenant role:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to create tenant role' },
      { status: 500 }
    )
  }
}

