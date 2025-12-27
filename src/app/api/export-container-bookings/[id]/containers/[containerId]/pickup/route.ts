import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; containerId: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, user } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const containerId = Number(resolvedParams.containerId)
    const body = await request.json()

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

    // Verify container belongs to booking
    const container = await payload.findByID({
      collection: 'container-details',
      id: containerId,
    })

    if (!container) {
      return NextResponse.json({ message: 'Container not found' }, { status: 404 })
    }

    const containerBookingId =
      typeof (container as { containerBookingId?: number | { id: number } }).containerBookingId ===
      'object'
        ? (container as { containerBookingId: { id: number } }).containerBookingId.id
        : (container as { containerBookingId?: number }).containerBookingId

    if (containerBookingId !== bookingId) {
      return NextResponse.json(
        { message: 'Container does not belong to this booking' },
        { status: 400 },
      )
    }

    const { productLineIndex, pickedUpLPNs, bufferQty, notes } = body

    if (!Array.isArray(pickedUpLPNs) || pickedUpLPNs.length === 0) {
      return NextResponse.json(
        { message: 'Picked up LPNs are required' },
        { status: 400 }
      )
    }

    // Get stock allocations for this container
    const allocations = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        containerDetailId: {
          equals: containerId,
        },
        stage: {
          equals: 'allocated',
        },
      },
    })

    if (allocations.docs.length === 0) {
      return NextResponse.json(
        { message: 'No allocated stock found for this container' },
        { status: 400 }
      )
    }

    // Find the allocation and product line
    const allocation = allocations.docs[0] // Use first allocation for now
    const productLine = allocation.productLines?.[productLineIndex || 0]

    if (!productLine) {
      return NextResponse.json(
        { message: 'Product line not found' },
        { status: 400 }
      )
    }

    // Calculate picked up quantity from LPNs
    const pickedUpQty = pickedUpLPNs.reduce((sum: number, lpn: any) => {
      return sum + (lpn.huQty || 0)
    }, 0)

    const finalPickedUpQty = pickedUpQty + (bufferQty || 0)

    // Create pickup record
    const pickup = await payload.create({
      collection: 'pickup-stock',
      data: {
        tenantId: tenant.id,
        containerDetailId: containerId,
        containerStockAllocationId: allocation.id,
        pickedUpLPNs: pickedUpLPNs.map((lpn: any) => ({
          lpnId: lpn.lpnId,
          lpnNumber: lpn.lpnNumber,
          huQty: lpn.huQty,
          location: lpn.location,
        })),
        pickedUpQty,
        bufferQty: bufferQty || 0,
        finalPickedUpQty,
        pickupStatus: 'completed',
        pickedUpBy: user?.id,
        notes: notes || '',
      },
    })

    // Update PutAwayStock allocation status to 'picked'
    for (const lpn of pickedUpLPNs) {
      if (lpn.lpnId) {
        const lpnId = typeof lpn.lpnId === 'object' ? lpn.lpnId.id : lpn.lpnId
        await payload.update({
          collection: 'put-away-stock',
          id: lpnId,
          data: {
            allocationStatus: 'picked',
          },
        })
      }
    }

    // Update product line picked quantities
    const updatedProductLines = allocation.productLines.map((pl: any, idx: number) => {
      if (idx === (productLineIndex || 0)) {
        return {
          ...pl,
          pickedQty: (pl.pickedQty || 0) + pickedUpQty,
          pickedWeight: pl.pickedWeight || 0, // Calculate if needed
        }
      }
      return pl
    })

    await payload.update({
      collection: 'container-stock-allocations',
      id: allocation.id,
      data: {
        productLines: updatedProductLines,
      },
    })

    // Check if all product lines have been picked
    const allPicked = updatedProductLines.every(
      (pl: any) => pl.pickedQty && pl.pickedQty > 0 && pl.pickedQty >= (pl.allocatedQty || 0),
    )

    if (allPicked) {
      // Update container status to picked_up
      await payload.update({
        collection: 'container-details',
        id: containerId,
        data: {
          status: 'picked_up',
        },
      })
    }

    return NextResponse.json({
      success: true,
      pickup,
    })
  } catch (error) {
    console.error('Error creating container pickup:', error)
    return NextResponse.json(
      { message: 'Failed to create pickup' },
      { status: 500 }
    )
  }
}

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
    const containerId = Number(resolvedParams.containerId)

    const records = await payload.find({
      collection: 'pickup-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            containerDetailId: {
              equals: containerId,
            },
          },
        ],
      },
      depth: 2,
    })

    return NextResponse.json({
      success: true,
      records: records.docs,
      count: records.docs.length,
    })
  } catch (error) {
    console.error('Error fetching container pickup records:', error)
    return NextResponse.json(
      { message: 'Failed to fetch pickup records' },
      { status: 500 }
    )
  }
}

