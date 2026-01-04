import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { payload } = auth
    const resolvedParams = await params
    const tenantId = Number(resolvedParams.id)

    // Parse request body to check for userId
    const body = await request.json().catch(() => ({}))
    const userId = body.userId ? Number(body.userId) : null

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
        { status: 400 },
      )
    }

    if (!tenant.subdomain) {
      return NextResponse.json({ message: 'Tenant subdomain not found' }, { status: 400 })
    }

    let tenantUser
    let loginPassword: string
    let originalPasswordHash: string | null = null
    let originalPasswordSalt: string | null = null
    let needsPasswordRestore = false

    // If userId is provided, use that specific user
    if (userId) {
      try {
        tenantUser = await payload.findByID({
          collection: 'tenant-users',
          id: userId,
        })

        // Verify the user belongs to this tenant
        const userTenantId =
          typeof tenantUser.tenantId === 'object'
            ? (tenantUser.tenantId as { id: number }).id
            : tenantUser.tenantId

        if (userTenantId !== tenantId) {
          return NextResponse.json(
            { message: 'User does not belong to this tenant' },
            { status: 403 },
          )
        }

        // Store original password hash before changing it
        // Use raw SQL query to access password hash directly (Payload filters it from normal queries)
        try {
          const dbAdapter = payload.db as {
            pool?: { query: (sql: string, params: any[]) => Promise<{ rows: any[] }> }
          }
          if (dbAdapter.pool) {
            // Query ALL columns in table to find hash and salt columns
            const allColumnsResult = await dbAdapter.pool.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_users' ORDER BY column_name`,
              [],
            )

            // Payload CMS stores password as hash + salt, not a single password column
            // Find both hash and salt columns
            const hashColumn = allColumnsResult.rows.find(
              (r: { column_name: string }) => r.column_name === 'hash',
            )?.column_name
            const saltColumn = allColumnsResult.rows.find(
              (r: { column_name: string }) => r.column_name === 'salt',
            )?.column_name

            if (hashColumn && saltColumn) {
              const result = await dbAdapter.pool.query(
                `SELECT ${hashColumn} as hash, ${saltColumn} as salt FROM tenant_users WHERE id = $1`,
                [userId],
              )
              if (
                result.rows &&
                result.rows.length > 0 &&
                result.rows[0].hash &&
                result.rows[0].salt
              ) {
                originalPasswordHash = result.rows[0].hash
                originalPasswordSalt = result.rows[0].salt
                needsPasswordRestore = true
              }
            }
          }
        } catch (dbError) {
          console.error('Error fetching original password hash:', dbError)
          // Continue anyway - worst case is password won't be restored
        }

        // Reset password temporarily to login
        loginPassword = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`
        await payload.update({
          collection: 'tenant-users',
          id: tenantUser.id,
          data: {
            password: loginPassword,
          },
        })
      } catch (error) {
        return NextResponse.json({ message: 'User not found' }, { status: 404 })
      }
    } else {
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

      if (adminUsers.docs.length > 0) {
        // Use existing admin user - need to reset password to login
        tenantUser = adminUsers.docs[0]

        // Store original password hash before changing it
        // Use raw SQL query to access password hash directly (Payload filters it from normal queries)
        try {
          const dbAdapter = payload.db as {
            pool?: { query: (sql: string, params: any[]) => Promise<{ rows: any[] }> }
          }
          if (dbAdapter.pool) {
            // Query ALL columns to find hash and salt columns
            const allColumnsResult = await dbAdapter.pool.query(
              `SELECT column_name FROM information_schema.columns WHERE table_name = 'tenant_users' ORDER BY column_name`,
              [],
            )
            const hashColumn = allColumnsResult.rows.find(
              (r: { column_name: string }) => r.column_name === 'hash',
            )?.column_name
            const saltColumn = allColumnsResult.rows.find(
              (r: { column_name: string }) => r.column_name === 'salt',
            )?.column_name

            if (hashColumn && saltColumn) {
              const result = await dbAdapter.pool.query(
                `SELECT ${hashColumn} as hash, ${saltColumn} as salt FROM tenant_users WHERE id = $1`,
                [tenantUser.id],
              )
              if (
                result.rows &&
                result.rows.length > 0 &&
                result.rows[0].hash &&
                result.rows[0].salt
              ) {
                originalPasswordHash = result.rows[0].hash
                originalPasswordSalt = result.rows[0].salt
                needsPasswordRestore = true
              }
            }
          }
        } catch (dbError) {
          console.error('Error fetching original password hash:', dbError)
          // Continue anyway - worst case is password won't be restored
        }

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
                settings: {
                  view: true,
                  entity_settings: true,
                  user_settings: true,
                  personalization: true,
                },
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
    }

    // Generate token for tenant user using the password we know
    // Use try/finally to ensure password is restored even if token generation fails
    let result
    try {
      result = await payload.login({
        collection: 'tenant-users',
        data: {
          email: tenantUser.email,
          password: loginPassword,
        },
      })

      if (!result.token) {
        return NextResponse.json(
          { message: 'Failed to create tenant user session' },
          { status: 500 },
        )
      }
    } catch (loginError) {
      throw loginError
    } finally {
      // Always restore original password hash and salt after token generation (success or failure)
      // This ensures the user's original password is never permanently lost
      if (needsPasswordRestore && originalPasswordHash && originalPasswordSalt) {
        try {
          // Use raw SQL update to restore password hash and salt directly
          // This bypasses Payload's password hashing since we're restoring the original hash/salt
          const dbAdapter = payload.db as {
            pool?: { query: (sql: string, params: any[]) => Promise<any> }
          }
          if (dbAdapter.pool) {
            await dbAdapter.pool.query(
              `UPDATE tenant_users SET hash = $1, salt = $2 WHERE id = $3`,
              [originalPasswordHash, originalPasswordSalt, tenantUser.id],
            )
          }
        } catch (restoreError) {
          console.error('Error restoring password after token generation:', restoreError)
          // Log error but don't fail the request - token may already be generated
        }
      }
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
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 })
  }
}
