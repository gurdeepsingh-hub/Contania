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
    const jobType = url.searchParams.get('jobType') || ''

    const where: any = {
      and: [
        {
          tenantId: {
            equals: tenant.id,
          },
        },
      ],
    }

    if (jobType) {
      where.and.push({
        jobType: {
          equals: jobType,
        },
      })
    }

    if (search) {
      where.and.push({
        or: [
          {
            vesselName: {
              contains: search,
            },
          },
          {
            voyageNumber: {
              contains: search,
            },
          },
          {
            lloydsNumber: {
              contains: search,
            },
          },
        ],
      })
    }

    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    const result = await payload.find({
      collection: 'vessels',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      vessels: result.docs,
      totalDocs: result.totalDocs,
      limit: result.limit,
      totalPages: result.totalPages,
      page: result.page,
      hasPrevPage: result.hasPrevPage,
      hasNextPage: result.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching vessels:', error)
    return NextResponse.json(
      { message: 'Failed to fetch vessels' },
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

    if (!body.vesselName || !body.jobType) {
      return NextResponse.json(
        { message: 'Vessel name and job type are required' },
        { status: 400 }
      )
    }

    const vesselData: Record<string, unknown> = {
      tenantId: tenant.id,
      vesselName: body.vesselName,
      voyageNumber: body.voyageNumber || undefined,
      lloydsNumber: body.lloydsNumber || undefined,
      wharfId: body.wharfId || undefined,
      jobType: body.jobType,
    }

    // Add import fields if jobType is import
    if (body.jobType === 'import') {
      if (body.eta !== undefined) vesselData.eta = body.eta
      if (body.availability !== undefined) vesselData.availability = body.availability
      if (body.storageStart !== undefined) vesselData.storageStart = body.storageStart
      if (body.firstFreeImportDate !== undefined) vesselData.firstFreeImportDate = body.firstFreeImportDate
    }

    // Add export fields if jobType is export
    if (body.jobType === 'export') {
      if (body.etd !== undefined) vesselData.etd = body.etd
      if (body.receivalStart !== undefined) vesselData.receivalStart = body.receivalStart
      if (body.cutoff !== undefined) vesselData.cutoff = body.cutoff
      if (body.reeferCutoff !== undefined) vesselData.reeferCutoff = body.reeferCutoff
    }

    const newVessel = await payload.create({
      collection: 'vessels',
      data: vesselData,
    })

    return NextResponse.json({
      success: true,
      vessel: newVessel,
    })
  } catch (error) {
    console.error('Error creating vessel:', error)
    return NextResponse.json(
      { message: 'Failed to create vessel' },
      { status: 500 }
    )
  }
}


