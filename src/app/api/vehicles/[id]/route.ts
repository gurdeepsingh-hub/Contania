import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const vehicleId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the vehicle
    const vehicle = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
      depth,
    })

    if (!vehicle) {
      return NextResponse.json({ message: 'Vehicle not found' }, { status: 404 })
    }

    // Verify vehicle belongs to this tenant
    const vehicleTenantId = typeof (vehicle as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (vehicle as { tenantId: { id: number } }).tenantId.id
      : (vehicle as { tenantId?: number }).tenantId

    if (vehicleTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vehicle does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      vehicle,
    })
  } catch (error) {
    console.error('Error fetching vehicle:', error)
    return NextResponse.json(
      { message: 'Failed to fetch vehicle' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const vehicleId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the vehicle to update
    const vehicleToUpdate = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
    })

    if (!vehicleToUpdate) {
      return NextResponse.json({ message: 'Vehicle not found' }, { status: 404 })
    }

    // Verify vehicle belongs to this tenant
    const vehicleTenantId = typeof (vehicleToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (vehicleToUpdate as { tenantId: { id: number } }).tenantId.id
      : (vehicleToUpdate as { tenantId?: number }).tenantId

    if (vehicleTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vehicle does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.fleetNumber !== undefined) updateData.fleetNumber = body.fleetNumber
    if (body.rego !== undefined) updateData.rego = body.rego
    if (body.regoExpiryDate !== undefined) updateData.regoExpiryDate = body.regoExpiryDate || undefined
    if (body.gpsId !== undefined) updateData.gpsId = body.gpsId || undefined
    if (body.description !== undefined) updateData.description = body.description || undefined
    if (body.defaultDepotId !== undefined) updateData.defaultDepotId = body.defaultDepotId || undefined
    if (body.aTrailerId !== undefined) updateData.aTrailerId = body.aTrailerId || undefined
    if (body.bTrailerId !== undefined) updateData.bTrailerId = body.bTrailerId || undefined
    if (body.cTrailerId !== undefined) updateData.cTrailerId = body.cTrailerId || undefined
    if (body.defaultTrailerCombinationId !== undefined) updateData.defaultTrailerCombinationId = body.defaultTrailerCombinationId || undefined
    if (body.sideloader !== undefined) updateData.sideloader = body.sideloader

    // Update vehicle
    const updatedVehicle = await payload.update({
      collection: 'vehicles',
      id: vehicleId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      vehicle: updatedVehicle,
    })
  } catch (error) {
    console.error('Error updating vehicle:', error)
    return NextResponse.json(
      { message: 'Failed to update vehicle' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const vehicleId = Number(resolvedParams.id)

    // Get the vehicle to delete
    const vehicleToDelete = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
    })

    if (!vehicleToDelete) {
      return NextResponse.json({ message: 'Vehicle not found' }, { status: 404 })
    }

    // Verify vehicle belongs to this tenant
    const vehicleTenantId = typeof (vehicleToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (vehicleToDelete as { tenantId: { id: number } }).tenantId.id
      : (vehicleToDelete as { tenantId?: number }).tenantId

    if (vehicleTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vehicle does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete vehicle
    await payload.delete({
      collection: 'vehicles',
      id: vehicleId,
    })

    return NextResponse.json({
      success: true,
      message: 'Vehicle deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting vehicle:', error)
    return NextResponse.json(
      { message: 'Failed to delete vehicle' },
      { status: 500 }
    )
  }
}

