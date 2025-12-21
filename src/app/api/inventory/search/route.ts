import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'
import { aggregateInventoryRecords, isLocationInRange } from '@/lib/inventory-helpers'
import type { InventoryRecord } from '@/lib/inventory-helpers'

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    const {
      warehouseId,
      customerName,
      skuId,
      batch,
      skuDescription,
      lpn,
      expiry,
      containerNumber,
      customerReference,
      inboundOrderNumber,
      attribute1,
      attribute2,
      locationFrom,
      locationTo,
    } = body

    if (!warehouseId) {
      return NextResponse.json({ message: 'Warehouse ID is required' }, { status: 400 })
    }

    // Verify warehouse belongs to tenant
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: Number(warehouseId),
    })

    const warehouseTenantId =
      typeof warehouse.tenantId === 'object' ? warehouse.tenantId.id : warehouse.tenantId
    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Build where clause
    const where: any = {
      and: [
        {
          tenantId: {
            equals: tenant.id,
          },
        },
        {
          warehouseId: {
            equals: Number(warehouseId),
          },
        },
        {
          isDeleted: {
            equals: false,
          },
        },
      ],
    }

    // Fetch all put-away records for this warehouse with depth to get relationships
    // We'll filter in memory for complex queries
    const putAwayRecords = await payload.find({
      collection: 'put-away-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            warehouseId: {
              equals: Number(warehouseId),
            },
          },
          {
            isDeleted: {
              equals: false,
            },
          },
        ],
      },
      depth: 3, // Include SKU, InboundInventory, InboundProductLine, Customer
      limit: 10000, // Large limit for aggregation
    })

    // Filter records based on search criteria
    let filteredRecords = putAwayRecords.docs as InventoryRecord[]

    // Filter by LPN
    if (lpn) {
      filteredRecords = filteredRecords.filter(
        (r) => r.lpnNumber && r.lpnNumber.toLowerCase().includes(lpn.toLowerCase()),
      )
    }

    // Filter by location range
    if (locationFrom || locationTo) {
      filteredRecords = filteredRecords.filter((r) =>
        isLocationInRange(r.location, locationFrom, locationTo),
      )
    }

    // Filter by SKU ID (via skuCode)
    if (skuId) {
      filteredRecords = filteredRecords.filter((r) => {
        const sku = typeof r.skuId === 'object' ? r.skuId : null
        return sku && sku.skuCode && sku.skuCode.toLowerCase().includes(skuId.toLowerCase())
      })
    }

    // Filter by SKU Description
    if (skuDescription) {
      filteredRecords = filteredRecords.filter((r) => {
        const sku = typeof r.skuId === 'object' ? r.skuId : null
        return (
          sku &&
          sku.description &&
          sku.description.toLowerCase().includes(skuDescription.toLowerCase())
        )
      })
    }

    // Filter by batch
    if (batch) {
      filteredRecords = filteredRecords.filter((r) => {
        const productLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        return (
          productLine &&
          productLine.batchNumber &&
          productLine.batchNumber.toLowerCase().includes(batch.toLowerCase())
        )
      })
    }

    // Filter by expiry
    if (expiry) {
      const expiryDate = new Date(expiry)
      filteredRecords = filteredRecords.filter((r) => {
        const productLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        if (!productLine || !productLine.expiryDate) return false
        const recordExpiry = new Date(productLine.expiryDate)
        return recordExpiry.toDateString() === expiryDate.toDateString()
      })
    }

    // Filter by attribute1
    if (attribute1) {
      filteredRecords = filteredRecords.filter((r) => {
        const productLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        return (
          productLine &&
          productLine.attribute1 &&
          productLine.attribute1.toLowerCase().includes(attribute1.toLowerCase())
        )
      })
    }

    // Filter by attribute2
    if (attribute2) {
      filteredRecords = filteredRecords.filter((r) => {
        const productLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        return (
          productLine &&
          productLine.attribute2 &&
          productLine.attribute2.toLowerCase().includes(attribute2.toLowerCase())
        )
      })
    }

    // Filter by customer name
    if (customerName) {
      filteredRecords = filteredRecords.filter((r) => {
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        if (!inboundInventory) return false
        const customer =
          typeof inboundInventory.deliveryCustomerId === 'object'
            ? inboundInventory.deliveryCustomerId
            : null
        return (
          customer &&
          customer.customer_name &&
          customer.customer_name.toLowerCase().includes(customerName.toLowerCase())
        )
      })
    }

    // Filter by container number
    // Note: containerNumber may be in OutboundInventory, not InboundInventory
    if (containerNumber) {
      filteredRecords = filteredRecords.filter((r) => {
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        // Check if containerNumber exists (may not be in InboundInventory schema)
        const hasContainerNumber = inboundInventory && (inboundInventory as any).containerNumber
        return (
          hasContainerNumber &&
          (inboundInventory as any).containerNumber
            .toLowerCase()
            .includes(containerNumber.toLowerCase())
        )
      })
    }

    // Filter by customer reference
    if (customerReference) {
      filteredRecords = filteredRecords.filter((r) => {
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        return (
          inboundInventory &&
          inboundInventory.deliveryCustomerReferenceNumber &&
          inboundInventory.deliveryCustomerReferenceNumber
            .toLowerCase()
            .includes(customerReference.toLowerCase())
        )
      })
    }

    // Filter by inbound order number
    if (inboundOrderNumber) {
      filteredRecords = filteredRecords.filter((r) => {
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        return (
          inboundInventory &&
          inboundInventory.jobCode &&
          inboundInventory.jobCode.toLowerCase().includes(inboundOrderNumber.toLowerCase())
        )
      })
    }

    // Aggregate the filtered records
    const aggregated = aggregateInventoryRecords(filteredRecords)
    const results = Array.from(aggregated.values())

    // Fetch outbound jobs for each SKU
    const skuIds = new Set<number>()
    for (const record of filteredRecords) {
      const skuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
      if (skuId) {
        skuIds.add(skuId)
      }
    }

    // Get outbound product lines for these SKUs
    // We need to filter by tenant through the outbound-inventory relationship
    const outboundProductLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        and: [
          {
            skuId: {
              in: Array.from(skuIds),
            },
          },
        ],
      },
      depth: 3, // Include outbound inventory (with tenant) and customer info
      limit: 10000,
    })

    // Filter outbound product lines by tenant
    const tenantFilteredProductLines = outboundProductLines.docs.filter((line: any) => {
      const outboundInventory =
        typeof line.outboundInventoryId === 'object' ? line.outboundInventoryId : null
      if (!outboundInventory) return false
      const outboundTenantId =
        typeof outboundInventory.tenantId === 'object'
          ? outboundInventory.tenantId.id
          : outboundInventory.tenantId
      return outboundTenantId === tenant.id
    })

    // Group outbound jobs by SKU ID
    const outboundJobsBySku = new Map<number, any[]>()
    for (const productLine of tenantFilteredProductLines) {
      const skuId =
        typeof (productLine as any).skuId === 'object'
          ? (productLine as any).skuId.id
          : (productLine as any).skuId
      if (skuId) {
        if (!outboundJobsBySku.has(skuId)) {
          outboundJobsBySku.set(skuId, [])
        }
        const outboundInventory =
          typeof (productLine as any).outboundInventoryId === 'object'
            ? (productLine as any).outboundInventoryId
            : null
        if (outboundInventory) {
          outboundJobsBySku.get(skuId)!.push({
            id: (outboundInventory as any).id,
            jobCode: (outboundInventory as any).jobCode,
            customerRefNumber: (outboundInventory as any).customerRefNumber,
            consigneeRefNumber: (outboundInventory as any).consigneeRefNumber,
            customerName: (outboundInventory as any).customerName,
            customerToName: (outboundInventory as any).customerToName,
            requiredDateTime: (outboundInventory as any).requiredDateTime,
            status: (outboundInventory as any).status,
            createdAt: (outboundInventory as any).createdAt,
            updatedAt: (outboundInventory as any).updatedAt,
            allocatedQty: (productLine as any).allocatedQty,
            expectedQty: (productLine as any).expectedQty,
            pickedQty: (productLine as any).pickedQty,
          })
        }
      }
    }

    // Fetch inbound jobs for each SKU
    // Get inbound product lines for these SKUs
    const inboundProductLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        and: [
          {
            skuId: {
              in: Array.from(skuIds),
            },
          },
        ],
      },
      depth: 3, // Include inbound inventory (with tenant) and customer info
      limit: 10000,
    })

    // Filter inbound product lines by tenant
    const tenantFilteredInboundProductLines = inboundProductLines.docs.filter((line: any) => {
      const inboundInventory =
        typeof line.inboundInventoryId === 'object' ? line.inboundInventoryId : null
      if (!inboundInventory) return false
      const inboundTenantId =
        typeof inboundInventory.tenantId === 'object'
          ? inboundInventory.tenantId.id
          : inboundInventory.tenantId
      return inboundTenantId === tenant.id
    })

    // Group inbound jobs by SKU ID
    const inboundJobsBySku = new Map<number, any[]>()
    for (const productLine of tenantFilteredInboundProductLines) {
      const skuId =
        typeof (productLine as any).skuId === 'object'
          ? (productLine as any).skuId.id
          : (productLine as any).skuId
      if (skuId) {
        if (!inboundJobsBySku.has(skuId)) {
          inboundJobsBySku.set(skuId, [])
        }
        const inboundInventory =
          typeof (productLine as any).inboundInventoryId === 'object'
            ? (productLine as any).inboundInventoryId
            : null
        if (inboundInventory) {
          // Check if this job is already added for this SKU (avoid duplicates)
          const existingJobs = inboundJobsBySku.get(skuId) || []
          const jobId = (inboundInventory as any).id
          if (!existingJobs.find((j: any) => j.id === jobId)) {
            // Compute status based on dates (similar to inbound page)
            const completedDate = (inboundInventory as any).completedDate
            const expectedDate = (inboundInventory as any).expectedDate
            let status = 'draft'
            if (completedDate) {
              status = 'received'
            } else if (expectedDate) {
              status = 'expected'
            }

            inboundJobsBySku.get(skuId)!.push({
              id: jobId,
              jobCode: (inboundInventory as any).jobCode,
              deliveryCustomerReferenceNumber: (inboundInventory as any)
                .deliveryCustomerReferenceNumber,
              orderingCustomerReferenceNumber: (inboundInventory as any)
                .orderingCustomerReferenceNumber,
              customerName: (inboundInventory as any).customerName,
              supplierName: (inboundInventory as any).supplierName,
              expectedDate: expectedDate,
              completedDate: completedDate,
              status: status,
              createdAt: (inboundInventory as any).createdAt,
              updatedAt: (inboundInventory as any).updatedAt,
              receivedQty: (productLine as any).recievedQty,
            })
          }
        }
      }
    }

    // Sort by SKU ID
    results.sort((a, b) => a.skuId.localeCompare(b.skuId))

    // Group individual records by SKU/Batch for accordion display
    // Match records to aggregated items by SKU code and batch
    const resultsWithRecords = results.map((item) => {
      // Find the SKU ID for this item
      const skuIdForItem = filteredRecords.find((r) => {
        const recordSkuCode = typeof r.skuId === 'object' ? r.skuId.skuCode : undefined
        return recordSkuCode === item.skuId
      })
      const skuId =
        skuIdForItem && typeof skuIdForItem.skuId === 'object'
          ? skuIdForItem.skuId.id
          : skuIdForItem?.skuId

      // Get outbound jobs for this SKU
      const outboundJobs = skuId ? outboundJobsBySku.get(skuId as number) || [] : []
      // Get inbound jobs for this SKU
      const inboundJobs = skuId ? inboundJobsBySku.get(skuId as number) || [] : []
      const matchingRecords: InventoryRecord[] = []

      for (const record of filteredRecords) {
        const recordSkuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
        const recordSkuCode = typeof record.skuId === 'object' ? record.skuId.skuCode : undefined
        const recordBatch =
          typeof record.inboundProductLineId === 'object'
            ? record.inboundProductLineId.batchNumber
            : undefined

        // Match by SKU code (item.skuId contains the SKU code from aggregation)
        const skuMatches = recordSkuCode === item.skuId || recordSkuId?.toString() === item.skuId

        if (skuMatches) {
          // Match by batch if item has batches
          if (item.batches.length > 0) {
            // Item has batches, so record must have matching batch
            if (recordBatch && item.batches.includes(recordBatch)) {
              matchingRecords.push(record)
            }
          } else {
            // Item has no batches, so record should also have no batch
            if (!recordBatch) {
              matchingRecords.push(record)
            }
          }
        }
      }

      return {
        ...item,
        records: matchingRecords, // Individual PutAwayStock records for this SKU/Batch
        outboundJobs, // Outbound jobs for this SKU
        inboundJobs, // Inbound jobs for this SKU
      }
    })

    return NextResponse.json({
      success: true,
      results: resultsWithRecords,
      count: resultsWithRecords.length,
    })
  } catch (error) {
    console.error('Error searching inventory:', error)
    return NextResponse.json({ message: 'Failed to search inventory' }, { status: 500 })
  }
}
