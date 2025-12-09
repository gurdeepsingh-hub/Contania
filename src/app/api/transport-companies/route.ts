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
            contact: {
              contains: search,
            },
          },
          {
            mobile: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch transport companies for this tenant with pagination
    const transportCompaniesResult = await payload.find({
      collection: 'transport-companies',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      transportCompanies: transportCompaniesResult.docs,
      totalDocs: transportCompaniesResult.totalDocs,
      limit: transportCompaniesResult.limit,
      totalPages: transportCompaniesResult.totalPages,
      page: transportCompaniesResult.page,
      hasPrevPage: transportCompaniesResult.hasPrevPage,
      hasNextPage: transportCompaniesResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching transport companies:', error)
    return NextResponse.json(
      { message: 'Failed to fetch transport companies' },
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
        { message: 'Transport company name is required' },
        { status: 400 }
      )
    }

    // Create transport company
    const newTransportCompany = await payload.create({
      collection: 'transport-companies',
      data: {
        tenantId: tenant.id,
        name: body.name,
        contact: body.contact || undefined,
        mobile: body.mobile || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      transportCompany: newTransportCompany,
    })
  } catch (error) {
    console.error('Error creating transport company:', error)
    return NextResponse.json(
      { message: 'Failed to create transport company' },
      { status: 500 }
    )
  }
}

