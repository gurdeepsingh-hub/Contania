import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const allocationId = Number(resolvedParams.id)

    // Get depth parameter
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Get the stock allocation
    const allocation = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
      depth,
    })

    if (!allocation) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to tenant through booking (polymorphic)
    const allocationData = allocation as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = allocationData.containerBookingId
    const bookingId =
      typeof bookingRef === 'object' ? bookingRef.id : bookingRef
    const collection =
      typeof bookingRef === 'object' ? bookingRef.relationTo : null

    if (bookingId && collection) {
      try {
        const booking = await payload.findByID({
          collection: collection as 'import-container-bookings' | 'export-container-bookings',
          id: bookingId,
        })

        if (booking) {
          const bookingTenantId =
            typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
              ? (booking as { tenantId: { id: number } }).tenantId.id
              : (booking as { tenantId?: number }).tenantId

          if (bookingTenantId !== tenant.id) {
            return NextResponse.json(
              { message: 'Stock allocation does not belong to this tenant' },
              { status: 403 },
            )
          }
        }
      } catch (error) {
        // Try the other collection
        const otherCollection =
          collection === 'import-container-bookings'
            ? 'export-container-bookings'
            : 'import-container-bookings'
        try {
          const booking = await payload.findByID({
            collection: otherCollection,
            id: bookingId,
          })

          if (booking) {
            const bookingTenantId =
              typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
                ? (booking as { tenantId: { id: number } }).tenantId.id
                : (booking as { tenantId?: number }).tenantId

            if (bookingTenantId !== tenant.id) {
              return NextResponse.json(
                { message: 'Stock allocation does not belong to this tenant' },
                { status: 403 },
              )
            }
          }
        } catch (e) {
          return NextResponse.json(
            { message: 'Container booking not found' },
            { status: 404 },
          )
        }
      }
    }

    return NextResponse.json({
      success: true,
      stockAllocation: allocation,
    })
  } catch (error) {
    console.error('Error fetching stock allocation:', error)
    return NextResponse.json({ message: 'Failed to fetch stock allocation' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'containers_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const allocationId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the allocation to update
    const allocationToUpdate = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
    })

    if (!allocationToUpdate) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to tenant through booking (polymorphic)
    const allocationData = allocationToUpdate as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = allocationData.containerBookingId
    const bookingId =
      typeof bookingRef === 'object' ? bookingRef.id : bookingRef
    const collection =
      typeof bookingRef === 'object' ? bookingRef.relationTo : null

    if (bookingId && collection) {
      try {
        const booking = await payload.findByID({
          collection: collection as 'import-container-bookings' | 'export-container-bookings',
          id: bookingId,
        })

        if (booking) {
          const bookingTenantId =
            typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
              ? (booking as { tenantId: { id: number } }).tenantId.id
              : (booking as { tenantId?: number }).tenantId

          if (bookingTenantId !== tenant.id) {
            return NextResponse.json(
              { message: 'Stock allocation does not belong to this tenant' },
              { status: 403 },
            )
          }
        }
      } catch (error) {
        // Try the other collection
        const otherCollection =
          collection === 'import-container-bookings'
            ? 'export-container-bookings'
            : 'import-container-bookings'
        try {
          const booking = await payload.findByID({
            collection: otherCollection,
            id: bookingId,
          })

          if (booking) {
            const bookingTenantId =
              typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
                ? (booking as { tenantId: { id: number } }).tenantId.id
                : (booking as { tenantId?: number }).tenantId

            if (bookingTenantId !== tenant.id) {
              return NextResponse.json(
                { message: 'Stock allocation does not belong to this tenant' },
                { status: 403 },
              )
            }
          }
        } catch (e) {
          return NextResponse.json(
            { message: 'Container booking not found' },
            { status: 404 },
          )
        }
      }
    }

    // Prepare update data (jobType removed - inferred from collection)
    const updateData: Record<string, unknown> = {}
    const allowedFields = ['stage', 'productLines']

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Update stock allocation
    const updatedAllocation = await payload.update({
      collection: 'container-stock-allocations',
      id: allocationId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      stockAllocation: updatedAllocation,
    })
  } catch (error) {
    console.error('Error updating stock allocation:', error)
    return NextResponse.json({ message: 'Failed to update stock allocation' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const allocationId = Number(resolvedParams.id)

    // Get the allocation to delete
    const allocationToDelete = await payload.findByID({
      collection: 'container-stock-allocations',
      id: allocationId,
    })

    if (!allocationToDelete) {
      return NextResponse.json({ message: 'Stock allocation not found' }, { status: 404 })
    }

    // Verify allocation belongs to tenant through booking (polymorphic)
    const allocationData = allocationToDelete as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = allocationData.containerBookingId
    const bookingId =
      typeof bookingRef === 'object' ? bookingRef.id : bookingRef
    const collection =
      typeof bookingRef === 'object' ? bookingRef.relationTo : null

    if (bookingId && collection) {
      try {
        const booking = await payload.findByID({
          collection: collection as 'import-container-bookings' | 'export-container-bookings',
          id: bookingId,
        })

        if (booking) {
          const bookingTenantId =
            typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
              ? (booking as { tenantId: { id: number } }).tenantId.id
              : (booking as { tenantId?: number }).tenantId

          if (bookingTenantId !== tenant.id) {
            return NextResponse.json(
              { message: 'Stock allocation does not belong to this tenant' },
              { status: 403 },
            )
          }
        }
      } catch (error) {
        // Try the other collection
        const otherCollection =
          collection === 'import-container-bookings'
            ? 'export-container-bookings'
            : 'import-container-bookings'
        try {
          const booking = await payload.findByID({
            collection: otherCollection,
            id: bookingId,
          })

          if (booking) {
            const bookingTenantId =
              typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
                ? (booking as { tenantId: { id: number } }).tenantId.id
                : (booking as { tenantId?: number }).tenantId

            if (bookingTenantId !== tenant.id) {
              return NextResponse.json(
                { message: 'Stock allocation does not belong to this tenant' },
                { status: 403 },
              )
            }
          }
        } catch (e) {
          return NextResponse.json(
            { message: 'Container booking not found' },
            { status: 404 },
          )
        }
      }
    }

    // Delete stock allocation
    await payload.delete({
      collection: 'container-stock-allocations',
      id: allocationId,
    })

    return NextResponse.json({
      success: true,
      message: 'Stock allocation deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting stock allocation:', error)
    return NextResponse.json({ message: 'Failed to delete stock allocation' }, { status: 500 })
  }
}

