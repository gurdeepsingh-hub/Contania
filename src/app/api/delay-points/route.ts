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
    const sortDirection = sort.startsWith('-') ? 'desc' : 'asc'

    const result = await payload.find({
      collection: 'delay-points',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      delayPoints: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching delay points:', error)
    return NextResponse.json(
      { message: 'Failed to fetch delay points' },
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
        { message: 'Delay point name is required' },
        { status: 400 }
      )
    }

    const newDelayPoint = await payload.create({
      collection: 'delay-points',
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
      delayPoint: newDelayPoint,
    })
  } catch (error) {
    console.error('Error creating delay point:', error)
    return NextResponse.json(
      { message: 'Failed to create delay point' },
      { status: 500 }
    )
  }
}


