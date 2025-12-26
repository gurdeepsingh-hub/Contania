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
            reason: {
              contains: search,
            },
          },
          {
            freightType: {
              contains: search,
            },
          },
        ],
      })
    }

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    const result = await payload.find({
      collection: 'damage-codes',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      damageCodes: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching damage codes:', error)
    return NextResponse.json(
      { message: 'Failed to fetch damage codes' },
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

    if (!body.freightType || !body.reason) {
      return NextResponse.json(
        { message: 'Freight type and reason are required' },
        { status: 400 }
      )
    }

    const newDamageCode = await payload.create({
      collection: 'damage-codes',
      data: {
        tenantId: tenant.id,
        freightType: body.freightType,
        reason: body.reason,
      },
    })

    return NextResponse.json({
      success: true,
      damageCode: newDamageCode,
    })
  } catch (error) {
    console.error('Error creating damage code:', error)
    return NextResponse.json(
      { message: 'Failed to create damage code' },
      { status: 500 }
    )
  }
}


