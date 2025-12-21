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
      collection: 'outbound-inventory',
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
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
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
    console.error('Error fetching outbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to fetch outbound inventory job' },
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
      collection: 'outbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Helper function to handle field updates (supports null/empty string)
    const updateField = (field: string, newValue: any, existingValue: any) => {
      if (newValue !== undefined) {
        // Convert empty strings to null for optional fields
        if (typeof newValue === 'string' && newValue.trim() === '') {
          return null
        }
        return newValue
      }
      return existingValue
    }

    // Update the job (supports partial updates)
    const updatedJob = await payload.update({
      collection: 'outbound-inventory',
      id: jobId,
      data: {
        // Basic Info
        jobCode: updateField('jobCode', body.jobCode, existingJob.jobCode),
        status: updateField('status', body.status, existingJob.status),
        customerRefNumber: updateField('customerRefNumber', body.customerRefNumber, existingJob.customerRefNumber),
        consigneeRefNumber: updateField('consigneeRefNumber', body.consigneeRefNumber, existingJob.consigneeRefNumber),
        containerNumber: updateField('containerNumber', body.containerNumber, existingJob.containerNumber),
        inspectionNumber: updateField('inspectionNumber', body.inspectionNumber, existingJob.inspectionNumber),
        inboundJobNumber: updateField('inboundJobNumber', body.inboundJobNumber, existingJob.inboundJobNumber),
        warehouseId: updateField('warehouseId', body.warehouseId, existingJob.warehouseId),
        requiredDateTime: updateField('requiredDateTime', body.requiredDateTime, existingJob.requiredDateTime),
        orderNotes: updateField('orderNotes', body.orderNotes, existingJob.orderNotes),
        palletCount: updateField('palletCount', body.palletCount, existingJob.palletCount),
        // Customer Details - these are the key fields that need to be saved
        customerId: updateField('customerId', body.customerId, existingJob.customerId),
        customerToId: updateField('customerToId', body.customerToId, existingJob.customerToId),
        customerFromId: updateField('customerFromId', body.customerFromId, existingJob.customerFromId),
        // Customer details are auto-populated by hooks when customerId/customerToId/customerFromId are set
        // But we include them in case they're already set and need to be preserved
        customerName: updateField('customerName', body.customerName, existingJob.customerName),
        customerLocation: updateField('customerLocation', body.customerLocation, existingJob.customerLocation),
        customerState: updateField('customerState', body.customerState, existingJob.customerState),
        customerContact: updateField('customerContact', body.customerContact, existingJob.customerContact),
        customerToName: updateField('customerToName', body.customerToName, existingJob.customerToName),
        customerToLocation: updateField('customerToLocation', body.customerToLocation, existingJob.customerToLocation),
        customerToState: updateField('customerToState', body.customerToState, existingJob.customerToState),
        customerToContact: updateField('customerToContact', body.customerToContact, existingJob.customerToContact),
        customerFromName: updateField('customerFromName', body.customerFromName, existingJob.customerFromName),
        customerFromLocation: updateField('customerFromLocation', body.customerFromLocation, existingJob.customerFromLocation),
        customerFromState: updateField('customerFromState', body.customerFromState, existingJob.customerFromState),
        customerFromContact: updateField('customerFromContact', body.customerFromContact, existingJob.customerFromContact),
      },
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
    })
  } catch (error) {
    console.error('Error updating outbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to update outbound inventory job' },
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
      collection: 'outbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Delete product lines first
    const productLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: jobId,
        },
      },
    })

    for (const line of productLines.docs) {
      await payload.delete({
        collection: 'outbound-product-line',
        id: line.id,
      })
    }

    // Delete the job
    await payload.delete({
      collection: 'outbound-inventory',
      id: jobId,
    })

    return NextResponse.json({
      success: true,
      message: 'Job deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting outbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to delete outbound inventory job' },
      { status: 500 }
    )
  }
}
