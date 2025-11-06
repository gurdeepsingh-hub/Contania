import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { generateUniqueSubdomain, slugify } from '@/lib/subdomain'
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
  { params }: { params: { id: string } }
) {
  try {
    const auth = await isSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { payload, user } = auth
    const tenantId = Number(params.id)

    // Get the tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    if (tenant.approved) {
      return NextResponse.json({ message: 'Tenant already approved' }, { status: 400 })
    }

    // Generate unique subdomain
    const checkSubdomainUniqueness = async (subdomain: string) => {
      const existing = await payload.find({
        collection: 'tenants',
        where: {
          subdomain: {
            equals: subdomain,
          },
        },
        limit: 1,
      })
      return existing.docs.length === 0
    }

    const subdomain = await generateUniqueSubdomain(
      tenant.companyName,
      checkSubdomainUniqueness
    )

    // Generate a temporary password for the initial tenant user
    const tempPassword = `Temp${Math.random().toString(36).slice(-8)}!`

    // Create initial tenant user (company admin)
    const tenantUser = await payload.create({
      collection: 'tenant-users',
      data: {
        tenantId: tenant.id,
        fullName: tenant.companyName + ' Admin',
        email: tenant.email,
        userGroup: 'Admin',
        password: tempPassword,
      },
    })

    // Update tenant with subdomain and approval
    const updatedTenant = await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        approved: true,
        approvedBy: user.id,
        subdomain,
      },
    })

    // Send approval email with credentials
    try {
      const emailContent = getTenantApprovalEmail({
        companyName: tenant.companyName,
        email: tenant.email,
        subdomain,
        loginEmail: tenantUser.email,
        loginPassword: tempPassword,
      })

      await payload.sendEmail({
        to: tenant.email,
        from: process.env.EMAIL_FROM || 'no-reply@localhost',
        subject: emailContent.subject,
        html: emailContent.html,
      })
    } catch (emailError) {
      console.error('Error sending approval email:', emailError)
      // Don't fail the approval if email fails
    }

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
      credentials: {
        email: tenantUser.email,
        password: tempPassword,
        subdomain,
      },
      message: 'Tenant approved successfully',
    })
  } catch (error) {
    console.error('Error approving tenant:', error)
    return NextResponse.json(
      { message: 'Failed to approve tenant' },
      { status: 500 }
    )
  }
}

