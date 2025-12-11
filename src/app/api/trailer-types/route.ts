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
            name: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch trailer types for this tenant with pagination
    const trailerTypesResult = await payload.find({
      collection: 'trailer-types',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      trailerTypes: trailerTypesResult.docs,
      totalDocs: trailerTypesResult.totalDocs,
      limit: trailerTypesResult.limit,
      totalPages: trailerTypesResult.totalPages,
      page: trailerTypesResult.page,
      hasPrevPage: trailerTypesResult.hasPrevPage,
      hasNextPage: trailerTypesResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching trailer types:', error)
    return NextResponse.json(
      { message: 'Failed to fetch trailer types' },
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
        { message: 'Trailer type name is required' },
        { status: 400 }
      )
    }

    // Create trailer type
    const newTrailerType = await payload.create({
      collection: 'trailer-types',
      data: {
        tenantId: tenant.id,
        name: body.name,
        maxWeightKg: body.maxWeightKg || undefined,
        maxCubicM3: body.maxCubicM3 || undefined,
        maxPallet: body.maxPallet || undefined,
        trailerA: body.trailerA || false,
        trailerB: body.trailerB || false,
        trailerC: body.trailerC || false,
      },
    })

    return NextResponse.json({
      success: true,
      trailerType: newTrailerType,
    })
  } catch (error) {
    console.error('Error creating trailer type:', error)
    return NextResponse.json(
      { message: 'Failed to create trailer type' },
      { status: 500 }
    )
  }
}

