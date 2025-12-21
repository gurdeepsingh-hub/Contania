import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Endpoint to update received quantity for a SKU
 * Updates all inbound-product-line records for the SKU
 */
export async function PUT(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()
    const { skuId, receivedQty } = body

    if (!skuId || receivedQty === undefined) {
      return NextResponse.json(
        { message: 'SKU ID and received quantity are required' },
        { status: 400 }
      )
    }

    // Find the SKU
    const skuResult = await payload.find({
      collection: 'skus',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            skuCode: {
              equals: skuId,
            },
          },
        ],
      },
      limit: 1,
    })

    if (skuResult.docs.length === 0) {
      return NextResponse.json({ message: 'SKU not found' }, { status: 404 })
    }

    const sku = skuResult.docs[0]
    const skuIdNum = sku.id

    // Find all inbound product lines for this SKU
    // We need to filter by tenant through the inbound-inventory relationship
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        skuId: {
          equals: skuIdNum,
        },
      },
      depth: 1, // Include inbound-inventory to check tenant
      limit: 10000,
    })

    // Filter product lines by tenant
    const tenantFilteredProductLines = productLines.docs.filter((line: any) => {
      const inboundInventory =
        typeof line.inboundInventoryId === 'object' ? line.inboundInventoryId : null
      if (!inboundInventory) return false
      const inboundTenantId =
        typeof inboundInventory.tenantId === 'object'
          ? inboundInventory.tenantId.id
          : inboundInventory.tenantId
      return inboundTenantId === tenant.id
    })

    // Update all product lines
    const updatePromises = tenantFilteredProductLines.map((line: any) =>
      payload.update({
        collection: 'inbound-product-line',
        id: line.id,
        data: {
          recievedQty: receivedQty,
        },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: `Updated received quantity for ${tenantFilteredProductLines.length} product line(s)`,
    })
  } catch (error) {
    console.error('Error updating quantity:', error)
    return NextResponse.json(
      { message: 'Failed to update quantity' },
      { status: 500 }
    )
  }
}

