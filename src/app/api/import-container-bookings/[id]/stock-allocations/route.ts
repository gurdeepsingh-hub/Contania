import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Get depth parameter
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Fetch stock allocations for this booking (polymorphic relationship)
    const allocationsResult = await payload.find({
      collection: 'container-stock-allocations',
      where: {
        containerBookingId: {
          equals: bookingId,
        },
      },
      depth,
    })

    // Filter to ensure they're linked to this import booking
    const filteredAllocations = allocationsResult.docs.filter((allocation) => {
      const allocationBookingId =
        typeof (allocation as { containerBookingId?: number | { id: number; relationTo?: string } })
          .containerBookingId === 'object'
          ? (allocation as { containerBookingId: { id: number; relationTo?: string } })
              .containerBookingId
          : null

      if (allocationBookingId && typeof allocationBookingId === 'object') {
        return (
          allocationBookingId.id === bookingId &&
          allocationBookingId.relationTo === 'import-container-bookings'
        )
      }
      return false
    })

    return NextResponse.json({
      success: true,
      stockAllocations: filteredAllocations,
      totalDocs: filteredAllocations.length,
    })
  } catch (error) {
    console.error('Error fetching stock allocations:', error)
    return NextResponse.json(
      { message: 'Failed to fetch stock allocations' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const body = await request.json()

    // Verify booking belongs to tenant
    const booking = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Validate required fields
    if (!body.containerDetailId) {
      return NextResponse.json(
        { message: 'Container detail ID is required' },
        { status: 400 }
      )
    }

    // Create stock allocation with polymorphic relationship (default stage for import is 'expected')
    const newAllocation = await payload.create({
      collection: 'container-stock-allocations',
      data: {
        containerDetailId: body.containerDetailId,
        containerBookingId: {
          relationTo: 'import-container-bookings',
          value: bookingId,
        },
        stage: body.stage || 'expected',
        productLines: body.productLines || [],
      },
    })

    return NextResponse.json({
      success: true,
      stockAllocation: newAllocation,
    })
  } catch (error) {
    console.error('Error creating stock allocation:', error)
    return NextResponse.json(
      { message: 'Failed to create stock allocation' },
      { status: 500 }
    )
  }
}

