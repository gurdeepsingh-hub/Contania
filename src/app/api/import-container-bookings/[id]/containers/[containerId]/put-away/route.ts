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
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)
    const body = await request.json()

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Verify container belongs to booking
    const container = await payload.findByID({
      collection: 'container-details',
      id: containerId,
      depth: 1, // Need depth to populate containerBookingId relationship
    })

    if (!container) {
      return NextResponse.json({ message: 'Container not found' }, { status: 404 })
    }

    // Handle polymorphic relationship structure
    const containerBookingRef = (container as any).containerBookingId

    if (!containerBookingRef) {
      return NextResponse.json(
        { message: 'Container does not belong to this booking' },
        { status: 400 },
      )
    }

    let containerBookingId: number | null = null
    let containerRelationTo: string | null = null

    // Handle polymorphic relationship structure (same as container-details route)
    if (typeof containerBookingRef === 'object' && containerBookingRef !== null) {
      // Payload returns polymorphic relationships with depth=1 as:
      // { relationTo: string, value: { id: number, ... } }
      // OR: { id: number, relationTo: string }
      containerBookingId =
        containerBookingRef.id || (containerBookingRef.value && containerBookingRef.value.id)
      containerRelationTo = containerBookingRef.relationTo
    } else if (typeof containerBookingRef === 'number') {
      containerBookingId = containerBookingRef
      containerRelationTo = 'import-container-bookings' // Assume import if it's just a number
    }

    // Verify booking ID matches and it's an import booking
    if (
      !containerBookingId ||
      containerBookingId !== bookingId ||
      containerRelationTo !== 'import-container-bookings'
    ) {
      return NextResponse.json(
        { message: 'Container does not belong to this booking' },
        { status: 400 },
      )
    }

    const { warehouseId, putAwayRecords } = body

    if (!warehouseId || !Array.isArray(putAwayRecords) || putAwayRecords.length === 0) {
      return NextResponse.json(
        { message: 'Warehouse ID and put-away records are required' },
        { status: 400 },
      )
    }

    // Verify warehouse belongs to tenant
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: warehouseId,
    })

    const warehouseTenantId =
      typeof warehouse.tenantId === 'object' ? warehouse.tenantId.id : warehouse.tenantId
    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Get stock allocations for this container with depth to populate product lines
    const allocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        containerDetailId: {
          equals: containerId,
        },
      },
      depth: 2, // Need depth to populate productLines and their relationships
    })

    console.log(
      `[Put-Away] Processing ${putAwayRecords.length} put-away records for container ${containerId}`,
    )
    console.log(`[Put-Away] Found ${allocations.docs.length} allocations for this container`)

    // Create put-away records
    const createdRecords = []
    for (let i = 0; i < putAwayRecords.length; i++) {
      const record = putAwayRecords[i]

      // Find the allocation that contains this product line by matching SKU ID and product line index
      let allocation = null
      const productLineIndex = record.productLineIndex || 0

      for (const alloc of allocations.docs) {
        if (!alloc.productLines || !Array.isArray(alloc.productLines)) continue

        const productLine = alloc.productLines[productLineIndex]
        if (!productLine) continue

        const productLineSkuId =
          typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId

        // Match by SKU ID
        if (productLineSkuId === record.skuId) {
          allocation = alloc
          break
        }
      }

      if (!allocation) {
        console.warn(
          `[Put-Away] Record ${i + 1}/${putAwayRecords.length}: Could not find allocation for skuId=${record.skuId}, productLineIndex=${productLineIndex}`,
        )
        continue
      }

      // Get SKU from product line to verify
      const productLine = allocation.productLines?.[productLineIndex]

      if (!productLine) {
        console.warn(
          `[Put-Away] Record ${i + 1}/${putAwayRecords.length}: Product line at index ${productLineIndex} not found in allocation ${allocation.id}`,
        )
        continue
      }

      const skuId =
        typeof productLine.skuId === 'object'
          ? productLine.skuId.id
          : typeof productLine.skuId === 'number'
            ? productLine.skuId
            : record.skuId

      if (!skuId) {
        console.error(
          `[Put-Away] Record ${i + 1}/${putAwayRecords.length}: SKU ID not found for product line at index ${productLineIndex} in allocation ${allocation.id}`,
        )
        continue
      }

      try {
        const created = await payload.create({
          collection: 'put-away-stock',
          data: {
            tenantId: tenant.id,
            containerDetailId: containerId,
            containerStockAllocationId: allocation.id,
            skuId,
            warehouseId,
            location: record.location,
            huQty: record.huQty,
            lpnNumber: record.lpnNumber,
            allocatedAt: new Date().toISOString(),
            allocatedBy: user?.id || null,
          },
        })

        createdRecords.push(created)
        if ((i + 1) % 10 === 0 || i === putAwayRecords.length - 1) {
          console.log(`[Put-Away] Created ${i + 1}/${putAwayRecords.length} put-away records...`)
        }
      } catch (error) {
        console.error(`[Put-Away] Failed to create put-away record ${i + 1}:`, error)
        // Continue processing other records instead of failing completely
      }
    }

    console.log(
      `[Put-Away] Successfully created ${createdRecords.length}/${putAwayRecords.length} put-away records`,
    )

    // Update container status and allocation stages to put_away if all product lines have put-away records
    if (createdRecords.length > 0) {
      // Get all put-away records for this container (including newly created ones)
      const putAwayRecordsQuery = await payload.find({
        collection: 'put-away-stock',
        where: {
          containerDetailId: {
            equals: containerId,
          },
        },
        depth: 1,
        limit: 10000, // Ensure we get all records
      })

      // Combine queried records with newly created records to ensure we have all of them
      // (in case of any timing/caching issues)
      const allPutAwayRecords = [...putAwayRecordsQuery.docs]
      const createdRecordIds = new Set(createdRecords.map((r: any) => r.id))

      // Add any newly created records that might not be in the query yet
      for (const createdRecord of createdRecords) {
        if (!allPutAwayRecords.find((r: any) => r.id === createdRecord.id)) {
          allPutAwayRecords.push(createdRecord)
        }
      }

      console.log(
        `[Put-Away] Total put-away records for container ${containerId}: ${allPutAwayRecords.length} (${putAwayRecordsQuery.docs.length} from query + ${createdRecords.length} newly created)`,
      )

      // Track which allocations had records created in this request
      const allocationsWithNewRecords = new Set<number>()
      for (const createdRecord of createdRecords) {
        const recordAllocationId =
          typeof createdRecord.containerStockAllocationId === 'object'
            ? createdRecord.containerStockAllocationId.id
            : createdRecord.containerStockAllocationId
        if (recordAllocationId) {
          allocationsWithNewRecords.add(recordAllocationId)
        }
      }

      // Update each allocation's stage if all its product lines have put-away records
      // Only check allocations that had records created in this request
      for (const allocation of allocations.docs) {
        const allocationId = typeof allocation.id === 'object' ? allocation.id.id : allocation.id

        // Only check allocations that had new records created
        if (!allocationsWithNewRecords.has(allocationId)) {
          continue
        }

        const allocationProductLines = allocation.productLines || []

        // Filter product lines that have received quantities
        const receivedProductLines = allocationProductLines.filter(
          (line: any) => line.recievedQty && line.recievedQty > 0,
        )

        if (receivedProductLines.length === 0) {
          continue // Skip allocations with no received product lines
        }

        // Check if all received product lines have put-away records
        const allPutAway = receivedProductLines.every((line: any) => {
          const lineSkuId = typeof line.skuId === 'object' ? line.skuId.id : line.skuId

          if (!lineSkuId) {
            console.log(`[Put-Away] Skipping line without SKU ID in allocation ${allocationId}`)
            return false
          }

          // Get all put-away records for this SKU in this allocation
          const skuPutAwayRecords = allPutAwayRecords.filter((record: any) => {
            const recordAllocationId =
              typeof record.containerStockAllocationId === 'object'
                ? record.containerStockAllocationId.id
                : record.containerStockAllocationId
            const recordSkuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId

            return recordAllocationId === allocationId && recordSkuId === lineSkuId
          })

          // If no put-away records for this SKU, it's not put away
          if (skuPutAwayRecords.length === 0) {
            console.log(
              `[Put-Away] No put-away records found for SKU ${lineSkuId} in allocation ${allocationId}`,
            )
            return false
          }

          // Calculate total put-away quantity for this SKU
          const totalPutAwayQty = skuPutAwayRecords.reduce((sum: number, record: any) => {
            const huQty = Number(record.huQty) || 0
            return sum + huQty
          }, 0)

          // Parse received quantity (handle both string and number)
          const receivedQty = Number(line.recievedQty) || 0

          // Use a small tolerance for floating point comparison (0.01)
          // Check if total put-away quantity matches or exceeds received quantity
          const tolerance = 0.01
          const isPutAway = totalPutAwayQty >= receivedQty - tolerance

          console.log(
            `[Put-Away] SKU ${lineSkuId} in allocation ${allocationId}: received=${receivedQty}, putAway=${totalPutAwayQty}, records=${skuPutAwayRecords.length}, isPutAway=${isPutAway}`,
          )
          if (skuPutAwayRecords.length > 0) {
            console.log(
              `[Put-Away] Put-away record details:`,
              skuPutAwayRecords.map((r: any) => ({
                id: r.id,
                huQty: r.huQty,
                lpnNumber: r.lpnNumber,
              })),
            )
          }

          return isPutAway
        })

        // Update allocation stage to 'put_away' if all product lines are put away
        if (allPutAway && allocation.stage !== 'put_away') {
          console.log(
            `[Put-Away] Updating allocation ${allocationId} stage from ${allocation.stage} to put_away`,
          )
          try {
            await payload.update({
              collection: 'container-stock-allocations',
              id: allocationId,
              data: {
                stage: 'put_away',
              },
            })
            console.log(`[Put-Away] Successfully updated allocation ${allocationId} stage`)
          } catch (error) {
            console.error(`[Put-Away] Failed to update allocation ${allocationId} stage:`, error)
          }
        } else if (!allPutAway) {
          console.log(
            `[Put-Away] Allocation ${allocationId} not fully put away yet. Stage remains: ${allocation.stage}`,
          )
        }
      }

      // Update container status to put_away if we have put-away records
      if (allPutAwayRecords.length > 0) {
        await payload.update({
          collection: 'container-details',
          id: containerId,
          data: {
            status: 'put_away',
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      records: createdRecords,
      count: createdRecords.length,
    })
  } catch (error) {
    console.error('Error creating container put-away records:', error)
    return NextResponse.json({ message: 'Failed to create put-away records' }, { status: 500 })
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
      collection: 'put-away-stock',
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
        ],
      },
      depth: 2,
      limit: 10000, // Ensure we get all records, not just the default 10
    })

    return NextResponse.json({
      success: true,
      records: records.docs,
      count: records.docs.length,
    })
  } catch (error) {
    console.error('Error fetching container put-away records:', error)
    return NextResponse.json({ message: 'Failed to fetch put-away records' }, { status: 500 })
  }
}
