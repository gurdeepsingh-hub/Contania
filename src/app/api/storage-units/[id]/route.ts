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
    const storageUnitId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the storage unit
    const storageUnit = await payload.findByID({
      collection: 'storage-units',
      id: storageUnitId,
      depth,
    })

    if (!storageUnit) {
      return NextResponse.json({ message: 'Storage unit not found' }, { status: 404 })
    }

    // Verify storage unit belongs to this tenant
    const storageUnitTenantId = typeof (storageUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storageUnit as { tenantId: { id: number } }).tenantId.id
      : (storageUnit as { tenantId?: number }).tenantId

    if (storageUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Storage unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      storageUnit,
    })
  } catch (error) {
    console.error('Error fetching storage unit:', error)
    return NextResponse.json(
      { message: 'Failed to fetch storage unit' },
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
    const storageUnitId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the storage unit to update
    const storageUnitToUpdate = await payload.findByID({
      collection: 'storage-units',
      id: storageUnitId,
    })

    if (!storageUnitToUpdate) {
      return NextResponse.json({ message: 'Storage unit not found' }, { status: 404 })
    }

    // Verify storage unit belongs to this tenant
    const storageUnitTenantId = typeof (storageUnitToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storageUnitToUpdate as { tenantId: { id: number } }).tenantId.id
      : (storageUnitToUpdate as { tenantId?: number }).tenantId

    if (storageUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Storage unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.abbreviation !== undefined) updateData.abbreviation = body.abbreviation || undefined
    if (body.palletSpaces !== undefined) updateData.palletSpaces = body.palletSpaces !== null ? Number(body.palletSpaces) : undefined
    if (body.lengthPerSU_mm !== undefined) updateData.lengthPerSU_mm = body.lengthPerSU_mm !== null ? Number(body.lengthPerSU_mm) : undefined
    if (body.widthPerSU_mm !== undefined) updateData.widthPerSU_mm = body.widthPerSU_mm !== null ? Number(body.widthPerSU_mm) : undefined
    if (body.whstoChargeBy !== undefined) updateData.whstoChargeBy = body.whstoChargeBy || undefined

    // Update storage unit
    const updatedStorageUnit = await payload.update({
      collection: 'storage-units',
      id: storageUnitId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      storageUnit: updatedStorageUnit,
    })
  } catch (error) {
    console.error('Error updating storage unit:', error)
    return NextResponse.json(
      { message: 'Failed to update storage unit' },
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
    const storageUnitId = Number(resolvedParams.id)

    // Get the storage unit to delete
    const storageUnitToDelete = await payload.findByID({
      collection: 'storage-units',
      id: storageUnitId,
    })

    if (!storageUnitToDelete) {
      return NextResponse.json({ message: 'Storage unit not found' }, { status: 404 })
    }

    // Verify storage unit belongs to this tenant
    const storageUnitTenantId = typeof (storageUnitToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storageUnitToDelete as { tenantId: { id: number } }).tenantId.id
      : (storageUnitToDelete as { tenantId?: number }).tenantId

    if (storageUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Storage unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete storage unit
    await payload.delete({
      collection: 'storage-units',
      id: storageUnitId,
    })

    return NextResponse.json({
      success: true,
      message: 'Storage unit deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting storage unit:', error)
    return NextResponse.json(
      { message: 'Failed to delete storage unit' },
      { status: 500 }
    )
  }
}

