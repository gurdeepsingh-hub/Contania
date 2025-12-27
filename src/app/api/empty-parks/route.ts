import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
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
      collection: 'empty-parks',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      emptyParks: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching empty parks:', error)
    return NextResponse.json({ message: 'Failed to fetch empty parks' }, { status: 500 })
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
      return NextResponse.json({ message: 'Empty park name is required' }, { status: 400 })
    }

    const newEmptyPark = await payload.create({
      collection: 'empty-parks',
      data: {
        tenantId: tenant.id,
        name: body.name,
        email: body.email || undefined,
        contactName: body.contactName || undefined,
        contactPhoneNumber: body.contactPhoneNumber || undefined,
        address: body.address || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      emptyPark: newEmptyPark,
    })
  } catch (error) {
    console.error('Error creating empty park:', error)
    return NextResponse.json({ message: 'Failed to create empty park' }, { status: 500 })
  }
}
