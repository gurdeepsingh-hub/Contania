import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Get depth from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Fetch the product line
    const productLine = await payload.findByID({
      collection: 'outbound-product-line',
      id: productLineId,
      depth,
    })

    // Verify tenant ownership through outbound inventory
    const outboundInventoryId =
      typeof productLine.outboundInventoryId === 'object'
        ? productLine.outboundInventoryId.id
        : productLine.outboundInventoryId

    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      productLine,
    })
  } catch (error) {
    console.error('Error fetching outbound product line:', error)
    return NextResponse.json(
      { message: 'Failed to fetch outbound product line' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingProductLine = await payload.findByID({
      collection: 'outbound-product-line',
      id: productLineId,
    })

    const outboundInventoryId =
      typeof existingProductLine.outboundInventoryId === 'object'
        ? existingProductLine.outboundInventoryId.id
        : existingProductLine.outboundInventoryId

    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Update the product line (supports partial updates)
    const updatedProductLine = await payload.update({
      collection: 'outbound-product-line',
      id: productLineId,
      data: {
        batchNumber:
          body.batchNumber !== undefined
            ? body.batchNumber
            : existingProductLine.batchNumber,
        skuId: body.skuId !== undefined ? body.skuId : existingProductLine.skuId,
        requiredQty:
          body.requiredQty !== undefined ? body.requiredQty : existingProductLine.requiredQty,
        requiredWeight:
          body.requiredWeight !== undefined
            ? body.requiredWeight
            : existingProductLine.requiredWeight,
        requiredCubicPerHU:
          body.requiredCubicPerHU !== undefined
            ? body.requiredCubicPerHU
            : existingProductLine.requiredCubicPerHU,
        containerNumber:
          body.containerNumber !== undefined
            ? body.containerNumber
            : existingProductLine.containerNumber,
      },
    })

    return NextResponse.json({
      success: true,
      productLine: updatedProductLine,
    })
  } catch (error) {
    console.error('Error updating outbound product line:', error)
    return NextResponse.json(
      { message: 'Failed to update outbound product line' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingProductLine = await payload.findByID({
      collection: 'outbound-product-line',
      id: productLineId,
    })

    const outboundInventoryId =
      typeof existingProductLine.outboundInventoryId === 'object'
        ? existingProductLine.outboundInventoryId.id
        : existingProductLine.outboundInventoryId

    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Release allocated LPNs before deleting
    const allocatedLPNs = await payload.find({
      collection: 'put-away-stock',
      where: {
        outboundProductLineId: {
          equals: productLineId,
        },
      },
    })

    for (const lpn of allocatedLPNs.docs) {
      await payload.update({
        collection: 'put-away-stock',
        id: lpn.id,
        data: {
          outboundInventoryId: null,
          outboundProductLineId: null,
          allocationStatus: 'available',
          allocatedAt: null,
          allocatedBy: null,
        },
      })
    }

    // Delete the product line
    await payload.delete({
      collection: 'outbound-product-line',
      id: productLineId,
    })

    return NextResponse.json({
      success: true,
      message: 'Product line deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting outbound product line:', error)
    return NextResponse.json(
      { message: 'Failed to delete outbound product line' },
      { status: 500 }
    )
  }
}




