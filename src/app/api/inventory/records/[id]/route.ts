import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    const record = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
      depth: 3, // Include SKU, InboundInventory, InboundProductLine, Customer, Warehouse
    })

    if (!record) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Verify tenant ownership
    const recordTenantId =
      typeof record.tenantId === 'object' ? record.tenantId.id : record.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Check if deleted
    if ((record as any).isDeleted === true) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      record,
    })
  } catch (error) {
    console.error('Error fetching inventory record:', error)
    return NextResponse.json({ message: 'Failed to fetch inventory record' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'inventory_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)
    const body = await request.json()

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    // Verify record exists and belongs to tenant
    const existingRecord = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
    })

    if (!existingRecord) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    const recordTenantId =
      typeof existingRecord.tenantId === 'object'
        ? existingRecord.tenantId.id
        : existingRecord.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Check if deleted
    if ((existingRecord as any).isDeleted === true) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Get current status and allocation fields
    const currentStatus = (existingRecord as any).allocationStatus || 'available'
    const currentOutboundInventoryId =
      typeof (existingRecord as any).outboundInventoryId === 'object'
        ? (existingRecord as any).outboundInventoryId?.id
        : (existingRecord as any).outboundInventoryId
    const currentOutboundProductLineId =
      typeof (existingRecord as any).outboundProductLineId === 'object'
        ? (existingRecord as any).outboundProductLineId?.id
        : (existingRecord as any).outboundProductLineId

    // Prepare update data - only allow updating specific fields
    const updateData: Record<string, unknown> = {}
    if (body.location !== undefined) updateData.location = body.location
    if (body.huQty !== undefined) updateData.huQty = Number(body.huQty)

    const newStatus = body.allocationStatus
    const statusChanged = newStatus !== undefined && newStatus !== currentStatus

    if (newStatus !== undefined) {
      // Validate allocation status - only allow available, allocated, picked
      const validStatuses = ['available', 'allocated', 'picked']
      if (!validStatuses.includes(newStatus)) {
        return NextResponse.json({ message: 'Invalid allocation status' }, { status: 400 })
      }

      // Enforce workflow rules:
      // - Available can only go to allocated
      // - Allocated can go to picked or available
      // - Picked can go to available or allocated
      if (currentStatus === 'available' && newStatus !== 'allocated') {
        return NextResponse.json(
          { message: 'Available LPNs can only be updated to allocated' },
          { status: 400 },
        )
      }
      if (currentStatus === 'allocated' && newStatus !== 'picked' && newStatus !== 'available') {
        return NextResponse.json(
          { message: 'Allocated LPNs can only be updated to picked or available' },
          { status: 400 },
        )
      }
      if (currentStatus === 'picked' && newStatus !== 'available' && newStatus !== 'allocated') {
        return NextResponse.json(
          { message: 'Picked LPNs can only be updated to available or allocated' },
          { status: 400 },
        )
      }

      updateData.allocationStatus = newStatus
    }

    // Handle status change logic
    if (statusChanged) {
      // 1. available -> allocated: require outbound product line
      if (currentStatus === 'available' && newStatus === 'allocated') {
        if (!body.outboundProductLineId) {
          return NextResponse.json(
            { message: 'Outbound product line is required when changing status to allocated' },
            { status: 400 },
          )
        }

        // Verify outbound product line exists and belongs to tenant
        const productLineId =
          typeof body.outboundProductLineId === 'object'
            ? (body.outboundProductLineId as { id: number }).id
            : body.outboundProductLineId

        const productLine = await payload.findByID({
          collection: 'outbound-product-line',
          id: productLineId,
          depth: 1,
        })

        if (!productLine) {
          return NextResponse.json({ message: 'Outbound product line not found' }, { status: 404 })
        }

        const productLineOutboundId =
          typeof productLine.outboundInventoryId === 'object'
            ? productLine.outboundInventoryId.id
            : productLine.outboundInventoryId

        // If outboundInventoryId is provided in body, validate it matches the product line's job
        if (body.outboundInventoryId !== undefined) {
          const providedJobId =
            typeof body.outboundInventoryId === 'object'
              ? (body.outboundInventoryId as { id: number }).id
              : body.outboundInventoryId

          if (providedJobId !== productLineOutboundId) {
            return NextResponse.json(
              { message: 'Outbound job does not match the selected product line' },
              { status: 400 },
            )
          }
        }

        const outboundJob = await payload.findByID({
          collection: 'outbound-inventory',
          id: productLineOutboundId,
        })

        const jobTenantId =
          typeof outboundJob.tenantId === 'object'
            ? (outboundJob.tenantId as { id: number }).id
            : outboundJob.tenantId

        if (jobTenantId !== tenant.id) {
          return NextResponse.json(
            { message: 'Outbound product line does not belong to this tenant' },
            { status: 403 },
          )
        }

        // Set allocation fields
        updateData.outboundInventoryId = productLineOutboundId
        updateData.outboundProductLineId = productLineId
        updateData.allocatedAt = new Date().toISOString()
        updateData.allocatedBy = currentUser.id
      }

      // 2. allocated -> picked: create pickup entry
      if (currentStatus === 'allocated' && newStatus === 'picked') {
        if (!currentOutboundProductLineId || !currentOutboundInventoryId) {
          return NextResponse.json(
            { message: 'LPN must be allocated to an outbound product line before picking' },
            { status: 400 },
          )
        }

        // Check if pickup entry already exists for this LPN and product line
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

        // Check if this LPN is already in a pickup entry
        let lpnInPickup = false
        for (const pickup of existingPickups.docs) {
          const pickedUpLPNs = (pickup as any).pickedUpLPNs || []
          if (
            pickedUpLPNs.some((lpn: any) => {
              const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
              return lpnId === recordId
            })
          ) {
            lpnInPickup = true
            break
          }
        }

        // If LPN is not in a pickup entry, create one
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
                  lpnId: recordId,
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

      // 3. allocated -> available: clear allocation fields
      if (currentStatus === 'allocated' && newStatus === 'available') {
        updateData.outboundInventoryId = null
        updateData.outboundProductLineId = null
        updateData.allocatedAt = null
        updateData.allocatedBy = null
      }

      // 4. picked -> available: clear allocation fields and remove from pickup entries
      if (currentStatus === 'picked' && newStatus === 'available') {
        updateData.outboundInventoryId = null
        updateData.outboundProductLineId = null
        updateData.allocatedAt = null
        updateData.allocatedBy = null

        // Remove from pickup entries
        const allPickups = await payload.find({
          collection: 'pickup-stock',
          where: {
            and: [
              {
                tenantId: {
                  equals: tenant.id,
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

        for (const pickup of allPickups.docs) {
          const pickedUpLPNs = (pickup as any).pickedUpLPNs || []
          const lpnIndex = pickedUpLPNs.findIndex((lpn: any) => {
            const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
            return lpnId === recordId
          })

          if (lpnIndex !== -1) {
            const updatedLPNs = pickedUpLPNs.filter((_: any, index: number) => index !== lpnIndex)

            const pickedUpQty = updatedLPNs.reduce(
              (sum: number, lpn: any) => sum + (lpn.huQty || 0),
              0,
            )
            const bufferQty = (pickup as any).bufferQty || 0
            const finalPickedUpQty = pickedUpQty + bufferQty

            await payload.update({
              collection: 'pickup-stock',
              id: pickup.id,
              data: {
                pickedUpLPNs: updatedLPNs,
                pickedUpQty,
                finalPickedUpQty,
              },
            })
          }
        }
      }

      // 5. picked -> allocated: remove from pickup entries but keep allocation fields
      if (currentStatus === 'picked' && newStatus === 'allocated') {
        // Remove from pickup entries
        const allPickups = await payload.find({
          collection: 'pickup-stock',
          where: {
            and: [
              {
                tenantId: {
                  equals: tenant.id,
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

        for (const pickup of allPickups.docs) {
          const pickedUpLPNs = (pickup as any).pickedUpLPNs || []
          const lpnIndex = pickedUpLPNs.findIndex((lpn: any) => {
            const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
            return lpnId === recordId
          })

          if (lpnIndex !== -1) {
            const updatedLPNs = pickedUpLPNs.filter((_: any, index: number) => index !== lpnIndex)

            const pickedUpQty = updatedLPNs.reduce(
              (sum: number, lpn: any) => sum + (lpn.huQty || 0),
              0,
            )
            const bufferQty = (pickup as any).bufferQty || 0
            const finalPickedUpQty = pickedUpQty + bufferQty

            await payload.update({
              collection: 'pickup-stock',
              id: pickup.id,
              data: {
                pickedUpLPNs: updatedLPNs,
                pickedUpQty,
                finalPickedUpQty,
              },
            })
          }
        }
        // Keep allocation fields (they should already be set)
      }
    }

    // Allocation fields (if not handled by status change logic)
    if (body.outboundInventoryId !== undefined && !statusChanged) {
      updateData.outboundInventoryId = body.outboundInventoryId
    }
    if (body.outboundProductLineId !== undefined && !statusChanged) {
      updateData.outboundProductLineId = body.outboundProductLineId
    }
    if (body.allocatedAt !== undefined && !statusChanged) {
      updateData.allocatedAt = body.allocatedAt
    }
    if (body.allocatedBy !== undefined && !statusChanged) {
      updateData.allocatedBy = body.allocatedBy
    }

    // Update batch number if provided (via inbound-product-line relationship)
    // For LPN edit modal: If batch number changes, always create a new product line
    // This ensures individual LPN batch changes don't affect other LPNs
    let newProductLineId = null

    if (body.batchNumber !== undefined) {
      const productLineId =
        typeof existingRecord.inboundProductLineId === 'object'
          ? existingRecord.inboundProductLineId.id
          : existingRecord.inboundProductLineId

      if (productLineId) {
        try {
          // Fetch the current product line to get its data
          const currentProductLine = await payload.findByID({
            collection: 'inbound-product-line',
            id: productLineId,
            depth: 1,
          })

          // Check if batch number is actually changing
          const currentBatch = (currentProductLine as any).batchNumber
          if (body.batchNumber !== currentBatch) {
            // Always create a new product line for individual LPN batch changes
            // This ensures the change only affects this LPN
            const newProductLineData: any = {
              inboundInventoryId: (currentProductLine as any).inboundInventoryId,
              skuId: (currentProductLine as any).skuId,
              batchNumber: body.batchNumber,
              expectedQty: (currentProductLine as any).expectedQty,
              recievedQty: (currentProductLine as any).recievedQty,
              expectedWeight: (currentProductLine as any).expectedWeight,
              recievedWeight: (currentProductLine as any).recievedWeight,
              weightPerHU: (currentProductLine as any).weightPerHU,
              expectedCubicPerHU: (currentProductLine as any).expectedCubicPerHU,
              recievedCubicPerHU: (currentProductLine as any).recievedCubicPerHU,
              expiryDate: (currentProductLine as any).expiryDate,
              attribute1: (currentProductLine as any).attribute1,
              attribute2: (currentProductLine as any).attribute2,
            }

            const newProductLine = await payload.create({
              collection: 'inbound-product-line',
              data: newProductLineData,
            })

            newProductLineId = newProductLine.id

            // Update the LPN to point to the new product line
            updateData.inboundProductLineId = newProductLineId
          }
        } catch (error) {
          console.error('Error updating batch number:', error)
          return NextResponse.json({ message: 'Failed to update batch number' }, { status: 500 })
        }
      }
    }

    if (Object.keys(updateData).length === 0 && !newProductLineId) {
      return NextResponse.json({ message: 'No valid fields to update' }, { status: 400 })
    }

    const updatedRecord =
      Object.keys(updateData).length > 0
        ? await payload.update({
            collection: 'put-away-stock',
            id: recordId,
            data: updateData,
          })
        : existingRecord

    return NextResponse.json({
      success: true,
      record: updatedRecord,
    })
  } catch (error) {
    console.error('Error updating inventory record:', error)
    return NextResponse.json({ message: 'Failed to update inventory record' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'inventory_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    // Verify record exists and belongs to tenant
    const existingRecord = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
    })

    if (!existingRecord) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    const recordTenantId =
      typeof existingRecord.tenantId === 'object'
        ? existingRecord.tenantId.id
        : existingRecord.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Use Payload's delete which will trigger soft delete hook
    await payload.delete({
      collection: 'put-away-stock',
      id: recordId,
    })

    return NextResponse.json({
      success: true,
      message: 'Record deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting inventory record:', error)
    return NextResponse.json({ message: 'Failed to delete inventory record' }, { status: 500 })
  }
}
