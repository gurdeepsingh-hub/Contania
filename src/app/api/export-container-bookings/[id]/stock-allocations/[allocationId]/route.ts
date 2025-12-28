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
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 2

    // Fetch the stock allocation
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to this booking
    const allocationBookingRef = (allocation as any).containerBookingId
    if (!allocationBookingRef) {
      return NextResponse.json(
        { message: 'Stock allocation does not have a booking reference' },
        { status: 400 },
      )
    }

    const allocationBookingId =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.id || (allocationBookingRef.value && allocationBookingRef.value.id)
        : allocationBookingRef

    const allocationRelationTo =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.relationTo
        : null

    if (
      allocationBookingId !== bookingId ||
      allocationRelationTo !== 'export-container-bookings'
    ) {
      return NextResponse.json(
        { message: 'Stock allocation does not belong to this booking' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      stockAllocation: allocation,
    })
  } catch (error) {
    console.error('Error fetching stock allocation:', error)
    return NextResponse.json(
      { message: 'Failed to fetch stock allocation' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
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

    // Verify allocation exists and belongs to this booking
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth: 1,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    const allocationBookingRef = (allocation as any).containerBookingId
    const allocationBookingId =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.id || (allocationBookingRef.value && allocationBookingRef.value.id)
        : allocationBookingRef

    const allocationRelationTo =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.relationTo
        : null

    if (
      allocationBookingId !== bookingId ||
      allocationRelationTo !== 'export-container-bookings'
    ) {
      return NextResponse.json(
        { message: 'Stock allocation does not belong to this booking' },
        { status: 403 },
      )
    }

    // Update the allocation
    const updatedAllocation = await payload.update({
      collection: 'container-stock-allocations',
      id: allocationId,
      data: {
        ...(body.stage && { stage: body.stage }),
        ...(body.productLines && { productLines: body.productLines }),
      },
    })

    return NextResponse.json({
      success: true,
      stockAllocation: updatedAllocation,
    })
  } catch (error) {
    console.error('Error updating stock allocation:', error)
    return NextResponse.json(
      { message: 'Failed to update stock allocation' },
      { status: 500 }
    )
  }
}


