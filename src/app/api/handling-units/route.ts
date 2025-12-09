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
            abbreviation: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    // Fetch handling units for this tenant with pagination
    const handlingUnitsResult = await payload.find({
      collection: 'handling-units',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      handlingUnits: handlingUnitsResult.docs,
      totalDocs: handlingUnitsResult.totalDocs,
      limit: handlingUnitsResult.limit,
      totalPages: handlingUnitsResult.totalPages,
      page: handlingUnitsResult.page,
      hasPrevPage: handlingUnitsResult.hasPrevPage,
      hasNextPage: handlingUnitsResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching handling units:', error)
    return NextResponse.json(
      { message: 'Failed to fetch handling units' },
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
        { message: 'Name is required' },
        { status: 400 }
      )
    }

    // Create handling unit
    const newHandlingUnit = await payload.create({
      collection: 'handling-units',
      data: {
        tenantId: tenant.id,
        name: body.name,
        abbreviation: body.abbreviation || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      handlingUnit: newHandlingUnit,
    })
  } catch (error) {
    console.error('Error creating handling unit:', error)
    return NextResponse.json(
      { message: 'Failed to create handling unit' },
      { status: 500 }
    )
  }
}

