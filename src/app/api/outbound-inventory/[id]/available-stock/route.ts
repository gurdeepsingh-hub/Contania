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
    const jobId = parseInt(id, 10)

    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: jobId,
      depth: 1,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Get product lines for this job
    const productLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: jobId,
        },
      },
      depth: 1,
    })

    const warehouseId =
      typeof job.warehouseId === 'object' ? job.warehouseId.id : job.warehouseId

    // For each product line, find available stock
    const availabilityData = []

    for (const productLine of productLines.docs) {
      const batchNumber = productLine.batchNumber
      const skuId =
        typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId

      if (!batchNumber || !skuId) {
        continue
      }

      // Find inbound product lines with matching batch number
      const inboundProductLines = await payload.find({
        collection: 'inbound-product-line',
        where: {
          and: [
            {
              batchNumber: {
                equals: batchNumber,
              },
            },
            {
              skuId: {
                equals: skuId,
              },
            },
          ],
        },
        depth: 1,
      })

      // Get inbound product line IDs
      const inboundProductLineIds = inboundProductLines.docs.map((line) => line.id)

      if (inboundProductLineIds.length === 0) {
        availabilityData.push({
          productLineId: productLine.id,
          batchNumber,
          skuId,
          availableQty: 0,
          availableLPNs: [],
        })
        continue
      }

      // Find available LPNs from PutAwayStock
      const availableLPNs = await payload.find({
        collection: 'put-away-stock',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              skuId: {
                equals: skuId,
              },
            },
            {
              inboundProductLineId: {
                in: inboundProductLineIds,
              },
            },
            {
              allocationStatus: {
                equals: 'available',
              },
            },
            ...(warehouseId
              ? [
                  {
                    warehouseId: {
                      equals: warehouseId,
                    },
                  },
                ]
              : []),
          ],
        },
        depth: 1,
      })

      // Calculate available quantity
      const availableQty = availableLPNs.docs.reduce((sum, lpn) => sum + (lpn.huQty || 0), 0)

      // Format LPN data
      const lpnData = availableLPNs.docs.map((lpn) => ({
        id: lpn.id,
        lpnNumber: lpn.lpnNumber,
        location: lpn.location,
        huQty: lpn.huQty,
        inboundProductLineId:
          typeof lpn.inboundProductLineId === 'object'
            ? lpn.inboundProductLineId.id
            : lpn.inboundProductLineId,
      }))

      availabilityData.push({
        productLineId: productLine.id,
        batchNumber,
        skuId,
        requiredQty: productLine.requiredQty || 0,
        availableQty,
        availableLPNs: lpnData,
      })
    }

    return NextResponse.json({
      success: true,
      availability: availabilityData,
    })
  } catch (error) {
    console.error('Error fetching available stock:', error)
    return NextResponse.json(
      { message: 'Failed to fetch available stock' },
      { status: 500 }
    )
  }
}





