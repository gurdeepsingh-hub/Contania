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
        {
          isDeleted: {
            equals: false,
          },
        },
      ],
    }

    // Add search if provided
    if (search) {
      where.and.push({
        or: [
          {
            name: {
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
            type: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch warehouses for this tenant with pagination
    const warehousesResult = await payload.find({
      collection: 'warehouses',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      warehouses: warehousesResult.docs,
      totalDocs: warehousesResult.totalDocs,
      limit: warehousesResult.limit,
      totalPages: warehousesResult.totalPages,
      page: warehousesResult.page,
      hasPrevPage: warehousesResult.hasPrevPage,
      hasNextPage: warehousesResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching warehouses:', error)
    return NextResponse.json(
      { message: 'Failed to fetch warehouses' },
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
    if (!body.name) {
      return NextResponse.json(
        { message: 'Warehouse name is required' },
        { status: 400 }
      )
    }

    // Create warehouse
    const newWarehouse = await payload.create({
      collection: 'warehouses',
      data: {
        tenantId: tenant.id,
        name: body.name,
        email: body.email || undefined,
        contact_name: body.contact_name || undefined,
        contact_phone: body.contact_phone || undefined,
        street: body.street || undefined,
        city: body.city || undefined,
        state: body.state || undefined,
        postcode: body.postcode || undefined,
        store: body.store || undefined,
        type: body.type || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      warehouse: newWarehouse,
    })
  } catch (error) {
    console.error('Error creating warehouse:', error)
    return NextResponse.json(
      { message: 'Failed to create warehouse' },
      { status: 500 }
    )
  }
}

