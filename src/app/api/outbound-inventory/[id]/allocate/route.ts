import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const { id } = await params
    const jobId = parseInt(id, 10)
    const body = await request.json()

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

    const allocations = body.allocations || []
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return NextResponse.json(
        { message: 'Allocations array is required' },
        { status: 400 }
      )
    }

    const allocationResults = []
    const errors = []

    // Process each allocation
    for (const allocation of allocations) {
      const { productLineId, batchNumber, lpnIds, quantity } = allocation

      if (!productLineId || !batchNumber) {
        errors.push({
          productLineId,
          error: 'productLineId and batchNumber are required',
        })
        continue
      }

      // Get product line
      const productLine = await payload.findByID({
        collection: 'outbound-product-line',
        id: productLineId,
        depth: 1,
      })

      // Verify product line belongs to this job
      const lineJobId =
        typeof productLine.outboundInventoryId === 'object'
          ? productLine.outboundInventoryId.id
          : productLine.outboundInventoryId

      if (lineJobId !== jobId) {
        errors.push({
          productLineId,
          error: 'Product line does not belong to this job',
        })
        continue
      }

      const skuId =
        typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
      const warehouseId =
        typeof job.warehouseId === 'object' ? job.warehouseId.id : job.warehouseId

      if (!skuId) {
        errors.push({
          productLineId,
          error: 'Product line does not have a SKU',
        })
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
      })

      const inboundProductLineIds = inboundProductLines.docs.map((line) => line.id)

      if (inboundProductLineIds.length === 0) {
        errors.push({
          productLineId,
          error: `No inbound product lines found for batch ${batchNumber}`,
        })
        continue
      }

      let lpnRecordsToAllocate = []

      if (lpnIds && Array.isArray(lpnIds) && lpnIds.length > 0) {
        // Manual LPN selection
        const lpnRecords = await payload.find({
          collection: 'put-away-stock',
          where: {
            and: [
              {
                tenantId: {
                  equals: tenant.id,
                },
              },
              {
                lpnNumber: {
                  in: lpnIds,
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
        })

        // Verify all requested LPNs were found and are available
        const foundLpnNumbers = lpnRecords.docs.map((lpn) => lpn.lpnNumber)
        const missingLPNs = lpnIds.filter((id) => !foundLpnNumbers.includes(id))

        if (missingLPNs.length > 0) {
          errors.push({
            productLineId,
            error: `LPNs not found or not available: ${missingLPNs.join(', ')}`,
          })
          continue
        }

        lpnRecordsToAllocate = lpnRecords.docs
      } else if (quantity && quantity > 0) {
        // Auto-allocation by quantity - fetch all pages
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
            sort: 'createdAt', // FIFO allocation
            limit: 1000,
            page,
          })
          allAvailableLPNs.push(...availableLPNsResult.docs)
          hasMore = availableLPNsResult.hasNextPage
          page++
        }

        // Allocate LPNs until quantity requirement is met
        let allocatedQty = 0
        for (const lpn of allAvailableLPNs) {
          if (allocatedQty >= quantity) {
            break
          }
          lpnRecordsToAllocate.push(lpn)
          allocatedQty += lpn.huQty || 0
        }

        if (allocatedQty < quantity) {
          errors.push({
            productLineId,
            error: `Insufficient stock. Available: ${allocatedQty}, Required: ${quantity}`,
          })
          continue
        }
      } else {
        errors.push({
          productLineId,
          error: 'Either lpnIds or quantity must be provided',
        })
        continue
      }

      // Allocate the LPNs
      const allocatedLPNNumbers = []
      let totalAllocatedQty = 0
      let primaryLocation = ''

      for (const lpn of lpnRecordsToAllocate) {
        // Update PutAwayStock record
        await payload.update({
          collection: 'put-away-stock',
          id: lpn.id,
          data: {
            outboundInventoryId: jobId,
            outboundProductLineId: productLineId,
            allocationStatus: 'allocated',
            allocatedAt: new Date().toISOString(),
            allocatedBy: currentUser.id,
          },
        })

        allocatedLPNNumbers.push(lpn.lpnNumber)
        totalAllocatedQty += lpn.huQty || 0
        if (!primaryLocation && lpn.location) {
          primaryLocation = lpn.location
        }
      }

      // Get SKU to calculate weight and other metrics
      const sku = await payload.findByID({
        collection: 'skus',
        id: skuId,
      })

      const skuData = sku as {
        weightPerHU_kg?: number
        huPerSu?: number
        lengthPerHU_mm?: number
        widthPerHU_mm?: number
        heightPerHU_mm?: number
      }

      // Calculate allocated weight
      const allocatedWeight =
        skuData.weightPerHU_kg && totalAllocatedQty
          ? skuData.weightPerHU_kg * totalAllocatedQty
          : undefined

      // Calculate allocated cubic
      let allocatedCubicPerHU = undefined
      if (
        skuData.lengthPerHU_mm &&
        skuData.widthPerHU_mm &&
        skuData.heightPerHU_mm &&
        totalAllocatedQty > 0
      ) {
        allocatedCubicPerHU =
          (skuData.lengthPerHU_mm * skuData.widthPerHU_mm * skuData.heightPerHU_mm) /
          1_000_000_000
      }

      // Calculate pltQty
      let pltQty = undefined
      if (skuData.huPerSu && skuData.huPerSu > 0) {
        pltQty = totalAllocatedQty / skuData.huPerSu
      }

      // Update OutboundProductLine
      await payload.update({
        collection: 'outbound-product-line',
        id: productLineId,
        data: {
          allocatedQty: totalAllocatedQty,
          allocatedWeight,
          allocatedCubicPerHU,
          pltQty,
          LPN: allocatedLPNNumbers.map((lpnNum) => ({ lpnNumber: lpnNum })),
          location: primaryLocation,
        },
      })

      allocationResults.push({
        productLineId,
        batchNumber,
        allocatedQty: totalAllocatedQty,
        allocatedLPNs: allocatedLPNNumbers,
        location: primaryLocation,
      })
    }

    // Update job status based on allocation results
    if (allocationResults.length > 0) {
      // Check if all product lines are allocated
      const productLines = await payload.find({
        collection: 'outbound-product-line',
        where: {
          outboundInventoryId: {
            equals: jobId,
          },
        },
      })

      const allAllocated =
        productLines.docs.length > 0 &&
        productLines.docs.every(
          (line: any) => line.allocatedQty && line.allocatedQty > 0,
        )

      const newStatus = allAllocated ? 'allocated' : 'partially_allocated'

      await payload.update({
        collection: 'outbound-inventory',
        id: jobId,
        data: {
          status: newStatus,
        },
      })
    }

    return NextResponse.json({
      success: true,
      allocations: allocationResults,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Error allocating stock:', error)
    return NextResponse.json({ message: 'Failed to allocate stock' }, { status: 500 })
  }
}





