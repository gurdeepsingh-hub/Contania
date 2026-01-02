import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    // Accept both LPNs and loosened items
    const lpnNumbers = body.lpnNumbers || []
    const loosenedQty = body.loosenedQty || 0

    if ((!lpnNumbers || lpnNumbers.length === 0) && (!loosenedQty || loosenedQty <= 0)) {
      return NextResponse.json(
        { message: 'At least one LPN number or loosened quantity is required' },
        { status: 400 },
      )
    }

    // Verify tenant ownership through outbound inventory
    const productLine = await payload.findByID({
      collection: 'outbound-product-line',
      id: productLineId,
      depth: 1,
    })

    const outboundInventoryId =
      typeof productLine.outboundInventoryId === 'object'
        ? productLine.outboundInventoryId.id
        : productLine.outboundInventoryId

    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Validate each LPN
    const validatedLPNs = []
    const warnings: Array<{ lpnNumber: string; message: string }> = []

    for (const lpnNumber of lpnNumbers) {
      // Find LPN by number
      const lpnResult = await payload.find({
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
                equals: lpnNumber,
              },
            },
          ],
        },
        limit: 1,
      })

      if (lpnResult.docs.length === 0) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} not found`,
        })
        continue
      }

      const lpn = lpnResult.docs[0]

      // Check if LPN is allocated to this product line
      const lpnProductLineId =
        typeof lpn.outboundProductLineId === 'object'
          ? lpn.outboundProductLineId?.id
          : lpn.outboundProductLineId

      if (lpnProductLineId !== productLineId) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} is not allocated to this product line`,
        })
        continue
      }

      // Check if LPN status is 'allocated' (not already picked/dispatched)
      // Exception: loosened stock can be picked up even if status is 'allocated'
      if (lpn.allocationStatus !== 'allocated' && !(lpn as any).isLoosened) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} has status '${lpn.allocationStatus}' and cannot be picked up`,
        })
        continue
      }
      
      // For loosened stock, verify it's allocated to this product line
      if ((lpn as any).isLoosened && lpnProductLineId !== productLineId) {
        warnings.push({
          lpnNumber,
          message: `Loosened stock LPN ${lpnNumber} is not allocated to this product line`,
        })
        continue
      }

      // Check if LPN is allocated to the same job
      const lpnJobId =
        typeof lpn.outboundInventoryId === 'object'
          ? lpn.outboundInventoryId?.id
          : lpn.outboundInventoryId

      if (lpnJobId !== outboundInventoryId) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} is allocated to a different job`,
        })
        continue
      }

      validatedLPNs.push(lpn)
    }

    // Validate loosened stock if provided
    let validatedLoosenedQty = 0
    if (loosenedQty > 0) {
      const productLineSkuId =
        productLine.skuId && typeof productLine.skuId === 'object'
          ? productLine.skuId.id
          : productLine.skuId
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
            ],
          },
          limit: 1000,
        })

        if (loosenedStock.docs.length > 0) {
          // Sum up all available loosened stock allocated to this product line
          const totalAvailableLoosenedQty = loosenedStock.docs.reduce((sum, record) => {
            return sum + (record.loosenedQty || 0)
          }, 0)
          
          if (loosenedQty > totalAvailableLoosenedQty) {
            warnings.push({
              lpnNumber: 'LOOSENED',
              message: `Requested ${loosenedQty} loosened items but only ${totalAvailableLoosenedQty} available`,
            })
            validatedLoosenedQty = totalAvailableLoosenedQty
          } else {
            validatedLoosenedQty = loosenedQty
          }
          
          // Add all loosened stock records to validatedLPNs so they get picked up
          // We'll distribute the picked quantity across them
          let remainingToPick = validatedLoosenedQty
          for (const loosenedRecord of loosenedStock.docs) {
            if (remainingToPick <= 0) break
            
            const recordQty = loosenedRecord.loosenedQty || 0
            if (recordQty > 0) {
              // Add the record, we'll update quantities in the update loop
              validatedLPNs.push(loosenedRecord)
              remainingToPick -= recordQty
            }
          }
        } else {
          warnings.push({
            lpnNumber: 'LOOSENED',
            message: 'No loosened stock available for this SKU+batch',
          })
        }
      }
    }

    // If no valid LPNs and no valid loosened quantity, return error
    if (validatedLPNs.length === 0 && validatedLoosenedQty === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid LPNs or loosened items to pick up',
          warnings,
        },
        { status: 400 },
      )
    }

    // Calculate quantities
    // For regular LPNs, sum their allocated quantities
    // For loosened stock, use validatedLoosenedQty (the requested amount, not the sum of all records)
    const regularLPNs = validatedLPNs.filter((lpn) => !(lpn as any).isLoosened)
    const regularLPNQty = regularLPNs.reduce((sum, lpn) => {
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
        return sum + qty
      }, 0)
    const pickedUpQty = regularLPNQty + validatedLoosenedQty
    const bufferQty = body.bufferQty || 0
    const finalPickedUpQty = pickedUpQty + bufferQty

    // Calculate how much loosened quantity is picked from each loosened stock record
    // This needs to be done before creating the pickup record
    const loosenedPickupMap = new Map<number, number>() // Map LPN ID to picked quantity
    if (validatedLoosenedQty > 0) {
      let remainingToDistribute = validatedLoosenedQty
      for (const lpn of validatedLPNs) {
        if ((lpn as any).isLoosened && remainingToDistribute > 0) {
          const currentLoosenedQty = (lpn as any).loosenedQty || 0
          const pickedFromThisRecord = Math.min(currentLoosenedQty, remainingToDistribute)
          loosenedPickupMap.set(lpn.id, pickedFromThisRecord)
          remainingToDistribute -= pickedFromThisRecord
        }
      }
    }

    // Create pickup record
    const pickedUpLPNsMapped = validatedLPNs.map((lpn) => {
          // Calculate the quantity to pick up
          let qty = 0
          if ((lpn as any).isLoosened) {
            // For loosened stock, use the actual picked quantity from the map
            qty = loosenedPickupMap.get(lpn.id) || 0
          } else {
            // For regular LPNs, determine the allocated quantity
            if ((lpn as any).remainingHuQty !== undefined && (lpn as any).remainingHuQty !== null && (lpn as any).remainingHuQty > 0) {
              // Partially allocated: calculate allocated quantity
              if ((lpn as any).originalHuQty !== undefined && (lpn as any).originalHuQty !== null) {
                qty = (lpn as any).originalHuQty - (lpn as any).remainingHuQty
              } else {
                qty = (lpn.huQty || 0) - (lpn as any).remainingHuQty
              }
            } else if ((lpn as any).remainingHuQty === 0 && (lpn as any).originalHuQty !== undefined && (lpn as any).originalHuQty !== null) {
              // Fully allocated: use huQty which stores the allocated quantity
              // For opened pallets that were fully allocated, huQty contains the allocated quantity
              qty = lpn.huQty || (lpn as any).originalHuQty || 0
            } else {
              // Fallback: use remainingHuQty or huQty
              qty = (lpn as any).remainingHuQty ?? lpn.huQty ?? 0
            }
          }
          return {
            lpnId: lpn.id,
            lpnNumber: lpn.lpnNumber,
            huQty: qty,
            location: lpn.location,
            isLoosened: (lpn as any).isLoosened || false,
          }
        })
    const pickupRecord = await payload.create({
      collection: 'pickup-stock',
      data: {
        tenantId: tenant.id,
        outboundInventoryId: outboundInventoryId,
        outboundProductLineId: productLineId,
        pickedUpLPNs: pickedUpLPNsMapped,
        pickedUpLoosenedQty: validatedLoosenedQty, // Track the actual picked loosened quantity
        pickedUpQty,
        bufferQty,
        finalPickedUpQty,
        pickupStatus: 'completed',
        pickedUpBy: currentUser.id,
        notes: body.notes || '',
      },
    })

    // Update PutAwayStock records to 'picked' status
    // Track remaining loosened quantity to distribute across records
    // Use the same distribution logic as above
    let remainingLoosenedToPick = validatedLoosenedQty
    
    for (const lpn of validatedLPNs) {
      const lpnData: any = {
        allocationStatus: 'picked',
      }

      // If this is a loosened stock record, reduce the quantity picked
      if ((lpn as any).isLoosened) {
        const currentLoosenedQty = (lpn as any).loosenedQty || 0
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
        // If partially allocated, update remaining quantity
        const remainingQty = (lpn as any).remainingHuQty ?? lpn.huQty ?? 0
        const pickedQty = remainingQty
        lpnData.remainingHuQty = 0
      }

      await payload.update({
        collection: 'put-away-stock',
        id: lpn.id,
        data: lpnData,
      })
    }

    // Loosened stock is already handled in the validatedLPNs loop above
    // No need for separate handling here

    // Check if all product lines have pickup records
    const allProductLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: outboundInventoryId,
        },
      },
    })

    const pickupChecks = await Promise.all(
      allProductLines.docs.map(async (line: any) => {
        const pickups = await payload.find({
          collection: 'pickup-stock',
          where: {
            and: [
              {
                outboundProductLineId: {
                  equals: line.id,
                },
              },
              {
                pickupStatus: {
                  equals: 'completed',
                },
              },
            ],
          },
        })
        return pickups.docs.length > 0
      }),
    )

    const allPicked = pickupChecks.length > 0 && pickupChecks.every((picked) => picked)
    const somePicked = pickupChecks.some((picked) => picked)

    // Update job status based on pickup completion
    if (allPicked && job.status !== 'picked') {
      // All product lines are picked
      await payload.update({
        collection: 'outbound-inventory',
        id: outboundInventoryId,
        data: {
          status: 'picked',
        },
      })
    } else if (somePicked && job.status !== 'picked' && job.status !== 'partially_picked') {
      // Some but not all product lines are picked
      await payload.update({
        collection: 'outbound-inventory',
        id: outboundInventoryId,
        data: {
          status: 'partially_picked',
        },
      })
    }

    return NextResponse.json({
      success: true,
      pickupRecord,
      warnings: warnings.length > 0 ? warnings : undefined,
      jobStatusUpdated: allPicked,
    })
  } catch (error) {
    console.error('Error creating pickup record:', error)
    return NextResponse.json({ message: 'Failed to create pickup record' }, { status: 500 })
  }
}

