import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Batch endpoint to fetch multiple LPN records by IDs
 * Accepts an array of record IDs and returns their SKU IDs and warehouse IDs
 */
export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()
    const { ids } = body

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'IDs array is required' }, { status: 400 })
    }

    // Limit batch size to prevent abuse
    if (ids.length > 500) {
      return NextResponse.json(
        { message: 'Maximum 500 records per batch request' },
        { status: 400 },
      )
    }

    // Convert string IDs to numbers
    const recordIds = ids.map((id: string | number) => Number(id)).filter((id) => !isNaN(id))

    if (recordIds.length === 0) {
      return NextResponse.json({ message: 'No valid IDs provided' }, { status: 400 })
    }

    // Fetch all records in a single query using 'in' operator
    const result = await payload.find({
      collection: 'put-away-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            id: {
              in: recordIds,
            },
          },
        ],
      },
      depth: 1, // Only need SKU and warehouse IDs, minimal depth
      limit: recordIds.length,
    })

    // Extract SKU IDs and warehouse IDs from records
    const records = result.docs.map((record: any) => {
      const skuId = typeof record.skuId === 'object' ? record.skuId?.id : record.skuId
      const warehouseId =
        typeof record.warehouseId === 'object' ? record.warehouseId?.id : record.warehouseId

      return {
        id: record.id,
        skuId: skuId || null,
        warehouseId: warehouseId || null,
      }
    })

    return NextResponse.json({
      success: true,
      records,
    })
  } catch (error) {
    console.error('Error fetching batch LPN records:', error)
    return NextResponse.json({ message: 'Failed to fetch batch LPN records' }, { status: 500 })
  }
}

/**
 * Batch endpoint to update multiple LPN records
 * Accepts an array of updates, each with id and update data
 */
