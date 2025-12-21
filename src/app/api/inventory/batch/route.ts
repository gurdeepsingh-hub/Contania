import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Endpoint to update batch number for a SKU
 * Updates all inbound-product-line records with the old batch number to the new batch number
 */
export async function PUT(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()
    const { skuId, oldBatchNumber, newBatchNumber } = body

    if (!skuId || !oldBatchNumber || !newBatchNumber) {
      return NextResponse.json(
        { message: 'SKU ID, old batch number, and new batch number are required' },
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

    // Find all inbound product lines for this SKU with the old batch number
    // We need to filter by tenant through the inbound-inventory relationship
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        and: [
          {
            skuId: {
              equals: skuIdNum,
            },
          },
          {
            batchNumber: {
              equals: oldBatchNumber,
            },
          },
        ],
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

    if (tenantFilteredProductLines.length === 0) {
      return NextResponse.json(
        { message: 'No product lines found with the specified batch number' },
        { status: 404 }
      )
    }

    // Update all product lines
    const updatePromises = tenantFilteredProductLines.map((line: any) =>
      payload.update({
        collection: 'inbound-product-line',
        id: line.id,
        data: {
          batchNumber: newBatchNumber,
        },
      })
    )

    await Promise.all(updatePromises)

    return NextResponse.json({
      success: true,
      message: `Updated batch number for ${tenantFilteredProductLines.length} product line(s)`,
    })
  } catch (error) {
    console.error('Error updating batch number:', error)
    return NextResponse.json(
      { message: 'Failed to update batch number' },
      { status: 500 }
    )
  }
}

