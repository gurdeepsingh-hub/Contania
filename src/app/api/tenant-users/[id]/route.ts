import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { canManageUsers } from '@/lib/permissions'

// Helper function to get tenant context and verify admin
async function getTenantContext(request: NextRequest) {
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
  const tenantUser = user as { tenantId?: number | { id: number }; id?: number }
  const tenantUserId = typeof tenantUser.tenantId === 'object' 
    ? tenantUser.tenantId.id 
    : tenantUser.tenantId

  if (tenantUserId !== tenant.id) {
    return { error: 'User does not belong to this tenant', status: 403 }
  }

  // Fetch user with role populated to check permissions
  const fullUser = await payload.findByID({
    collection: 'tenant-users',
    id: user.id as number,
    depth: 1,
  })

  // Verify user has permission to manage users
  if (!canManageUsers(fullUser)) {
    return { error: 'Insufficient permissions to manage tenant users', status: 403 }
  }

  return { payload, tenant, currentUser: user }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request)
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const userId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the user
    const user = await payload.findByID({
      collection: 'tenant-users',
      id: userId,
      depth,
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    // Verify user belongs to this tenant
    const userTenantId = typeof (user as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (user as { tenantId: { id: number } }).tenantId.id
      : (user as { tenantId?: number }).tenantId

    if (userTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'User does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: (user as { fullName?: string }).fullName,
        role: (user as { role?: number | string | { id: number; name?: string } }).role,
        status: (user as { status?: string }).status || 'active',
        position: (user as { position?: string }).position,
        phoneMobile: (user as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (user as { phoneFixed?: string }).phoneFixed,
        ddi: (user as { ddi?: string }).ddi,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    console.error('Error fetching tenant user:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant user' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request)
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const resolvedParams = await params
    const userId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the user to update
    const userToUpdate = await payload.findByID({
      collection: 'tenant-users',
      id: userId,
    })

    if (!userToUpdate) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    // Verify user belongs to this tenant
    const userTenantId = typeof (userToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (userToUpdate as { tenantId: { id: number } }).tenantId.id
      : (userToUpdate as { tenantId?: number }).tenantId

    if (userTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'User does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prevent user from changing their own role (self-demotion prevention)
    const currentUserId = (currentUser as { id?: number }).id
    const currentUserRole = (userToUpdate as { role?: number | string | { id: number } }).role
    const currentUserRoleId = typeof currentUserRole === 'object' && currentUserRole && 'id' in currentUserRole
      ? currentUserRole.id
      : typeof currentUserRole === 'number' || typeof currentUserRole === 'string'
      ? Number(currentUserRole)
      : null
    
    if (currentUserId === userId && body.role && Number(body.role) !== currentUserRoleId) {
      return NextResponse.json(
        { message: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    // Prevent user from suspending themselves
    if (currentUserId === userId && body.status && body.status === 'suspended') {
      return NextResponse.json(
        { message: 'You cannot suspend your own account' },
        { status: 400 }
      )
    }

    // Check email uniqueness if email is being changed
    if (body.email && body.email !== (userToUpdate as { email?: string }).email) {
      const existingUsers = await payload.find({
        collection: 'tenant-users',
        where: {
          and: [
            {
              email: {
                equals: body.email.toLowerCase(),
              },
            },
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              id: {
                not_equals: userId,
              },
            },
          ],
        },
        limit: 1,
      })

      if (existingUsers.docs.length > 0) {
        return NextResponse.json(
          { message: 'User with this email already exists in this tenant' },
          { status: 400 }
        )
      }
    }

    // If role is being changed, verify it belongs to tenant
    if (body.role !== undefined) {
      const roleDoc = await payload.findByID({
        collection: 'tenant-roles',
        id: Number(body.role),
      })

      const roleTenantId = typeof (roleDoc as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? ((roleDoc as { tenantId?: { id: number } }).tenantId as { id: number }).id
        : (roleDoc as { tenantId?: number }).tenantId

      if (roleTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Role does not belong to this tenant' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.fullName !== undefined) updateData.fullName = body.fullName
    if (body.email !== undefined) updateData.email = body.email.toLowerCase()
    if (body.role !== undefined) updateData.role = Number(body.role)
    if (body.status !== undefined) updateData.status = body.status
    if (body.position !== undefined) updateData.position = body.position || undefined
    if (body.phoneMobile !== undefined) updateData.phoneMobile = body.phoneMobile || undefined
    if (body.phoneFixed !== undefined) updateData.phoneFixed = body.phoneFixed || undefined
    if (body.ddi !== undefined) updateData.ddi = body.ddi || undefined
    if (body.password !== undefined && body.password) {
      updateData.password = body.password
    }

    // Update user
    const updatedUser = await payload.update({
      collection: 'tenant-users',
      id: userId,
      data: updateData,
      depth: 1, // Populate role relationship
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: (updatedUser as { fullName?: string }).fullName,
        role: (updatedUser as { role?: number | string | { id: number; name?: string } }).role,
        status: (updatedUser as { status?: string }).status || 'active',
        position: (updatedUser as { position?: string }).position,
        phoneMobile: (updatedUser as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (updatedUser as { phoneFixed?: string }).phoneFixed,
        ddi: (updatedUser as { ddi?: string }).ddi,
      },
    })
  } catch (error) {
    console.error('Error updating tenant user:', error)
    return NextResponse.json(
      { message: 'Failed to update tenant user' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request)
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const resolvedParams = await params
    const userId = Number(resolvedParams.id)

    // Prevent user from deleting themselves
    const currentUserId = (currentUser as { id?: number }).id
    if (currentUserId === userId) {
      return NextResponse.json(
        { message: 'You cannot delete your own account' },
        { status: 400 }
      )
    }

    // Get the user to delete
    const userToDelete = await payload.findByID({
      collection: 'tenant-users',
      id: userId,
    })

    if (!userToDelete) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    // Verify user belongs to this tenant
    const userTenantId = typeof (userToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (userToDelete as { tenantId: { id: number } }).tenantId.id
      : (userToDelete as { tenantId?: number }).tenantId

    if (userTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'User does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete user
    await payload.delete({
      collection: 'tenant-users',
      id: userId,
    })

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting tenant user:', error)
    return NextResponse.json(
      { message: 'Failed to delete tenant user' },
      { status: 500 }
    )
  }
}

