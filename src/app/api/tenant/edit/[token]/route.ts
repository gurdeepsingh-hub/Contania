import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getTenantRequestNotificationEmail } from '@/lib/email-templates'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const payload = await getPayload({ config })
    const { token } = await params

    // Find tenant by edit token
    const tenants = await payload.find({
      collection: 'tenants',
      where: {
        editToken: {
          equals: token,
        },
      },
      limit: 1,
    })

    if (tenants.docs.length === 0) {
      return NextResponse.json(
        { message: 'Invalid or expired edit token' },
        { status: 404 }
      )
    }

    const tenant = tenants.docs[0]

    // Check if token is expired
    if (tenant.editTokenExpiresAt) {
      const expirationDate = new Date(tenant.editTokenExpiresAt as string)
      const now = new Date()
      if (now > expirationDate) {
        return NextResponse.json(
          { message: 'Edit token has expired' },
          { status: 400 }
        )
      }
    }

    // Check if tenant is in correct status
    if (tenant.status !== 'needs_correction') {
      return NextResponse.json(
        { message: 'This edit link is no longer valid' },
        { status: 400 }
      )
    }

    // Return tenant data (excluding sensitive fields)
    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        companyName: tenant.companyName,
        fullName: tenant.fullName,
        abn: tenant.abn,
        acn: tenant.acn,
        website: tenant.website,
        scac: tenant.scac,
        email: tenant.email,
        phone: tenant.phone,
        fax: tenant.fax,
        address: tenant.address,
        emails: tenant.emails,
        dataRegion: tenant.dataRegion,
        emailPreferences: tenant.emailPreferences,
        revertReason: tenant.revertReason,
      },
    })
  } catch (error) {
    console.error('Error fetching tenant for edit:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant data' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const payload = await getPayload({ config })
    const { token } = await params
    const body = await request.json()

    // Find tenant by edit token
    const tenants = await payload.find({
      collection: 'tenants',
      where: {
        editToken: {
          equals: token,
        },
      },
      limit: 1,
    })

    if (tenants.docs.length === 0) {
      return NextResponse.json(
        { message: 'Invalid or expired edit token' },
        { status: 404 }
      )
    }

    const tenant = tenants.docs[0]

    // Check if token is expired
    if (tenant.editTokenExpiresAt) {
      const expirationDate = new Date(tenant.editTokenExpiresAt as string)
      const now = new Date()
      if (now > expirationDate) {
        return NextResponse.json(
          { message: 'Edit token has expired' },
          { status: 400 }
        )
      }
    }

    // Check if tenant is in correct status
    if (tenant.status !== 'needs_correction') {
      return NextResponse.json(
        { message: 'This edit link is no longer valid' },
        { status: 400 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      companyName: body.companyName,
      fullName: body.fullName || body.companyName,
      email: body.email,
      status: 'pending', // Reset to pending after corrections
      editToken: null, // Clear the token after submission
      editTokenExpiresAt: null, // Clear expiration
      revertReason: null, // Clear the reason
    }

    // Optional fields
    if (body.abn !== undefined) updateData.abn = body.abn || undefined
    if (body.acn !== undefined) updateData.acn = body.acn || undefined
    if (body.website !== undefined) updateData.website = body.website || undefined
    if (body.scac !== undefined) updateData.scac = body.scac || undefined
    if (body.phone !== undefined) updateData.phone = body.phone || undefined
    if (body.fax !== undefined) updateData.fax = body.fax || undefined
    if (body.address !== undefined) updateData.address = body.address || undefined
    if (body.emails !== undefined) updateData.emails = body.emails || undefined
    if (body.dataRegion !== undefined) updateData.dataRegion = body.dataRegion
    if (body.emailPreferences !== undefined) updateData.emailPreferences = body.emailPreferences

    // Update tenant
    const updatedTenant = await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: updateData,
    })

    // Send notification email to super admins
    try {
      const superAdmins = await payload.find({
        collection: 'users',
        where: {
          role: {
            equals: 'superadmin',
          },
        },
      })

      for (const admin of superAdmins.docs) {
        if (admin.email) {
          const emailContent = getTenantRequestNotificationEmail({
            companyName: updatedTenant.companyName as string,
            email: updatedTenant.email as string,
            phone: updatedTenant.phone as string | null,
            createdAt: updatedTenant.createdAt as string,
          })

          await payload.sendEmail({
            to: admin.email,
            from: process.env.EMAIL_FROM || 'no-reply@localhost',
            subject: `Tenant Registration Updated: ${updatedTenant.companyName}`,
            html: `
              <h2>Tenant Registration Updated</h2>
              <p>The tenant <strong>${updatedTenant.companyName}</strong> has submitted corrected information.</p>
              <p>Please review the updated registration in the admin dashboard.</p>
              ${emailContent.html}
            `,
          })
        }
      }
    } catch (emailError) {
      console.error('Error sending notification email to super admins:', emailError)
      // Don't fail the update if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Tenant information updated successfully. Your corrections have been submitted for review.',
      tenant: {
        id: updatedTenant.id,
        companyName: updatedTenant.companyName,
        status: updatedTenant.status,
      },
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { message: 'Failed to update tenant information' },
      { status: 500 }
    )
  }
}

