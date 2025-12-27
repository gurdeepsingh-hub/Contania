import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get pagination parameters
    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1
    const bookingId = url.searchParams.get('bookingId') || ''

    // Build where clause - filter through container booking tenant
    const where: any = {}

    if (bookingId) {
      where.containerBookingId = {
        equals: Number(bookingId),
      }
    }

    // Fetch container details
    const detailsResult = await payload.find({
      collection: 'container-details',
      where,
      depth,
      limit,
      page,
    })

    // Filter by tenant through container booking relationship (polymorphic)
    const filteredDetails = await Promise.all(
      detailsResult.docs.map(async (detail) => {
        const bookingRef = (detail as {
          containerBookingId?: number | { id: number; relationTo?: string }
        }).containerBookingId

        if (!bookingRef) return { detail, belongsToTenant: false }

        const bookingId =
          typeof bookingRef === 'object' ? bookingRef.id : bookingRef
        const collection =
          typeof bookingRef === 'object' ? bookingRef.relationTo : null

        if (!bookingId || !collection) return { detail, belongsToTenant: false }

        // Try to fetch from the specified collection
        try {
          const booking = await payload.findByID({
            collection: collection as 'import-container-bookings' | 'export-container-bookings',
            id: bookingId,
          })

          if (booking) {
            const bookingTenantId =
              typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
                ? (booking as { tenantId: { id: number } }).tenantId.id
                : (booking as { tenantId?: number }).tenantId

            return { detail, belongsToTenant: bookingTenantId === tenant.id }
          }
        } catch (error) {
          // If collection doesn't match, try the other one
          const otherCollection =
            collection === 'import-container-bookings'
              ? 'export-container-bookings'
              : 'import-container-bookings'
          try {
            const booking = await payload.findByID({
              collection: otherCollection,
              id: bookingId,
            })

            if (booking) {
              const bookingTenantId =
                typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
                  ? (booking as { tenantId: { id: number } }).tenantId.id
                  : (booking as { tenantId?: number }).tenantId

              return { detail, belongsToTenant: bookingTenantId === tenant.id }
            }
          } catch (e) {
            // Booking not found in either collection
          }
        }

        return { detail, belongsToTenant: false }
      }),
    )

    const validDetails = filteredDetails
      .filter((item) => item.belongsToTenant)
      .map((item) => item.detail)

    return NextResponse.json({
      success: true,
      containerDetails: validDetails,
      totalDocs: validDetails.length,
      limit: detailsResult.limit,
      totalPages: detailsResult.totalPages,
      page: detailsResult.page,
    })
  } catch (error) {
    console.error('Error fetching container details:', error)
    return NextResponse.json(
      { message: 'Failed to fetch container details' },
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
    if (!body.containerBookingId || !body.containerNumber || !body.containerSizeId) {
      return NextResponse.json(
        { message: 'Container booking ID, container number, and container size are required' },
        { status: 400 }
      )
    }

    // Handle polymorphic booking relationship
    let bookingId: number
    let bookingCollection: 'import-container-bookings' | 'export-container-bookings'

    if (typeof body.containerBookingId === 'object' && body.containerBookingId.relationTo) {
      // Polymorphic format: { relationTo: 'import-container-bookings', value: 123 }
      bookingCollection = body.containerBookingId.relationTo as
        | 'import-container-bookings'
        | 'export-container-bookings'
      bookingId = body.containerBookingId.value
    } else {
      // Try to determine collection from bookingId
      bookingId = Number(body.containerBookingId)
      // Try import first, then export
      let booking = null
      try {
        booking = await payload.findByID({
          collection: 'import-container-bookings',
          id: bookingId,
        })
        bookingCollection = 'import-container-bookings'
      } catch {
        try {
          booking = await payload.findByID({
            collection: 'export-container-bookings',
            id: bookingId,
          })
          bookingCollection = 'export-container-bookings'
        } catch {
          return NextResponse.json({ message: 'Container booking not found' }, { status: 404 })
        }
      }
    }

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: bookingCollection,
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Create container detail with polymorphic relationship
    const newDetail = await payload.create({
      collection: 'container-details',
      data: {
        containerBookingId: {
          relationTo: bookingCollection,
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

