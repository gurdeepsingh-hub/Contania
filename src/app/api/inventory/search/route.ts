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
      containerBookingCode,
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
      depth: 3, // Include SKU, InboundInventory, InboundProductLine, Customer, ContainerDetails, ContainerStockAllocations
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
    // Check both inbound product lines and container stock allocations
    if (batch) {
      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound product lines
        const inboundProductLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        if (
          inboundProductLine &&
          inboundProductLine.batchNumber &&
          inboundProductLine.batchNumber.toLowerCase().includes(batch.toLowerCase())
        ) {
          return true
        }

        // Check container stock allocations
        const containerStockAllocation =
          typeof (r as any).containerStockAllocationId === 'object'
            ? (r as any).containerStockAllocationId
            : null
        
        if (containerStockAllocation && containerStockAllocation.productLines) {
          const productLines = Array.isArray(containerStockAllocation.productLines)
            ? containerStockAllocation.productLines
            : []
          for (const productLine of productLines) {
            if (
              productLine.batchNumber &&
              productLine.batchNumber.toLowerCase().includes(batch.toLowerCase())
            ) {
              return true
            }
          }
        }

        return false
      })
    }

    // Filter by expiry
    // Check both inbound product lines and container stock allocations
    if (expiry) {
      const expiryDate = new Date(expiry)
      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound product lines
        const inboundProductLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        if (inboundProductLine && inboundProductLine.expiryDate) {
          const recordExpiry = new Date(inboundProductLine.expiryDate)
          if (recordExpiry.toDateString() === expiryDate.toDateString()) {
            return true
          }
        }

        // Check container stock allocations
        const containerStockAllocation =
          typeof (r as any).containerStockAllocationId === 'object'
            ? (r as any).containerStockAllocationId
            : null
        
        if (containerStockAllocation && containerStockAllocation.productLines) {
          const productLines = Array.isArray(containerStockAllocation.productLines)
            ? containerStockAllocation.productLines
            : []
          for (const productLine of productLines) {
            if (productLine.expiryDate) {
              const recordExpiry = new Date(productLine.expiryDate)
              if (recordExpiry.toDateString() === expiryDate.toDateString()) {
                return true
              }
            }
          }
        }

        return false
      })
    }

    // Filter by attribute1
    // Check both inbound product lines and container stock allocations
    if (attribute1) {
      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound product lines
        const inboundProductLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        if (
          inboundProductLine &&
          inboundProductLine.attribute1 &&
          inboundProductLine.attribute1.toLowerCase().includes(attribute1.toLowerCase())
        ) {
          return true
        }

        // Check container stock allocations
        const containerStockAllocation =
          typeof (r as any).containerStockAllocationId === 'object'
            ? (r as any).containerStockAllocationId
            : null
        
        if (containerStockAllocation && containerStockAllocation.productLines) {
          const productLines = Array.isArray(containerStockAllocation.productLines)
            ? containerStockAllocation.productLines
            : []
          for (const productLine of productLines) {
            if (
              productLine.attribute1 &&
              productLine.attribute1.toLowerCase().includes(attribute1.toLowerCase())
            ) {
              return true
            }
          }
        }

        return false
      })
    }

    // Filter by attribute2
    // Check both inbound product lines and container stock allocations
    if (attribute2) {
      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound product lines
        const inboundProductLine =
          typeof r.inboundProductLineId === 'object' ? r.inboundProductLineId : null
        if (
          inboundProductLine &&
          inboundProductLine.attribute2 &&
          inboundProductLine.attribute2.toLowerCase().includes(attribute2.toLowerCase())
        ) {
          return true
        }

        // Check container stock allocations
        const containerStockAllocation =
          typeof (r as any).containerStockAllocationId === 'object'
            ? (r as any).containerStockAllocationId
            : null
        
        if (containerStockAllocation && containerStockAllocation.productLines) {
          const productLines = Array.isArray(containerStockAllocation.productLines)
            ? containerStockAllocation.productLines
            : []
          for (const productLine of productLines) {
            if (
              productLine.attribute2 &&
              productLine.attribute2.toLowerCase().includes(attribute2.toLowerCase())
            ) {
              return true
            }
          }
        }

        return false
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
    // Check both inbound/outbound inventory and container details
    if (containerNumber) {
      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound inventory
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        const hasInboundContainerNumber =
          inboundInventory && (inboundInventory as any).containerNumber
        if (
          hasInboundContainerNumber &&
          (inboundInventory as any).containerNumber
            .toLowerCase()
            .includes(containerNumber.toLowerCase())
        ) {
          return true
        }

        // Check container details (for container bookings)
        const containerDetail =
          typeof (r as any).containerDetailId === 'object'
            ? (r as any).containerDetailId
            : null
        if (
          containerDetail &&
          containerDetail.containerNumber &&
          containerDetail.containerNumber.toLowerCase().includes(containerNumber.toLowerCase())
        ) {
          return true
        }

        return false
      })
    }

    // Filter by customer reference
    // Check both inbound inventory and container bookings
    if (customerReference) {
      // First, find container bookings matching customer reference
      const importBookingsWithRef = await payload.find({
        collection: 'import-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              customerReference: {
                contains: customerReference,
              },
            },
          ],
        },
        limit: 1000,
      })

      const exportBookingsWithRef = await payload.find({
        collection: 'export-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              customerReference: {
                contains: customerReference,
              },
            },
          ],
        },
        limit: 1000,
      })

      const matchingBookingIds = new Set<number>()
      importBookingsWithRef.docs.forEach((b: any) => matchingBookingIds.add(b.id))
      exportBookingsWithRef.docs.forEach((b: any) => matchingBookingIds.add(b.id))

      // Find allocations for these bookings
      // Note: Payload doesn't support 'in' operator on polymorphic relationships
      // So we need to query allocations and filter in memory
      const matchingAllocationIds = new Set<number>()
      if (matchingBookingIds.size > 0) {
        // Query all allocations and filter by booking ID in memory
        const allAllocations = await payload.find({
          collection: 'container-stock-allocations',
          where: {},
          depth: 2, // Load booking relationship
          limit: 10000,
        })

        for (const allocation of allAllocations.docs) {
          const allocationData = allocation as any
          const bookingRef = allocationData.containerBookingId

          // Handle polymorphic relationship
          let bookingId: number | undefined
          if (typeof bookingRef === 'object' && bookingRef !== null) {
            if ('value' in bookingRef && bookingRef.value) {
              bookingId =
                typeof bookingRef.value === 'object' && bookingRef.value !== null
                  ? (bookingRef.value as { id: number }).id
                  : typeof bookingRef.value === 'number'
                    ? bookingRef.value
                    : undefined
            } else if ('id' in bookingRef && bookingRef.id) {
              bookingId =
                typeof bookingRef.id === 'object' && bookingRef.id !== null
                  ? (bookingRef.id as { id: number }).id
                  : typeof bookingRef.id === 'number'
                    ? bookingRef.id
                    : undefined
            }
          } else if (typeof bookingRef === 'number') {
            bookingId = bookingRef
          }

          if (bookingId && matchingBookingIds.has(bookingId)) {
            matchingAllocationIds.add(allocation.id)
          }
        }
      }

      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound inventory
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        if (
          inboundInventory &&
          inboundInventory.deliveryCustomerReferenceNumber &&
          inboundInventory.deliveryCustomerReferenceNumber
            .toLowerCase()
            .includes(customerReference.toLowerCase())
        ) {
          return true
        }

        // Check container bookings via container stock allocation
        const allocationId =
          typeof (r as any).containerStockAllocationId === 'object'
            ? (r as any).containerStockAllocationId?.id
            : (r as any).containerStockAllocationId
        if (allocationId && matchingAllocationIds.has(allocationId)) {
          return true
        }

        return false
      })
    }

    // Filter by container booking code
    if (containerBookingCode) {
      // First, find container bookings matching the code
      const importBookings = await payload.find({
        collection: 'import-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              bookingCode: {
                contains: containerBookingCode,
              },
            },
          ],
        },
        limit: 1000,
      })

      const exportBookings = await payload.find({
        collection: 'export-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              bookingCode: {
                contains: containerBookingCode,
              },
            },
          ],
        },
        limit: 1000,
      })

      const bookingIds = new Set<number>()
      importBookings.docs.forEach((b: any) => bookingIds.add(b.id))
      exportBookings.docs.forEach((b: any) => bookingIds.add(b.id))

      if (bookingIds.size > 0) {
        // Find container stock allocations for these bookings
        // Note: Payload doesn't support 'in' operator on polymorphic relationships
        // So we need to query allocations and filter in memory
        const allAllocations = await payload.find({
          collection: 'container-stock-allocations',
          where: {},
          depth: 2, // Load booking relationship
          limit: 10000,
        })

        const allocationIds = new Set<number>()
        for (const allocation of allAllocations.docs) {
          const allocationData = allocation as any
          const bookingRef = allocationData.containerBookingId

          // Handle polymorphic relationship
          let bookingId: number | undefined
          if (typeof bookingRef === 'object' && bookingRef !== null) {
            if ('value' in bookingRef && bookingRef.value) {
              bookingId =
                typeof bookingRef.value === 'object' && bookingRef.value !== null
                  ? (bookingRef.value as { id: number }).id
                  : typeof bookingRef.value === 'number'
                    ? bookingRef.value
                    : undefined
            } else if ('id' in bookingRef && bookingRef.id) {
              bookingId =
                typeof bookingRef.id === 'object' && bookingRef.id !== null
                  ? (bookingRef.id as { id: number }).id
                  : typeof bookingRef.id === 'number'
                    ? bookingRef.id
                    : undefined
            }
          } else if (typeof bookingRef === 'number') {
            bookingId = bookingRef
          }

          if (bookingId && bookingIds.has(bookingId)) {
            allocationIds.add(allocation.id)
          }
        }

        // Filter records by container stock allocation IDs
        filteredRecords = filteredRecords.filter((r) => {
          const allocationId =
            typeof (r as any).containerStockAllocationId === 'object'
              ? (r as any).containerStockAllocationId?.id
              : (r as any).containerStockAllocationId
          return allocationId && allocationIds.has(allocationId)
        })
      } else {
        // No bookings found, filter out all records
        filteredRecords = []
      }
    }

    // Filter by inbound order number (job code)
    // Check both inbound inventory and container bookings
    if (inboundOrderNumber) {
      // First, find container bookings matching the job code (bookingCode)
      const importBookingsWithJobCode = await payload.find({
        collection: 'import-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              bookingCode: {
                contains: inboundOrderNumber,
              },
            },
          ],
        },
        limit: 1000,
      })

      const exportBookingsWithJobCode = await payload.find({
        collection: 'export-container-bookings',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              bookingCode: {
                contains: inboundOrderNumber,
              },
            },
          ],
        },
        limit: 1000,
      })

      const matchingJobCodeBookingIds = new Set<number>()
      importBookingsWithJobCode.docs.forEach((b: any) => matchingJobCodeBookingIds.add(b.id))
      exportBookingsWithJobCode.docs.forEach((b: any) => matchingJobCodeBookingIds.add(b.id))

      // Find allocations for these bookings
      const matchingJobCodeAllocationIds = new Set<number>()
      if (matchingJobCodeBookingIds.size > 0) {
        const allAllocations = await payload.find({
          collection: 'container-stock-allocations',
          where: {},
          depth: 2, // Load booking relationship
          limit: 10000,
        })

        for (const allocation of allAllocations.docs) {
          const allocationData = allocation as any
          const bookingRef = allocationData.containerBookingId

          // Handle polymorphic relationship
          let bookingId: number | undefined
          if (typeof bookingRef === 'object' && bookingRef !== null) {
            if ('value' in bookingRef && bookingRef.value) {
              bookingId =
                typeof bookingRef.value === 'object' && bookingRef.value !== null
                  ? (bookingRef.value as { id: number }).id
                  : typeof bookingRef.value === 'number'
                    ? bookingRef.value
                    : undefined
            } else if ('id' in bookingRef && bookingRef.id) {
              bookingId =
                typeof bookingRef.id === 'object' && bookingRef.id !== null
                  ? (bookingRef.id as { id: number }).id
                  : typeof bookingRef.id === 'number'
                    ? bookingRef.id
                    : undefined
            }
          } else if (typeof bookingRef === 'number') {
            bookingId = bookingRef
          }

          if (bookingId && matchingJobCodeBookingIds.has(bookingId)) {
            matchingJobCodeAllocationIds.add(allocation.id)
          }
        }
      }

      filteredRecords = filteredRecords.filter((r) => {
        // Check inbound inventory job code
        const inboundInventory =
          typeof r.inboundInventoryId === 'object' ? r.inboundInventoryId : null
        if (
          inboundInventory &&
          inboundInventory.jobCode &&
          inboundInventory.jobCode.toLowerCase().includes(inboundOrderNumber.toLowerCase())
        ) {
          return true
        }

        // Check container bookings via container stock allocation
        const containerAllocationRef = (r as any).containerStockAllocationId
        let allocationId: number | undefined
        
        if (containerAllocationRef) {
          if (typeof containerAllocationRef === 'object' && containerAllocationRef !== null) {
            // Could be loaded with depth
            allocationId = containerAllocationRef.id || (containerAllocationRef as any).value?.id || (containerAllocationRef as any).value
          } else if (typeof containerAllocationRef === 'number') {
            allocationId = containerAllocationRef
          }
        }
        
        if (allocationId && matchingJobCodeAllocationIds.has(allocationId)) {
          return true
        }

        return false
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

    // Fetch container jobs for each SKU
    // Get container stock allocations for these SKUs
    const containerStockAllocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        // We'll filter by SKU in memory since productLines is an array field
      },
      depth: 3, // Include container booking (with tenant) and container details
      limit: 10000,
    })

    // Filter container allocations by SKU and tenant
    const containerJobsBySku = new Map<number, any[]>()
    for (const allocation of containerStockAllocations.docs) {
      const allocationData = allocation as any
      const bookingRef = allocationData.containerBookingId

      // Handle polymorphic relationship (loaded with depth: 3)
      let bookingId: number | undefined
      let bookingCollection: string | undefined
      let booking: any = null

      if (typeof bookingRef === 'object' && bookingRef !== null) {
        if ('value' in bookingRef && bookingRef.value) {
          // Format: {relationTo: "...", value: {id: 1, ...}} - fully loaded with depth
          booking = bookingRef.value
          bookingId =
            typeof bookingRef.value === 'object' && bookingRef.value !== null
              ? (bookingRef.value as { id: number }).id
              : typeof bookingRef.value === 'number'
                ? bookingRef.value
                : undefined
          bookingCollection = bookingRef.relationTo
        } else if ('id' in bookingRef && bookingRef.id) {
          // Partial load - need to fetch
          bookingId =
            typeof bookingRef.id === 'object' && bookingRef.id !== null
              ? (bookingRef.id as { id: number }).id
              : typeof bookingRef.id === 'number'
                ? bookingRef.id
                : undefined
          bookingCollection = bookingRef.relationTo
          // Fetch the booking if we have ID and collection
          if (bookingId && bookingCollection) {
            try {
              booking = await payload.findByID({
                collection: bookingCollection as
                  | 'import-container-bookings'
                  | 'export-container-bookings',
                id: bookingId,
              })
            } catch (error) {
              console.error('Error fetching container booking:', error)
              continue
            }
          }
        } else if ((bookingRef as any).id) {
          // Direct object with booking data (shouldn't happen with depth, but handle it)
          booking = bookingRef
          bookingId = (bookingRef as any).id
          bookingCollection = (bookingRef as any).relationTo || 'import-container-bookings'
        }
      } else if (typeof bookingRef === 'number') {
        // Just an ID - need to fetch (shouldn't happen with depth: 3, but handle it)
        bookingId = bookingRef
        // Try to determine collection by checking both
        try {
          booking = await payload.findByID({
            collection: 'import-container-bookings',
            id: bookingId,
          })
          bookingCollection = 'import-container-bookings'
        } catch {
          try {
            booking = await payload.findByID({
              collection: 'export-container-bookings',
              id: bookingId,
            })
            bookingCollection = 'export-container-bookings'
          } catch {
            continue
          }
        }
      }

      if (!bookingId || !bookingCollection || !booking) continue

      // Check tenant
      const bookingTenantId =
        typeof booking.tenantId === 'object' ? booking.tenantId.id : booking.tenantId
      if (bookingTenantId !== tenant.id) continue

      // Process product lines in this allocation
      const productLines = allocationData.productLines || []
      for (const productLine of productLines) {
        const productLineSkuId =
          typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
        if (!productLineSkuId || !skuIds.has(productLineSkuId)) continue

        if (!containerJobsBySku.has(productLineSkuId)) {
          containerJobsBySku.set(productLineSkuId, [])
        }

        // Check if this booking is already added for this SKU (avoid duplicates)
        const existingJobs = containerJobsBySku.get(productLineSkuId) || []
        if (!existingJobs.find((j: any) => j.id === bookingId && j.type === bookingCollection)) {
          // Get container details
          const containerDetail =
            typeof allocationData.containerDetailId === 'object'
              ? allocationData.containerDetailId
              : null

          const isImport = bookingCollection === 'import-container-bookings'
          const containerJob: any = {
            id: bookingId,
            type: isImport ? 'import' : 'export',
            bookingCode: booking.bookingCode,
            customerReference: booking.customerReference,
            bookingReference: booking.bookingReference,
            status: booking.status,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt,
          }

          // Add container-specific fields
          if (containerDetail) {
            containerJob.containerNumber = containerDetail.containerNumber
          }

          // Add import-specific fields
          if (isImport) {
            containerJob.eta = booking.eta
            containerJob.consigneeId = booking.consigneeId
            if (productLine.recievedQty !== undefined) {
              containerJob.receivedQty = productLine.recievedQty
            }
            if (productLine.expectedQtyImport !== undefined) {
              containerJob.expectedQty = productLine.expectedQtyImport
            }
          } else {
            // Export-specific fields
            containerJob.etd = booking.etd
            containerJob.consignorId = booking.consignorId
            if (productLine.allocatedQty !== undefined) {
              containerJob.allocatedQty = productLine.allocatedQty
            }
            if (productLine.pickedQty !== undefined) {
              containerJob.pickedQty = productLine.pickedQty
            }
            if (productLine.expectedQty !== undefined) {
              containerJob.expectedQty = productLine.expectedQty
            }
          }

          containerJobsBySku.get(productLineSkuId)!.push(containerJob)
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
      // Get container jobs for this SKU
      const containerJobs = skuId ? containerJobsBySku.get(skuId as number) || [] : []
      const matchingRecords: InventoryRecord[] = []

      for (const record of filteredRecords) {
        const recordSkuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
        const recordSkuCode = typeof record.skuId === 'object' ? record.skuId.skuCode : undefined
        
        // Get batch number - check both inbound product lines and container stock allocations
        let recordBatch: string | undefined = undefined
        
        // Check inbound product line first
        if (typeof record.inboundProductLineId === 'object' && record.inboundProductLineId !== null) {
          recordBatch = record.inboundProductLineId.batchNumber
        }
        
        // If no batch from inbound product line, check container stock allocation
        if (!recordBatch) {
          const containerAllocation = (record as any).containerStockAllocationId
          if (containerAllocation && typeof containerAllocation === 'object' && containerAllocation !== null) {
            // Container allocations have productLines array - find matching SKU
            const productLines = containerAllocation.productLines || []
            for (const productLine of productLines) {
              const productLineSkuId =
                typeof productLine.skuId === 'object' ? productLine.skuId?.id : productLine.skuId
              if (productLineSkuId === recordSkuId && productLine.batchNumber) {
                recordBatch = productLine.batchNumber
                break
              }
            }
          }
        }

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
        containerJobs, // Container jobs (import/export) for this SKU
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
