import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthCookieOptions } from '@/lib/cookie-config'

// Helper to check if user is super admin
async function isSuperAdmin(req: NextRequest): Promise<{ payload: any; user: any } | null> {
  try {
    const payload = await getPayload({ config })
    const token = req.cookies.get('payload-token')?.value

    if (!token) return null

    const { user } = await payload.auth({
      headers: req.headers,
    })

    if (user && (user as { role?: string }).role === 'superadmin') {
      return { payload, user }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { payload } = auth
    const resolvedParams = await params
    const tenantId = Number(resolvedParams.id)

    // Get the tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    if (!tenant.approved) {
      return NextResponse.json(
        { message: 'Tenant must be approved before signing in' },
        { status: 400 }
      )
    }

    if (!tenant.subdomain) {
      return NextResponse.json(
        { message: 'Tenant subdomain not found' },
        { status: 400 }
      )
    }

    // Find or create an admin tenant user for super admin access
    // First, try to find an existing admin user
    const adminUsers = await payload.find({
      collection: 'tenant-users',
      where: {
        and: [
          {
            tenantId: {
              equals: tenantId,
            },
          },
        ],
      },
      limit: 1,
    })

    let tenantUser
    let loginPassword: string

    if (adminUsers.docs.length > 0) {
      // Use existing admin user - need to reset password to login
      tenantUser = adminUsers.docs[0]
      loginPassword = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`
      await payload.update({
        collection: 'tenant-users',
        id: tenantUser.id,
        data: {
          password: loginPassword,
        },
      })
    } else {
      // Create a temporary admin user for super admin access
      // Find admin role first
      const adminRoles = await payload.find({
        collection: 'tenant-roles',
        where: {
          and: [
            {
              tenantId: {
                equals: tenantId,
              },
            },
          ],
        },
        limit: 1,
      })

      let adminRoleId
      if (adminRoles.docs.length > 0) {
        adminRoleId = adminRoles.docs[0].id
      } else {
        // Create a default admin role with all permissions
        const newRole = await payload.create({
          collection: 'tenant-roles',
          data: {
            tenantId: tenantId,
            name: 'Super Admin',
            permissions: {
              dashboard: { view: true },
              settings: { view: true, entity_settings: true, user_settings: true, personalization: true },
              // Add all other permissions as true
            },
          },
        })
        adminRoleId = newRole.id
      }

      // Create temporary admin user
      const tempEmail = `superadmin-${tenantId}@temp.containa.io`
      loginPassword = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`

      tenantUser = await payload.create({
        collection: 'tenant-users',
        data: {
          tenantId: tenantId,
          email: tempEmail,
          password: loginPassword,
          fullName: 'Super Admin (Temporary)',
          role: adminRoleId,
          status: 'active',
        },
      })
    }

    // Generate token for tenant user using the password we know
    const result = await payload.login({
      collection: 'tenant-users',
      data: {
        email: tenantUser.email,
        password: loginPassword,
      },
    })

    if (!result.token) {
      return NextResponse.json(
        { message: 'Failed to create tenant user session' },
        { status: 500 }
      )
    }

    // Generate URL based on environment
    const hostname = request.headers.get('host') || ''
    const isLocalhost = hostname.includes('localhost')
    const baseUrl = isLocalhost 
      ? `http://${tenant.subdomain}.localhost:${hostname.split(':')[1] || '3000'}`
      : `https://${tenant.subdomain}.containa.io`
    
    // Use auth callback route to set cookie on the subdomain
    const callbackUrl = `${baseUrl}/auth/callback?token=${encodeURIComponent(result.token)}`
    
    const response = NextResponse.json({
      success: true,
      subdomain: tenant.subdomain,
      url: callbackUrl,
    })

    return response
  } catch (error) {
    console.error('Super admin tenant sign-in error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

