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
    }

    // Add search if provided
    if (search) {
      where.and.push({
        or: [
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
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch customers (consignee/consignors) for this tenant with pagination
    const customersResult = await payload.find({
      collection: 'customers',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      customers: customersResult.docs,
      totalDocs: customersResult.totalDocs,
      limit: customersResult.limit,
      totalPages: customersResult.totalPages,
      page: customersResult.page,
      hasPrevPage: customersResult.hasPrevPage,
      hasNextPage: customersResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { message: 'Failed to fetch customers' },
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

    // Create customer (consignee/consignor)
    const newCustomer = await payload.create({
      collection: 'customers',
      data: {
        tenantId: tenant.id,
        customer_name: body.customer_name,
        email: body.email || undefined,
        contact_name: body.contact_name || undefined,
        contact_phone: body.contact_phone || undefined,
        street: body.street || undefined,
        city: body.city || undefined,
        state: body.state || undefined,
        postcode: body.postcode || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      customer: newCustomer,
    })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { message: 'Failed to create customer' },
      { status: 500 }
    )
  }
}

