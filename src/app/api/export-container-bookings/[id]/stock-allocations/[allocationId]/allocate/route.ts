import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> }
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, user: currentUser } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const allocationId = Number(resolvedParams.allocationId)
    const body = await request.json()

    if (isNaN(bookingId) || isNaN(allocationId)) {
      return NextResponse.json({ message: 'Invalid booking or allocation ID' }, { status: 400 })
    }

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
      depth: 1,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Get the allocation
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth: 1,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to this booking
    const allocationBookingRef = (allocation as any).containerBookingId
    const allocationBookingId =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.id || (allocationBookingRef.value && allocationBookingRef.value.id)
        : allocationBookingRef

    const allocationRelationTo =
      typeof allocationBookingRef === 'object' && allocationBookingRef !== null
        ? allocationBookingRef.relationTo
        : null

    if (
      allocationBookingId !== bookingId ||
      allocationRelationTo !== 'export-container-bookings'
    ) {
      return NextResponse.json(
        { message: 'Stock allocation does not belong to this booking' },
        { status: 403 }
      )
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

    // Get container detail to get warehouse
    const containerDetailId =
      typeof allocation.containerDetailId === 'object'
        ? (allocation.containerDetailId as { id: number }).id
        : allocation.containerDetailId

    const containerDetail = await payload.findByID({
      collection: 'container-details',
      id: containerDetailId,
      depth: 1,
    })

    const warehouseId =
      containerDetail.warehouseId && typeof containerDetail.warehouseId === 'object'
        ? (containerDetail.warehouseId as { id: number }).id
        : containerDetail.warehouseId || null

    // Process each allocation
    for (const allocationItem of allocations) {
      const { productLineIndex, batchNumber, lpnIds, quantity } = allocationItem

      if (productLineIndex === undefined || productLineIndex === null || !batchNumber) {
        errors.push({
          productLineIndex,
          error: 'productLineIndex and batchNumber are required',
        })
        continue
      }

      const productLines = allocation.productLines || []
      if (productLineIndex < 0 || productLineIndex >= productLines.length) {
        errors.push({
          productLineIndex,
          error: 'Invalid product line index',
        })
        continue
      }

      const productLine = productLines[productLineIndex]

      // Check if product line is already fully allocated
      const existingAllocatedQty = productLine.allocatedQty || 0
      const expectedQty = productLine.expectedQty || 0
      if (expectedQty > 0 && existingAllocatedQty >= expectedQty) {
        errors.push({
          productLineIndex,
          error: `Product line is already fully allocated (${existingAllocatedQty}/${expectedQty})`,
        })
        continue
      }

      const skuId =
        typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId

      if (!skuId) {
        errors.push({
          productLineIndex,
          error: 'Product line does not have a SKU',
        })
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
      })

      const inboundProductLineIds = inboundProductLines.docs.map((line: { id: number }) => line.id)

      // Find container stock allocations with matching batch number and SKU in product lines
      // Note: container-stock-allocations doesn't have tenantId field, so we query by containerDetailId
      // Get container detail IDs for this warehouse to scope the allocation query
      // If warehouseId is null, we'll query by containerDetailId directly (just for this container)
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
      } else {
        // If no warehouseId, just use the current container's detail ID
        containerDetailIds = [containerDetailId]
      }
      
      // Query allocations for containers in this warehouse
      const containerStockAllocations = await payload.find({
        collection: 'container-stock-allocations',
        where: {
          containerDetailId: {
            in: containerDetailIds.length > 0 ? containerDetailIds : [-1], // Use -1 to return empty if no containers
          },
        },
        depth: 2,
        limit: 1000,
      })

      // Filter allocations that have product lines with matching batch number and SKU
      const matchingAllocationIds: number[] = []
      for (const alloc of containerStockAllocations.docs) {
        const productLines = (alloc as any).productLines || []
        const hasMatchingLine = productLines.some((line: any) => {
          const lineSkuId = typeof line.skuId === 'object' ? line.skuId.id : line.skuId
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
        errors.push({
          productLineIndex,
          error: `No stock found for batch ${batchNumber} and SKU ${skuId}`,
        })
        continue
      }

      let lpnRecordsToAllocate = []

      if (lpnIds && Array.isArray(lpnIds) && lpnIds.length > 0) {
        // Manual LPN selection - include both available and already-allocated-to-this-line LPNs
        // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
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
                        containerStockAllocationId: {
                          equals: allocationId,
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
        })

        // Separate available and already-allocated LPNs
        const availableLPNs = lpnRecords.docs.filter(
          (lpn: any) => lpn.allocationStatus === 'available'
        )
        const alreadyAllocatedLPNs = lpnRecords.docs.filter(
          (lpn: any) =>
            lpn.allocationStatus === 'allocated' &&
            (typeof lpn.containerStockAllocationId === 'object'
              ? lpn.containerStockAllocationId.id
              : lpn.containerStockAllocationId) === allocationId
        )

        // Verify all requested LPNs were found
        const foundLpnNumbers = lpnRecords.docs.map((lpn: { lpnNumber: string }) => lpn.lpnNumber)
        const missingLPNs = lpnIds.filter((id) => !foundLpnNumbers.includes(id))

        if (missingLPNs.length > 0) {
          errors.push({
            productLineIndex,
            error: `LPNs not found: ${missingLPNs.join(', ')}`,
          })
          continue
        }

        // Check if any LPNs are allocated to other allocations
        const allocatedToOther = lpnRecords.docs.filter(
          (lpn: any) =>
            lpn.allocationStatus === 'allocated' &&
            (typeof lpn.containerStockAllocationId === 'object'
              ? lpn.containerStockAllocationId.id
              : lpn.containerStockAllocationId) !== allocationId
        )

        if (allocatedToOther.length > 0) {
          errors.push({
            productLineIndex,
            error: `Some LPNs are already allocated to other containers: ${allocatedToOther.map((l: any) => l.lpnNumber).join(', ')}`,
          })
          continue
        }

        // Use available LPNs (already-allocated ones will be counted but not re-allocated)
        lpnRecordsToAllocate = availableLPNs
      } else if (quantity && quantity > 0) {
        // Auto-allocation by quantity - calculate remaining quantity needed
        const remainingQtyNeeded = Math.max(0, expectedQty - existingAllocatedQty)

        if (remainingQtyNeeded === 0) {
          errors.push({
            productLineIndex,
            error: `Product line is already fully allocated (${existingAllocatedQty}/${expectedQty})`,
          })
          continue
        }

        // Fetch available LPNs - fetch all pages
        // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
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

        // Allocate LPNs until remaining quantity requirement is met
        let allocatedQty = 0
        for (const lpn of allAvailableLPNs) {
          if (allocatedQty >= remainingQtyNeeded) {
            break
          }
          lpnRecordsToAllocate.push(lpn)
          allocatedQty += lpn.huQty || 0
        }

        if (allocatedQty < remainingQtyNeeded) {
          errors.push({
            productLineIndex,
            error: `Insufficient stock. Available: ${allocatedQty}, Still needed: ${remainingQtyNeeded} (already allocated: ${existingAllocatedQty}/${expectedQty})`,
          })
          continue
        }
      } else {
        errors.push({
          productLineIndex,
          error: 'Either lpnIds or quantity must be provided',
        })
        continue
      }

      // Allocate the LPNs
      const allocatedLPNNumbers = []
      let totalAllocatedQty = 0
      let primaryLocation = ''

      for (const lpn of lpnRecordsToAllocate) {
        // Check if LPN is already allocated to this allocation
        if (
          (typeof lpn.containerStockAllocationId === 'object'
            ? lpn.containerStockAllocationId.id
            : lpn.containerStockAllocationId) === allocationId &&
          lpn.allocationStatus === 'allocated'
        ) {
          // Already allocated to this allocation, skip
          allocatedLPNNumbers.push(lpn.lpnNumber)
          totalAllocatedQty += lpn.huQty || 0
          if (!primaryLocation && lpn.location) {
            primaryLocation = lpn.location
          }
          continue
        }

        // Update PutAwayStock record
        await payload.update({
          collection: 'put-away-stock',
          id: lpn.id,
          data: {
            containerStockAllocationId: allocationId,
            containerDetailId: containerDetailId,
            allocationStatus: 'allocated',
            allocatedAt: new Date().toISOString(),
            allocatedBy: currentUser?.id,
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

      // Update product line - add to existing allocatedQty
      const newAllocatedQty = existingAllocatedQty + totalAllocatedQty

      // Calculate new allocated weight (add to existing if present)
      const existingAllocatedWeight = productLine.allocatedWeight || 0
      const newAllocatedWeight = allocatedWeight
        ? existingAllocatedWeight + allocatedWeight
        : existingAllocatedWeight

      // Get existing LPNs and merge with new ones
      const existingLPNs = productLine.LPN || []
      const existingLPNNumbers = Array.isArray(existingLPNs)
        ? existingLPNs.map((lpn: any) => (typeof lpn === 'string' ? lpn : lpn.lpnNumber)).filter(Boolean)
        : []
      const mergedLPNNumbers = [...new Set([...existingLPNNumbers, ...allocatedLPNNumbers])]

      // Update the product line in the array
      const updatedProductLines = [...productLines]
      updatedProductLines[productLineIndex] = {
        ...productLine,
        allocatedQty: newAllocatedQty,
        allocatedWeight: newAllocatedWeight > 0 ? newAllocatedWeight : undefined,
        allocatedCubicPerHU: allocatedCubicPerHU || productLine.allocatedCubicPerHU,
        pltQty: pltQty || productLine.pltQty,
        LPN: mergedLPNNumbers.map((lpnNum) => ({ lpnNumber: lpnNum })),
        location: primaryLocation || productLine.location,
      }

      // Update the allocation with updated product lines
      await payload.update({
        collection: 'container-stock-allocations',
        id: allocationId,
        data: {
          productLines: updatedProductLines,
        },
      })

      allocationResults.push({
        productLineIndex,
        batchNumber,
        allocatedQty: totalAllocatedQty,
        allocatedLPNs: allocatedLPNNumbers,
        location: primaryLocation,
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

