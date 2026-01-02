import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Fetch allocated LPNs for this product line - fetch all pages
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

    // Format LPN data - calculate actual allocated quantity
    const lpnData = allAllocatedLPNs.map((lpn: any, index) => {
      // Calculate actual allocated quantity
      // For partial allocations: allocatedQty = originalHuQty - remainingHuQty
      // For full allocations: allocatedQty = huQty (which stores the allocated quantity for opened pallets)
      let allocatedQty = lpn.huQty || 0
      
      if (lpn.isLoosened) {
        // For loosened stock, use the loosenedQty (the quantity allocated)
        // Since it's fully allocated, remainingHuQty should be 0
        allocatedQty = lpn.loosenedQty || lpn.huQty || 0
      } else if (lpn.remainingHuQty !== undefined && lpn.remainingHuQty !== null && lpn.remainingHuQty > 0) {
        // Partial allocation: calculate allocated quantity
        // Only calculate if remainingHuQty > 0 (partially allocated)
        if (lpn.originalHuQty !== undefined && lpn.originalHuQty !== null) {
          allocatedQty = lpn.originalHuQty - lpn.remainingHuQty
        } else {
          // Has remainingHuQty but no originalHuQty - use huQty as original
          allocatedQty = (lpn.huQty || 0) - lpn.remainingHuQty
        }
      } else if (lpn.remainingHuQty === 0 && lpn.originalHuQty !== undefined && lpn.originalHuQty !== null) {
        // Fully allocated pallet: use huQty which stores the allocated quantity
        // For opened pallets that were fully allocated, huQty contains the allocated quantity
        // For full pallets that were never opened, huQty contains the full pallet quantity
        allocatedQty = lpn.huQty || lpn.originalHuQty || 0
      }
      
      return {
        serialNumber: index + 1,
        lpnNumber: lpn.lpnNumber,
        location: lpn.location || '',
        huQty: allocatedQty,
        id: lpn.id,
      }
    })

    return NextResponse.json({
      success: true,
      allocatedLPNs: lpnData,
    })
  } catch (error) {
    console.error('Error fetching allocated LPNs:', error)
    return NextResponse.json(
      { message: 'Failed to fetch allocated LPNs' },
      { status: 500 }
    )
  }
}

