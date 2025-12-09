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
            fleetNumber: {
              contains: search,
            },
          },
          {
            rego: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch trailers for this tenant with pagination
    const trailersResult = await payload.find({
      collection: 'trailers',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      trailers: trailersResult.docs,
      totalDocs: trailersResult.totalDocs,
      limit: trailersResult.limit,
      totalPages: trailersResult.totalPages,
      page: trailersResult.page,
      hasPrevPage: trailersResult.hasPrevPage,
      hasNextPage: trailersResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching trailers:', error)
    return NextResponse.json(
      { message: 'Failed to fetch trailers' },
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
    if (!body.fleetNumber || !body.rego) {
      return NextResponse.json(
        { message: 'Fleet number and registration are required' },
        { status: 400 }
      )
    }

    // Create trailer
    const newTrailer = await payload.create({
      collection: 'trailers',
      data: {
        tenantId: tenant.id,
        fleetNumber: body.fleetNumber,
        rego: body.rego,
        regoExpiryDate: body.regoExpiryDate || undefined,
        trailerTypeId: body.trailerTypeId || undefined,
        maxWeightKg: body.maxWeightKg || undefined,
        maxCubeM3: body.maxCubeM3 || undefined,
        maxPallet: body.maxPallet || undefined,
        defaultWarehouseId: body.defaultWarehouseId || undefined,
        dangerousCertNumber: body.dangerousCertNumber || undefined,
        dangerousCertExpiry: body.dangerousCertExpiry || undefined,
        description: body.description || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      trailer: newTrailer,
    })
  } catch (error) {
    console.error('Error creating trailer:', error)
    return NextResponse.json(
      { message: 'Failed to create trailer' },
      { status: 500 }
    )
  }
}

