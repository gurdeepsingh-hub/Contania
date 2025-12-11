import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get query parameters
    const url = new URL(request.url)
    const outboundInventoryId = url.searchParams.get('outboundInventoryId')
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    if (!outboundInventoryId) {
      return NextResponse.json(
        { message: 'outboundInventoryId is required' },
        { status: 400 }
      )
    }

    const inventoryId = parseInt(outboundInventoryId, 10)
    if (isNaN(inventoryId)) {
      return NextResponse.json({ message: 'Invalid outboundInventoryId' }, { status: 400 })
    }

    // Verify tenant ownership of the outbound inventory
    const inventory = await payload.findByID({
      collection: 'outbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId = typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Outbound inventory not found' }, { status: 404 })
    }

    // Fetch product lines
    const result = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: inventoryId,
        },
      },
      depth,
    })

    return NextResponse.json({
      success: true,
      productLines: result.docs,
      totalDocs: result.totalDocs,
    })
  } catch (error) {
    console.error('Error fetching product lines:', error)
    return NextResponse.json(
      { message: 'Failed to fetch product lines' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    if (!body.outboundInventoryId) {
      return NextResponse.json(
        { message: 'outboundInventoryId is required' },
        { status: 400 }
      )
    }

    const inventoryId = parseInt(body.outboundInventoryId, 10)
    if (isNaN(inventoryId)) {
      return NextResponse.json({ message: 'Invalid outboundInventoryId' }, { status: 400 })
    }

    // Verify tenant ownership of the outbound inventory
    const inventory = await payload.findByID({
      collection: 'outbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId = typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Outbound inventory not found' }, { status: 404 })
    }

    // Create product line
    const newProductLine = await payload.create({
      collection: 'outbound-product-line',
      data: {
        outboundInventoryId: inventoryId,
        skuId: body.skuId || undefined,
        batchNumber: body.batchNumber || undefined,
        sqmPerSU: body.sqmPerSU || undefined,
        expectedQty: body.expectedQty || undefined,
        pickedQty: body.pickedQty || undefined,
        expectedWeight: body.expectedWeight || undefined,
        pickedWeight: body.pickedWeight || undefined,
        weightPerHU: body.weightPerHU || undefined,
        expectedCubicPerHU: body.expectedCubicPerHU || undefined,
        pickedCubicPerHU: body.pickedCubicPerHU || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      productLine: newProductLine,
    })
  } catch (error) {
    console.error('Error creating product line:', error)
    return NextResponse.json(
      { message: 'Failed to create product line' },
      { status: 500 }
    )
  }
}
