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

    const jobTenantId =
      job.tenantId && typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
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
      job.warehouseId && typeof job.warehouseId === 'object'
        ? job.warehouseId.id
        : job.warehouseId || null

    // For each product line, find available stock
    const availabilityData = []

    for (const productLine of productLines.docs) {
      const batchNumber = productLine.batchNumber
      const skuId =
        productLine.skuId && typeof productLine.skuId === 'object'
          ? productLine.skuId.id
          : productLine.skuId
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

      // Find inbound product lines with matching batch number and SKU
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

      const inboundProductLineIds = inboundProductLines.docs.map((line: { id: number }) => line.id)

      // Find container stock allocations with matching batch number and SKU in product lines
      // Get container detail IDs for this warehouse to scope the allocation query
      // If warehouseId is null, we'll query all container stock allocations (tenant filtering happens at LPN level)
      let containerDetailIds: number[] = []
      
      if (warehouseId) {
        const warehouseContainers = await payload.find({
          collection: 'container-details',
          where: {
            and: [
              {
                warehouseId: {
                  equals: warehouseId,
                },
              },
            ],
          },
          limit: 1000,
          depth: 0,
        })
        
        containerDetailIds = warehouseContainers.docs
          .filter((c: any) => c && c.id)
          .map((c: { id: number }) => c.id)
      }
      
      // Query allocations for containers in this warehouse (or all if no warehouseId)
      // Note: When warehouseId is null, we query all allocations - tenant filtering happens at LPN level via tenantId
      const containerStockAllocations = await payload.find({
        collection: 'container-stock-allocations',
        where: containerDetailIds.length > 0
          ? {
              containerDetailId: {
                in: containerDetailIds,
              },
            }
          : {}, // Query all allocations when no warehouseId - tenant filtering at LPN level
        depth: 2,
        limit: 1000,
      })

      // Filter allocations that have product lines with matching batch number and SKU
      const matchingAllocationIds: number[] = []
      for (const alloc of containerStockAllocations.docs) {
        const productLines = (alloc as any).productLines || []
        const hasMatchingLine = productLines.some((line: any) => {
          if (!line.batchNumber || !line.skuId) {
            return false
          }
          const lineSkuId =
            typeof line.skuId === 'object' && line.skuId !== null ? line.skuId.id : line.skuId
          return line.batchNumber === batchNumber && lineSkuId === skuId
        })
        if (hasMatchingLine) {
          matchingAllocationIds.push(alloc.id)
        }
      }

      // Build OR conditions for matching LPNs
      const orConditions: any[] = []
      
      if (inboundProductLineIds.length > 0) {
        orConditions.push({
          inboundProductLineId: {
            in: inboundProductLineIds,
          },
        })
      }
      
      if (matchingAllocationIds.length > 0) {
        orConditions.push({
          containerStockAllocationId: {
            in: matchingAllocationIds,
          },
        })
      }

      if (orConditions.length === 0) {
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
      // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
      // Partially allocated pallets remain as "available" so they'll show up here
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
                or: orConditions,
              },
              {
                allocationStatus: {
                  equals: 'available',
                },
              },
              {
                isLoosened: {
                  not_equals: true,
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

      // Also fetch loosened stock for this SKU+batch
      const loosenedStock = await payload.find({
        collection: 'put-away-stock',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              isLoosened: {
                equals: true,
              },
            },
            {
              loosenedSkuId: {
                equals: skuId,
              },
            },
            {
              loosenedBatchNumber: {
                equals: batchNumber,
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
        limit: 1,
      })
      
      // Add loosened stock to available LPNs
      if (loosenedStock.docs.length > 0) {
        allAvailableLPNs.push(...loosenedStock.docs)
      }

      // Find all LPNs (including allocated ones) for this batch/SKU to show in UI - fetch all pages
      // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
      // Include available pallets and allocated LPNs (for display purposes)
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
                or: orConditions,
              },
              {
                or: [
                  {
                    allocationStatus: {
                      equals: 'available',
                    },
                  },
                  {
                    and: [
                      {
                        allocationStatus: {
                          equals: 'allocated',
                        },
                      },
                      {
                        outboundInventoryId: {
                          equals: jobId,
                        },
                      },
                      {
                        outboundProductLineId: {
                          equals: productLine.id,
                        },
                      },
                    ],
                  },
                ],
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

      // Calculate available quantity - use remainingHuQty for opened pallets, loosenedQty for loosened stock
      const availableQty = allAvailableLPNs.reduce((sum, lpn: any) => {
        if (lpn.isLoosened) {
          return sum + (lpn.loosenedQty || 0)
        }
        // Use remainingHuQty if available, otherwise use huQty
        return sum + ((lpn.remainingHuQty ?? lpn.huQty) || 0)
      }, 0)

      // Format LPN data - include both available and allocated LPNs
      const lpnData = allLPNsList.map((lpn) => {
        const isAllocated = lpn.allocationStatus === 'allocated'
        const allocatedToJobId =
          isAllocated && lpn.outboundInventoryId
            ? typeof lpn.outboundInventoryId === 'object' && lpn.outboundInventoryId !== null
              ? lpn.outboundInventoryId.id
              : lpn.outboundInventoryId
            : null

        // Check if LPN is allocated to this product line (should be shown but marked as already allocated)
        const allocatedToProductLineId =
          isAllocated && lpn.outboundProductLineId
            ? typeof lpn.outboundProductLineId === 'object' && lpn.outboundProductLineId !== null
              ? lpn.outboundProductLineId.id
              : lpn.outboundProductLineId
            : null
        const isAllocatedToThisProductLine =
          isAllocated && allocatedToProductLineId === productLine.id

        // Check if LPN is allocated to another job (should be disabled)
        const isAllocatedToOtherJob = isAllocated && allocatedToJobId !== jobId

        // Get job code if allocated to another job
        let allocatedToJobCode = null
        if (isAllocatedToOtherJob && allocatedToJobId) {
          try {
            const allocatedJob = lpn.outboundInventoryId
            if (typeof allocatedJob === 'object' && allocatedJob !== null && allocatedJob.jobCode) {
              allocatedToJobCode = allocatedJob.jobCode
            }
          } catch (error) {
            // If we can't get job code, just use job ID
            console.warn('Could not fetch job code for allocated LPN:', error)
          }
        }

        // Handle inboundProductLineId - can be null for container stock allocations
        const inboundProductLineIdValue =
          lpn.inboundProductLineId && typeof lpn.inboundProductLineId === 'object'
            ? lpn.inboundProductLineId.id
            : lpn.inboundProductLineId || null

        // Handle containerStockAllocationId - can be null for inbound product lines
        const containerStockAllocationIdValue =
          lpn.containerStockAllocationId && typeof lpn.containerStockAllocationId === 'object'
            ? lpn.containerStockAllocationId.id
            : lpn.containerStockAllocationId || null

        // Determine quantity to show - use remainingHuQty for opened pallets, loosenedQty for loosened stock
        let displayQty = 0
        if (lpn.isLoosened) {
          displayQty = lpn.loosenedQty || 0
        } else if (lpn.remainingHuQty !== undefined && lpn.remainingHuQty !== null) {
          displayQty = lpn.remainingHuQty
        } else {
          displayQty = lpn.huQty || 0
        }

        return {
          id: lpn.id,
          lpnNumber: lpn.lpnNumber,
          location: lpn.location,
          huQty: displayQty,
          originalHuQty: lpn.originalHuQty || lpn.huQty || 0,
          remainingHuQty: lpn.remainingHuQty ?? (lpn.isLoosened ? lpn.loosenedQty : lpn.huQty) ?? 0,
          isLoosened: lpn.isLoosened || false,
          loosenedQty: lpn.loosenedQty || 0,
          inboundProductLineId: inboundProductLineIdValue,
          containerStockAllocationId: containerStockAllocationIdValue,
          isAllocatedToThisProductLine: isAllocatedToThisProductLine,
          isAllocatedToOtherJob: isAllocatedToOtherJob,
          allocatedToJobId: isAllocatedToOtherJob ? allocatedToJobId : null,
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





