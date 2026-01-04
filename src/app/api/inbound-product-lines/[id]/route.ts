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
    const lineId = parseInt(id, 10)

    if (isNaN(lineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Get depth from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Fetch the product line
    const productLine = await payload.findByID({
      collection: 'inbound-product-line',
      id: lineId,
      depth,
    })

    // Verify tenant ownership through inbound inventory
    const inventoryId =
      typeof productLine.inboundInventoryId === 'object'
        ? productLine.inboundInventoryId.id
        : productLine.inboundInventoryId

    const inventory = await payload.findByID({
      collection: 'inbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId =
      typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      productLine,
    })
  } catch (error) {
    console.error('Error fetching product line:', error)
    return NextResponse.json({ message: 'Failed to fetch product line' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const lineId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(lineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingLine = await payload.findByID({
      collection: 'inbound-product-line',
      id: lineId,
    })

    const inventoryId =
      typeof existingLine.inboundInventoryId === 'object'
        ? existingLine.inboundInventoryId.id
        : existingLine.inboundInventoryId

    const inventory = await payload.findByID({
      collection: 'inbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId =
      typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Update the product line
    const updatedLine = await payload.update({
      collection: 'inbound-product-line',
      id: lineId,
      data: {
        skuId: body.skuId !== undefined ? body.skuId : existingLine.skuId,
        batchNumber: body.batchNumber !== undefined ? body.batchNumber : existingLine.batchNumber,
        sqmPerSU: body.sqmPerSU !== undefined ? body.sqmPerSU : existingLine.sqmPerSU,
        expectedQty: body.expectedQty !== undefined ? body.expectedQty : existingLine.expectedQty,
        recievedQty: body.recievedQty !== undefined ? body.recievedQty : existingLine.recievedQty,
        expectedWeight:
          body.expectedWeight !== undefined ? body.expectedWeight : existingLine.expectedWeight,
        recievedWeight:
          body.recievedWeight !== undefined ? body.recievedWeight : existingLine.recievedWeight,
        weightPerHU: body.weightPerHU !== undefined ? body.weightPerHU : existingLine.weightPerHU,
        expectedCubicPerHU:
          body.expectedCubicPerHU !== undefined
            ? body.expectedCubicPerHU
            : existingLine.expectedCubicPerHU,
        recievedCubicPerHU:
          body.recievedCubicPerHU !== undefined
            ? body.recievedCubicPerHU
            : existingLine.recievedCubicPerHU,
        expiryDate: body.expiryDate !== undefined ? body.expiryDate : existingLine.expiryDate,
        attribute1: body.attribute1 !== undefined ? body.attribute1 : existingLine.attribute1,
        attribute2: body.attribute2 !== undefined ? body.attribute2 : existingLine.attribute2,
      },
    })

    return NextResponse.json({
      success: true,
      productLine: updatedLine,
    })
  } catch (error) {
    console.error('Error updating product line:', error)
    return NextResponse.json({ message: 'Failed to update product line' }, { status: 500 })
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
    const lineId = parseInt(id, 10)

    if (isNaN(lineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingLine = await payload.findByID({
      collection: 'inbound-product-line',
      id: lineId,
    })

    const inventoryId =
      typeof existingLine.inboundInventoryId === 'object'
        ? existingLine.inboundInventoryId.id
        : existingLine.inboundInventoryId

    const inventory = await payload.findByID({
      collection: 'inbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId =
      typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Delete the product line
    await payload.delete({
      collection: 'inbound-product-line',
      id: lineId,
    })

    return NextResponse.json({
      success: true,
      message: 'Product line deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting product line:', error)
    return NextResponse.json({ message: 'Failed to delete product line' }, { status: 500 })
  }
}
