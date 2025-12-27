import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const allocationId = Number(resolvedParams.allocationId)

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Get allocation with depth 2 to include product lines and their relationships
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth: 2,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to the booking
    // Handle polymorphic relationship structure like container-details route does
    const allocationBookingRef = (allocation as any).containerBookingId

    if (allocationBookingRef) {
      let allocationBookingId: number | null = null
      let allocationRelationTo: string | null = null

      // Handle polymorphic relationship structure (same as container-details route)
      if (typeof allocationBookingRef === 'object' && allocationBookingRef !== null) {
        // Payload returns polymorphic relationships with depth=2 as:
        // { relationTo: string, value: { id: number, ... } }
        // OR: { id: number, relationTo: string }
        // The booking ID is nested in value.id or directly in id
        allocationBookingId =
          allocationBookingRef.id || (allocationBookingRef.value && allocationBookingRef.value.id)
        allocationRelationTo = allocationBookingRef.relationTo
      } else if (typeof allocationBookingRef === 'number') {
        allocationBookingId = allocationBookingRef
        allocationRelationTo = 'import-container-bookings' // Assume import if it's just a number
      }

      // Verify booking ID matches and it's an import booking
      if (
        !allocationBookingId ||
        allocationBookingId !== bookingId ||
        allocationRelationTo !== 'import-container-bookings'
      ) {
        return NextResponse.json(
          { message: 'Stock allocation does not belong to this booking' },
          { status: 403 },
        )
      }
    } else {
      // Fallback: verify via container detail
      const containerDetailId =
        typeof (allocation as { containerDetailId?: number | { id: number } }).containerDetailId ===
        'object'
          ? (allocation as { containerDetailId: { id: number } }).containerDetailId.id
          : (allocation as { containerDetailId?: number }).containerDetailId

      if (containerDetailId) {
        const container = await payload.findByID({
          collection: 'container-details',
          id: containerDetailId,
          depth: 1, // Need depth to populate containerBookingId
        })

        if (container) {
          const containerBookingRef = (container as any).containerBookingId
          if (containerBookingRef) {
            let containerBookingId: number | null = null
            let containerRelationTo: string | null = null

            // Handle polymorphic relationship structure
            if (typeof containerBookingRef === 'object' && containerBookingRef !== null) {
              containerBookingId =
                containerBookingRef.id ||
                (containerBookingRef.value && containerBookingRef.value.id)
              containerRelationTo = containerBookingRef.relationTo
            } else if (typeof containerBookingRef === 'number') {
              containerBookingId = containerBookingRef
              containerRelationTo = 'import-container-bookings'
            }

            if (
              !containerBookingId ||
              containerBookingId !== bookingId ||
              containerRelationTo !== 'import-container-bookings'
            ) {
              return NextResponse.json(
                { message: 'Stock allocation does not belong to this booking' },
                { status: 403 },
              )
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      stockAllocation: allocation,
    })
  } catch (error) {
    console.error('Error fetching stock allocation:', error)
    return NextResponse.json({ message: 'Failed to fetch stock allocation' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const allocationId = Number(resolvedParams.allocationId)
    const body = await request.json()

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Get existing allocation
    const existingAllocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
    })

    if (!existingAllocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Update allocation
    const updatedAllocation = await payload.update({
      collection: 'container-stock-allocations',
      id: allocationId,
      data: {
        ...body,
        containerBookingId: {
          relationTo: 'import-container-bookings',
          value: bookingId,
        },
      },
    })

    // Fetch the updated allocation with depth 2 to include product lines and their relationships
    let allocationWithDepth = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth: 2,
    })

    // Check if all product lines have received values and update container status
    const containerDetailId =
      typeof allocationWithDepth.containerDetailId === 'object'
        ? allocationWithDepth.containerDetailId.id
        : allocationWithDepth.containerDetailId

    if (containerDetailId && allocationWithDepth.productLines) {
      const allProductLinesHaveReceivedValues = allocationWithDepth.productLines.every(
        (line: any) => line.recievedQty && line.recievedQty > 0,
      )

      if (allProductLinesHaveReceivedValues) {
        // Update allocation stage to 'received' if it's currently 'expected'
        if (allocationWithDepth.stage === 'expected') {
          await payload.update({
            collection: 'container-stock-allocations',
            id: allocationId,
            data: {
              stage: 'received',
            },
          })
          // Refetch allocation with updated stage
          allocationWithDepth = await payload.findByID({
            collection: 'container-stock-allocations',
            id: allocationId,
            depth: 2,
          })
        }

        // Get current container status
        const container = await payload.findByID({
          collection: 'container-details',
          id: containerDetailId,
        })

        // Update container status to 'received' if it's currently 'expecting'
        if (container && (container as any).status === 'expecting') {
          await payload.update({
            collection: 'container-details',
            id: containerDetailId,
            data: {
              status: 'received',
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      stockAllocation: allocationWithDepth,
    })
  } catch (error) {
    console.error('Error updating stock allocation:', error)
    return NextResponse.json({ message: 'Failed to update stock allocation' }, { status: 500 })
  }
}
