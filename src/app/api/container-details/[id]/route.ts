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
    const detailId = Number(resolvedParams.id)

    // Get depth parameter
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Get the container detail
    const detail = await payload.findByID({
      collection: 'container-details',
      id: detailId,
      depth,
    })

    if (!detail) {
      return NextResponse.json({ message: 'Container detail not found' }, { status: 404 })
    }

    // Verify detail belongs to tenant through booking (polymorphic)
    const detailData = detail as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = detailData.containerBookingId
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
              { message: 'Container detail does not belong to this tenant' },
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
                { message: 'Container detail does not belong to this tenant' },
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
      containerDetail: detail,
    })
  } catch (error) {
    console.error('Error fetching container detail:', error)
    return NextResponse.json({ message: 'Failed to fetch container detail' }, { status: 500 })
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
    const detailId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the detail to update
    const detailToUpdate = await payload.findByID({
      collection: 'container-details',
      id: detailId,
    })

    if (!detailToUpdate) {
      return NextResponse.json({ message: 'Container detail not found' }, { status: 404 })
    }

    // Verify detail belongs to tenant through booking (polymorphic)
    const detailData = detailToUpdate as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = detailData.containerBookingId
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
              { message: 'Container detail does not belong to this tenant' },
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
                { message: 'Container detail does not belong to this tenant' },
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

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'containerNumber',
      'containerSizeId',
      'gross',
      'tare',
      'net',
      'pin',
      'whManifest',
      'isoCode',
      'timeSlot',
      'emptyTimeSlot',
      'dehireDate',
      'shippingLineId',
      'countryOfOrigin',
      'orderRef',
      'jobAvailability',
      'sealNumber',
      'customerRequestDate',
      'dock',
      'confirmedUnpackDate',
      'yardLocation',
      'secureSealsIntact',
      'inspectUnpack',
      'directionType',
      'houseBillNumber',
      'oceanBillNumber',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // Update container detail
    const updatedDetail = await payload.update({
      collection: 'container-details',
      id: detailId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      containerDetail: updatedDetail,
    })
  } catch (error) {
    console.error('Error updating container detail:', error)
    return NextResponse.json({ message: 'Failed to update container detail' }, { status: 500 })
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
    const detailId = Number(resolvedParams.id)

    // Get the detail to delete
    const detailToDelete = await payload.findByID({
      collection: 'container-details',
      id: detailId,
    })

    if (!detailToDelete) {
      return NextResponse.json({ message: 'Container detail not found' }, { status: 404 })
    }

    // Verify detail belongs to tenant through booking (polymorphic)
    const detailData = detailToDelete as {
      containerBookingId?: number | { id: number; relationTo?: string }
    }
    const bookingRef = detailData.containerBookingId
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
              { message: 'Container detail does not belong to this tenant' },
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
                { message: 'Container detail does not belong to this tenant' },
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

    // Delete container detail
    await payload.delete({
      collection: 'container-details',
      id: detailId,
    })

    return NextResponse.json({
      success: true,
      message: 'Container detail deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting container detail:', error)
    return NextResponse.json({ message: 'Failed to delete container detail' }, { status: 500 })
  }
}

