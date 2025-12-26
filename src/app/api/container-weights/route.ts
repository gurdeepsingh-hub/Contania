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
            size: {
              contains: search,
            },
          },
          {
            attribute: {
              contains: search,
            },
          },
        ],
      })
    }

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    const result = await payload.find({
      collection: 'container-weights',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      containerWeights: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching container weights:', error)
    return NextResponse.json(
      { message: 'Failed to fetch container weights' },
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

    if (!body.size || !body.attribute || body.weight === undefined) {
      return NextResponse.json(
        { message: 'Container size, attribute, and weight are required' },
        { status: 400 }
      )
    }

    const newContainerWeight = await payload.create({
      collection: 'container-weights',
      data: {
        tenantId: tenant.id,
        size: body.size,
        attribute: body.attribute,
        weight: body.weight,
      },
    })

    return NextResponse.json({
      success: true,
      containerWeight: newContainerWeight,
    })
  } catch (error) {
    console.error('Error creating container weight:', error)
    return NextResponse.json(
      { message: 'Failed to create container weight' },
      { status: 500 }
    )
  }
}


