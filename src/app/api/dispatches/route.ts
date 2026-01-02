import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { searchParams } = new URL(request.url)
    const outboundInventoryId = searchParams.get('outboundInventoryId')

    if (!outboundInventoryId) {
      return NextResponse.json({ message: 'outboundInventoryId is required' }, { status: 400 })
    }

    const jobId = parseInt(outboundInventoryId, 10)
    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership of the job
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: jobId,
      depth: 0,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Get dispatches for this job
    const dispatches = await payload.find({
      collection: 'dispatches',
      where: {
        and: [
          {
            tenantId: {
              equals: tenant.id,
            },
          },
          {
            outboundInventoryId: {
              equals: jobId,
            },
          },
        ],
      },
      depth: 2,
      sort: '-createdAt',
    })

    return NextResponse.json({
      success: true,
      dispatches: dispatches.docs,
    })
  } catch (error: any) {
    console.error('Error fetching dispatches:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to fetch dispatches' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const body = await request.json()

    const { outboundInventoryId, dispatchDate, dispatchTime, driverId, vehicleId, notes } = body

    if (!outboundInventoryId || !dispatchDate || !dispatchTime || !vehicleId) {
      return NextResponse.json(
        { message: 'outboundInventoryId, dispatchDate, dispatchTime, and vehicleId are required' },
        { status: 400 },
      )
    }

    const jobId = parseInt(outboundInventoryId, 10)
    if (isNaN(jobId)) {
      return NextResponse.json({ message: 'Invalid job ID' }, { status: 400 })
    }

    // Verify tenant ownership of the job
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: jobId,
      depth: 0,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Verify vehicle belongs to tenant
    const vehicle = await payload.findByID({
      collection: 'vehicles',
      id: vehicleId,
    })

    const vehicleTenantId =
      typeof vehicle.tenantId === 'object' ? vehicle.tenantId.id : vehicle.tenantId
    if (vehicleTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vehicle not found or does not belong to tenant' },
        { status: 400 },
      )
    }

    // Verify driver belongs to tenant (if provided)
    if (driverId) {
      const driver = await payload.findByID({
        collection: 'drivers',
        id: driverId,
      })

      const driverTenantId =
        typeof driver.tenantId === 'object' ? driver.tenantId.id : driver.tenantId
      if (driverTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Driver not found or does not belong to tenant' },
          { status: 400 },
        )
      }
    }

    // Create dispatch entry
    const dispatch = await payload.create({
      collection: 'dispatches',
      data: {
        tenantId: tenant.id,
        outboundInventoryId: jobId,
        dispatchDate,
        dispatchTime,
        driverId: driverId || undefined,
        vehicleId,
        status: 'planned',
        notes: notes || undefined,
        createdBy: currentUser.id,
      },
    })

    return NextResponse.json({
      success: true,
      dispatch,
      message: 'Dispatch entry created successfully',
    })
  } catch (error: any) {
    console.error('Error creating dispatch:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to create dispatch' },
      { status: 500 },
    )
  }
}
