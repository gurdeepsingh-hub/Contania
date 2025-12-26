import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    // Allow both settings_entity_settings and inventory_view permissions
    let context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      // Try with inventory_view permission as fallback
      context = await getTenantContext(request, 'inventory_view')
      if ('error' in context) {
        return NextResponse.json({ message: context.error }, { status: context.status })
      }
    }

    const { payload, tenant } = context

    // Get pagination parameters from query string
    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0
    const search = url.searchParams.get('search') || ''
    const sort = url.searchParams.get('sort') || '-createdAt'

    // Build where clause
    const where: any = {
      and: [
        {
          tenantId: {
            equals: tenant.id,
          },
        },
      ],
    }

    // Add search if provided
    if (search) {
      where.and.push({
        or: [
          {
            storeName: {
              contains: search,
            },
          },
          {
            zoneType: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch stores for this tenant with pagination
    const storesResult = await payload.find({
      collection: 'stores',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      stores: storesResult.docs,
      totalDocs: storesResult.totalDocs,
      limit: storesResult.limit,
      totalPages: storesResult.totalPages,
      page: storesResult.page,
      hasPrevPage: storesResult.hasPrevPage,
      hasNextPage: storesResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching stores:', error)
    return NextResponse.json({ message: 'Failed to fetch stores' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const body = await request.json()

    // Validate required fields
    if (!body.storeName) {
      return NextResponse.json({ message: 'Store name is required' }, { status: 400 })
    }

    if (!body.warehouseId) {
      return NextResponse.json({ message: 'Warehouse is required' }, { status: 400 })
    }

    if (!body.zoneType) {
      return NextResponse.json({ message: 'Zone type is required' }, { status: 400 })
    }

    // Verify warehouse belongs to this tenant
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: Number(body.warehouseId),
    })

    if (!warehouse) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    const warehouseTenantId =
      typeof (warehouse as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (warehouse as { tenantId: { id: number } }).tenantId.id
        : (warehouse as { tenantId?: number }).tenantId

    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Warehouse does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Create store
    // Note: Not passing req like warehouses does - hooks will still run but won't have user context
    // This is fine since we're explicitly setting tenantId and validating warehouse belongs to tenant
    const newStore = await payload.create({
      collection: 'stores',
      data: {
        tenantId: tenant.id,
        warehouseId: Number(body.warehouseId),
        storeName: body.storeName,
        countable: body.countable || false,
        zoneType: body.zoneType,
      },
    })

    return NextResponse.json({
      success: true,
      store: newStore,
    })
  } catch (error) {
    console.error('Error creating store:', error)
    console.error('Error details:', JSON.stringify(error, null, 2))

    // Return more detailed error information
    if (error && typeof error === 'object') {
      // Handle Payload validation errors
      if ('data' in error) {
        const errorData = error.data as { errors?: Array<{ message?: string; field?: string }> }
        if (errorData.errors && errorData.errors.length > 0) {
          return NextResponse.json(
            {
              message: errorData.errors[0].message || 'Validation error',
              field: errorData.errors[0].field,
              errors: errorData.errors,
              fullError: errorData,
            },
            { status: 400 },
          )
        }
      }

      // Handle ValidationError specifically
      if ('message' in error && (error as { name?: string }).name === 'ValidationError') {
        const validationError = error as {
          message?: string
          data?: { errors?: Array<{ message?: string; field?: string }> }
        }
        if (validationError.data?.errors) {
          return NextResponse.json(
            {
              message: validationError.message || 'Validation error',
              errors: validationError.data.errors,
            },
            { status: 400 },
          )
        }
        return NextResponse.json(
          { message: validationError.message || 'Validation error' },
          { status: 400 },
        )
      }

      // Handle other error types
      if ('message' in error) {
        return NextResponse.json(
          { message: (error as { message: string }).message },
          { status: 500 },
        )
      }
    }

    return NextResponse.json(
      { message: 'Failed to create store', error: String(error) },
      { status: 500 },
    )
  }
}
