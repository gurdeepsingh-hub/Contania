import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    let context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context

    const url = new URL(request.url)
    const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0
    const search = url.searchParams.get('search') || ''
    const sort = url.searchParams.get('sort') || '-createdAt'

    const where: any = {
      and: [
        {
          tenantId: {
            equals: tenant.id,
          },
        },
      ],
    }

    if (search) {
      where.and.push({
        or: [
          {
            name: {
              contains: search,
            },
          },
          {
            email: {
              contains: search,
            },
          },
          {
            contactName: {
              contains: search,
            },
          },
        ],
      })
    }

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    const result = await payload.find({
      collection: 'shipping-lines',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      shippingLines: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching shipping lines:', error)
    return NextResponse.json(
      { message: 'Failed to fetch shipping lines' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    if (!body.name) {
      return NextResponse.json(
        { message: 'Shipping line name is required' },
        { status: 400 }
      )
    }

    const newShippingLine = await payload.create({
      collection: 'shipping-lines',
      data: {
        tenantId: tenant.id,
        name: body.name,
        email: body.email || undefined,
        contactName: body.contactName || undefined,
        contactPhoneNumber: body.contactPhoneNumber || undefined,
        address: body.address || undefined,
        importFreeDays: body.importFreeDays || undefined,
        calculateImportFreeDaysUsing: body.calculateImportFreeDaysUsing || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      shippingLine: newShippingLine,
    })
  } catch (error) {
    console.error('Error creating shipping line:', error)
    return NextResponse.json(
      { message: 'Failed to create shipping line' },
      { status: 500 }
    )
  }
}


