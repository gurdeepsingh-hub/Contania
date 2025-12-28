import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> }
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)

    if (isNaN(bookingId) || isNaN(containerId)) {
      return NextResponse.json({ message: 'Invalid booking or container ID' }, { status: 400 })
    }

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Get allocations for this container
    const allocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        and: [
          {
            containerDetailId: {
              equals: containerId,
            },
          },
          {
            containerBookingId: {
              equals: bookingId,
            },
          },
          {
            stage: {
              equals: 'allocated',
            },
          },
        ],
      },
      depth: 1,
    })

    const allocatedLPNsByProductLine: Record<string, any[]> = {}

    for (const allocation of allocations.docs) {
      const productLines = allocation.productLines || []
      
      for (let index = 0; index < productLines.length; index++) {
        const productLine = productLines[index]
        const skuId = typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId
        
        if (!skuId || !productLine.allocatedQty || productLine.allocatedQty === 0) {
          continue
        }

        const key = `${allocation.id}-${index}`
        
        // Find allocated LPNs for this allocation
        const lpnRecords = await payload.find({
          collection: 'put-away-stock',
          where: {
            and: [
              {
                tenantId: {
                  equals: tenant.id,
                },
              },
              {
                containerStockAllocationId: {
                  equals: allocation.id,
                },
              },
              {
                allocationStatus: {
                  in: ['allocated', 'picked'],
                },
              },
            ],
          },
          depth: 1,
        })

        allocatedLPNsByProductLine[key] = lpnRecords.docs.map((lpn: any) => ({
          id: lpn.id,
          lpnNumber: lpn.lpnNumber,
          location: lpn.location,
          huQty: lpn.huQty,
          allocationId: allocation.id,
          productLineIndex: index,
          isPickedUp: lpn.allocationStatus === 'picked',
        }))
      }
    }

    return NextResponse.json({
      success: true,
      allocatedLPNs: allocatedLPNsByProductLine,
    })
  } catch (error) {
    console.error('Error fetching allocated LPNs:', error)
    return NextResponse.json(
      { message: 'Failed to fetch allocated LPNs' },
      { status: 500 }
    )
  }
}

