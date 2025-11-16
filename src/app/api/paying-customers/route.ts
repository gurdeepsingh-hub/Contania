import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get pagination parameters from query string
    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0
    const search = url.searchParams.get('search') || ''
    const sort = url.searchParams.get('sort') || '-createdAt'

    // Build where clause
    const where: any = {
      tenantId: {
        equals: tenant.id,
      },
    }

    // Add search if provided
    if (search) {
      where.or = [
        {
          customer_name: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
          },
        },
        {
          contact_name: {
            contains: search,
          },
        },
        {
          abn: {
            contains: search,
          },
        },
      ]
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch paying customers for this tenant with pagination
    const payingCustomersResult = await payload.find({
      collection: 'paying-customers',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      payingCustomers: payingCustomersResult.docs,
      totalDocs: payingCustomersResult.totalDocs,
      limit: payingCustomersResult.limit,
      totalPages: payingCustomersResult.totalPages,
      page: payingCustomersResult.page,
      hasPrevPage: payingCustomersResult.hasPrevPage,
      hasNextPage: payingCustomersResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching paying customers:', error)
    return NextResponse.json(
      { message: 'Failed to fetch paying customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    // Validate required fields
    if (!body.customer_name) {
      return NextResponse.json(
        { message: 'Customer name is required' },
        { status: 400 }
      )
    }

    // Create paying customer
    const newPayingCustomer = await payload.create({
      collection: 'paying-customers',
      data: {
        tenantId: tenant.id,
        customer_name: body.customer_name,
        abn: body.abn || undefined,
        email: body.email || undefined,
        contact_name: body.contact_name || undefined,
        contact_phone: body.contact_phone || undefined,
        billing_street: body.billing_street || undefined,
        billing_city: body.billing_city || undefined,
        billing_state: body.billing_state || undefined,
        billing_postcode: body.billing_postcode || undefined,
        delivery_same_as_billing: body.delivery_same_as_billing || false,
        delivery_street: body.delivery_street || undefined,
        delivery_city: body.delivery_city || undefined,
        delivery_state: body.delivery_state || undefined,
        delivery_postcode: body.delivery_postcode || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      payingCustomer: newPayingCustomer,
    })
  } catch (error) {
    console.error('Error creating paying customer:', error)
    return NextResponse.json(
      { message: 'Failed to create paying customer' },
      { status: 500 }
    )
  }
}

