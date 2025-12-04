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

    // Verify the outbound inventory job belongs to tenant
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: parseInt(outboundInventoryId, 10),
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Fetch product lines
    const productLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: parseInt(outboundInventoryId, 10),
        },
      },
      depth,
    })

    return NextResponse.json({
      success: true,
      productLines: productLines.docs,
      count: productLines.docs.length,
    })
  } catch (error) {
    console.error('Error fetching outbound product lines:', error)
    return NextResponse.json(
      { message: 'Failed to fetch outbound product lines' },
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

    // Verify the outbound inventory job belongs to tenant
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: body.outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Create product line
    const newProductLine = await payload.create({
      collection: 'outbound-product-line',
      data: {
        outboundInventoryId: body.outboundInventoryId,
        batchNumber: body.batchNumber || undefined,
        skuId: body.skuId || undefined,
        requiredQty: body.requiredQty || undefined,
        requiredWeight: body.requiredWeight || undefined,
        requiredCubicPerHU: body.requiredCubicPerHU || undefined,
        containerNumber: body.containerNumber || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      productLine: newProductLine,
    })
  } catch (error) {
    console.error('Error creating outbound product line:', error)
    return NextResponse.json(
      { message: 'Failed to create outbound product line' },
      { status: 500 }
    )
  }
}




