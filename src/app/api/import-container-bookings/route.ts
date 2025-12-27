import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'containers_view')
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

    // Fetch import container bookings for this tenant with pagination
    const bookingsResult = await payload.find({
      collection: 'import-container-bookings',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      importContainerBookings: bookingsResult.docs,
      totalDocs: bookingsResult.totalDocs,
      limit: bookingsResult.limit,
      totalPages: bookingsResult.totalPages,
      page: bookingsResult.page,
      hasPrevPage: bookingsResult.hasPrevPage,
      hasNextPage: bookingsResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching import container bookings:', error)
    return NextResponse.json(
      { message: 'Failed to fetch import container bookings' },
      { status: 500 },
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
        { status: 400 },
      )
    }

    // Prepare data object, only including defined values
    const bookingData: any = {
      tenantId: tenant.id,
      customerReference: body.customerReference,
      bookingReference: body.bookingReference,
      status: body.status || 'draft',
    }

    // Add optional fields only if they have valid values
    // For draft status, these fields are optional, so only include if they have valid values
    if (
      body.chargeToId !== undefined &&
      body.chargeToId !== null &&
      body.chargeToId !== '' &&
      body.chargeToId !== 0
    ) {
      // Validate it's a valid number
      const chargeToIdNum =
        typeof body.chargeToId === 'number'
          ? body.chargeToId
          : parseInt(String(body.chargeToId), 10)
      if (!isNaN(chargeToIdNum) && chargeToIdNum > 0) {
        bookingData.chargeToId = chargeToIdNum
      }
    }
    if (body.chargeToCollection) {
      bookingData.chargeToCollection = body.chargeToCollection
    }
    if (body.chargeToContactName) {
      bookingData.chargeToContactName = body.chargeToContactName
    }
    if (body.chargeToContactNumber) {
      bookingData.chargeToContactNumber = body.chargeToContactNumber
    }
    if (
      body.consigneeId !== undefined &&
      body.consigneeId !== null &&
      body.consigneeId !== '' &&
      body.consigneeId !== 0
    ) {
      const consigneeIdNum =
        typeof body.consigneeId === 'number'
          ? body.consigneeId
          : parseInt(String(body.consigneeId), 10)
      if (!isNaN(consigneeIdNum) && consigneeIdNum > 0) {
        bookingData.consigneeId = consigneeIdNum
      }
    }
    if (body.vesselId !== undefined && body.vesselId !== null) {
      bookingData.vesselId = body.vesselId
    }
    if (body.eta) {
      bookingData.eta = body.eta
    }
    if (body.availability !== undefined) {
      bookingData.availability = body.availability
    }
    if (body.storageStart) {
      bookingData.storageStart = body.storageStart
    }
    if (body.firstFreeImportDate) {
      bookingData.firstFreeImportDate = body.firstFreeImportDate
    }
    if (
      body.fromId !== undefined &&
      body.fromId !== null &&
      body.fromId !== '' &&
      body.fromId !== 0
    ) {
      const fromIdNum =
        typeof body.fromId === 'number' ? body.fromId : parseInt(String(body.fromId), 10)
      if (!isNaN(fromIdNum) && fromIdNum > 0) {
        bookingData.fromId = fromIdNum
      }
    }
    if (body.toId !== undefined && body.toId !== null && body.toId !== '' && body.toId !== 0) {
      const toIdNum = typeof body.toId === 'number' ? body.toId : parseInt(String(body.toId), 10)
      if (!isNaN(toIdNum) && toIdNum > 0) {
        bookingData.toId = toIdNum
      }
    }
    if (
      body.containerSizeIds &&
      Array.isArray(body.containerSizeIds) &&
      body.containerSizeIds.length > 0
    ) {
      bookingData.containerSizeIds = body.containerSizeIds
    }
    if (body.containerQuantities && Object.keys(body.containerQuantities).length > 0) {
      bookingData.containerQuantities = body.containerQuantities
    }
    if (body.emptyRouting) {
      bookingData.emptyRouting = body.emptyRouting
    }
    if (body.fullRouting) {
      bookingData.fullRouting = body.fullRouting
    }
    if (body.instructions) {
      bookingData.instructions = body.instructions
    }
    if (body.jobNotes) {
      bookingData.jobNotes = body.jobNotes
    }
    if (body.driverAllocation) {
      bookingData.driverAllocation = body.driverAllocation
    }

    // Create import container booking
    const newBooking = await payload.create({
      collection: 'import-container-bookings',
      data: bookingData,
    })

    return NextResponse.json({
      success: true,
      importContainerBooking: newBooking,
    })
  } catch (error) {
    console.error('Error creating import container booking:', error)
    return NextResponse.json(
      { message: 'Failed to create import container booking' },
      { status: 500 },
    )
  }
}
