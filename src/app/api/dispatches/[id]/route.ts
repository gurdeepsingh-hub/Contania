import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const dispatchId = parseInt(id, 10)

    if (isNaN(dispatchId)) {
      return NextResponse.json({ message: 'Invalid dispatch ID' }, { status: 400 })
    }

    const dispatch = await payload.findByID({
      collection: 'dispatches',
      id: dispatchId,
      depth: 2,
    })

    const dispatchTenantId =
      typeof dispatch.tenantId === 'object' ? dispatch.tenantId.id : dispatch.tenantId
    if (dispatchTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Dispatch not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      dispatch,
    })
  } catch (error: any) {
    console.error('Error fetching dispatch:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch dispatch' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const dispatchId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(dispatchId)) {
      return NextResponse.json({ message: 'Invalid dispatch ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const dispatch = await payload.findByID({
      collection: 'dispatches',
      id: dispatchId,
      depth: 0,
    })

    const dispatchTenantId =
      typeof dispatch.tenantId === 'object' ? dispatch.tenantId.id : dispatch.tenantId
    if (dispatchTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Dispatch not found' }, { status: 404 })
    }

    // If updating vehicle, verify it belongs to tenant
    if (body.vehicleId) {
      const vehicle = await payload.findByID({
        collection: 'vehicles',
        id: body.vehicleId,
      })

      const vehicleTenantId =
        typeof vehicle.tenantId === 'object' ? vehicle.tenantId.id : vehicle.tenantId
      if (vehicleTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Vehicle not found or does not belong to tenant' },
          { status: 400 },
        )
      }
    }

    // If updating driver, verify it belongs to tenant
    if (body.driverId) {
      const driver = await payload.findByID({
        collection: 'drivers',
        id: body.driverId,
      })

      const driverTenantId =
        typeof driver.tenantId === 'object' ? driver.tenantId.id : driver.tenantId
      if (driverTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Driver not found or does not belong to tenant' },
          { status: 400 },
        )
      }
    }

    // Update dispatch
    const updatedDispatch = await payload.update({
      collection: 'dispatches',
      id: dispatchId,
      data: body,
    })

    return NextResponse.json({
      success: true,
      dispatch: updatedDispatch,
      message: 'Dispatch updated successfully',
    })
  } catch (error: any) {
    console.error('Error updating dispatch:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to update dispatch' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const dispatchId = parseInt(id, 10)

    if (isNaN(dispatchId)) {
      return NextResponse.json({ message: 'Invalid dispatch ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const dispatch = await payload.findByID({
      collection: 'dispatches',
      id: dispatchId,
      depth: 0,
    })

    const dispatchTenantId =
      typeof dispatch.tenantId === 'object' ? dispatch.tenantId.id : dispatch.tenantId
    if (dispatchTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Dispatch not found' }, { status: 404 })
    }

    // Only allow deletion if status is 'planned'
    if (dispatch.status !== 'planned') {
      return NextResponse.json(
        { message: 'Can only delete dispatch entries with status "planned"' },
        { status: 400 },
      )
    }

    await payload.delete({
      collection: 'dispatches',
      id: dispatchId,
    })

    return NextResponse.json({
      success: true,
      message: 'Dispatch deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting dispatch:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to delete dispatch' },
      { status: 500 },
    )
  }
}
