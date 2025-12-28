import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get query parameters
    const url = new URL(request.url)
    const warehouseId = url.searchParams.get('warehouseId')

    if (!warehouseId) {
      return NextResponse.json({ message: 'warehouseId is required' }, { status: 400 })
    }

    const whId = parseInt(warehouseId, 10)
    if (isNaN(whId)) {
      return NextResponse.json({ message: 'Invalid warehouseId' }, { status: 400 })
    }

    // Get all put-away records for this warehouse directly
    // This is more reliable than checking completed inbound jobs
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
              equals: whId,
            },
          },
          {
            isDeleted: {
              not_equals: true,
            },
          },
        ],
      },
      depth: 2, // Need depth to get product line details
      limit: 10000, // Get all put-away records
    })

    // Get unique product line IDs from put-away records
    const productLineIds = new Set<number>()
    for (const record of putAwayRecords.docs) {
      const inboundProductLineIdRef = (record as { inboundProductLineId?: number | { id: number } | null }).inboundProductLineId
      if (!inboundProductLineIdRef) continue
      
      const productLineId =
        typeof inboundProductLineIdRef === 'object' && inboundProductLineIdRef !== null
          ? inboundProductLineIdRef.id
          : inboundProductLineIdRef
      if (productLineId) {
        productLineIds.add(productLineId)
      }
    }

    // Get all product lines that have put-away records
    let inboundProductLines: any[] = []
    if (productLineIds.size > 0) {
      const productLinesResult = await payload.find({
        collection: 'inbound-product-line',
        where: {
          id: {
            in: Array.from(productLineIds),
          },
        },
        depth: 1,
        limit: 10000, // Get all product lines
      })

      // Filter product lines to only those that have batch numbers and received quantity
      inboundProductLines = productLinesResult.docs.filter((line: { id: number; recievedQty?: number; batchNumber?: string }) => {
        // Check if line has received quantity
        const hasReceived = line.recievedQty && line.recievedQty > 0
        // Check if line has batch number
        const hasBatch = line.batchNumber && line.batchNumber.trim() !== ''
        return hasReceived && hasBatch
      })
    }

    // Also get batches from import container booking product lines
    // First, get all container details for this warehouse
    const containerDetails = await payload.find({
      collection: 'container-details',
      where: {
        and: [
          {
            warehouseId: {
              equals: whId,
            },
          },
        ],
      },
      depth: 0,
      limit: 10000,
    })

    const containerDetailIds = containerDetails.docs.map((cd: { id: number }) => cd.id)

    // Get all container stock allocations for import bookings with these containers
    // Note: We need to query all and filter by polymorphic relationship since Payload doesn't support direct polymorphic queries
    let importContainerProductLines: any[] = []
    if (containerDetailIds.length > 0) {
      // Query allocations for these containers
      const allocations = await payload.find({
        collection: 'container-stock-allocations',
        where: {
          containerDetailId: {
            in: containerDetailIds,
          },
        },
        depth: 1, // Need depth to check polymorphic relationship
        limit: 10000,
      })

      // Filter allocations that are for import bookings and have received/put_away stage
      const importAllocations = allocations.docs.filter((allocation: any) => {
        const bookingRef = allocation.containerBookingId
        if (!bookingRef) return false

        // Check if it's an import booking
        if (typeof bookingRef === 'object' && bookingRef !== null) {
          const relationTo = bookingRef.relationTo
          if (relationTo !== 'import-container-bookings') return false
        } else {
          return false
        }

        // Check stage
        const stage = allocation.stage
        return stage === 'received' || stage === 'put_away'
      })

      // Extract product lines from import allocations
      for (const allocation of importAllocations) {
        const allocationData = allocation as { productLines?: any[] }
        if (allocationData.productLines && Array.isArray(allocationData.productLines)) {
          // Filter product lines that have batch numbers and received quantity
          const validLines = allocationData.productLines.filter((line: any) => {
            const hasReceived = line.recievedQty && line.recievedQty > 0
            const hasBatch = line.batchNumber && line.batchNumber.trim() !== ''
            return hasReceived && hasBatch
          })
          importContainerProductLines.push(...validLines)
        }
      }
    }

    // Combine both sources of product lines
    const validProductLines = [...inboundProductLines, ...importContainerProductLines]

    // Group by batch number and get unique batches
    const batchMap = new Map<
      string,
      {
        batchNumber: string
        skuId: number | { id: number; skuCode?: string; description?: string }
        skuDescription?: string
      }
    >()

    validProductLines.forEach((line: { batchNumber?: string; skuId?: number | { id: number; skuCode?: string; description?: string }; skuDescription?: string }) => {
      if (line.batchNumber && !batchMap.has(line.batchNumber)) {
        batchMap.set(line.batchNumber, {
          batchNumber: line.batchNumber,
          skuId: line.skuId as number | { id: number; skuCode?: string; description?: string },
          skuDescription: line.skuDescription,
        })
      }
    })

    return NextResponse.json({
      success: true,
      batches: Array.from(batchMap.values()),
    })
  } catch (error) {
    console.error('Error fetching batches:', error)
    return NextResponse.json({ message: 'Failed to fetch batches' }, { status: 500 })
  }
}