export async function PUT(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const body = await request.json()
    const { updates } = body

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ message: 'Updates array is required' }, { status: 400 })
    }

    // Limit batch size to prevent abuse
    if (updates.length > 500) {
      return NextResponse.json({ message: 'Maximum 500 records per batch update' }, { status: 400 })
    }

    // Process updates - for status changes with side effects, process sequentially
    // For simple updates, we can batch them
    const results: Array<{ id: number; success: boolean; error?: string }> = []
    const simpleUpdates: Array<{ id: number; data: Record<string, unknown> }> = []
    const complexUpdates: Array<{ id: number; updateData: any }> = []

    // Separate simple updates from complex ones (those with status changes)
    for (const update of updates) {
      const recordId = Number(update.id)
      if (isNaN(recordId)) {
        results.push({ id: update.id, success: false, error: 'Invalid record ID' })
        continue
      }

      // Check if this is a complex update (has status change)
      const hasStatusChange = update.allocationStatus !== undefined
      if (hasStatusChange) {
        complexUpdates.push({ id: recordId, updateData: update })
      } else {
        simpleUpdates.push({ id: recordId, data: update })
      }
    }

    // Process simple updates in parallel
    if (simpleUpdates.length > 0) {
      const simplePromises = simpleUpdates.map(async ({ id, data }) => {
        try {
          // Verify record exists and belongs to tenant
          const existingRecord = await payload.findByID({
            collection: 'put-away-stock',
            id,
          })

          if (!existingRecord) {
            return { id, success: false, error: 'Record not found' }
          }

          const recordTenantId =
            typeof existingRecord.tenantId === 'object'
              ? existingRecord.tenantId.id
              : existingRecord.tenantId
          if (recordTenantId !== tenant.id) {
            return { id, success: false, error: 'Record not found' }
          }

          // Build update data
          const updateData: Record<string, unknown> = {}
          if (data.location !== undefined) updateData.location = data.location
          if (data.huQty !== undefined) updateData.huQty = Number(data.huQty)

          // Handle allocation fields
          if (data.outboundInventoryId !== undefined) {
            updateData.outboundInventoryId = data.outboundInventoryId
          }
          if (data.outboundProductLineId !== undefined) {
            updateData.outboundProductLineId = data.outboundProductLineId
          }
          if (data.allocatedAt !== undefined) {
            updateData.allocatedAt = data.allocatedAt
          }
          if (data.allocatedBy !== undefined) {
            updateData.allocatedBy = data.allocatedBy
          }

          if (Object.keys(updateData).length === 0) {
            return { id, success: false, error: 'No valid fields to update' }
          }

          await payload.update({
            collection: 'put-away-stock',
            id,
            data: updateData,
          })

          return { id, success: true }
        } catch (error: any) {
          console.error(`Error updating record ${id}:`, error)
          return { id, success: false, error: error.message || 'Update failed' }
        }
      })

      const simpleResults = await Promise.all(simplePromises)
      results.push(...simpleResults)
    }

    // Process complex updates sequentially (they may have side effects like creating pickup entries)
    // We'll reuse the logic from the individual PUT endpoint by calling it internally
    // For now, let's process them one by one using the same validation logic
    for (const { id, updateData } of complexUpdates) {
      try {
        // Verify record exists and belongs to tenant
        const existingRecord = await payload.findByID({
          collection: 'put-away-stock',
          id,
        })

        if (!existingRecord) {
          results.push({ id, success: false, error: 'Record not found' })
          continue
        }

        const recordTenantId =
          typeof existingRecord.tenantId === 'object'
            ? existingRecord.tenantId.id
            : existingRecord.tenantId
        if (recordTenantId !== tenant.id) {
          results.push({ id, success: false, error: 'Record not found' })
          continue
        }

        // Check if deleted
        if ((existingRecord as any).isDeleted === true) {
          results.push({ id, success: false, error: 'Record not found' })
          continue
        }

        // Get current status
        const currentStatus = (existingRecord as any).allocationStatus || 'available'
        const currentOutboundInventoryId =
          typeof (existingRecord as any).outboundInventoryId === 'object'
            ? (existingRecord as any).outboundInventoryId?.id
            : (existingRecord as any).outboundInventoryId
        const currentOutboundProductLineId =
          typeof (existingRecord as any).outboundProductLineId === 'object'
            ? (existingRecord as any).outboundProductLineId?.id
            : (existingRecord as any).outboundProductLineId

        // Prepare update data
        const updateDataObj: Record<string, unknown> = {}
        if (updateData.location !== undefined) updateDataObj.location = updateData.location
        if (updateData.huQty !== undefined) updateDataObj.huQty = Number(updateData.huQty)

        const newStatus = updateData.allocationStatus
        const statusChanged = newStatus !== undefined && newStatus !== currentStatus

        if (newStatus !== undefined) {
          // Validate allocation status - only allow available, allocated, picked
          const validStatuses = ['available', 'allocated', 'picked']
          if (!validStatuses.includes(newStatus)) {
            results.push({ id, success: false, error: 'Invalid allocation status' })
            continue
          }

          // Enforce workflow rules:
          // - Available can only go to allocated
          // - Allocated can go to picked or available
          // - Picked can go to available or allocated
          if (currentStatus === 'available' && newStatus !== 'allocated') {
            results.push({
              id,
              success: false,
              error: 'Available LPNs can only be updated to allocated',
            })
            continue
          }
          if (
            currentStatus === 'allocated' &&
            newStatus !== 'picked' &&
            newStatus !== 'available'
          ) {
            results.push({
              id,
              success: false,
              error: 'Allocated LPNs can only be updated to picked or available',
            })
            continue
          }
          if (
            currentStatus === 'picked' &&
            newStatus !== 'available' &&
            newStatus !== 'allocated'
          ) {
            results.push({
              id,
              success: false,
              error: 'Picked LPNs can only be updated to available or allocated',
            })
            continue
          }

          updateDataObj.allocationStatus = newStatus
        }

        // Handle status change logic (simplified - same as individual endpoint)
        if (statusChanged) {
          // available -> allocated
          if (currentStatus === 'available' && newStatus === 'allocated') {
            if (!updateData.outboundProductLineId) {
              results.push({
                id,
                success: false,
                error: 'Outbound product line is required when changing status to allocated',
              })
              continue
            }

            const productLineId =
              typeof updateData.outboundProductLineId === 'object'
                ? (updateData.outboundProductLineId as { id: number }).id
                : updateData.outboundProductLineId

            const productLine = await payload.findByID({
              collection: 'outbound-product-line',
              id: productLineId,
              depth: 1,
            })

            if (!productLine) {
              results.push({ id, success: false, error: 'Outbound product line not found' })
              continue
            }

            const productLineOutboundId =
              typeof productLine.outboundInventoryId === 'object'
                ? productLine.outboundInventoryId.id
                : productLine.outboundInventoryId

            const outboundJob = await payload.findByID({
              collection: 'outbound-inventory',
              id: productLineOutboundId,
            })

            const jobTenantId =
              typeof outboundJob.tenantId === 'object'
                ? (outboundJob.tenantId as { id: number }).id
                : outboundJob.tenantId

            if (jobTenantId !== tenant.id) {
              results.push({
                id,
                success: false,
                error: 'Outbound product line does not belong to this tenant',
              })
              continue
            }

            updateDataObj.outboundInventoryId = productLineOutboundId
            updateDataObj.outboundProductLineId = productLineId
            updateDataObj.allocatedAt = new Date().toISOString()
            updateDataObj.allocatedBy = currentUser.id
          }

          // allocated -> picked
          if (currentStatus === 'allocated' && newStatus === 'picked') {
            if (!currentOutboundProductLineId || !currentOutboundInventoryId) {
              results.push({
                id,
                success: false,
                error: 'LPN must be allocated to an outbound product line before picking',
              })
              continue
            }

            // Check if pickup entry already exists
            const existingPickups = await payload.find({
              collection: 'pickup-stock',
              where: {
                and: [
                  {
                    outboundProductLineId: {
                      equals: currentOutboundProductLineId,
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

            let lpnInPickup = false
            for (const pickup of existingPickups.docs) {
              const pickedUpLPNs = (pickup as any).pickedUpLPNs || []
              if (
                pickedUpLPNs.some((lpn: any) => {
                  const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
                  return lpnId === id
                })
              ) {
                lpnInPickup = true
                break
              }
            }

            if (!lpnInPickup) {
              const pickedUpQty = (existingRecord as any).huQty || 0
              const bufferQty = 0
              const finalPickedUpQty = pickedUpQty + bufferQty

              await payload.create({
                collection: 'pickup-stock',
                data: {
                  tenantId: tenant.id,
                  outboundInventoryId: currentOutboundInventoryId,
                  outboundProductLineId: currentOutboundProductLineId,
                  pickedUpLPNs: [
                    {
                      lpnId: id,
                      lpnNumber: (existingRecord as any).lpnNumber,
                      huQty: pickedUpQty,
                      location: (existingRecord as any).location,
                    },
                  ],
                  pickedUpQty,
                  bufferQty,
                  finalPickedUpQty,
                  pickupStatus: 'completed',
                  pickedUpBy: currentUser.id,
                  notes: '',
                },
              })
            }
          }

          // Note: Status changes from allocated/picked to available are not allowed (handled in validation above)
          // Note: Status changes from picked to other status are not allowed (handled in validation above)
        }

        // Handle allocation fields if not changed by status logic
        if (updateData.outboundInventoryId !== undefined && !statusChanged) {
          updateDataObj.outboundInventoryId = updateData.outboundInventoryId
        }
        if (updateData.outboundProductLineId !== undefined && !statusChanged) {
          updateDataObj.outboundProductLineId = updateData.outboundProductLineId
        }
        if (updateData.allocatedAt !== undefined && !statusChanged) {
          updateDataObj.allocatedAt = updateData.allocatedAt
        }
        if (updateData.allocatedBy !== undefined && !statusChanged) {
          updateDataObj.allocatedBy = updateData.allocatedBy
        }

        if (Object.keys(updateDataObj).length === 0) {
          results.push({ id, success: false, error: 'No valid fields to update' })
          continue
        }

        await payload.update({
          collection: 'put-away-stock',
          id,
          data: updateDataObj,
        })

        results.push({ id, success: true })
      } catch (error: any) {
        console.error(`Error updating record ${id}:`, error)
        results.push({ id, success: false, error: error.message || 'Update failed' })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
    })
  } catch (error) {
    console.error('Error in batch update:', error)
    return NextResponse.json({ message: 'Failed to process batch update' }, { status: 500 })
  }
}
