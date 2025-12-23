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
    const storeId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the store
    const store = await payload.findByID({
      collection: 'stores',
      id: storeId,
      depth,
    })

    if (!store) {
      return NextResponse.json({ message: 'Store not found' }, { status: 404 })
    }

    // Verify store belongs to this tenant
    const storeTenantId = typeof (store as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (store as { tenantId: { id: number } }).tenantId.id
      : (store as { tenantId?: number }).tenantId

    if (storeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Store does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      store,
    })
  } catch (error) {
    console.error('Error fetching store:', error)
    return NextResponse.json(
      { message: 'Failed to fetch store' },
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
    const storeId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the store to update
    const storeToUpdate = await payload.findByID({
      collection: 'stores',
      id: storeId,
    })

    if (!storeToUpdate) {
      return NextResponse.json({ message: 'Store not found' }, { status: 404 })
    }

    // Verify store belongs to this tenant
    const storeTenantId = typeof (storeToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storeToUpdate as { tenantId: { id: number } }).tenantId.id
      : (storeToUpdate as { tenantId?: number }).tenantId

    if (storeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Store does not belong to this tenant' },
        { status: 403 }
      )
    }

    // If warehouseId is being updated, verify it belongs to this tenant
    if (body.warehouseId !== undefined) {
      const warehouse = await payload.findByID({
        collection: 'warehouses',
        id: Number(body.warehouseId),
      })

      if (!warehouse) {
        return NextResponse.json(
          { message: 'Warehouse not found' },
          { status: 404 }
        )
      }

      const warehouseTenantId = typeof (warehouse as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (warehouse as { tenantId: { id: number } }).tenantId.id
        : (warehouse as { tenantId?: number }).tenantId

      if (warehouseTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Warehouse does not belong to this tenant' },
          { status: 403 }
        )
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.storeName !== undefined) updateData.storeName = body.storeName
    if (body.warehouseId !== undefined) updateData.warehouseId = Number(body.warehouseId)
    if (body.countable !== undefined) updateData.countable = body.countable
    if (body.zoneType !== undefined) updateData.zoneType = body.zoneType

    // Update store
    const updatedStore = await payload.update({
      collection: 'stores',
      id: storeId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      store: updatedStore,
    })
  } catch (error) {
    console.error('Error updating store:', error)
    return NextResponse.json(
      { message: 'Failed to update store' },
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
    const storeId = Number(resolvedParams.id)

    // Get the store to delete
    const storeToDelete = await payload.findByID({
      collection: 'stores',
      id: storeId,
    })

    if (!storeToDelete) {
      return NextResponse.json({ message: 'Store not found' }, { status: 404 })
    }

    // Verify store belongs to this tenant
    const storeTenantId = typeof (storeToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storeToDelete as { tenantId: { id: number } }).tenantId.id
      : (storeToDelete as { tenantId?: number }).tenantId

    if (storeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Store does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete store
    await payload.delete({
      collection: 'stores',
      id: storeId,
    })

    return NextResponse.json({
      success: true,
      message: 'Store deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting store:', error)
    return NextResponse.json(
      { message: 'Failed to delete store' },
      { status: 500 }
    )
  }
}

