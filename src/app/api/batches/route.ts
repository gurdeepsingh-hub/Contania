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

    // Find all inbound inventory jobs for this warehouse that have been completed (received)
    const inboundJobs = await payload.find({
      collection: 'inbound-inventory',
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
            or: [
              {
                completedDate: {
                  exists: true,
                },
              },
              {
                completedDate: {
                  not_equals: null,
                },
              },
            ],
          },
        ],
      },
      depth: 0,
    })

    const jobIds = inboundJobs.docs.map((job) => job.id)

    if (jobIds.length === 0) {
      return NextResponse.json({
        success: true,
        batches: [],
      })
    }

    // Get all product lines from these jobs
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        inboundInventoryId: {
          in: jobIds,
        },
      },
      depth: 1,
    })

    // Get all put-away records for these product lines to verify they're put away
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
            inboundProductLineId: {
              in: productLines.docs.map((line) => line.id),
            },
          },
        ],
      },
      depth: 0,
    })

    // Get unique product line IDs that have put-away records
    const putAwayProductLineIds = new Set(
      putAwayRecords.docs.map((record) => {
        const lineId =
          typeof record.inboundProductLineId === 'object'
            ? record.inboundProductLineId.id
            : record.inboundProductLineId
        return lineId
      }),
    )

    // Filter product lines to only those that have been received and put away
    const validProductLines = productLines.docs.filter((line) => {
      // Check if line has received quantity
      const hasReceived = line.recievedQty && line.recievedQty > 0
      // Check if line has put-away records
      const hasPutAway = putAwayProductLineIds.has(line.id)
      return hasReceived && hasPutAway && line.batchNumber
    })

    // Group by batch number and get unique batches
    const batchMap = new Map<
      string,
      {
        batchNumber: string
        skuId: number | { id: number; skuCode?: string; description?: string }
        skuDescription?: string
      }
    >()

    validProductLines.forEach((line) => {
      if (line.batchNumber && !batchMap.has(line.batchNumber)) {
        batchMap.set(line.batchNumber, {
          batchNumber: line.batchNumber,
          skuId: line.skuId,
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


