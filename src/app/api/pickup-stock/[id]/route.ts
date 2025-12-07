import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const pickupId = parseInt(id, 10)

    if (isNaN(pickupId)) {
      return NextResponse.json({ message: 'Invalid pickup ID' }, { status: 400 })
    }

    // Fetch pickup record
    const pickup = await payload.findByID({
      collection: 'pickup-stock',
      id: pickupId,
      depth: 2,
    })

    // Verify tenant ownership
    const pickupTenantId =
      typeof pickup.tenantId === 'object' ? pickup.tenantId.id : pickup.tenantId
    if (pickupTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Pickup record not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      pickup,
    })
  } catch (error) {
    console.error('Error fetching pickup record:', error)
    return NextResponse.json({ message: 'Failed to fetch pickup record' }, { status: 500 })
  }
}

export async function PUT(
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
    const pickupId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(pickupId)) {
      return NextResponse.json({ message: 'Invalid pickup ID' }, { status: 400 })
    }

    // Fetch existing pickup record
    const existingPickup = await payload.findByID({
      collection: 'pickup-stock',
      id: pickupId,
    })

    // Verify tenant ownership
    const pickupTenantId =
      typeof existingPickup.tenantId === 'object'
        ? existingPickup.tenantId.id
        : existingPickup.tenantId
    if (pickupTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Pickup record not found' }, { status: 404 })
    }

    // Only allow updates if status is 'draft'
    if (existingPickup.pickupStatus !== 'draft') {
      return NextResponse.json(
        { message: 'Can only update pickup records with status "draft"' },
        { status: 400 },
      )
    }

    // Build update data
    const updateData: any = {}
    if (body.bufferQty !== undefined) updateData.bufferQty = body.bufferQty
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.pickupStatus !== undefined) updateData.pickupStatus = body.pickupStatus

    // Update pickup record
    const updatedPickup = await payload.update({
      collection: 'pickup-stock',
      id: pickupId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      pickup: updatedPickup,
    })
  } catch (error) {
    console.error('Error updating pickup record:', error)
    return NextResponse.json({ message: 'Failed to update pickup record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const pickupId = parseInt(id, 10)

    if (isNaN(pickupId)) {
      return NextResponse.json({ message: 'Invalid pickup ID' }, { status: 400 })
    }

    // Fetch existing pickup record
    const existingPickup = await payload.findByID({
      collection: 'pickup-stock',
      id: pickupId,
      depth: 1,
    })

    // Verify tenant ownership
    const pickupTenantId =
      typeof existingPickup.tenantId === 'object'
        ? existingPickup.tenantId.id
        : existingPickup.tenantId
    if (pickupTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Pickup record not found' }, { status: 404 })
    }

    // Only allow deletion if status is 'draft'
    if (existingPickup.pickupStatus !== 'draft') {
      return NextResponse.json(
        { message: 'Can only delete pickup records with status "draft"' },
        { status: 400 },
      )
    }

    // Revert PutAwayStock status back to 'allocated'
    if (existingPickup.pickedUpLPNs && Array.isArray(existingPickup.pickedUpLPNs)) {
      for (const lpn of existingPickup.pickedUpLPNs) {
        const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
        if (lpnId) {
          await payload.update({
            collection: 'put-away-stock',
            id: lpnId,
            data: {
              allocationStatus: 'allocated',
            },
          })
        }
      }
    }

    // Delete pickup record
    await payload.delete({
      collection: 'pickup-stock',
      id: pickupId,
    })

    return NextResponse.json({
      success: true,
      message: 'Pickup record deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting pickup record:', error)
    return NextResponse.json({ message: 'Failed to delete pickup record' }, { status: 500 })
  }
}

