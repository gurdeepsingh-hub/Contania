import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
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
            skuCode: {
              contains: search,
            },
          },
          {
            description: {
              contains: search,
            },
          },
        ],
      })
    }

    // Parse sort (format: "field" or "-field" for descending)
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort

    // Fetch SKUs for this tenant with pagination
    const skusResult = await payload.find({
      collection: 'skus',
      where,
      depth,
      limit,
      page,
      sort: sortField,
    })

    return NextResponse.json({
      success: true,
      skus: skusResult.docs,
      totalDocs: skusResult.totalDocs,
      limit: skusResult.limit,
      totalPages: skusResult.totalPages,
      page: skusResult.page,
      hasPrevPage: skusResult.hasPrevPage,
      hasNextPage: skusResult.hasNextPage,
    })
  } catch (error) {
    console.error('Error fetching SKUs:', error)
    return NextResponse.json(
      { message: 'Failed to fetch SKUs' },
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

    // Validate required fields
    if (!body.skuCode) {
      return NextResponse.json(
        { message: 'SKU code is required' },
        { status: 400 }
      )
    }

    if (!body.storageUnitId) {
      return NextResponse.json(
        { message: 'Storage unit is required' },
        { status: 400 }
      )
    }

    if (!body.handlingUnitId) {
      return NextResponse.json(
        { message: 'Handling unit is required' },
        { status: 400 }
      )
    }

    // Verify relationships belong to tenant
    if (body.customerId) {
      const customer = await payload.findByID({
        collection: 'customers',
        id: Number(body.customerId),
      })
      const customerTenantId = typeof (customer as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (customer as { tenantId: { id: number } }).tenantId.id
        : (customer as { tenantId?: number }).tenantId
      if (customerTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Customer does not belong to this tenant' },
          { status: 400 }
        )
      }
    }

    const storageUnit = await payload.findByID({
      collection: 'storage-units',
      id: Number(body.storageUnitId),
    })
    const storageUnitTenantId = typeof (storageUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (storageUnit as { tenantId: { id: number } }).tenantId.id
      : (storageUnit as { tenantId?: number }).tenantId
    if (storageUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Storage unit does not belong to this tenant' },
        { status: 400 }
      )
    }

    const handlingUnit = await payload.findByID({
      collection: 'handling-units',
      id: Number(body.handlingUnitId),
    })
    const handlingUnitTenantId = typeof (handlingUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (handlingUnit as { tenantId: { id: number } }).tenantId.id
      : (handlingUnit as { tenantId?: number }).tenantId
    if (handlingUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Handling unit does not belong to this tenant' },
        { status: 400 }
      )
    }

    // Get palletSpaces from storage unit
    const palletSpaces = (storageUnit as { palletSpaces?: number }).palletSpaces

    // Create SKU
    const newSKU = await payload.create({
      collection: 'skus',
      data: {
        tenantId: tenant.id,
        skuCode: body.skuCode,
        description: body.description || undefined,
        customerId: body.customerId ? Number(body.customerId) : undefined,
        storageUnitId: Number(body.storageUnitId),
        handlingUnitId: Number(body.handlingUnitId),
        palletSpacesOfStorageUnit: palletSpaces || undefined,
        huPerSu: body.huPerSu !== undefined && body.huPerSu !== null ? Number(body.huPerSu) : undefined,
        receiveHU: body.receiveHU || undefined,
        pickHU: body.pickHU || undefined,
        pickStrategy: body.pickStrategy || undefined,
        lengthPerHU_mm: body.lengthPerHU_mm !== undefined && body.lengthPerHU_mm !== null ? Number(body.lengthPerHU_mm) : undefined,
        widthPerHU_mm: body.widthPerHU_mm !== undefined && body.widthPerHU_mm !== null ? Number(body.widthPerHU_mm) : undefined,
        heightPerHU_mm: body.heightPerHU_mm !== undefined && body.heightPerHU_mm !== null ? Number(body.heightPerHU_mm) : undefined,
        weightPerHU_kg: body.weightPerHU_kg !== undefined && body.weightPerHU_kg !== null ? Number(body.weightPerHU_kg) : undefined,
        casesPerLayer: body.casesPerLayer !== undefined && body.casesPerLayer !== null ? Number(body.casesPerLayer) : undefined,
        layersPerPallet: body.layersPerPallet !== undefined && body.layersPerPallet !== null ? Number(body.layersPerPallet) : undefined,
        casesPerPallet: body.casesPerPallet !== undefined && body.casesPerPallet !== null ? Number(body.casesPerPallet) : undefined,
        eachsPerCase: body.eachsPerCase !== undefined && body.eachsPerCase !== null ? Number(body.eachsPerCase) : undefined,
        isExpriy: body.isExpriy === true,
        isAttribute1: body.isAttribute1 === true,
        isAttribute2: body.isAttribute2 === true,
        expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
        attribute1: body.attribute1 || undefined,
        attribute2: body.attribute2 || undefined,
      },
    })

    return NextResponse.json({
      success: true,
      sku: newSKU,
    })
  } catch (error) {
    console.error('Error creating SKU:', error)
    return NextResponse.json(
      { message: 'Failed to create SKU' },
      { status: 500 }
    )
  }
}

