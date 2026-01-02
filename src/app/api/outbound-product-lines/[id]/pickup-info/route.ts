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

      // Fetch allocated LPNs for this product line (including partial allocations)
      // Exclude loosened stock here - we'll fetch it separately to ensure proper filtering
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
              {
                isLoosened: {
                  not_equals: true,
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

      // Fetch loosened stock allocated to THIS product line only (separate query to ensure proper filtering)
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
          limit: 1000,
        })

        // Add only loosened stock allocated to THIS product line
        if (loosenedStock.docs.length > 0) {
          allAllocatedLPNs.push(...loosenedStock.docs)
        }
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
    const lpnData = allAllocatedLPNs.map((lpn: any) => {
      const isPickedUp = pickedUpLPNIds.has(lpn.id)
      
      // Determine quantity - show the ALLOCATED quantity for pickup
      let displayQty = lpn.huQty || 0
      if (lpn.isLoosened) {
        displayQty = lpn.loosenedQty || 0
      } else if (lpn.remainingHuQty !== undefined && lpn.remainingHuQty !== null && lpn.remainingHuQty > 0) {
        // Partially allocated pallet: calculate allocated quantity
        if (lpn.originalHuQty !== undefined && lpn.originalHuQty !== null) {
          displayQty = lpn.originalHuQty - lpn.remainingHuQty
        } else {
          // Has remaining but no original - use huQty as original
          displayQty = (lpn.huQty || 0) - lpn.remainingHuQty
        }
      } else if (lpn.remainingHuQty === 0 && lpn.originalHuQty !== undefined && lpn.originalHuQty !== null) {
        // Fully allocated pallet: use huQty which stores the allocated quantity
        // For opened pallets that were fully allocated, huQty contains the allocated quantity (not original)
        // For full pallets that were never opened, huQty contains the full pallet quantity
        displayQty = lpn.huQty || lpn.originalHuQty || 0
      }

      return {
        id: lpn.id,
        lpnNumber: lpn.lpnNumber,
        location: lpn.location || (lpn.isLoosened ? 'LOOSENED' : ''),
        huQty: displayQty,
        isLoosened: lpn.isLoosened || false,
        loosenedQty: lpn.loosenedQty || 0,
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

