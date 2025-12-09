import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()

    const { jobId, warehouseId, putAwayRecords } = body

    if (!jobId || !warehouseId || !Array.isArray(putAwayRecords) || putAwayRecords.length === 0) {
      return NextResponse.json(
        { message: 'Job ID, warehouse ID, and put-away records are required' },
        { status: 400 }
      )
    }

    // Verify job belongs to tenant
    const job = await payload.findByID({
      collection: 'inbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Verify warehouse belongs to tenant
    const warehouse = await payload.findByID({
      collection: 'warehouses',
      id: warehouseId,
    })

    const warehouseTenantId =
      typeof warehouse.tenantId === 'object' ? warehouse.tenantId.id : warehouse.tenantId
    if (warehouseTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 })
    }

    // Verify product lines belong to the job
    const productLineIds = putAwayRecords.map((r: { inboundProductLineId: number }) => r.inboundProductLineId)
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        id: {
          in: productLineIds,
        },
      },
    })

    for (const line of productLines.docs) {
      const lineJobId =
        typeof line.inboundInventoryId === 'object'
          ? line.inboundInventoryId.id
          : line.inboundInventoryId
      if (lineJobId !== jobId) {
        return NextResponse.json(
          { message: 'Product line does not belong to this job' },
          { status: 400 }
        )
      }
    }

    // Create put-away records
    const createdRecords = []
    for (const record of putAwayRecords) {
      const productLine = productLines.docs.find(
        (pl) => pl.id === record.inboundProductLineId
      )

      if (!productLine) {
        continue
      }

      const skuId =
        typeof record.skuId === 'number' ? record.skuId : productLine.skuId
          ? typeof productLine.skuId === 'object'
            ? productLine.skuId.id
            : productLine.skuId
          : null

      if (!skuId) {
        return NextResponse.json(
          { message: `SKU ID not found for product line ${record.inboundProductLineId}` },
          { status: 400 }
        )
      }

      const created = await payload.create({
        collection: 'put-away-stock',
        data: {
          tenantId: tenant.id,
          inboundInventoryId: jobId,
          inboundProductLineId: record.inboundProductLineId,
          skuId,
          warehouseId,
          location: record.location,
          huQty: record.huQty,
          lpnNumber: record.lpnNumber, // Use provided LPN number
        },
      })

      createdRecords.push(created)
    }

    return NextResponse.json({
      success: true,
      records: createdRecords,
      count: createdRecords.length,
    })
  } catch (error) {
    console.error('Error creating put-away records:', error)
    return NextResponse.json(
      { message: 'Failed to create put-away records' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const url = new URL(request.url)
    const jobId = url.searchParams.get('jobId')
    const productLineId = url.searchParams.get('productLineId')

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

    if (jobId) {
      where.and.push({
        inboundInventoryId: {
          equals: Number(jobId),
        },
      })
    }

    if (productLineId) {
      where.and.push({
        inboundProductLineId: {
          equals: Number(productLineId),
        },
      })
    }

    const records = await payload.find({
      collection: 'put-away-stock',
      where,
      depth: 2,
      limit: 10000, // Increase limit to show all records
    })

    return NextResponse.json({
      success: true,
      records: records.docs,
      count: records.docs.length,
    })
  } catch (error) {
    console.error('Error fetching put-away records:', error)
    return NextResponse.json(
      { message: 'Failed to fetch put-away records' },
      { status: 500 }
    )
  }
}

