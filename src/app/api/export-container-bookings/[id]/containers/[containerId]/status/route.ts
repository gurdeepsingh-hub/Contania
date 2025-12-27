import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_update')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)
    const body = await request.json()

    const { status } = body

    if (!status) {
      return NextResponse.json({ message: 'Status is required' }, { status: 400 })
    }

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

    // Get container
    const container = await payload.findByID({
      collection: 'container-details',
      id: containerId,
    })

    if (!container) {
      return NextResponse.json({ message: 'Container not found' }, { status: 404 })
    }

    const currentStatus = container.status

    // Validate status transition
    const validTransitions: Record<string, string[]> = {
      allocated: ['picked_up'],
      picked_up: ['dispatched'],
      dispatched: [], // Terminal state
    }

    if (!validTransitions[currentStatus]?.includes(status)) {
      return NextResponse.json(
        {
          message: `Invalid status transition from ${currentStatus} to ${status}`,
        },
        { status: 400 }
      )
    }

    // Additional validation for specific transitions
    if (status === 'picked_up') {
      // Check if all product lines have been picked
      const allocations = await payload.find({
        collection: 'container-stock-allocations',
        where: {
          containerDetailId: {
            equals: containerId,
          },
        },
      })

      const allProductLines = allocations.docs.flatMap((a: any) => a.productLines || [])
      
      // Check if pickup records exist for all product lines
      const pickupRecords = await payload.find({
        collection: 'pickup-stock',
        where: {
          containerDetailId: {
            equals: containerId,
          },
          pickupStatus: {
            equals: 'completed',
          },
        },
      })

      // Simple check: if we have pickup records and all product lines have pickedQty
      const allPicked = allProductLines.every(
        (line: any) => line.pickedQty && line.pickedQty > 0,
      )

      if (!allPicked || pickupRecords.docs.length === 0) {
        return NextResponse.json(
          { message: 'All product lines must be picked before changing status to picked_up' },
          { status: 400 }
        )
      }
    }

    if (status === 'dispatched') {
      // Check if driver and vehicle are assigned (via driverAllocation)
      const bookingData = booking as { driverAllocation?: any }
      const containerDispatch = bookingData.driverAllocation?.containers?.[containerId]

      if (!containerDispatch || !containerDispatch.driverId || !containerDispatch.vehicleId) {
        return NextResponse.json(
          { message: 'Driver and vehicle must be assigned before dispatching' },
          { status: 400 }
        )
      }
    }

    // Update container status
    const updatedContainer = await payload.update({
      collection: 'container-details',
      id: containerId,
      data: {
        status,
      },
    })

    return NextResponse.json({
      success: true,
      container: updatedContainer,
    })
  } catch (error) {
    console.error('Error updating container status:', error)
    return NextResponse.json(
      { message: 'Failed to update container status' },
      { status: 500 }
    )
  }
}

