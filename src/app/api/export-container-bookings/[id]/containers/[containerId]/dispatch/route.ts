import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
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

    // Verify container belongs to booking
    const container = await payload.findByID({
      collection: 'container-details',
      id: containerId,
    })

    if (!container) {
      return NextResponse.json({ message: 'Container not found' }, { status: 404 })
    }

    const containerBookingId =
      typeof (container as { containerBookingId?: number | { id: number } }).containerBookingId ===
      'object'
        ? (container as { containerBookingId: { id: number } }).containerBookingId.id
        : (container as { containerBookingId?: number }).containerBookingId

    if (containerBookingId !== bookingId) {
      return NextResponse.json(
        { message: 'Container does not belong to this booking' },
        { status: 400 },
      )
    }

    // Verify container status is picked_up
    if (container.status !== 'picked_up') {
      return NextResponse.json(
        { message: 'Container must be picked up before dispatch' },
        { status: 400 },
      )
    }

    const { driverId, vehicleId } = body

    if (!driverId || !vehicleId) {
      return NextResponse.json(
        { message: 'Driver ID and Vehicle ID are required' },
        { status: 400 },
      )
    }

    // Update booking's driverAllocation JSON field
    const bookingData = booking as { driverAllocation?: any }
    const driverAllocation = bookingData.driverAllocation || {}

    // Initialize container allocations if needed
    if (!driverAllocation.containers) {
      driverAllocation.containers = {}
    }

    // Store dispatch info for this container
    driverAllocation.containers[containerId] = {
      driverId,
      vehicleId,
      dispatchedAt: new Date().toISOString(),
    }

    // Update booking with driver allocation
    await payload.update({
      collection: 'export-container-bookings',
      id: bookingId,
      data: {
        driverAllocation,
      },
    })

    // Update container status to dispatched
    await payload.update({
      collection: 'container-details',
      id: containerId,
      data: {
        status: 'dispatched',
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Container dispatched successfully',
    })
  } catch (error) {
    console.error('Error dispatching container:', error)
    return NextResponse.json({ message: 'Failed to dispatch container' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)

    // Get booking to check driver allocation
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    const bookingData = booking as { driverAllocation?: any }
    const containerDispatch = bookingData.driverAllocation?.containers?.[containerId] || null

    return NextResponse.json({
      success: true,
      dispatch: containerDispatch,
    })
  } catch (error) {
    console.error('Error fetching container dispatch:', error)
    return NextResponse.json({ message: 'Failed to fetch dispatch information' }, { status: 500 })
  }
}
