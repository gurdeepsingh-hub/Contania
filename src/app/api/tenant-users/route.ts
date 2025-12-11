import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { canManageUsers } from '@/lib/permissions'

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

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Fetch all tenant users for this tenant with role populated
    const tenantUsersResult = await payload.find({
      collection: 'tenant-users',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          // {
          //   isDeleted: {
          //     equals: false,
          //   },
          // },
        ],
      },
      depth,
      limit: 1000, // Adjust as needed
    })

    // Format user data
    const users = tenantUsersResult.docs.map((user) => {
      const role = (user as { role?: number | string | { id: number; name?: string } }).role
      return {
        id: user.id,
        email: user.email,
        fullName: (user as { fullName?: string }).fullName || '',
        role: role,
        status: (user as { status?: string }).status || 'active',
        position: (user as { position?: string }).position,
        phoneMobile: (user as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (user as { phoneFixed?: string }).phoneFixed,
        ddi: (user as { ddi?: string }).ddi,
        createdAt: user.createdAt,
      }
    })

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
  const tenantUser = user as { tenantId?: number | { id: number } }
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
  if (!canManageUsers(fullUser as unknown as import('@/lib/permissions').UserWithRole)) {
    return { error: 'Insufficient permissions to manage tenant users', status: 403 }
  }

  return { payload, tenant, currentUser: user }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request)
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const body = await request.json()

    const { email, fullName, role, password, position, phoneMobile, phoneFixed, ddi } = body

    // Validate required fields
    if (!email || !fullName || !role) {
      return NextResponse.json(
        { message: 'Email, fullName, and role are required' },
        { status: 400 }
      )
    }

    // Verify role belongs to tenant
    const roleDoc = await payload.findByID({
      collection: 'tenant-roles',
      id: Number(role),
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

    // Check if email already exists for this tenant
    const existingUsers = await payload.find({
      collection: 'tenant-users',
      where: {
        and: [
          {
            email: {
              equals: email.toLowerCase(),
            },
          },
          {
            tenantId: {
              equals: tenant.id,
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

    // Generate password if not provided
    const userPassword = password || `Temp${Math.random().toString(36).slice(-8)}!`

    // Create tenant user
    const newUser = await payload.create({
      collection: 'tenant-users',
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        fullName,
        role: Number(role),
        password: userPassword,
        status: 'active',
        position: position || undefined,
        phoneMobile: phoneMobile || undefined,
        phoneFixed: phoneFixed || undefined,
        ddi: ddi || undefined,
      },
    })

    // Send welcome email
    try {
      const { getTenantUserWelcomeEmail } = await import('@/lib/email-templates')
      const roleName = (roleDoc as { name?: string }).name || 'User'
      const emailContent = getTenantUserWelcomeEmail({
        fullName,
        email: email.toLowerCase(),
        password: userPassword,
        companyName: tenant.companyName as string,
        subdomain: tenant.subdomain as string,
        userGroup: roleName, // Keep using userGroup for email template compatibility
      })

      await payload.sendEmail({
        to: email.toLowerCase(),
        from: process.env.EMAIL_FROM || 'no-reply@localhost',
        subject: emailContent.subject,
        html: emailContent.html,
      })
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail the user creation if email fails
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: (newUser as { fullName?: string }).fullName,
        role: (newUser as { role?: number | string | { id: number; name?: string } }).role,
        status: (newUser as { status?: string }).status || 'active',
        position: (newUser as { position?: string }).position,
        phoneMobile: (newUser as { phoneMobile?: string }).phoneMobile,
        phoneFixed: (newUser as { phoneFixed?: string }).phoneFixed,
        ddi: (newUser as { ddi?: string }).ddi,
      },
      password: userPassword, // Return password only for initial creation
    })
  } catch (error) {
    console.error('Error creating tenant user:', error)
    return NextResponse.json(
      { message: 'Failed to create tenant user' },
      { status: 500 }
    )
  }
}

