import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.companyName || !body.email) {
      return NextResponse.json(
        { message: 'Company name and email are required' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Create tenant with approved: false by default
    const tenant = await payload.create({
      collection: 'tenants',
      data: {
        companyName: body.companyName,
        fullName: body.fullName || body.companyName,
        abn: body.abn,
        acn: body.acn,
        website: body.website,
        scac: body.scac,
        email: body.email,
        phone: body.phone,
        fax: body.fax,
        address: body.address
          ? {
              street: body.address.street,
              city: body.address.city,
              state: body.address.state,
              postalCode: body.address.postalCode,
              countryCode: body.address.countryCode || body.address.country,
            }
          : undefined,
        emails: body.emails
          ? {
              account: body.emails.account,
              bookings: body.emails.bookings,
              management: body.emails.management,
              operations: body.emails.operations,
              replyTo: body.emails.replyTo,
            }
          : undefined,
        logo: body.logo,
        businessType: body.businessType,
        dataRegion: body.dataRegion,
        emailPreferences: body.emailPreferences
          ? {
              marketing: body.emailPreferences.marketing || false,
              updates: body.emailPreferences.updates || false,
              system: body.emailPreferences.system !== false, // Default to true
            }
          : undefined,
        privacyConsent: body.privacyConsent || false,
        termsAcceptedAt: body.termsAcceptedAt ? new Date(body.termsAcceptedAt) : undefined,
        approved: false, // Default to not approved
        onboardingStep: 'submitted',
        // Subdomain will be generated on approval (Phase 5)
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Tenant registration submitted successfully',
        tenant: {
          id: tenant.id,
          companyName: tenant.companyName,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Tenant registration error:', error)
    
    // Handle validation errors
    if (error && typeof error === 'object' && 'data' in error) {
      const errorData = error.data as { errors?: Array<{ message?: string }> }
      if (errorData.errors && errorData.errors.length > 0) {
        return NextResponse.json(
          { message: errorData.errors[0].message || 'Validation error' },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { message: 'Failed to submit tenant registration' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const approved = searchParams.get('approved')
    const payload = await getPayload({ config })

    const where: any = {}

    if (approved !== null) {
      where.approved = {
        equals: approved === 'true',
      }
    }

    const tenants = await payload.find({
      collection: 'tenants',
      where,
      limit: 100,
      sort: '-createdAt',
    })

    return NextResponse.json({
      success: true,
      tenants: tenants.docs,
      totalDocs: tenants.totalDocs,
    })
  } catch (error) {
    console.error('Error fetching tenants:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenants' },
      { status: 500 }
    )
  }
}
