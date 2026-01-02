import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Create or update loosened stock record for a SKU+batch combination
 */
async function createOrUpdateLoosenedStock(
  payload: any,
  tenantId: number,
  skuId: number,
  batchNumber: string,
  warehouseId: number | null,
  quantity: number,
  parentLpnId?: number,
) {
  // Find existing loosened stock for this SKU+batch+warehouse
  const existing = await payload.find({
    collection: 'put-away-stock',
    where: {
      and: [
        {
          tenantId: {
            equals: tenantId,
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

  if (existing.docs.length > 0) {
    // Update existing loosened stock
    const loosened = existing.docs[0]
    const currentQty = loosened.loosenedQty || 0
    await payload.update({
      collection: 'put-away-stock',
      id: loosened.id,
      data: {
        loosenedQty: currentQty + quantity,
        huQty: currentQty + quantity, // Keep huQty in sync
        remainingHuQty: currentQty + quantity,
      },
    })
    return loosened.id
  } else {
    // Create new loosened stock record
    const loosened = await payload.create({
      collection: 'put-away-stock',
      data: {
        tenantId,
        skuId, // Still need skuId for the record
        warehouseId: warehouseId || undefined,
        location: 'LOOSENED', // Special location for loosened items
        huQty: quantity,
        originalHuQty: quantity,
        remainingHuQty: quantity,
        isLoosened: true,
        loosenedQty: quantity,
        loosenedSkuId: skuId,
        loosenedBatchNumber: batchNumber,
        parentLpnId: parentLpnId || undefined,
        allocationStatus: 'available',
        lpnNumber: `LOOSENED-${skuId}-${batchNumber}`, // Will be generated if not unique
      },
    })
    return loosened.id
  }
}

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

    const jobTenantId =
      job.tenantId && typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
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
        productLine.outboundInventoryId && typeof productLine.outboundInventoryId === 'object'
          ? productLine.outboundInventoryId.id
          : productLine.outboundInventoryId

      if (lineJobId !== jobId) {
        errors.push({
          productLineId,
          error: 'Product line does not belong to this job',
        })
        continue
      }

      // Check if product line is already fully allocated
      const existingAllocatedQty = productLine.allocatedQty || 0
      const expectedQty = productLine.expectedQty || 0
      if (expectedQty > 0 && existingAllocatedQty >= expectedQty) {
        errors.push({
          productLineId,
          error: `Product line is already fully allocated (${existingAllocatedQty}/${expectedQty})`,
        })
        continue
      }

      const skuId =
        productLine.skuId && typeof productLine.skuId === 'object'
          ? productLine.skuId.id
          : productLine.skuId
      const warehouseId =
        job.warehouseId && typeof job.warehouseId === 'object'
          ? job.warehouseId.id
          : job.warehouseId || null

      if (!skuId) {
        errors.push({
          productLineId,
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
        errors.push({
          productLineId,
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
                        outboundProductLineId: {
                          equals: productLineId,
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
            lpn.outboundProductLineId &&
            (typeof lpn.outboundProductLineId === 'object'
              ? lpn.outboundProductLineId.id
              : lpn.outboundProductLineId) === productLineId
        )

        // Verify all requested LPNs were found
        const foundLpnNumbers = lpnRecords.docs.map((lpn: { lpnNumber: string }) => lpn.lpnNumber)
        const missingLPNs = lpnIds.filter((id) => !foundLpnNumbers.includes(id))

        if (missingLPNs.length > 0) {
          errors.push({
            productLineId,
            error: `LPNs not found: ${missingLPNs.join(', ')}`,
          })
          continue
        }

        // Check if any LPNs are allocated to other product lines
        const allocatedToOtherLines = lpnRecords.docs.filter(
          (lpn: any) =>
            lpn.allocationStatus === 'allocated' &&
            lpn.outboundProductLineId &&
            (typeof lpn.outboundProductLineId === 'object'
              ? lpn.outboundProductLineId.id
              : lpn.outboundProductLineId) !== productLineId
        )

        if (allocatedToOtherLines.length > 0) {
          errors.push({
            productLineId,
            error: `Some LPNs are already allocated to other product lines: ${allocatedToOtherLines.map((l: any) => l.lpnNumber).join(', ')}`,
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
            productLineId,
            error: `Product line is already fully allocated (${existingAllocatedQty}/${expectedQty})`,
          })
          continue
        }

        // Fetch opened pallets first (prioritize already-opened pallets)
        const openedPallets = []
        let page = 1
        let hasMore = true
        
        while (hasMore) {
          const openedResult = await payload.find({
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
                  remainingHuQty: {
                    exists: true,
                  },
                },
                {
                  originalHuQty: {
                    exists: true,
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
            sort: 'createdAt',
            limit: 1000,
            page,
          })
          
          // Filter to only opened pallets (remainingHuQty < originalHuQty)
          const filtered = openedResult.docs.filter((lpn: any) => {
            const remaining = lpn.remainingHuQty || lpn.huQty
            const original = lpn.originalHuQty || lpn.huQty
            return remaining < original && remaining > 0
          })
          openedPallets.push(...filtered)
          hasMore = openedResult.hasNextPage
          page++
        }

        // Fetch full pallets (not opened) - fetch all available and filter
        const allFullPallets = []
        page = 1
        hasMore = true
        
        while (hasMore) {
          const fullResult = await payload.find({
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
            sort: 'createdAt',
            limit: 1000,
            page,
          })
          
          allFullPallets.push(...fullResult.docs)
          hasMore = fullResult.hasNextPage
          page++
        }
        
        // Filter to full pallets (remainingHuQty === originalHuQty or not set, and not in openedPallets)
        const openedLpnIds = new Set(openedPallets.map((l: any) => l.id))
        const fullPallets = allFullPallets.filter((lpn: any) => {
          if (openedLpnIds.has(lpn.id)) return false
          const remaining = lpn.remainingHuQty ?? lpn.huQty
          const original = lpn.originalHuQty ?? lpn.huQty
          return remaining === original
        })

        // Fetch loosened stock for this SKU+batch
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

        // Allocate using partial pallet logic
        let allocatedQty = 0
        const partialAllocations: Array<{ lpn: any; qty: number }> = []
        const THRESHOLD_PERCENTAGE = 0.85 // 85% threshold

        // First, try to use loosened stock
        if (loosenedStock.docs.length > 0) {
          const loosened = loosenedStock.docs[0]
          const loosenedQty = loosened.loosenedQty || 0
          if (loosenedQty > 0) {
            const qtyToTake = Math.min(loosenedQty, remainingQtyNeeded - allocatedQty)
            allocatedQty += qtyToTake
            partialAllocations.push({ lpn: loosened, qty: qtyToTake })
          }
        }

        // Then prioritize opened pallets
        for (const lpn of openedPallets) {
          if (allocatedQty >= remainingQtyNeeded) break

          const remaining = lpn.remainingHuQty || lpn.huQty
          const original = lpn.originalHuQty || lpn.huQty
          const needed = remainingQtyNeeded - allocatedQty

          if (remaining === needed) {
            // Exact match - assign whole pallet
            lpnRecordsToAllocate.push(lpn)
            allocatedQty += remaining
          } else if (remaining > needed) {
            // Take only needed quantity (partial allocation)
            partialAllocations.push({ lpn, qty: needed })
            allocatedQty += needed
          } else {
            // Take all remaining (remaining < needed)
            lpnRecordsToAllocate.push(lpn)
            allocatedQty += remaining
          }
        }

        // Then use full pallets
        for (const lpn of fullPallets) {
          if (allocatedQty >= remainingQtyNeeded) break

          const palletQty = lpn.huQty || 0
          const needed = remainingQtyNeeded - allocatedQty
          const percentageNeeded = palletQty > 0 ? needed / palletQty : 0

          if (percentageNeeded >= THRESHOLD_PERCENTAGE) {
            // Assign whole pallet, create loosened stock for remainder
            lpnRecordsToAllocate.push(lpn)
            allocatedQty += palletQty
            const remainder = palletQty - needed
            if (remainder > 0) {
              // Will create loosened stock after allocation
              partialAllocations.push({ lpn, qty: -remainder }) // Negative indicates remainder
            }
          } else {
            // Take only needed quantity
            partialAllocations.push({ lpn, qty: needed })
            allocatedQty += needed
          }
        }

        if (allocatedQty < remainingQtyNeeded) {
          errors.push({
            productLineId,
            error: `Insufficient stock. Available: ${allocatedQty}, Still needed: ${remainingQtyNeeded} (already allocated: ${existingAllocatedQty}/${expectedQty})`,
          })
          continue
        }

        // Store partial allocations for processing after main allocation
        ;(allocation as any).partialAllocations = partialAllocations
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
      const partialAllocations = (allocation as any).partialAllocations || []

      // Process full pallet allocations
      for (const lpn of lpnRecordsToAllocate) {
        // Check if LPN is already allocated to this product line
        const lpnProductLineId =
          lpn.outboundProductLineId && typeof lpn.outboundProductLineId === 'object'
            ? lpn.outboundProductLineId.id
            : lpn.outboundProductLineId
        if (lpnProductLineId === productLineId && lpn.allocationStatus === 'allocated') {
          // Already allocated to this product line, skip
          allocatedLPNNumbers.push(lpn.lpnNumber)
          const qty = lpn.remainingHuQty || lpn.huQty || 0
          totalAllocatedQty += qty
          if (!primaryLocation && lpn.location) {
            primaryLocation = lpn.location
          }
          continue
        }

        // Update PutAwayStock record
        // For opened pallets that are fully allocated, store the allocated quantity in huQty
        // This preserves the actual allocated quantity (remainingHuQty before allocation)
        const allocatedQty = lpn.remainingHuQty !== undefined && lpn.remainingHuQty !== null
          ? lpn.remainingHuQty  // For opened pallets, this is what was allocated
          : (lpn.huQty || 0)    // For full pallets, use huQty
        
        await payload.update({
          collection: 'put-away-stock',
          id: lpn.id,
          data: {
            outboundInventoryId: jobId,
            outboundProductLineId: productLineId,
            allocationStatus: 'allocated',
            allocatedAt: new Date().toISOString(),
            allocatedBy: currentUser.id,
            // Ensure originalHuQty and remainingHuQty are set
            // For full pallet allocation, remainingHuQty should be 0
            originalHuQty: lpn.originalHuQty || lpn.huQty,
            remainingHuQty: 0, // Full pallet allocated, nothing remaining
            // Store the actual allocated quantity in huQty for opened pallets
            huQty: allocatedQty, // This preserves the allocated quantity for display
          },
        })

        allocatedLPNNumbers.push(lpn.lpnNumber)
        // For opened pallets, use remainingHuQty; for full pallets, use huQty
        const qty = lpn.remainingHuQty !== undefined && lpn.remainingHuQty !== null 
          ? lpn.remainingHuQty 
          : (lpn.huQty || 0)
        totalAllocatedQty += qty
        if (!primaryLocation && lpn.location) {
          primaryLocation = lpn.location
        }
      }

      // Process partial allocations
      for (const partial of partialAllocations) {
        const { lpn, qty } = partial
        
        if (qty < 0) {
          // Negative qty indicates remainder from whole pallet allocation
          // Create loosened stock for remainder
          const remainder = Math.abs(qty)
          await createOrUpdateLoosenedStock(
            payload,
            tenant.id,
            skuId,
            batchNumber,
            warehouseId,
            remainder,
            lpn.id,
          )
        } else {
          // Partial allocation - create loosened stock for allocated quantity, keep pallet available
          const currentRemaining = lpn.remainingHuQty || lpn.huQty || 0
          const originalQty = lpn.originalHuQty || lpn.huQty || 0
          const newRemaining = currentRemaining - qty

          // Update the pallet - reduce remaining quantity but keep it as "available"
          // Don't link it to product line since most of it is still on the pallet
          await payload.update({
            collection: 'put-away-stock',
            id: lpn.id,
            data: {
              remainingHuQty: newRemaining,
              originalHuQty: originalQty,
              // Keep allocationStatus as 'available' - don't mark as allocated
              // Don't set outboundInventoryId or outboundProductLineId
            },
          })

          // Create a NEW loosened stock record specifically for this allocation
          // This ensures we allocate exactly the quantity needed, not aggregated loosened stock
          // Generate unique LPN number for loosened stock
          const timestamp = Date.now()
          const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
          const loosenedLpnNumber = `LOOSENED-${skuId}-${batchNumber}-${timestamp}-${randomSuffix}`
          
          // Use the original pallet's location for the loosened stock
          const loosenedLocation = lpn.location || 'LOOSENED'
          
          const loosenedStockRecord = await payload.create({
            collection: 'put-away-stock',
            data: {
              tenantId: tenant.id,
              skuId, // Still need skuId for the record
              warehouseId: warehouseId || undefined,
              location: loosenedLocation, // Use original pallet's location
              huQty: qty,
              originalHuQty: qty,
              remainingHuQty: 0, // Fully allocated, nothing remaining
              isLoosened: true,
              loosenedQty: qty,
              loosenedSkuId: skuId,
              loosenedBatchNumber: batchNumber,
              parentLpnId: lpn.id,
              allocationStatus: 'allocated', // Immediately allocate to product line
              outboundInventoryId: jobId,
              outboundProductLineId: productLineId,
              allocatedAt: new Date().toISOString(),
              allocatedBy: currentUser.id,
              lpnNumber: loosenedLpnNumber, // Unique LPN for this allocation
            },
          })
          allocatedLPNNumbers.push(loosenedStockRecord.lpnNumber)

          // Track allocated quantity
          totalAllocatedQty += qty
          if (!primaryLocation && lpn.location) {
            primaryLocation = lpn.location
          }
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

      // Update OutboundProductLine - add to existing allocatedQty
      const newAllocatedQty = existingAllocatedQty + totalAllocatedQty
      
      // Calculate new allocated weight (add to existing if present)
      const existingAllocatedWeight = productLine.allocatedWeight || 0
      const newAllocatedWeight = allocatedWeight 
        ? existingAllocatedWeight + allocatedWeight 
        : existingAllocatedWeight

      // Get existing LPNs and merge with new ones
      const existingLPNs = productLine.LPN || []
      const existingLPNNumbers = Array.isArray(existingLPNs) 
        ? existingLPNs.map((lpn: any) => typeof lpn === 'string' ? lpn : lpn.lpnNumber).filter(Boolean)
        : []
      const mergedLPNNumbers = [...new Set([...existingLPNNumbers, ...allocatedLPNNumbers])]

      await payload.update({
        collection: 'outbound-product-line',
        id: productLineId,
        data: {
          allocatedQty: newAllocatedQty,
          allocatedWeight: newAllocatedWeight > 0 ? newAllocatedWeight : undefined,
          allocatedCubicPerHU: allocatedCubicPerHU || productLine.allocatedCubicPerHU,
          pltQty: pltQty || productLine.pltQty,
          LPN: mergedLPNNumbers.map((lpnNum) => ({ lpnNumber: lpnNum })),
          location: primaryLocation || productLine.location,
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
    if (allocationResults.length > 0 || errors.length > 0) {
      // Re-fetch all product lines to get the latest allocation status
      const productLines = await payload.find({
        collection: 'outbound-product-line',
        where: {
          outboundInventoryId: {
            equals: jobId,
          },
        },
      })

      // Check if all product lines are fully allocated
      // A product line is considered allocated if allocatedQty >= expectedQty and expectedQty > 0
      const allAllocated =
        productLines.docs.length > 0 &&
        productLines.docs.every((line: any) => {
          const allocatedQty = line.allocatedQty || 0
          const expectedQty = line.expectedQty || 0
          // If expectedQty is 0 or not set, consider it allocated if allocatedQty > 0
          // Otherwise, check if allocatedQty >= expectedQty
          return expectedQty === 0 ? allocatedQty > 0 : allocatedQty >= expectedQty
        })

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





