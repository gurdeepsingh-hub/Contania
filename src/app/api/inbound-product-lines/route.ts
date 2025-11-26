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
    const inboundInventoryId = url.searchParams.get('inboundInventoryId')
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    if (!inboundInventoryId) {
      return NextResponse.json(
        { message: 'inboundInventoryId is required' },
        { status: 400 }
      )
    }

    const inventoryId = parseInt(inboundInventoryId, 10)
    if (isNaN(inventoryId)) {
      return NextResponse.json({ message: 'Invalid inboundInventoryId' }, { status: 400 })
    }

    // Verify tenant ownership of the inbound inventory
    const inventory = await payload.findByID({
      collection: 'inbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId = typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Inbound inventory not found' }, { status: 404 })
    }

    // Fetch product lines
    const result = await payload.find({
      collection: 'inbound-product-line',
      where: {
        inboundInventoryId: {
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

    if (!body.inboundInventoryId) {
      return NextResponse.json(
        { message: 'inboundInventoryId is required' },
        { status: 400 }
      )
    }

    const inventoryId = parseInt(body.inboundInventoryId, 10)
    if (isNaN(inventoryId)) {
      return NextResponse.json({ message: 'Invalid inboundInventoryId' }, { status: 400 })
    }

    // Verify tenant ownership of the inbound inventory
    const inventory = await payload.findByID({
      collection: 'inbound-inventory',
      id: inventoryId,
    })

    const inventoryTenantId = typeof inventory.tenantId === 'object' ? inventory.tenantId.id : inventory.tenantId
    if (inventoryTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Inbound inventory not found' }, { status: 404 })
    }

    // Create product line
    const newProductLine = await payload.create({
      collection: 'inbound-product-line',
      data: {
        inboundInventoryId: inventoryId,
        skuId: body.skuId || undefined,
        batchNumber: body.batchNumber || undefined,
        sqmPerSU: body.sqmPerSU || undefined,
        expectedQty: body.expectedQty || undefined,
        recievedQty: body.recievedQty || undefined,
        expectedWeight: body.expectedWeight || undefined,
        recievedWeight: body.recievedWeight || undefined,
        weightPerHU: body.weightPerHU || undefined,
        expectedCubicPerHU: body.expectedCubicPerHU || undefined,
        recievedCubicPerHU: body.recievedCubicPerHU || undefined,
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

