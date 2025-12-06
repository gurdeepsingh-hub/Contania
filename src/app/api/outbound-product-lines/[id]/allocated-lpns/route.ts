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

    // Format LPN data
    const lpnData = allAllocatedLPNs.map((lpn, index) => ({
      serialNumber: index + 1,
      lpnNumber: lpn.lpnNumber,
      location: lpn.location || '',
      huQty: lpn.huQty || 0,
      id: lpn.id,
    }))

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

