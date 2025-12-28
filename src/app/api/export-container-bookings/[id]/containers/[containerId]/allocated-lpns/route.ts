import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

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
        { status: 403 },
      )
    }

    // Get allocations for this container
    // Note: containerBookingId is a polymorphic relationship, so we query by containerDetailId and stage first,
    // then filter by containerBookingId in memory to avoid Payload query limitations
    // Use depth: 2 to ensure polymorphic relationship is fully loaded
    const allocationsResult = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        and: [
          {
            containerDetailId: {
              equals: containerId,
            },
          },
          {
            stage: {
              equals: 'allocated',
            },
          },
        ],
      },
      depth: 2, // Increased depth to ensure polymorphic containerBookingId is loaded
      limit: 1000,
    })

    // Filter allocations by bookingId in memory (handles polymorphic relationship)
    // Polymorphic relationships can be: number | { id: number } | { relationTo: string, value: {id: number} }
    const allocations = {
      ...allocationsResult,
      docs: allocationsResult.docs.filter((alloc: any) => {
        let allocBookingId: number | undefined

        if (typeof alloc.containerBookingId === 'object' && alloc.containerBookingId !== null) {
          // Handle polymorphic relationship formats
          const bookingRef = alloc.containerBookingId as {
            id?: number | { id: number }
            value?: number | { id: number }
            relationTo?: string
          }
          // When loaded with depth, Payload returns {relationTo: "...", value: {id: 1, ...}}
          // So we need to check value.id first, then value (if it's a number), then id
          if (bookingRef.value) {
            allocBookingId =
              typeof bookingRef.value === 'object' && bookingRef.value !== null
                ? (bookingRef.value as { id: number }).id
                : typeof bookingRef.value === 'number'
                  ? bookingRef.value
                  : undefined
          } else if (bookingRef.id) {
            allocBookingId =
              typeof bookingRef.id === 'object' && bookingRef.id !== null
                ? (bookingRef.id as { id: number }).id
                : typeof bookingRef.id === 'number'
                  ? bookingRef.id
                  : undefined
          }
        } else if (typeof alloc.containerBookingId === 'number') {
          allocBookingId = alloc.containerBookingId
        }

        const matches = allocBookingId === bookingId
        return matches
      }),
    }

    const allocatedLPNsByProductLine: Record<string, any[]> = {}

    for (const allocation of allocations.docs) {
      const productLines = allocation.productLines || []

      for (let index = 0; index < productLines.length; index++) {
        const productLine = productLines[index]
        const skuId =
          typeof productLine.skuId === 'object' ? productLine.skuId.id : productLine.skuId

        if (!skuId || !productLine.allocatedQty || productLine.allocatedQty === 0) {
          continue
        }

        const key = `${allocation.id}-${index}`

        // Find allocated LPNs for this allocation
        // Query by tenantId and allocationStatus first, then filter by containerStockAllocationId in memory
        // This avoids Payload query limitations with relationship fields
        // Query only 'allocated' LPNs (not 'picked') for pickup dialog
        // 'picked' status means already picked up, so they shouldn't be shown in pickup dialog
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
                allocationStatus: {
                  equals: 'allocated', // Only show allocated LPNs, not picked ones
                },
              },
            ],
          },
          depth: 1,
          limit: 1000, // Reasonable limit for allocated LPNs
        })

        // Filter to only include LPNs that match this allocation
        const filteredLPNs = lpnRecords.docs.filter((lpn: any) => {
          const lpnAllocationId =
            lpn.containerStockAllocationId && typeof lpn.containerStockAllocationId === 'object'
              ? (lpn.containerStockAllocationId as { id: number }).id
              : lpn.containerStockAllocationId
          return lpnAllocationId === allocation.id
        })

        allocatedLPNsByProductLine[key] = filteredLPNs.map((lpn: any) => {
          // Determine isPickedUp based on allocationStatus from database
          // 'picked' status means already picked up, 'allocated' means available for pickup
          const isPickedUp = lpn.allocationStatus === 'picked'

          return {
            id: lpn.id,
            lpnNumber: lpn.lpnNumber,
            location: lpn.location,
            huQty: lpn.huQty,
            allocationId: allocation.id,
            productLineIndex: index,
            isPickedUp, // Based on allocationStatus: 'picked' = true, 'allocated' = false
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      allocatedLPNs: allocatedLPNsByProductLine,
    })
  } catch (error) {
    console.error('Error fetching allocated LPNs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch allocated LPNs',
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
