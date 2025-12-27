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

    // Get the import container booking
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
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

    const bookingData = booking as { driverAllocation?: unknown }

    return NextResponse.json({
      success: true,
      driverAllocation: bookingData.driverAllocation || null,
    })
  } catch (error) {
    console.error('Error fetching driver allocation:', error)
    return NextResponse.json({ message: 'Failed to fetch driver allocation' }, { status: 500 })
  }
}

export async function PUT(
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
    const bookingId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the booking to update
    const bookingToUpdate = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!bookingToUpdate) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (bookingToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (bookingToUpdate as { tenantId: { id: number } }).tenantId.id
        : (bookingToUpdate as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Update driver allocation
    const updatedBooking = await payload.update({
      collection: 'import-container-bookings',
      id: bookingId,
      data: {
        driverAllocation: body.driverAllocation,
      },
    })

    return NextResponse.json({
      success: true,
      importContainerBooking: updatedBooking,
    })
  } catch (error) {
    console.error('Error updating driver allocation:', error)
    return NextResponse.json({ message: 'Failed to update driver allocation' }, { status: 500 })
  }
}

