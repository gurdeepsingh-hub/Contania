import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Get depth parameter
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Fetch container details for this booking (polymorphic relationship)
    const detailsResult = await payload.find({
      collection: 'container-details',
      where: {
        containerBookingId: {
          equals: bookingId,
        },
      },
      depth,
    })

    // Filter to ensure they're linked to this export booking
    const filteredDetails = detailsResult.docs.filter((detail) => {
      const detailBookingId =
        typeof (detail as { containerBookingId?: number | { id: number; relationTo?: string } })
          .containerBookingId === 'object'
          ? (detail as { containerBookingId: { id: number; relationTo?: string } }).containerBookingId
          : null

      if (detailBookingId && typeof detailBookingId === 'object') {
        return (
          detailBookingId.id === bookingId &&
          detailBookingId.relationTo === 'export-container-bookings'
        )
      }
      return false
    })

    return NextResponse.json({
      success: true,
      containerDetails: filteredDetails,
      totalDocs: filteredDetails.length,
    })
  } catch (error) {
    console.error('Error fetching container details:', error)
    return NextResponse.json(
      { message: 'Failed to fetch container details' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const body = await request.json()

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Validate required fields
    if (!body.containerNumber || !body.containerSizeId) {
      return NextResponse.json(
        { message: 'Container number and container size are required' },
        { status: 400 }
      )
    }

    // Create container detail with polymorphic relationship
    const newDetail = await payload.create({
      collection: 'container-details',
      data: {
        containerBookingId: {
          relationTo: 'export-container-bookings',
          value: bookingId,
        },
        containerNumber: body.containerNumber,
        containerSizeId: body.containerSizeId,
        gross: body.gross,
        tare: body.tare,
        net: body.net,
        pin: body.pin,
        whManifest: body.whManifest,
        isoCode: body.isoCode,
        timeSlot: body.timeSlot,
        emptyTimeSlot: body.emptyTimeSlot,
        dehireDate: body.dehireDate,
        shippingLineId: body.shippingLineId,
        countryOfOrigin: body.countryOfOrigin,
        orderRef: body.orderRef,
        jobAvailability: body.jobAvailability,
        sealNumber: body.sealNumber,
        customerRequestDate: body.customerRequestDate,
        dock: body.dock,
        confirmedUnpackDate: body.confirmedUnpackDate,
        yardLocation: body.yardLocation,
        secureSealsIntact: body.secureSealsIntact,
        inspectUnpack: body.inspectUnpack,
        directionType: body.directionType,
        houseBillNumber: body.houseBillNumber,
        oceanBillNumber: body.oceanBillNumber,
        ventAirflow: body.ventAirflow,
      },
    })

    return NextResponse.json({
      success: true,
      containerDetail: newDetail,
    })
  } catch (error) {
    console.error('Error creating container detail:', error)
    return NextResponse.json(
      { message: 'Failed to create container detail' },
      { status: 500 }
    )
  }
}

