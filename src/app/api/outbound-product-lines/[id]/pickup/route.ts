import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant, currentUser } = context
    const { id } = await params
    const productLineId = parseInt(id, 10)
    const body = await request.json()

    if (isNaN(productLineId)) {
      return NextResponse.json({ message: 'Invalid product line ID' }, { status: 400 })
    }

    if (!body.lpnNumbers || !Array.isArray(body.lpnNumbers) || body.lpnNumbers.length === 0) {
      return NextResponse.json(
        { message: 'At least one LPN number is required' },
        { status: 400 },
      )
    }

    // Verify tenant ownership through outbound inventory
    const productLine = await payload.findByID({
      collection: 'outbound-product-line',
      id: productLineId,
      depth: 1,
    })

    const outboundInventoryId =
      typeof productLine.outboundInventoryId === 'object'
        ? productLine.outboundInventoryId.id
        : productLine.outboundInventoryId

    const job = await payload.findByID({
      collection: 'outbound-inventory',
      id: outboundInventoryId,
    })

    const jobTenantId = typeof job.tenantId === 'object' ? job.tenantId.id : job.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Product line not found' }, { status: 404 })
    }

    // Validate each LPN
    const validatedLPNs = []
    const warnings: Array<{ lpnNumber: string; message: string }> = []

    for (const lpnNumber of body.lpnNumbers) {
      // Find LPN by number
      const lpnResult = await payload.find({
        collection: 'put-away-stock',
        where: {
          and: [
            {
              tenantId: {
                equals: tenant.id,
              },
            },
            {
              lpnNumber: {
                equals: lpnNumber,
              },
            },
          ],
        },
        limit: 1,
      })

      if (lpnResult.docs.length === 0) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} not found`,
        })
        continue
      }

      const lpn = lpnResult.docs[0]

      // Check if LPN is allocated to this product line
      const lpnProductLineId =
        typeof lpn.outboundProductLineId === 'object'
          ? lpn.outboundProductLineId?.id
          : lpn.outboundProductLineId

      if (lpnProductLineId !== productLineId) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} is not allocated to this product line`,
        })
        continue
      }

      // Check if LPN status is 'allocated' (not already picked/dispatched)
      if (lpn.allocationStatus !== 'allocated') {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} has status '${lpn.allocationStatus}' and cannot be picked up`,
        })
        continue
      }

      // Check if LPN is allocated to the same job
      const lpnJobId =
        typeof lpn.outboundInventoryId === 'object'
          ? lpn.outboundInventoryId?.id
          : lpn.outboundInventoryId

      if (lpnJobId !== outboundInventoryId) {
        warnings.push({
          lpnNumber,
          message: `LPN ${lpnNumber} is allocated to a different job`,
        })
        continue
      }

      validatedLPNs.push(lpn)
    }

    // If no valid LPNs, return error
    if (validatedLPNs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'No valid LPNs to pick up',
          warnings,
        },
        { status: 400 },
      )
    }

    // Calculate quantities
    const pickedUpQty = validatedLPNs.reduce((sum, lpn) => sum + (lpn.huQty || 0), 0)
    const bufferQty = body.bufferQty || 0
    const finalPickedUpQty = pickedUpQty + bufferQty

    // Create pickup record
    const pickupRecord = await payload.create({
      collection: 'pickup-stock',
      data: {
        tenantId: tenant.id,
        outboundInventoryId: outboundInventoryId,
        outboundProductLineId: productLineId,
        pickedUpLPNs: validatedLPNs.map((lpn) => ({
          lpnId: lpn.id,
          lpnNumber: lpn.lpnNumber,
          huQty: lpn.huQty,
          location: lpn.location,
        })),
        pickedUpQty,
        bufferQty,
        finalPickedUpQty,
        pickupStatus: 'completed',
        pickedUpBy: currentUser.id,
        notes: body.notes || '',
      },
    })

    // Update PutAwayStock records to 'picked' status
    for (const lpn of validatedLPNs) {
      await payload.update({
        collection: 'put-away-stock',
        id: lpn.id,
        data: {
          allocationStatus: 'picked',
        },
      })
    }

    // Check if all product lines have pickup records
    const allProductLines = await payload.find({
      collection: 'outbound-product-line',
      where: {
        outboundInventoryId: {
          equals: outboundInventoryId,
        },
      },
    })

    const pickupChecks = await Promise.all(
      allProductLines.docs.map(async (line: any) => {
        const pickups = await payload.find({
          collection: 'pickup-stock',
          where: {
            and: [
              {
                outboundProductLineId: {
                  equals: line.id,
                },
              },
              {
                pickupStatus: {
                  equals: 'completed',
                },
              },
            ],
          },
        })
        return pickups.docs.length > 0
      }),
    )

    const allPicked = pickupChecks.length > 0 && pickupChecks.every((picked) => picked)
    const somePicked = pickupChecks.some((picked) => picked)

    // Update job status based on pickup completion
    if (allPicked && job.status !== 'picked') {
      // All product lines are picked
      await payload.update({
        collection: 'outbound-inventory',
        id: outboundInventoryId,
        data: {
          status: 'picked',
        },
      })
    } else if (somePicked && job.status !== 'picked' && job.status !== 'partially_picked') {
      // Some but not all product lines are picked
      await payload.update({
        collection: 'outbound-inventory',
        id: outboundInventoryId,
        data: {
          status: 'partially_picked',
        },
      })
    }

    return NextResponse.json({
      success: true,
      pickupRecord,
      warnings: warnings.length > 0 ? warnings : undefined,
      jobStatusUpdated: allPicked,
    })
  } catch (error) {
    console.error('Error creating pickup record:', error)
    return NextResponse.json({ message: 'Failed to create pickup record' }, { status: 500 })
  }
}

