import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const jobId = parseInt(id, 10)

    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Get depth from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 2

    // Fetch the job
    const job = await payload.findByID({
      collection: 'inbound-inventory',
      id: jobId,
      depth,
    })

    // Verify tenant ownership
    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Fetch product lines for this job
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        inboundInventoryId: {
          equals: jobId,
        },
      },
      depth: 1,
    })

    return NextResponse.json({
      success: true,
      job: {
        ...job,
        productLines: productLines.docs,
      },
    })
  } catch (error) {
    console.error('Error fetching inbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to fetch inbound inventory job' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const jobId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingJob = await payload.findByID({
      collection: 'inbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Update the job (supports partial updates)
    const updatedJob = await payload.update({
      collection: 'inbound-inventory',
      id: jobId,
      data: {
        jobCode: body.jobCode !== undefined ? body.jobCode : existingJob.jobCode, // Allow job code updates
        expectedDate: body.expectedDate !== undefined && body.expectedDate !== '' ? body.expectedDate : (body.expectedDate === '' ? null : existingJob.expectedDate),
        completedDate: body.completedDate !== undefined && body.completedDate !== '' ? body.completedDate : (body.completedDate === '' ? null : existingJob.completedDate),
        deliveryCustomerReferenceNumber: body.deliveryCustomerReferenceNumber !== undefined ? body.deliveryCustomerReferenceNumber : existingJob.deliveryCustomerReferenceNumber,
        orderingCustomerReferenceNumber: body.orderingCustomerReferenceNumber !== undefined ? body.orderingCustomerReferenceNumber : existingJob.orderingCustomerReferenceNumber,
        deliveryCustomerId: body.deliveryCustomerId !== undefined ? body.deliveryCustomerId : existingJob.deliveryCustomerId,
        notes: body.notes !== undefined ? body.notes : existingJob.notes,
        transportMode: body.transportMode !== undefined ? body.transportMode : existingJob.transportMode,
        warehouseId: body.warehouseId !== undefined ? body.warehouseId : existingJob.warehouseId,
        supplierId: body.supplierId !== undefined ? body.supplierId : existingJob.supplierId,
        transportCompanyId: body.transportCompanyId !== undefined ? body.transportCompanyId : existingJob.transportCompanyId,
        chep: body.chep !== undefined ? body.chep : existingJob.chep,
        loscam: body.loscam !== undefined ? body.loscam : existingJob.loscam,
        plain: body.plain !== undefined ? body.plain : existingJob.plain,
        palletTransferDocket: body.palletTransferDocket !== undefined ? body.palletTransferDocket : existingJob.palletTransferDocket,
      },
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
    })
  } catch (error) {
    console.error('Error updating inbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to update inbound inventory job' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'freight_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const jobId = parseInt(id, 10)

    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const existingJob = await payload.findByID({
      collection: 'inbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Delete product lines first
    const productLines = await payload.find({
      collection: 'inbound-product-line',
      where: {
        inboundInventoryId: {
          equals: jobId,
        },
      },
    })

    for (const line of productLines.docs) {
      await payload.delete({
        collection: 'inbound-product-line',
        id: line.id,
      })
    }

    // Delete the job
    await payload.delete({
      collection: 'inbound-inventory',
      id: jobId,
    })

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting inbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to delete inbound inventory job' },
      { status: 500 }
    )
  }
}







