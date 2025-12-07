import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
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

    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: jobId,
      depth: 1,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Verify job status is 'picked' (all product lines must be picked)
    if (job.status !== 'picked') {
      return NextResponse.json(
        { message: 'Job must be fully picked before completing pickup' },
        { status: 400 }
      )
    }

    // Update job status to 'ready_to_dispatch'
    const updatedJob = await payload.update({
      collection: 'outbound-inventory',
      id: jobId,
      data: {
        status: 'ready_to_dispatch',
      },
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: 'Pickup completed. Job is now ready to dispatch.',
    })
  } catch (error: any) {
    console.error('Error completing pickup:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to complete pickup' },
      { status: 500 }
    )
  }
}

