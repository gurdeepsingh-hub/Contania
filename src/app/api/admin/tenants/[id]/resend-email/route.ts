import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantApprovalEmail } from '@/lib/email-templates'

// Helper to check if user is super admin
async function isSuperAdmin(req: NextRequest): Promise<{ payload: any; user: any } | null> {
  try {
    const payload = await getPayload({ config })
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
    const { searchParams } = new URL(request.url)
    const emailType = searchParams.get('type') || 'approval' // 'approval' or 'credentials'

    // Get the tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    if (!tenant.approved || !tenant.subdomain) {
      return NextResponse.json(
        { message: 'Tenant must be approved with a subdomain to resend emails' },
        { status: 400 }
      )
    }

    // First, find the admin role for this tenant
    const adminRoles = await payload.find({
      collection: 'tenant-roles',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            isSystemRole: {
              equals: true,
            },
          },
        ],
      },
      limit: 1,
    })

    if (adminRoles.totalDocs === 0) {
      return NextResponse.json(
        { message: 'Admin role not found for this tenant' },
        { status: 404 }
      )
    }

    const adminRole = adminRoles.docs[0]

    // Find the tenant user with the admin role
    const tenantUsers = await payload.find({
      collection: 'tenant-users',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            role: {
              equals: adminRole.id,
            },
          },
        ],
      },
      depth: 1,
      limit: 1,
    })

    if (tenantUsers.docs.length === 0) {
      return NextResponse.json(
        { message: 'No admin user found for this tenant' },
        { status: 404 }
      )
    }

    const tenantUser = tenantUsers.docs[0]
    let loginPassword = ''

    // If credentials type, regenerate password
    if (emailType === 'credentials') {
      loginPassword = `Temp${Math.random().toString(36).slice(-8)}!`
      
      // Update the tenant user password
      await payload.update({
        collection: 'tenant-users',
        id: tenantUser.id,
        data: {
          password: loginPassword,
        },
      })
    } else {
      // For approval type, we can't retrieve the original password (it's hashed)
      // So we'll generate a new temporary password
      loginPassword = `Temp${Math.random().toString(36).slice(-8)}!`
      
      // Update the tenant user password
      await payload.update({
        collection: 'tenant-users',
        id: tenantUser.id,
        data: {
          password: loginPassword,
        },
      })
    }

    // Send email
    try {
      const emailContent = getTenantApprovalEmail({
        companyName: tenant.companyName as string,
        email: tenant.email as string,
        subdomain: tenant.subdomain as string,
        loginEmail: tenantUser.email as string,
        loginPassword,
      })

      await payload.sendEmail({
        to: tenant.email as string,
        from: process.env.EMAIL_FROM || 'no-reply@localhost',
        subject: emailType === 'credentials' 
          ? `Your Login Credentials - ${tenant.companyName}` 
          : emailContent.subject,
        html: emailContent.html,
      })

      return NextResponse.json({
        success: true,
        message: `Email sent successfully`,
        emailType,
        credentials: {
          email: tenantUser.email,
          password: loginPassword,
          subdomain: tenant.subdomain,
        },
      })
    } catch (emailError) {
      console.error('Error sending email:', emailError)
      return NextResponse.json(
        { message: 'Failed to send email', error: String(emailError) },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error resending email:', error)
    return NextResponse.json(
      { message: 'Failed to resend email' },
      { status: 500 }
    )
  }
}

