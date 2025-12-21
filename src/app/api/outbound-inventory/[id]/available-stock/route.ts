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
      const allocatedQty = productLine.allocatedQty || 0
      const expectedQty = productLine.expectedQty || 0

      if (!batchNumber || !skuId) {
        continue
      }

      // Skip product lines that are already fully allocated
      // Only show lines that need allocation (allocatedQty < expectedQty or allocatedQty is 0)
      if (allocatedQty > 0 && allocatedQty >= expectedQty && expectedQty > 0) {
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
      const inboundProductLineIds = inboundProductLines.docs.map((line: { id: number }) => line.id)

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

      // Find available LPNs from PutAwayStock - fetch all pages
      const allAvailableLPNs = []
      let page = 1
      let hasMore = true
      
      while (hasMore) {
        const availableLPNsResult = await payload.find({
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
          limit: 1000,
          page,
        })
        allAvailableLPNs.push(...availableLPNsResult.docs)
        hasMore = availableLPNsResult.hasNextPage
        page++
      }

      // Find all LPNs (including allocated ones) for this batch/SKU to show in UI - fetch all pages
      const allLPNsList = []
      page = 1
      hasMore = true
      
      while (hasMore) {
        const allLPNsResult = await payload.find({
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
          depth: 2,
          limit: 1000,
          page,
        })
        allLPNsList.push(...allLPNsResult.docs)
        hasMore = allLPNsResult.hasNextPage
        page++
      }

      // Calculate available quantity
      const availableQty = allAvailableLPNs.reduce((sum, lpn) => sum + (lpn.huQty || 0), 0)

      // Format LPN data - include both available and allocated LPNs
      const lpnData = allLPNsList.map((lpn) => {
        const isAllocated = lpn.allocationStatus === 'allocated'
        const allocatedToJobId =
          isAllocated && lpn.outboundInventoryId
            ? typeof lpn.outboundInventoryId === 'object'
              ? lpn.outboundInventoryId.id
              : lpn.outboundInventoryId
            : null

        // Get job code if allocated
        let allocatedToJobCode = null
        if (allocatedToJobId && allocatedToJobId !== jobId) {
          try {
            const allocatedJob = lpn.outboundInventoryId
            if (typeof allocatedJob === 'object' && allocatedJob.jobCode) {
              allocatedToJobCode = allocatedJob.jobCode
            }
          } catch (error) {
            // If we can't get job code, just use job ID
            console.warn('Could not fetch job code for allocated LPN:', error)
          }
        }

        return {
          id: lpn.id,
          lpnNumber: lpn.lpnNumber,
          location: lpn.location,
          huQty: lpn.huQty,
          inboundProductLineId:
            typeof lpn.inboundProductLineId === 'object'
              ? lpn.inboundProductLineId.id
              : lpn.inboundProductLineId,
          isAllocatedToOtherJob: isAllocated && allocatedToJobId !== jobId,
          allocatedToJobId: allocatedToJobId !== jobId ? allocatedToJobId : null,
          allocatedToJobCode: allocatedToJobCode,
        }
      })

      availabilityData.push({
        productLineId: productLine.id,
        batchNumber,
        skuId,
        requiredQty: productLine.expectedQty || 0, // Map expectedQty to requiredQty for frontend display
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





