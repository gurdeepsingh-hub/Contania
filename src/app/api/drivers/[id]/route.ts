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
    const driverId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the driver
    const driver = await payload.findByID({
      collection: 'drivers',
      id: driverId,
      depth,
    })

    if (!driver) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 })
    }

    // Verify driver belongs to this tenant
    const driverTenantId = typeof (driver as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (driver as { tenantId: { id: number } }).tenantId.id
      : (driver as { tenantId?: number }).tenantId

    if (driverTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Driver does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      driver,
    })
  } catch (error) {
    console.error('Error fetching driver:', error)
    return NextResponse.json(
      { message: 'Failed to fetch driver' },
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
    const driverId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the driver to update
    const driverToUpdate = await payload.findByID({
      collection: 'drivers',
      id: driverId,
    })

    if (!driverToUpdate) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 })
    }

    // Verify driver belongs to this tenant
    const driverTenantId = typeof (driverToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (driverToUpdate as { tenantId: { id: number } }).tenantId.id
      : (driverToUpdate as { tenantId?: number }).tenantId

    if (driverTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Driver does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.phoneNumber !== undefined) updateData.phoneNumber = body.phoneNumber
    if (body.vehicleId !== undefined) updateData.vehicleId = body.vehicleId || undefined
    if (body.defaultDepotId !== undefined) updateData.defaultDepotId = body.defaultDepotId || undefined
    if (body.abn !== undefined) updateData.abn = body.abn || undefined
    if (body.addressStreet !== undefined) updateData.addressStreet = body.addressStreet || undefined
    if (body.city !== undefined) updateData.city = body.city || undefined
    if (body.state !== undefined) updateData.state = body.state || undefined
    if (body.postcode !== undefined) updateData.postcode = body.postcode || undefined
    if (body.employeeType !== undefined) updateData.employeeType = body.employeeType
    if (body.drivingLicenceNumber !== undefined) updateData.drivingLicenceNumber = body.drivingLicenceNumber
    if (body.licenceExpiry !== undefined) updateData.licenceExpiry = body.licenceExpiry || undefined
    if (body.licencePhotoUrl !== undefined) updateData.licencePhotoUrl = body.licencePhotoUrl || undefined
    if (body.dangerousGoodsCertNumber !== undefined) updateData.dangerousGoodsCertNumber = body.dangerousGoodsCertNumber || undefined
    if (body.dangerousGoodsCertExpiry !== undefined) updateData.dangerousGoodsCertExpiry = body.dangerousGoodsCertExpiry || undefined
    if (body.msicNumber !== undefined) updateData.msicNumber = body.msicNumber || undefined
    if (body.msicExpiry !== undefined) updateData.msicExpiry = body.msicExpiry || undefined
    if (body.msicPhotoUrl !== undefined) updateData.msicPhotoUrl = body.msicPhotoUrl || undefined

    // Update driver
    const updatedDriver = await payload.update({
      collection: 'drivers',
      id: driverId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      driver: updatedDriver,
    })
  } catch (error) {
    console.error('Error updating driver:', error)
    return NextResponse.json(
      { message: 'Failed to update driver' },
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
    const driverId = Number(resolvedParams.id)

    // Get the driver to delete
    const driverToDelete = await payload.findByID({
      collection: 'drivers',
      id: driverId,
    })

    if (!driverToDelete) {
      return NextResponse.json({ message: 'Driver not found' }, { status: 404 })
    }

    // Verify driver belongs to this tenant
    const driverTenantId = typeof (driverToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (driverToDelete as { tenantId: { id: number } }).tenantId.id
      : (driverToDelete as { tenantId?: number }).tenantId

    if (driverTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Driver does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete driver
    await payload.delete({
      collection: 'drivers',
      id: driverId,
    })

    return NextResponse.json({
      success: true,
      message: 'Driver deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting driver:', error)
    return NextResponse.json(
      { message: 'Failed to delete driver' },
      { status: 500 }
    )
  }
}

