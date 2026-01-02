import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser: user } = context

    // Validate user exists (required for pickedUpBy field)
    if (!user || !user.id) {
      return NextResponse.json({ message: 'User authentication required' }, { status: 401 })
    }

    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)
    const body = await request.json()

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
        { status: 403 },
      )
    }

    // Verify container belongs to booking
    const container = await payload.findByID({
      collection: 'container-details',
      id: containerId,
      depth: 2, // Ensure polymorphic containerBookingId is loaded
    })

    if (!container) {
      return NextResponse.json({ message: 'Container not found' }, { status: 404 })
    }

    // Handle polymorphic relationship: number | { id: number } | { relationTo: string, value: {id: number} }
    let containerBookingId: number | undefined
    const containerBookingRef = (
      container as {
        containerBookingId?:
          | number
          | { id?: number | { id: number }; value?: number | { id: number }; relationTo?: string }
      }
    ).containerBookingId

    if (typeof containerBookingRef === 'object' && containerBookingRef !== null) {
      // When loaded with depth, Payload returns {relationTo: "...", value: {id: 1, ...}}
      if ('value' in containerBookingRef && containerBookingRef.value) {
        containerBookingId =
          typeof containerBookingRef.value === 'object' && containerBookingRef.value !== null
            ? (containerBookingRef.value as { id: number }).id
            : typeof containerBookingRef.value === 'number'
              ? containerBookingRef.value
              : undefined
      } else if ('id' in containerBookingRef && containerBookingRef.id) {
        containerBookingId =
          typeof containerBookingRef.id === 'object' && containerBookingRef.id !== null
            ? (containerBookingRef.id as { id: number }).id
            : typeof containerBookingRef.id === 'number'
              ? containerBookingRef.id
              : undefined
      }
    } else if (typeof containerBookingRef === 'number') {
      containerBookingId = containerBookingRef
    }

    if (containerBookingId !== bookingId) {
      return NextResponse.json(
        { message: 'Container does not belong to this booking' },
        { status: 400 },
      )
    }

    // Support both single pickup (backward compatibility) and multiple pickups
    const pickups = body.pickups || (body.productLineIndex !== undefined ? [body] : [])

    if (!Array.isArray(pickups) || pickups.length === 0) {
      return NextResponse.json(
        { message: 'Pickups array or single pickup data is required' },
        { status: 400 },
      )
    }

    // Get stock allocations for this container
    const allocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        containerDetailId: {
          equals: containerId,
        },
        stage: {
          equals: 'allocated',
        },
      },
      depth: 1,
    })

    if (allocations.docs.length === 0) {
      return NextResponse.json(
        { message: 'No allocated stock found for this container' },
        { status: 400 },
      )
    }

    const pickupResults = []
    const errors = []

    // Process each pickup
    for (const pickupData of pickups) {
      const { allocationId, productLineIndex, lpnIds, bufferQty, notes } = pickupData

      // Find the allocation (use provided allocationId or first allocation)
      let allocation =
        allocations.docs.find((a: any) => a.id === (allocationId || allocations.docs[0].id)) ||
        allocations.docs[0]

      if (!allocation) {
        errors.push({
          allocationId: allocationId || 'first',
          error: 'Allocation not found',
        })
        continue
      }

      const productLines = allocation.productLines || []
      if (productLineIndex === undefined || productLineIndex === null) {
        errors.push({
          allocationId: allocation.id,
          error: 'productLineIndex is required',
        })
        continue
      }

      if (productLineIndex < 0 || productLineIndex >= productLines.length) {
        errors.push({
          allocationId: allocation.id,
          productLineIndex,
          error: 'Invalid product line index',
        })
        continue
      }

      const productLine = productLines[productLineIndex]

      if (!productLine) {
        errors.push({
          allocationId: allocation.id,
          productLineIndex,
          error: 'Product line not found',
        })
        continue
      }

      // Get LPNs from PutAwayStock if lpnIds provided
      let pickedUpLPNs = []
      let validatedLoosenedQty = 0
      const loosenedLpnNumbers = pickupData.loosenedLpnNumbers || []
      const loosenedQty = pickupData.loosenedQty || 0

      if (lpnIds && Array.isArray(lpnIds) && lpnIds.length > 0) {
        // First, fetch all LPNs (including loosened) to separate them
        const allLpnRecords = await payload.find({
          collection: 'put-away-stock',
          where: {
            and: [
              {
                id: {
                  in: lpnIds,
                },
              },
              {
                containerStockAllocationId: {
                  equals: allocation.id,
                },
              },
              {
                allocationStatus: {
                  equals: 'allocated',
                },
              },
            ],
          },
          depth: 1,
        })

        // Separate regular LPNs from loosened stock
        const regularLPNs = allLpnRecords.docs.filter((lpn: any) => !lpn.isLoosened)
        const loosenedLPNs = allLpnRecords.docs.filter((lpn: any) => lpn.isLoosened)

        // Validate that all requested LPNs were found
        if (allLpnRecords.docs.length !== lpnIds.length) {
          const errorMsg = `Some LPNs not found or not allocated to this allocation. Found ${allLpnRecords.docs.length} of ${lpnIds.length} LPNs`
          errors.push({
            allocationId: allocation.id,
            productLineIndex,
            error: errorMsg,
          })
          continue
        }

        // Process regular LPNs
        pickedUpLPNs = regularLPNs.map((lpn: any) => {
          // Calculate the allocated quantity for this LPN
          let qty = 0
          if ((lpn as any).remainingHuQty !== undefined && (lpn as any).remainingHuQty !== null && (lpn as any).remainingHuQty > 0) {
            // Partially allocated: calculate allocated quantity
            if ((lpn as any).originalHuQty !== undefined && (lpn as any).originalHuQty !== null) {
              qty = (lpn as any).originalHuQty - (lpn as any).remainingHuQty
            } else {
              qty = (lpn.huQty || 0) - (lpn as any).remainingHuQty
            }
          } else if ((lpn as any).remainingHuQty === 0 && (lpn as any).originalHuQty !== undefined && (lpn as any).originalHuQty !== null) {
            // Fully allocated: use huQty which stores the allocated quantity
            qty = lpn.huQty || (lpn as any).originalHuQty || 0
          } else {
            // Fallback: use remainingHuQty or huQty
            qty = (lpn as any).remainingHuQty ?? lpn.huQty ?? 0
          }
          return {
            lpnId: lpn.id,
            lpnNumber: lpn.lpnNumber,
            huQty: qty,
            location: lpn.location,
            isLoosened: false,
          }
        })

        // Process loosened stock LPNs - add them to pickedUpLPNs with their loosenedQty
        if (loosenedLPNs.length > 0) {
          for (const loosenedLpn of loosenedLPNs) {
            pickedUpLPNs.push({
              lpnId: loosenedLpn.id,
              lpnNumber: loosenedLpn.lpnNumber,
              huQty: loosenedLpn.loosenedQty || loosenedLpn.huQty || 0,
              location: loosenedLpn.location,
              isLoosened: true,
            })
            // Add to validated loosened quantity
            validatedLoosenedQty += loosenedLpn.loosenedQty || loosenedLpn.huQty || 0
          }
        }
      } else if (pickupData.pickedUpLPNs && Array.isArray(pickupData.pickedUpLPNs)) {
        // Support direct LPN data (backward compatibility)
        pickedUpLPNs = pickupData.pickedUpLPNs
      }

      // Handle loosened stock if provided
      if (loosenedQty > 0) {
        const productLineSkuId = typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
        const productLineBatch = productLine.batchNumber

        if (productLineSkuId && productLineBatch) {
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
                    equals: productLineSkuId,
                  },
                },
                {
                  loosenedBatchNumber: {
                    equals: productLineBatch,
                  },
                },
                {
                  allocationStatus: {
                    equals: 'allocated',
                  },
                },
                {
                  containerStockAllocationId: {
                    equals: allocation.id,
                  },
                },
              ],
            },
            limit: 1000,
          })

          if (loosenedStock.docs.length > 0) {
            // Sum up all available loosened stock allocated to this allocation
            const totalAvailableLoosenedQty = loosenedStock.docs.reduce((sum, record) => {
              return sum + (record.loosenedQty || 0)
            }, 0)
            
            if (loosenedQty > totalAvailableLoosenedQty) {
              errors.push({
                allocationId: allocation.id,
                productLineIndex,
                error: `Requested ${loosenedQty} loosened items but only ${totalAvailableLoosenedQty} available`,
              })
              continue
            } else {
              validatedLoosenedQty = loosenedQty
            }
            
            // Add all loosened stock records to pickedUpLPNs so they get picked up
            // We'll distribute the picked quantity across them
            let remainingToPick = validatedLoosenedQty
            for (const loosenedRecord of loosenedStock.docs) {
              if (remainingToPick <= 0) break
              
              const recordQty = loosenedRecord.loosenedQty || 0
              if (recordQty > 0) {
                const pickedFromThisRecord = Math.min(recordQty, remainingToPick)
                pickedUpLPNs.push({
                  lpnId: loosenedRecord.id,
                  lpnNumber: loosenedRecord.lpnNumber,
                  huQty: pickedFromThisRecord,
                  location: loosenedRecord.location,
                  isLoosened: true,
                })
                remainingToPick -= pickedFromThisRecord
              }
            }
          } else {
            errors.push({
              allocationId: allocation.id,
              productLineIndex,
              error: 'No loosened stock available for this SKU+batch',
            })
            continue
          }
        }
      }

      if (pickedUpLPNs.length === 0 && validatedLoosenedQty === 0) {
        errors.push({
          allocationId: allocation.id,
          productLineIndex,
          error: 'At least one LPN or loosened quantity is required',
        })
        continue
      }

      // Calculate picked up quantity from regular LPNs (excluding loosened stock)
      const regularLPNQty = pickedUpLPNs
        .filter((lpn: any) => !lpn.isLoosened)
        .reduce((sum: number, lpn: any) => {
          return sum + (lpn.huQty || 0)
        }, 0)
      const pickedUpQty = regularLPNQty + validatedLoosenedQty

      const finalBufferQty = bufferQty || 0
      const finalPickedUpQty = pickedUpQty + finalBufferQty

      // Get SKU to calculate weight
      const skuId = typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
      let pickedWeight = productLine.pickedWeight || 0
      if (skuId) {
        try {
          const sku = await payload.findByID({
            collection: 'skus',
            id: skuId,
          })
          const skuData = sku as { weightPerHU_kg?: number }
          if (skuData.weightPerHU_kg) {
            pickedWeight = (productLine.pickedWeight || 0) + skuData.weightPerHU_kg * pickedUpQty
          }
        } catch (error) {
          console.error('Error fetching SKU for weight calculation:', error)
        }
      }

      // Calculate how much loosened quantity is picked from each loosened stock record
      const loosenedPickupMap = new Map<number, number>() // Map LPN ID to picked quantity
      if (validatedLoosenedQty > 0) {
        let remainingToDistribute = validatedLoosenedQty
        for (const lpn of pickedUpLPNs) {
          if ((lpn as any).isLoosened && remainingToDistribute > 0) {
            const pickedQty = lpn.huQty || 0
            loosenedPickupMap.set(typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId, pickedQty)
            remainingToDistribute -= pickedQty
          }
        }
      }

      // Create pickup record
      const pickedUpLPNsMapped = pickedUpLPNs.map((lpn: any) => {
        // Calculate the quantity to pick up
        let qty = 0
        if ((lpn as any).isLoosened) {
          // For loosened stock, use the actual picked quantity from the map
          qty = loosenedPickupMap.get(typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId) || 0
        } else {
          // For regular LPNs, use the huQty already calculated
          qty = lpn.huQty || 0
        }
        return {
          lpnId: typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId,
          lpnNumber: lpn.lpnNumber,
          huQty: qty,
          location: lpn.location,
          isLoosened: (lpn as any).isLoosened || false,
        }
      })

      const pickup = await payload.create({
        collection: 'pickup-stock',
        data: {
          tenantId: tenant.id,
          containerDetailId: containerId,
          containerStockAllocationId: allocation.id,
          pickedUpLPNs: pickedUpLPNsMapped,
          pickedUpLoosenedQty: validatedLoosenedQty,
          pickedUpQty,
          bufferQty: finalBufferQty,
          finalPickedUpQty,
          pickupStatus: 'completed',
          pickedUpBy: typeof user.id === 'number' ? user.id : Number(user.id), // Ensure it's a number
          notes: notes || '',
        },
      })

      // Update PutAwayStock allocation status to 'picked'
      // Track remaining loosened quantity to distribute across records
      let remainingLoosenedToPick = validatedLoosenedQty
      
      for (const lpn of pickedUpLPNs) {
        const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
        if (!lpnId) continue

        // Fetch current LPN record to get current quantities
        const lpnRecord = await payload.findByID({
          collection: 'put-away-stock',
          id: lpnId,
        })

        const lpnData: any = {
          allocationStatus: 'picked',
        }

        // If this is a loosened stock record, reduce the quantity picked
        if ((lpn as any).isLoosened) {
          const currentLoosenedQty = (lpnRecord as any).loosenedQty || 0
          
          // Calculate how much to pick from this record
          const pickedFromThisRecord = Math.min(currentLoosenedQty, remainingLoosenedToPick)
          
          const newLoosenedQty = currentLoosenedQty - pickedFromThisRecord
          
          if (newLoosenedQty <= 0) {
            // All loosened quantity picked up from this record
            lpnData.allocationStatus = 'picked'
            lpnData.loosenedQty = 0
            lpnData.huQty = 0
            lpnData.remainingHuQty = 0
          } else {
            // Partial pickup - reduce quantity but keep as allocated
            lpnData.loosenedQty = newLoosenedQty
            lpnData.huQty = newLoosenedQty
            lpnData.remainingHuQty = 0
            lpnData.allocationStatus = 'allocated' // Keep as allocated since not fully picked
          }
          
          // Reduce the remaining loosened quantity for next records
          remainingLoosenedToPick -= pickedFromThisRecord
        } else {
          // Regular LPN - mark as picked
          lpnData.remainingHuQty = 0
          lpnData.allocationStatus = 'picked'
        }

        await payload.update({
          collection: 'put-away-stock',
          id: lpnId,
          data: lpnData,
        })
      }

      // Update product line picked quantities
      const updatedProductLines = allocation.productLines.map((pl: any, idx: number) => {
        if (idx === productLineIndex) {
          return {
            ...pl,
            pickedQty: (pl.pickedQty || 0) + pickedUpQty,
            pickedWeight: pickedWeight,
          }
        }
        return pl
      })

      // Update allocation with updated product lines
      const updatedAllocation = await payload.update({
        collection: 'container-stock-allocations',
        id: allocation.id,
        data: {
          productLines: updatedProductLines,
        },
      })

      // Update allocation reference for next iteration
      allocation = updatedAllocation

      pickupResults.push({
        allocationId: allocation.id,
        productLineIndex,
        pickupId: pickup.id,
        pickedUpQty,
        finalPickedUpQty,
      })
    }

    // Check if all product lines across all allocations have been picked
    const allAllocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        containerDetailId: {
          equals: containerId,
        },
        stage: {
          equals: 'allocated',
        },
      },
      depth: 1,
    })

    let allPicked = true
    for (const alloc of allAllocations.docs) {
      const productLines = alloc.productLines || []
      if (productLines.length === 0) {
        allPicked = false
        break
      }
      for (const pl of productLines) {
        if (!pl.allocatedQty || pl.allocatedQty === 0) {
          continue // Skip lines with no allocation
        }
        if (!pl.pickedQty || pl.pickedQty < pl.allocatedQty) {
          allPicked = false
          break
        }
      }
      if (!allPicked) break
    }

    if (allPicked) {
      // Update container status to picked_up
      await payload.update({
        collection: 'container-details',
        id: containerId,
        data: {
          status: 'picked_up',
        },
      })
    }

    return NextResponse.json({
      success: true,
      pickups: pickupResults,
      errors: errors.length > 0 ? errors : undefined,
      allPicked,
    })
  } catch (error) {
    console.error('Error creating container pickup:', error)
    return NextResponse.json({ message: 'Failed to create pickup' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const containerId = Number(resolvedParams.containerId)

    const records = await payload.find({
      collection: 'pickup-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            containerDetailId: {
              equals: containerId,
            },
          },
          {
            pickupStatus: {
              not_equals: 'cancelled',
            },
          },
        ],
      },
      depth: 2,
      sort: '-createdAt',
    })

    return NextResponse.json({
      success: true,
      records: records.docs,
      count: records.docs.length,
    })
  } catch (error) {
    console.error('Error fetching container pickup records:', error)
    return NextResponse.json({ message: 'Failed to fetch pickup records' }, { status: 500 })
  }
}
