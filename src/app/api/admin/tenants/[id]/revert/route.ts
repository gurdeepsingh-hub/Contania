import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantRevertEmail } from '@/lib/email-templates'
import { randomBytes } from 'crypto'

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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await isSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { payload } = auth
    const resolvedParams = await params
    const tenantId = Number(resolvedParams.id)
    const body = await request.json()
    const { reason } = body

    // Get the tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    if (tenant.approved) {
      return NextResponse.json(
        { message: 'Cannot revert an approved tenant. Please reject instead.' },
        { status: 400 },
      )
    }

    // Generate secure token
    const editToken = randomBytes(32).toString('hex')

    // Set token expiration (7 days from now)
    const editTokenExpiresAt = new Date()
    editTokenExpiresAt.setDate(editTokenExpiresAt.getDate() + 7)

    // Update tenant with token, expiration, status, and reason
    const updatedTenant = await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        status: 'needs_correction',
        editToken,
        editTokenExpiresAt: editTokenExpiresAt.toISOString(),
        revertReason: reason || undefined,
      },
    })

    // Generate edit link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SERVER_URL ||
      'http://localhost:3000'
    const editLink = `/tenant/edit/${editToken}`

    // Send email with edit link
    let emailSent = false
    let emailError: Error | null = null
    try {
      const emailContent = getTenantRevertEmail({
        companyName: tenant.companyName as string,
        email: tenant.email as string,
        editLink,
        reason: reason || undefined,
      })

      await payload.sendEmail({
        to: tenant.email as string,
        from: process.env.EMAIL_FROM || 'no-reply@localhost',
        subject: emailContent.subject,
        html: emailContent.html,
      })
      emailSent = true
    } catch (err) {
      emailError = err instanceof Error ? err : new Error(String(err))
      console.error('Error sending revert email:', emailError)
      // Log detailed error for debugging
      console.error('Email error details:', {
        to: tenant.email,
        from: process.env.EMAIL_FROM,
        error: emailError.message,
        stack: emailError.stack,
      })
    }

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
      message: emailSent
        ? 'Tenant revert request sent successfully'
        : 'Tenant revert request created, but email failed to send. Please check email configuration.',
      editLink: `${baseUrl}${editLink}`,
      emailSent,
      emailError: emailError ? emailError.message : undefined,
    })
  } catch (error) {
    console.error('Error reverting tenant:', error)
    return NextResponse.json({ message: 'Failed to revert tenant' }, { status: 500 })
  }
}
