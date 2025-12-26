import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const warehouseId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the warehouse
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: warehouseId,
      depth,
    })

    if (!warehouse) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Verify warehouse belongs to this tenant
    const warehouseTenantId =
      typeof (warehouse as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (warehouse as { tenantId: { id: number } }).tenantId.id
        : (warehouse as { tenantId?: number }).tenantId

    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Warehouse does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      warehouse,
    })
  } catch (error) {
    console.error('Error fetching warehouse:', error)
    return NextResponse.json({ message: 'Failed to fetch warehouse' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const warehouseId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the warehouse to update
    const warehouseToUpdate = await payload.findByID({
      collection: 'warehouses',
      id: warehouseId,
    })

    if (!warehouseToUpdate) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Verify warehouse belongs to this tenant
    const warehouseTenantId =
      typeof (warehouseToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (warehouseToUpdate as { tenantId: { id: number } }).tenantId.id
        : (warehouseToUpdate as { tenantId?: number }).tenantId

    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Warehouse does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name || undefined
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone || undefined
    if (body.street !== undefined) updateData.street = body.street || undefined
    if (body.city !== undefined) updateData.city = body.city || undefined
    if (body.state !== undefined) updateData.state = body.state || undefined
    if (body.postcode !== undefined) updateData.postcode = body.postcode || undefined
    if (body.type !== undefined) updateData.type = body.type || undefined

    // Update warehouse
    const updatedWarehouse = await payload.update({
      collection: 'warehouses',
      id: warehouseId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      warehouse: updatedWarehouse,
    })
  } catch (error) {
    console.error('Error updating warehouse:', error)
    return NextResponse.json({ message: 'Failed to update warehouse' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const warehouseId = Number(resolvedParams.id)

    // Get the warehouse to delete
    const warehouseToDelete = await payload.findByID({
      collection: 'warehouses',
      id: warehouseId,
    })

    if (!warehouseToDelete) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Verify warehouse belongs to this tenant
    const warehouseTenantId =
      typeof (warehouseToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (warehouseToDelete as { tenantId: { id: number } }).tenantId.id
        : (warehouseToDelete as { tenantId?: number }).tenantId

    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Warehouse does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Delete warehouse
    await payload.delete({
      collection: 'warehouses',
      id: warehouseId,
    })

    return NextResponse.json({
      success: true,
      message: 'Warehouse deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting warehouse:', error)
    return NextResponse.json({ message: 'Failed to delete warehouse' }, { status: 500 })
  }
}
