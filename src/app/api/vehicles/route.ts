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
          {
            gpsId: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch vehicles for this tenant with pagination
    const vehiclesResult = await payload.find({
      collection: 'vehicles',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      vehicles: vehiclesResult.docs,
      totalDocs: vehiclesResult.totalDocs,
      limit: vehiclesResult.limit,
      totalPages: vehiclesResult.totalPages,
      page: vehiclesResult.page,
      hasPrevPage: vehiclesResult.hasPrevPage,
      hasNextPage: vehiclesResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { message: 'Failed to fetch vehicles' },
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

    // Create vehicle
    const newVehicle = await payload.create({
      collection: 'vehicles',
      data: {
        tenantId: tenant.id,
        fleetNumber: body.fleetNumber,
        rego: body.rego,
        regoExpiryDate: body.regoExpiryDate || undefined,
        gpsId: body.gpsId || undefined,
        description: body.description || undefined,
        defaultDepotId: body.defaultDepotId || undefined,
        aTrailerId: body.aTrailerId || undefined,
        bTrailerId: body.bTrailerId || undefined,
        cTrailerId: body.cTrailerId || undefined,
        sideloader: body.sideloader || false,
      },
    })

    return NextResponse.json({
      success: true,
      vehicle: newVehicle,
    })
  } catch (error) {
    console.error('Error creating vehicle:', error)
    return NextResponse.json(
      { message: 'Failed to create vehicle' },
      { status: 500 }
    )
  }
}

