import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * POST /api/container-stock-allocations/[id]/put-away
 * Put away stock for import job (transition from received to put_away)
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

    // Verify this is an import job (determined from collection name)
    const isImport = collection === 'import-container-bookings'
    if (!isImport) {
      return NextResponse.json(
        { message: 'Put away action is only for import jobs' },
        { status: 400 }
      )
    }

    // Verify current stage is received
    if (allocationData.stage !== 'received') {
      return NextResponse.json(
        { message: 'Stock must be received before put away' },
        { status: 400 }
      )
    }

    // Update allocation with put away information and stage
    const updateData: Record<string, unknown> = {
      productLines: body.productLines || allocationData.productLines || [],
      stage: 'put_away',
    }

    const updatedAllocation = await payload.update({
      collection: 'container-stock-allocations',
      id: allocationId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      stockAllocation: updatedAllocation,
      message: 'Stock put away successfully',
    })
  } catch (error) {
    console.error('Error putting away stock:', error)
    return NextResponse.json({ message: 'Failed to put away stock' }, { status: 500 })
  }
}

