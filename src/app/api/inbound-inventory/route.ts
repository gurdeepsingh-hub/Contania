import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    // Get pagination parameters from query string
    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1
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
        {
          isDeleted: {
            equals: false,
          },
        },
      ],
    }

    // Add search if provided
    if (search) {
      where.and.push({
        or: [
          {
            jobCode: {
              contains: search,
            },
          },
          {
            customerName: {
              contains: search,
            },
          },
          {
            supplierName: {
              contains: search,
            },
          },
          {
            notes: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch inbound inventory jobs for this tenant with pagination
    const result = await payload.find({
      collection: 'inbound-inventory',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      jobs: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching inbound inventory:', error)
    return NextResponse.json(
      { message: 'Failed to fetch inbound inventory' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_create')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    // Create inbound inventory job (supports partial saves)
    const newJob = await payload.create({
      collection: 'inbound-inventory',
      data: {
        tenantId: tenant.id,
        jobCode: body.jobCode || undefined, // Allow user-provided job code
        expectedDate: body.expectedDate || undefined,
        completedDate: body.completedDate || undefined,
        deliveryCustomerReferenceNumber: body.deliveryCustomerReferenceNumber || undefined,
        orderingCustomerReferenceNumber: body.orderingCustomerReferenceNumber || undefined,
        deliveryCustomerId: body.deliveryCustomerId || undefined,
        notes: body.notes || undefined,
        transportMode: body.transportMode || undefined,
        warehouseId: body.warehouseId || undefined,
        supplierId: body.supplierId || undefined,
        transportCompanyId: body.transportCompanyId || undefined,
        chep: body.chep || undefined,
        loscam: body.loscam || undefined,
        plain: body.plain || undefined,
        palletTransferDocket: body.palletTransferDocket || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      job: newJob,
    })
  } catch (error) {
    console.error('Error creating inbound inventory:', error)
    return NextResponse.json(
      { message: 'Failed to create inbound inventory' },
      { status: 500 }
    )
  }
}







