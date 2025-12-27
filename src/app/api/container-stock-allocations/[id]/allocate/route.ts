import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * POST /api/container-stock-allocations/[id]/allocate
 * Allocate stock for export job (transition from allocated to picked/dispatched)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const allocationId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the allocation
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to tenant and determine booking type (polymorphic)
    const allocationData = allocation as {
      containerBookingId?: number | { id: number; relationTo?: string }
      stage?: string
      productLines?: unknown[]
    }
    const bookingRef = allocationData.containerBookingId
    const bookingId =
      typeof bookingRef === 'object' ? bookingRef.id : bookingRef
    const collection =
      typeof bookingRef === 'object' ? bookingRef.relationTo : null

    if (!bookingId || !collection) {
      return NextResponse.json(
        { message: 'Invalid booking reference' },
        { status: 400 }
      )
    }

    // Verify booking belongs to tenant and determine job type from collection
    let booking = null
    try {
      booking = await payload.findByID({
        collection: collection as 'import-container-bookings' | 'export-container-bookings',
        id: bookingId,
      })
    } catch (error) {
      // Try the other collection
      const otherCollection =
        collection === 'import-container-bookings'
          ? 'export-container-bookings'
          : 'import-container-bookings'
      try {
        booking = await payload.findByID({
          collection: otherCollection,
          id: bookingId,
        })
      } catch (e) {
        return NextResponse.json(
          { message: 'Container booking not found' },
          { status: 404 }
        )
      }
    }

    if (booking) {
      const bookingTenantId =
        typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
          ? (booking as { tenantId: { id: number } }).tenantId.id
          : (booking as { tenantId?: number }).tenantId

      if (bookingTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Stock allocation does not belong to this tenant' },
          { status: 403 },
        )
      }
    }

    // Verify this is an export job (determined from collection name)
    const isExport = collection === 'export-container-bookings'
    if (!isExport) {
      return NextResponse.json(
        { message: 'Allocate action is only for export jobs' },
        { status: 400 }
      )
    }

    // Update allocation with product lines and stage
    const updateData: Record<string, unknown> = {
      productLines: body.productLines || allocationData.productLines || [],
    }

    // Update stage based on current stage
    if (allocationData.stage === 'allocated') {
      updateData.stage = 'picked'
    } else if (allocationData.stage === 'picked') {
      updateData.stage = 'dispatched'
    }

    const updatedAllocation = await payload.update({
      collection: 'container-stock-allocations',
      id: allocationId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      stockAllocation: updatedAllocation,
      message: 'Stock allocated successfully',
    })
  } catch (error) {
    console.error('Error allocating stock:', error)
    return NextResponse.json({ message: 'Failed to allocate stock' }, { status: 500 })
  }
}

