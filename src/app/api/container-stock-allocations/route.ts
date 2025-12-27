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
    const containerDetailId = url.searchParams.get('containerDetailId') || ''

    // Build where clause
    const where: any = {}

    if (bookingId) {
      where.containerBookingId = {
        equals: Number(bookingId),
      }
    }

    if (containerDetailId) {
      where.containerDetailId = {
        equals: Number(containerDetailId),
      }
    }

    // Fetch stock allocations
    const allocationsResult = await payload.find({
      collection: 'container-stock-allocations',
      where,
      depth,
      limit,
      page,
    })

    // Filter by tenant through container booking relationship (polymorphic)
    const allocationChecks = await Promise.all(
      allocationsResult.docs.map(async (allocation) => {
        const bookingRef = (allocation as {
          containerBookingId?: number | { id: number; relationTo?: string }
        }).containerBookingId

        if (!bookingRef) return { allocation, belongsToTenant: false }

        const bookingId =
          typeof bookingRef === 'object' ? bookingRef.id : bookingRef
        const collection =
          typeof bookingRef === 'object' ? bookingRef.relationTo : null

        if (!bookingId || !collection) return { allocation, belongsToTenant: false }

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

            return { allocation, belongsToTenant: bookingTenantId === tenant.id }
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

              return { allocation, belongsToTenant: bookingTenantId === tenant.id }
            }
          } catch (e) {
            // Booking not found in either collection
          }
        }

        return { allocation, belongsToTenant: false }
      })
    )

    const filteredAllocations = allocationChecks
      .filter((check) => check.belongsToTenant)
      .map((check) => check.allocation)

    return NextResponse.json({
      success: true,
      stockAllocations: filteredAllocations,
      totalDocs: resolvedAllocations.length,
      limit: allocationsResult.limit,
      totalPages: allocationsResult.totalPages,
      page: allocationsResult.page,
    })
  } catch (error) {
    console.error('Error fetching stock allocations:', error)
    return NextResponse.json(
      { message: 'Failed to fetch stock allocations' },
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
    if (!body.containerDetailId || !body.containerBookingId) {
      return NextResponse.json(
        { message: 'Container detail ID and booking ID are required' },
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

    // Determine default stage based on collection type
    const defaultStage =
      bookingCollection === 'export-container-bookings' ? 'allocated' : 'expected'

    // Create stock allocation with polymorphic relationship
    const newAllocation = await payload.create({
      collection: 'container-stock-allocations',
      data: {
        containerDetailId: body.containerDetailId,
        containerBookingId: {
          relationTo: bookingCollection,
          value: bookingId,
        },
        stage: body.stage || defaultStage,
        productLines: body.productLines || [],
      },
    })

    return NextResponse.json({
      success: true,
      stockAllocation: newAllocation,
    })
  } catch (error) {
    console.error('Error creating stock allocation:', error)
    return NextResponse.json(
      { message: 'Failed to create stock allocation' },
      { status: 500 }
    )
  }
}

