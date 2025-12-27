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

    // Get depth parameter
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Optimized query: Query polymorphic relationship via container_details_rels table
    // Payload CMS stores polymorphic relationships in PostgreSQL in a separate relation table:
    // - container_details_rels table with:
    //   - parent_id (container detail ID)
    //   - path ("containerBookingId")
    //   - import_container_bookings_id (booking ID if import)
    //   - export_container_bookings_id (booking ID if export)
    //
    // We query the relation table to find container detail IDs, then fetch the full details
    const db = payload.db
    let matchingDetailIds: number[] = []

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
            'container_details_rels',
            'container-details_rels',
            'container_details_rels',
          ]

          for (const tableName of possibleTableNames) {
            try {
              // Query the relation table to find matching container detail IDs
              const result = await session.query(
                `SELECT parent_id FROM "${tableName}" WHERE path = $1 AND import_container_bookings_id = $2`,
                ['containerBookingId', bookingId],
              )
              matchingDetailIds = result.rows.map((row: { parent_id: number }) => row.parent_id)
              if (matchingDetailIds.length > 0) {
                break
              }
            } catch {
              // Try without quotes
              try {
                const result = await session.query(
                  `SELECT parent_id FROM ${tableName} WHERE path = $1 AND import_container_bookings_id = $2`,
                  ['containerBookingId', bookingId],
                )
                matchingDetailIds = result.rows.map((row: { parent_id: number }) => row.parent_id)
                if (matchingDetailIds.length > 0) {
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

    // Fallback: Query all container details and filter by checking the relationship
    if (matchingDetailIds.length === 0) {
      try {
        const allDetails = await payload.find({
          collection: 'container-details',
          depth: 1, // Need depth to populate containerBookingId
          limit: 10000,
        })

        // Filter by checking if containerBookingId matches and is an import booking
        matchingDetailIds = allDetails.docs
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((detail: any) => {
            const bookingRef = detail.containerBookingId
            if (!bookingRef) {
              return false
            }

            // Check if it's an object with id and relationTo
            if (typeof bookingRef === 'object' && bookingRef !== null) {
              // Payload returns polymorphic relationships with depth=2 as:
              // { relationTo: string, value: { id: number, ... } }
              // The booking ID is nested in value.id
              const bookingIdValue = bookingRef.id || (bookingRef.value && bookingRef.value.id)
              const relationTo = bookingRef.relationTo

              if (!bookingIdValue) {
                return false
              }

              return bookingIdValue === bookingId && relationTo === 'import-container-bookings'
            }

            return false
          })
          .map((detail: { id: number }) => detail.id)
      } catch (fallbackError) {
        console.error('[Container Details Query] Fallback query failed:', fallbackError)
      }
    }

    // If no matching IDs, return empty array
    if (matchingDetailIds.length === 0) {
      return NextResponse.json({
        success: true,
        containerDetails: [],
        totalDocs: 0,
      })
    }

    // Fetch the full container details with proper depth using the matching IDs
    const detailsResult = await payload.find({
      collection: 'container-details',
      where: {
        id: {
          in: matchingDetailIds,
        },
      },
      depth,
      limit: 1000,
    })

    return NextResponse.json({
      success: true,
      containerDetails: detailsResult.docs,
      totalDocs: detailsResult.docs.length,
    })
  } catch (error) {
    console.error('Error fetching container details:', error)
    return NextResponse.json({ message: 'Failed to fetch container details' }, { status: 500 })
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
    if (!body.containerNumber || !body.containerSizeId || !body.warehouseId) {
      return NextResponse.json(
        { message: 'Container number, container size, and warehouse are required' },
        { status: 400 },
      )
    }

    // Create container detail with polymorphic relationship
    const newDetail = await payload.create({
      collection: 'container-details',
      data: {
        containerBookingId: {
          relationTo: 'import-container-bookings',
          value: bookingId,
        },
        containerNumber: body.containerNumber,
        containerSizeId: body.containerSizeId,
        warehouseId: body.warehouseId,
        gross: body.gross,
        tare: body.tare,
        net: body.net,
        pin: body.pin,
        whManifest: body.whManifest,
        isoCode: body.isoCode,
        timeSlot: body.timeSlot,
        emptyTimeSlot: body.emptyTimeSlot,
        dehireDate: body.dehireDate,
        shippingLineId: body.shippingLineId,
        countryOfOrigin: body.countryOfOrigin,
        orderRef: body.orderRef,
        jobAvailability: body.jobAvailability,
        sealNumber: body.sealNumber,
        customerRequestDate: body.customerRequestDate,
        dock: body.dock,
        confirmedUnpackDate: body.confirmedUnpackDate,
        yardLocation: body.yardLocation,
        secureSealsIntact: body.secureSealsIntact,
        inspectUnpack: body.inspectUnpack,
        directionType: body.directionType,
        houseBillNumber: body.houseBillNumber,
        oceanBillNumber: body.oceanBillNumber,
        ventAirflow: body.ventAirflow,
      },
    })

    return NextResponse.json({
      success: true,
      containerDetail: newDetail,
    })
  } catch (error) {
    console.error('Error creating container detail:', error)
    return NextResponse.json({ message: 'Failed to create container detail' }, { status: 500 })
  }
}
