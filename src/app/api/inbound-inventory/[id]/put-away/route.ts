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

    // Save received stock data (same as receive endpoint)
    const updatedJob = await payload.update({
      collection: 'inbound-inventory',
      id: jobId,
      data: {
        completedDate: body.completedDate || new Date().toISOString(),
      },
    })

    // Update product lines with received quantities if provided
    if (body.productLines && Array.isArray(body.productLines)) {
      for (const line of body.productLines) {
        if (line.id) {
          await payload.update({
            collection: 'inbound-product-line',
            id: line.id,
            data: {
              recievedQty: line.recievedQty !== undefined ? line.recievedQty : undefined,
              recievedWeight: line.recievedWeight !== undefined ? line.recievedWeight : undefined,
              recievedCubicPerHU: line.recievedCubicPerHU !== undefined ? line.recievedCubicPerHU : undefined,
            },
          })
        }
      }
    }

    // Return success - put-away dialog will be opened on frontend
    return NextResponse.json({
      success: true,
      job: updatedJob,
      openPutAwayDialog: true,
    })
  } catch (error) {
    console.error('Error preparing put-away:', error)
    return NextResponse.json(
      { message: 'Failed to prepare put-away' },
      { status: 500 }
    )
  }
}








