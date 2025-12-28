import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; allocationId: string }> }
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const allocationId = Number(resolvedParams.allocationId)

    if (isNaN(bookingId) || isNaN(allocationId)) {
      return NextResponse.json({ message: 'Invalid booking or allocation ID' }, { status: 400 })
    }

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
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

    // Get product lines for this allocation
    const productLines = allocation.productLines || []

    const availabilityData = []

    for (let index = 0; index < productLines.length; index++) {
      const productLine = productLines[index]
      const batchNumber = productLine.batchNumber
      const skuId = typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
      const allocatedQty = productLine.allocatedQty || 0
      const expectedQty = productLine.expectedQty || 0

      // Calculate remaining quantity needed (allow allocating more even if fully allocated)
      const remainingQty = Math.max(0, expectedQty - allocatedQty)

      // If batch number or SKU is missing, still show the product line but with no available stock
      if (!batchNumber || !skuId) {
        availabilityData.push({
          productLineIndex: index,
          batchNumber: batchNumber || '',
          skuId: skuId || 0,
          requiredQty: remainingQty,
          availableQty: 0,
          availableLPNs: [],
          allocatedQty,
          expectedQty,
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
        depth: 1,
      })

      // Get inbound product line IDs
      const inboundProductLineIds = inboundProductLines.docs.map((line: { id: number }) => line.id)

      // Find container stock allocations with matching batch number and SKU in product lines
      // Note: container-stock-allocations doesn't have tenantId field, so we query by containerDetailId
      // We'll query allocations for containers in the same warehouse (via containerDetailId)
      // Since put-away-stock is already filtered by tenantId and warehouseId, this is safe
      
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

      // If no sources found, still return the product line with empty LPNs
      if (inboundProductLineIds.length === 0 && matchingAllocationIds.length === 0) {
        availabilityData.push({
          productLineIndex: index,
          batchNumber,
          skuId,
          requiredQty: remainingQty,
          availableQty: 0,
          availableLPNs: [],
          allocatedQty,
          expectedQty,
        })
        continue
      }

      // Find available LPNs from PutAwayStock using batch number and SKU ID
      // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
      const allAvailableLPNs = []
      let page = 1
      let hasMore = true

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
        // No sources to query, but still return the product line
        availabilityData.push({
          productLineIndex: index,
          batchNumber,
          skuId,
          requiredQty: remainingQty,
          availableQty: 0,
          availableLPNs: [],
          allocatedQty,
          expectedQty,
        })
        continue
      }

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
          depth: 1,
          limit: 1000,
          page,
        })
        allAvailableLPNs.push(...availableLPNsResult.docs)
        hasMore = availableLPNsResult.hasNextPage
        page++
      }

      // Find all LPNs (including allocated ones) for this batch/SKU to show in UI - fetch all pages
      // Query LPNs that match batch/SKU through either inbound-product-line OR container-stock-allocation
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
        const allocatedToAllocationId =
          isAllocated && lpn.containerStockAllocationId
            ? typeof lpn.containerStockAllocationId === 'object'
              ? (lpn.containerStockAllocationId as { id: number }).id
              : lpn.containerStockAllocationId
            : null

        // Check if LPN is allocated to this allocation (should be shown but marked as already allocated)
        const isAllocatedToThisAllocation = isAllocated && allocatedToAllocationId === allocationId
        // Check if LPN is allocated to another allocation (should be disabled)
        const isAllocatedToOtherAllocation = isAllocated && allocatedToAllocationId !== allocationId

        // Handle both inboundProductLineId and containerStockAllocationId (can be null)
        const inboundProductLineIdValue =
          lpn.inboundProductLineId && typeof lpn.inboundProductLineId === 'object'
            ? (lpn.inboundProductLineId as { id: number }).id
            : lpn.inboundProductLineId || null

        const containerStockAllocationIdValue =
          lpn.containerStockAllocationId && typeof lpn.containerStockAllocationId === 'object'
            ? (lpn.containerStockAllocationId as { id: number }).id
            : lpn.containerStockAllocationId || null

        return {
          id: lpn.id,
          lpnNumber: lpn.lpnNumber,
          location: lpn.location,
          huQty: lpn.huQty,
          inboundProductLineId: inboundProductLineIdValue,
          containerStockAllocationId: containerStockAllocationIdValue,
          isAllocatedToOtherContainer: isAllocatedToOtherAllocation,
          isAllocatedToThisAllocation: isAllocatedToThisAllocation,
          allocatedToAllocationId: allocatedToAllocationId !== allocationId ? allocatedToAllocationId : null,
        }
      })

      availabilityData.push({
        productLineIndex: index,
        batchNumber,
        skuId,
        requiredQty: remainingQty, // Use remaining quantity instead of expected quantity
        availableQty,
        availableLPNs: lpnData,
        allocatedQty, // Include allocated quantity for display
        expectedQty, // Include expected quantity for display
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

