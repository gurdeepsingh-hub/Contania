import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
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

    // Fetch allocated LPNs for this product line
    const allAllocatedLPNs = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const allocatedLPNsResult = await payload.find({
        collection: 'put-away-stock',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              outboundProductLineId: {
                equals: productLineId,
              },
            },
            {
              allocationStatus: {
                equals: 'allocated',
              },
            },
          ],
        },
        sort: 'lpnNumber',
        limit: 1000,
        page,
      })
      allAllocatedLPNs.push(...allocatedLPNsResult.docs)
      hasMore = allocatedLPNsResult.hasNextPage
      page++
    }

    // Fetch existing pickup records for this product line
    const existingPickups = await payload.find({
      collection: 'pickup-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            outboundProductLineId: {
              equals: productLineId,
            },
          },
          {
            pickupStatus: {
              not_equals: 'cancelled',
            },
          },
        ],
      },
      depth: 1,
      sort: '-createdAt',
    })

    // Get LPN IDs that are already picked up
    const pickedUpLPNIds = new Set<number>()
    existingPickups.docs.forEach((pickup: any) => {
      if (pickup.pickedUpLPNs && Array.isArray(pickup.pickedUpLPNs)) {
        pickup.pickedUpLPNs.forEach((lpn: any) => {
          const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
          if (lpnId) {
            pickedUpLPNIds.add(lpnId)
          }
        })
      }
    })

    // Format LPN data with validation status
    const lpnData = allAllocatedLPNs.map((lpn) => {
      const isPickedUp = pickedUpLPNIds.has(lpn.id)
      return {
        id: lpn.id,
        lpnNumber: lpn.lpnNumber,
        location: lpn.location || '',
        huQty: lpn.huQty || 0,
        isPickedUp,
        allocationStatus: lpn.allocationStatus,
      }
    })

    return NextResponse.json({
      success: true,
      productLineId,
      allocatedLPNs: lpnData,
      existingPickups: existingPickups.docs.map((pickup: any) => ({
        id: pickup.id,
        pickedUpQty: pickup.pickedUpQty,
        bufferQty: pickup.bufferQty,
        finalPickedUpQty: pickup.finalPickedUpQty,
        pickupStatus: pickup.pickupStatus,
        pickedUpBy: pickup.pickedUpBy,
        createdAt: pickup.createdAt,
        notes: pickup.notes,
      })),
    })
  } catch (error) {
    console.error('Error fetching pickup info:', error)
    return NextResponse.json({ message: 'Failed to fetch pickup info' }, { status: 500 })
  }
}

