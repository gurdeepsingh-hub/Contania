import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

/**
 * Endpoint to fetch available locations for a warehouse
 * Returns distinct locations from put-away-stock records
 */
export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'inventory_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const url = new URL(request.url)
    const warehouseId = url.searchParams.get('warehouseId')

    if (!warehouseId) {
      return NextResponse.json(
        { message: 'Warehouse ID is required' },
        { status: 400 }
      )
    }

    // Verify warehouse belongs to tenant
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: Number(warehouseId),
    })

    const warehouseTenantId =
      typeof warehouse.tenantId === 'object' ? warehouse.tenantId.id : warehouse.tenantId
    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Query put-away-stock collection for distinct locations
    const putAwayRecords = await payload.find({
      collection: 'put-away-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            warehouseId: {
              equals: Number(warehouseId),
            },
          },
          {
            isDeleted: {
              equals: false,
            },
          },
          {
            location: {
              exists: true,
            },
          },
        ],
      },
      limit: 10000,
    })

    // Get unique locations
    const locationSet = new Set<string>()
    for (const record of putAwayRecords.docs) {
      const location = (record as any).location
      if (location && typeof location === 'string') {
        locationSet.add(location)
      }
    }

    // Sort locations alphabetically
    const locations = Array.from(locationSet).sort()

    return NextResponse.json({
      success: true,
      locations,
    })
  } catch (error) {
    console.error('Error fetching warehouse locations:', error)
    return NextResponse.json(
      { message: 'Failed to fetch locations' },
      { status: 500 }
    )
  }
}



