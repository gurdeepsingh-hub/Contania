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

    const body = await request.json()
    const { vehicleId, driverId } = body

    if (!vehicleId) {
      return NextResponse.json({ message: 'Vehicle ID is required' }, { status: 400 })
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

    // Verify job status is 'ready_to_dispatch'
    if (job.status !== 'ready_to_dispatch') {
      return NextResponse.json(
        { message: 'Job must be in "Ready to Dispatch" status before dispatching' },
        { status: 400 }
      )
    }

    // Verify vehicle belongs to tenant
    const vehicle = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
    })

    const vehicleTenantId = typeof vehicle.tenantId === 'object' ? vehicle.tenantId.id : vehicle.tenantId
    if (vehicleTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Vehicle not found or does not belong to tenant' }, { status: 400 })
    }

    // Verify driver belongs to tenant (if provided)
    if (driverId) {
      const driver = await payload.findByID({
        collection: 'drivers',
        id: driverId,
      })

      const driverTenantId = typeof driver.tenantId === 'object' ? driver.tenantId.id : driver.tenantId
      if (driverTenantId !== tenant.id) {
        return NextResponse.json({ message: 'Driver not found or does not belong to tenant' }, { status: 400 })
      }
    }

    // Update job with dispatch information
    const updatedJob = await payload.update({
      collection: 'outbound-inventory',
      id: jobId,
      data: {
        vehicleId,
        driverId: driverId || undefined,
        status: 'dispatched',
        dispatchedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
      message: 'Job dispatched successfully',
    })
  } catch (error: any) {
    console.error('Error dispatching job:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to dispatch job' },
      { status: 500 }
    )
  }
}

