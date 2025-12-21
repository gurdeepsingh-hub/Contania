import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    // Verify tenant ownership
    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: jobId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Fetch all product lines for this job
    const productLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: jobId,
        },
      },
    })

    // Fetch pickup records for all product lines
    const pickupStatuses = await Promise.all(
      productLines.docs.map(async (line: any) => {
        const pickups = await payload.find({
          collection: 'pickup-stock',
          where: {
            and: [
              {
                tenantId: {
                  equals: tenant.id,
                },
              },
              {
                outboundProductLineId: {
                  equals: line.id,
                },
              },
              {
                pickupStatus: {
                  not_equals: 'cancelled',
                },
              },
            ],
          },
          depth: 1,
          sort: '-createdAt',
        })

        const completedPickups = pickups.docs.filter(
          (p: any) => p.pickupStatus === 'completed',
        )

        return {
          productLineId: line.id,
          productLine: {
            id: line.id,
            batchNumber: line.batchNumber,
            skuDescription: line.skuDescription,
            requiredQty: line.expectedQty || 0, // Map expectedQty to requiredQty for frontend display
            allocatedQty: line.allocatedQty || 0,
          },
          hasPickup: completedPickups.length > 0,
          pickupRecords: pickups.docs.map((pickup: any) => ({
            id: pickup.id,
            pickedUpQty: pickup.pickedUpQty,
            bufferQty: pickup.bufferQty,
            finalPickedUpQty: pickup.finalPickedUpQty,
            pickupStatus: pickup.pickupStatus,
            pickedUpBy: pickup.pickedUpBy,
            createdAt: pickup.createdAt,
            notes: pickup.notes,
          })),
          latestPickup: completedPickups.length > 0 ? completedPickups[0] : null,
        }
      }),
    )

    // Calculate summary
    const totalProductLines = productLines.docs.length
    const productLinesWithPickup = pickupStatuses.filter((status) => status.hasPickup).length
    const allPicked = totalProductLines > 0 && productLinesWithPickup === totalProductLines

    const totalPickedUpQty = pickupStatuses.reduce((sum, status) => {
      if (status.latestPickup) {
        return sum + (status.latestPickup.finalPickedUpQty || 0)
      }
      return sum
    }, 0)

    return NextResponse.json({
      success: true,
      jobId,
      jobStatus: job.status,
      pickupStatuses,
      summary: {
        totalProductLines,
        productLinesWithPickup,
        allPicked,
        totalPickedUpQty,
      },
    })
  } catch (error) {
    console.error('Error fetching pickup status:', error)
    return NextResponse.json({ message: 'Failed to fetch pickup status' }, { status: 500 })
  }
}

