import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    let context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get pagination parameters from query string
    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1
    const search = url.searchParams.get('search') || ''
    const sort = url.searchParams.get('sort') || '-createdAt'
    const status = url.searchParams.get('status') || ''

    // Build where clause
    const where: any = {
      and: [
        {
          tenantId: {
            equals: tenant.id,
          },
        },
      ],
    }

    // Add status filter if provided
    if (status) {
      where.and.push({
        status: {
          equals: status,
        },
      })
    }

    // Add search if provided
    if (search) {
      where.and.push({
        or: [
          {
            bookingCode: {
              contains: search,
            },
          },
          {
            customerReference: {
              contains: search,
            },
          },
          {
            bookingReference: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch export container bookings for this tenant with pagination
    const bookingsResult = await payload.find({
      collection: 'export-container-bookings',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      exportContainerBookings: bookingsResult.docs,
      totalDocs: bookingsResult.totalDocs,
      limit: bookingsResult.limit,
      totalPages: bookingsResult.totalPages,
      page: bookingsResult.page,
      hasPrevPage: bookingsResult.hasPrevPage,
      hasNextPage: bookingsResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching export container bookings:', error)
    return NextResponse.json(
      { message: 'Failed to fetch export container bookings' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    // Validate required fields
    if (!body.customerReference || !body.bookingReference) {
      return NextResponse.json(
        { message: 'Customer reference and booking reference are required' },
        { status: 400 }
      )
    }

    // Create export container booking
    const newBooking = await payload.create({
      collection: 'export-container-bookings',
      data: {
        tenantId: tenant.id,
        customerReference: body.customerReference,
        bookingReference: body.bookingReference,
        chargeToId: body.chargeToId,
        consignorId: body.consignorId,
        vesselId: body.vesselId,
        // Export fields
        etd: body.etd,
        receivalStart: body.receivalStart,
        cutoff: body.cutoff,
        // Step 3 fields
        fromId: body.fromId,
        toId: body.toId,
        containerSizeIds: body.containerSizeIds,
        containerQuantities: body.containerQuantities,
        // Step 4 fields
        emptyRouting: body.emptyRouting,
        fullRouting: body.fullRouting,
        // Additional fields
        instructions: body.instructions,
        jobNotes: body.jobNotes,
        releaseNumber: body.releaseNumber,
        weight: body.weight,
        driverAllocation: body.driverAllocation,
        status: body.status || 'draft',
      },
    })

    return NextResponse.json({
      success: true,
      exportContainerBooking: newBooking,
    })
  } catch (error) {
    console.error('Error creating export container booking:', error)
    return NextResponse.json(
      { message: 'Failed to create export container booking' },
      { status: 500 }
    )
  }
}

