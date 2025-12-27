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

    // Get depth parameter - use depth 2 to properly fetch product lines and their relationships
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 2
    const containerDetailIdParam = url.searchParams.get('containerDetailId')
    const filterByContainerId = containerDetailIdParam ? Number(containerDetailIdParam) : null

    // Optimized query: Query polymorphic relationship via container_stock_allocations_rels table
    // Payload CMS stores polymorphic relationships in PostgreSQL in a separate relation table:
    // - container_stock_allocations_rels table with:
    //   - parent_id (stock allocation ID)
    //   - path ("containerBookingId")
    //   - import_container_bookings_id (booking ID if import)
    //   - export_container_bookings_id (booking ID if export)
    //
    // We query the relation table to find stock allocation IDs, then fetch the full details
    const db = payload.db
    let matchingAllocationIds: number[] = []

    try {
      // Use database adapter to query the relation table directly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dbAdapter = db as any

      // Check if we can access the PostgreSQL connection directly
      if (dbAdapter && dbAdapter.sessions) {
        // Get the database session/connection
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = Object.values(dbAdapter.sessions)[0] as any

        if (session && session.query) {
          // Try different possible table names (Payload might use different naming)
          const possibleTableNames = [
            'container_stock_allocations_rels',
            'container-stock-allocations_rels',
            'container_stock_allocations_rels',
          ]

          for (const tableName of possibleTableNames) {
            try {
              // Query the relation table to find matching stock allocation IDs
              const result = await session.query(
                `SELECT parent_id FROM "${tableName}" WHERE path = $1 AND import_container_bookings_id = $2`,
                ['containerBookingId', bookingId],
              )
              matchingAllocationIds = result.rows.map((row: { parent_id: number }) => row.parent_id)
              if (matchingAllocationIds.length > 0) {
                break
              }
            } catch {
              // Try without quotes
              try {
                const result = await session.query(
                  `SELECT parent_id FROM ${tableName} WHERE path = $1 AND import_container_bookings_id = $2`,
                  ['containerBookingId', bookingId],
                )
                matchingAllocationIds = result.rows.map(
                  (row: { parent_id: number }) => row.parent_id,
                )
                if (matchingAllocationIds.length > 0) {
                  break
                }
              } catch {
                continue
              }
            }
          }
        }
      }
    } catch {
      // Fallback to querying all and filtering
    }

    // Fallback: Query all stock allocations and filter by checking the relationship
    if (matchingAllocationIds.length === 0) {
      try {
        const allAllocations = await payload.find({
          collection: 'container-stock-allocations',
          depth: 1, // Need depth to populate containerBookingId
          limit: 10000,
        })

        // Filter by checking if containerBookingId matches and is an import booking
        matchingAllocationIds = allAllocations.docs
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((allocation: any) => {
            const bookingRef = allocation.containerBookingId
            if (!bookingRef) {
              return false
            }

            // Check if it's an object with id and relationTo
            if (typeof bookingRef === 'object' && bookingRef !== null) {
              // Payload returns polymorphic relationships with depth=1 as:
              // { relationTo: string, value: { id: number, ... } }
              // The booking ID is nested in value.id or directly in id
              const bookingIdValue = bookingRef.id || (bookingRef.value && bookingRef.value.id)
              const relationTo = bookingRef.relationTo

              if (!bookingIdValue) {
                return false
              }

              return bookingIdValue === bookingId && relationTo === 'import-container-bookings'
            }

            return false
          })
          .map((allocation: { id: number }) => allocation.id)
      } catch (fallbackError) {
        console.error('[Stock Allocations Query] Fallback query failed:', fallbackError)
      }
    }

    // If no matching IDs, return empty array
    if (matchingAllocationIds.length === 0) {
      return NextResponse.json({
        success: true,
        stockAllocations: [],
        totalDocs: 0,
      })
    }

    // Build where clause
    const whereClause: any = {
      id: {
        in: matchingAllocationIds,
      },
    }

    // If filtering by containerDetailId, add that filter
    if (filterByContainerId) {
      whereClause.containerDetailId = {
        equals: filterByContainerId,
      }
    }

    // Fetch the full stock allocations with proper depth using the matching IDs
    const allocationsResult = await payload.find({
      collection: 'container-stock-allocations',
      where: whereClause,
      depth,
      limit: 1000,
    })

    // Additional filter by containerDetailId if needed (in case the where clause didn't work)
    let filteredAllocations = allocationsResult.docs
    if (filterByContainerId) {
      filteredAllocations = filteredAllocations.filter((allocation: any) => {
        const allocationContainerId =
          typeof allocation.containerDetailId === 'object'
            ? allocation.containerDetailId.id
            : allocation.containerDetailId
        return allocationContainerId === filterByContainerId
      })
    }

    return NextResponse.json({
      success: true,
      stockAllocations: filteredAllocations,
      totalDocs: filteredAllocations.length,
    })
  } catch (error) {
    console.error('Error fetching stock allocations:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to fetch stock allocations'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        message: 'Failed to fetch stock allocations',
        error: errorMessage,
        stack: errorStack,
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
      return NextResponse.json({ message: 'Container detail ID is required' }, { status: 400 })
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

    // Return the created allocation immediately (product lines are already included)
    // Fetching with depth 2 can be done on the client side if needed
    return NextResponse.json({
      success: true,
      stockAllocation: newAllocation,
    })
  } catch (error) {
    console.error('Error creating stock allocation:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to create stock allocation'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        message: 'Failed to create stock allocation',
        error: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 },
    )
  }
}
