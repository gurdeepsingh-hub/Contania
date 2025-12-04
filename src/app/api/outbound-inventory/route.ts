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
    const status = url.searchParams.get('status') || ''

    // Build where clause
    const where: any = {
      tenantId: {
        equals: tenant.id,
      },
    }

    // Add status filter if provided
    if (status) {
      where.status = {
        equals: status,
      }
    }

    // Add search if provided
    if (search) {
      where.or = [
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
          customerToName: {
            contains: search,
          },
        },
        {
          customerFromName: {
            contains: search,
          },
        },
        {
          orderNotes: {
            contains: search,
          },
        },
      ]
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    // Fetch outbound inventory jobs for this tenant with pagination
    const result = await payload.find({
      collection: 'outbound-inventory',
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
    console.error('Error fetching outbound inventory:', error)
    return NextResponse.json({ message: 'Failed to fetch outbound inventory' }, { status: 500 })
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

    // Build data object, only including fields that have values
    const data: Record<string, unknown> = {
      tenantId: tenant.id,
      status: body.status || 'draft',
    }

    // Required fields
    if (
      !body.inboundJobNumber ||
      (typeof body.inboundJobNumber === 'string' && body.inboundJobNumber.trim() === '')
    ) {
      return NextResponse.json({ message: 'Inbound job number is required' }, { status: 400 })
    }
    data.inboundJobNumber = body.inboundJobNumber

    // Only include fields if they have values (not undefined, null, or empty string)
    if (body.jobCode) data.jobCode = body.jobCode
    if (body.customerRefNumber) data.customerRefNumber = body.customerRefNumber
    if (body.consigneeRefNumber) data.consigneeRefNumber = body.consigneeRefNumber
    if (body.containerNumber) data.containerNumber = body.containerNumber
    if (body.inspectionNumber) data.inspectionNumber = body.inspectionNumber
    if (body.warehouseId) data.warehouseId = body.warehouseId
    if (body.customerId && body.customerId.trim() !== '') data.customerId = body.customerId
    if (body.customerToId && body.customerToId.trim() !== '') data.customerToId = body.customerToId
    if (body.customerFromId && body.customerFromId.trim() !== '')
      data.customerFromId = body.customerFromId
    if (body.requiredDateTime) data.requiredDateTime = body.requiredDateTime
    if (body.orderNotes) data.orderNotes = body.orderNotes
    if (body.palletCount !== undefined && body.palletCount !== null)
      data.palletCount = body.palletCount

    // Create outbound inventory job (supports partial saves)
    const newJob = await payload.create({
      collection: 'outbound-inventory',
      data,
    })

    return NextResponse.json({
      success: true,
      job: newJob,
    })
  } catch (error) {
    console.error('Error creating outbound inventory:', error)
    return NextResponse.json({ message: 'Failed to create outbound inventory' }, { status: 500 })
  }
}
