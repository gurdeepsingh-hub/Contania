import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { canManageRoles, type UserWithRole } from '@/lib/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const resolvedParams = await params
    // Fetch role
    const role = await payload.findByID({
      collection: 'tenant-roles',
      id: Number(resolvedParams.id),
    })

    // Verify role belongs to tenant
    const roleTenantId = typeof (role as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? ((role as { tenantId?: { id: number } }).tenantId as { id: number }).id
      : (role as { tenantId?: number }).tenantId

    if (roleTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Role does not belong to this tenant' }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      role: {
        id: role.id,
        name: (role as { name?: string }).name || '',
        description: (role as { description?: string }).description || '',
        isSystemRole: (role as { isSystemRole?: boolean }).isSystemRole || false,
        isActive: (role as { isActive?: boolean }).isActive !== false,
        permissions: (role as { permissions?: Record<string, boolean> }).permissions || {},
      },
    })
  } catch (error) {
    console.error('Error fetching tenant role:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant role' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

      if (!canManageRoles(fullUser as unknown as UserWithRole)) {
        return NextResponse.json({ message: 'Insufficient permissions to manage roles' }, { status: 403 })
      }
    }

    const resolvedParams = await params
    // Fetch existing role to check if it's a system role
    const existingRole = await payload.findByID({
      collection: 'tenant-roles',
      id: Number(resolvedParams.id),
    })

    // Verify role belongs to tenant
    const roleTenantId = typeof (existingRole as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? ((existingRole as { tenantId?: { id: number } }).tenantId as { id: number }).id
      : (existingRole as { tenantId?: number }).tenantId

    if (roleTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Role does not belong to this tenant' }, { status: 403 })
    }

    // Prevent editing system roles (unless super admin or in development mode)
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ALLOW_SYSTEM_ROLE_EDIT === 'true'
    if ((existingRole as { isSystemRole?: boolean }).isSystemRole && !isSuperAdmin && !isDevelopment) {
      return NextResponse.json({ message: 'System roles cannot be edited' }, { status: 403 })
    }

    const body = await request.json()
    const { name, description, permissions, isActive } = body

    // Prepare update data (exclude isSystemRole from updates)
    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (permissions !== undefined) updateData.permissions = permissions
    if (isActive !== undefined) updateData.isActive = isActive

    // Update role
    const updatedRole = await payload.update({
      collection: 'tenant-roles',
      id: Number(resolvedParams.id),
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      role: {
        id: updatedRole.id,
        name: (updatedRole as { name?: string }).name || '',
        description: (updatedRole as { description?: string }).description || '',
        isSystemRole: (updatedRole as { isSystemRole?: boolean }).isSystemRole || false,
        isActive: (updatedRole as { isActive?: boolean }).isActive !== false,
        permissions: (updatedRole as { permissions?: Record<string, boolean> }).permissions || {},
      },
    })
  } catch (error) {
    console.error('Error updating tenant role:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to update tenant role' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

      if (!canManageRoles(fullUser as unknown as UserWithRole)) {
        return NextResponse.json({ message: 'Insufficient permissions to manage roles' }, { status: 403 })
      }
    }

    const resolvedParams = await params
    // Fetch existing role to check if it's a system role and if it's in use
    const existingRole = await payload.findByID({
      collection: 'tenant-roles',
      id: Number(resolvedParams.id),
    })

    // Verify role belongs to tenant
    const roleTenantId = typeof (existingRole as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? ((existingRole as { tenantId?: { id: number } }).tenantId as { id: number }).id
      : (existingRole as { tenantId?: number }).tenantId

    if (roleTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Role does not belong to this tenant' }, { status: 403 })
    }

    // Prevent deleting system roles (unless super admin or in development mode)
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.ALLOW_SYSTEM_ROLE_EDIT === 'true'
    if ((existingRole as { isSystemRole?: boolean }).isSystemRole && !isSuperAdmin && !isDevelopment) {
      return NextResponse.json({ message: 'System roles cannot be deleted' }, { status: 403 })
    }

    // Check if role is assigned to any users
    const usersWithRole = await payload.find({
      collection: 'tenant-users',
      where: {
        role: {
          equals: Number(resolvedParams.id),
        },
      },
      limit: 1,
    })

    if (usersWithRole.totalDocs > 0) {
      return NextResponse.json(
        { message: 'Cannot delete role that is assigned to users' },
        { status: 400 }
      )
    }

    // Delete role
    await payload.delete({
      collection: 'tenant-roles',
      id: Number(resolvedParams.id),
    })

    return NextResponse.json({
      success: true,
      message: 'Role deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting tenant role:', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Failed to delete tenant role' },
      { status: 500 }
    )
  }
}

