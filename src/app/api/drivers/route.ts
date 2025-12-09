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
            phoneNumber: {
              contains: search,
            },
          },
          {
            drivingLicenceNumber: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch drivers for this tenant with pagination
    const driversResult = await payload.find({
      collection: 'drivers',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      drivers: driversResult.docs,
      totalDocs: driversResult.totalDocs,
      limit: driversResult.limit,
      totalPages: driversResult.totalPages,
      page: driversResult.page,
      hasPrevPage: driversResult.hasPrevPage,
      hasNextPage: driversResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching drivers:', error)
    return NextResponse.json(
      { message: 'Failed to fetch drivers' },
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
    if (!body.name || !body.phoneNumber || !body.employeeType || !body.drivingLicenceNumber) {
      return NextResponse.json(
        { message: 'Name, phone number, employee type, and driving licence number are required' },
        { status: 400 }
      )
    }

    // Create driver
    const newDriver = await payload.create({
      collection: 'drivers',
      data: {
        tenantId: tenant.id,
        name: body.name,
        phoneNumber: body.phoneNumber,
        vehicleId: body.vehicleId || undefined,
        defaultDepotId: body.defaultDepotId || undefined,
        abn: body.abn || undefined,
        addressStreet: body.addressStreet || undefined,
        city: body.city || undefined,
        state: body.state || undefined,
        postcode: body.postcode || undefined,
        employeeType: body.employeeType,
        drivingLicenceNumber: body.drivingLicenceNumber,
        licenceExpiry: body.licenceExpiry || undefined,
        licencePhotoUrl: body.licencePhotoUrl || undefined,
        dangerousGoodsCertNumber: body.dangerousGoodsCertNumber || undefined,
        dangerousGoodsCertExpiry: body.dangerousGoodsCertExpiry || undefined,
        msicNumber: body.msicNumber || undefined,
        msicExpiry: body.msicExpiry || undefined,
        msicPhotoUrl: body.msicPhotoUrl || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      driver: newDriver,
    })
  } catch (error) {
    console.error('Error creating driver:', error)
    return NextResponse.json(
      { message: 'Failed to create driver' },
      { status: 500 }
    )
  }
}

