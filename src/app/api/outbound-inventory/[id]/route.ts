import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    return NextResponse.json({ message: 'Failed to fetch outbound inventory job' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const jobTenantId =
      typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Build update data object, excluding jobCode (read-only, auto-generated)
    const updateData: Record<string, unknown> = {}
    
    // Only include fields that are present in the body (excluding jobCode)
    if (body.status !== undefined) updateData.status = body.status
    if (body.customerRefNumber !== undefined) updateData.customerRefNumber = body.customerRefNumber
    if (body.consigneeRefNumber !== undefined) updateData.consigneeRefNumber = body.consigneeRefNumber
    if (body.containerNumber !== undefined) updateData.containerNumber = body.containerNumber
    if (body.inspectionNumber !== undefined) updateData.inspectionNumber = body.inspectionNumber
    if (body.inboundJobNumber !== undefined) updateData.inboundJobNumber = body.inboundJobNumber
    if (body.warehouseId !== undefined) updateData.warehouseId = body.warehouseId
    if (body.customerId !== undefined) {
      if (typeof body.customerId === 'string' && body.customerId.trim() !== '') {
        updateData.customerId = body.customerId
      } else {
        updateData.customerId = null
      }
    }
    if (body.customerToId !== undefined) {
      if (typeof body.customerToId === 'string' && body.customerToId.trim() !== '') {
        updateData.customerToId = body.customerToId
      } else {
        updateData.customerToId = null
      }
    }
    if (body.customerFromId !== undefined) {
      if (typeof body.customerFromId === 'string' && body.customerFromId.trim() !== '') {
        updateData.customerFromId = body.customerFromId
      } else {
        updateData.customerFromId = null
      }
    }
    if (body.requiredDateTime !== undefined) updateData.requiredDateTime = body.requiredDateTime
    if (body.orderNotes !== undefined) updateData.orderNotes = body.orderNotes
    if (body.palletCount !== undefined) updateData.palletCount = body.palletCount
    
    // Include auto-populated customer fields if present
    if (body.customerName !== undefined) updateData.customerName = body.customerName
    if (body.customerLocation !== undefined) updateData.customerLocation = body.customerLocation
    if (body.customerState !== undefined) updateData.customerState = body.customerState
    if (body.customerContact !== undefined) updateData.customerContact = body.customerContact
    if (body.customerToName !== undefined) updateData.customerToName = body.customerToName
    if (body.customerToLocation !== undefined) updateData.customerToLocation = body.customerToLocation
    if (body.customerToState !== undefined) updateData.customerToState = body.customerToState
    if (body.customerToContact !== undefined) updateData.customerToContact = body.customerToContact
    if (body.customerFromName !== undefined) updateData.customerFromName = body.customerFromName
    if (body.customerFromLocation !== undefined) updateData.customerFromLocation = body.customerFromLocation
    if (body.customerFromState !== undefined) updateData.customerFromState = body.customerFromState
    if (body.customerFromContact !== undefined) updateData.customerFromContact = body.customerFromContact

    // Update the job (supports partial updates)
    const updatedJob = await payload.update({
      collection: 'outbound-inventory',
      id: jobId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      job: updatedJob,
    })
  } catch (error) {
    console.error('Error updating outbound inventory job:', error)
    return NextResponse.json(
      { message: 'Failed to update outbound inventory job' },
      { status: 500 },
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

    const jobTenantId =
      typeof existingJob.tenantId === 'object' ? existingJob.tenantId.id : existingJob.tenantId
    if (jobTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Job not found' }, { status: 404 })
    }

    // Delete put-away-stock records that reference this outbound job (clear allocations)
    // Use database adapter directly to bypass Payload's cascade behavior
    try {
      const dbAdapter = payload.db as any

      // Try to access the postgres pool directly
      let pool: any = null

      if (dbAdapter?.pool) {
        pool = dbAdapter.pool
      } else if (dbAdapter?.sessions?.default?.schema?.db?.pool) {
        pool = dbAdapter.sessions.default.schema.db.pool
      } else if ((dbAdapter as any)?.sessions?.default?.db?.pool) {
        pool = (dbAdapter as any).sessions.default.db.pool
      }

      if (pool && typeof pool.query === 'function') {
        // Clear outbound references from put-away-stock (set to NULL since they're optional)
        await pool.query(
          'UPDATE put_away_stock SET outbound_inventory_id_id = NULL, outbound_product_line_id_id = NULL WHERE outbound_inventory_id_id = $1',
          [jobId],
        )
      } else {
        // Fallback: use Payload API to clear references
        let hasMore = true
        let page = 1
        const limit = 100

        while (hasMore) {
          const putAwayStockRecords = await payload.find({
            collection: 'put-away-stock',
            where: {
              outboundInventoryId: {
                equals: jobId,
              },
            },
            limit,
            page,
          })

          for (const stock of putAwayStockRecords.docs) {
            await payload.update({
              collection: 'put-away-stock',
              id: stock.id,
              data: {
                outboundInventoryId: null,
                outboundProductLineId: null,
                allocationStatus: 'available',
              },
            })
          }

          hasMore = putAwayStockRecords.hasNextPage
          page++
        }
      }
    } catch (dbError) {
      // If direct DB access fails, fall back to Payload API
      console.warn('Direct DB update failed, using Payload API:', dbError)
      let hasMore = true
      let page = 1
      const limit = 100

      while (hasMore) {
        const putAwayStockRecords = await payload.find({
          collection: 'put-away-stock',
          where: {
            outboundInventoryId: {
              equals: jobId,
            },
          },
          limit,
          page,
        })

        for (const stock of putAwayStockRecords.docs) {
          await payload.update({
            collection: 'put-away-stock',
            id: stock.id,
            data: {
              outboundInventoryId: null,
              outboundProductLineId: null,
              allocationStatus: 'available',
            },
          })
        }

        hasMore = putAwayStockRecords.hasNextPage
        page++
      }
    }

    // Delete outbound-product-line records first (they have required foreign key to outbound-inventory)
    // Use database adapter directly to bypass Payload's cascade behavior that tries to nullify foreign keys
    try {
      const dbAdapter = payload.db as any

      // Try to access the postgres pool directly
      let pool: any = null

      if (dbAdapter?.pool) {
        pool = dbAdapter.pool
      } else if (dbAdapter?.sessions?.default?.schema?.db?.pool) {
        pool = dbAdapter.sessions.default.schema.db.pool
      } else if ((dbAdapter as any)?.sessions?.default?.db?.pool) {
        pool = (dbAdapter as any).sessions.default.db.pool
      }

      if (pool && typeof pool.query === 'function') {
        // Execute raw SQL to delete outbound-product-line records directly
        await pool.query('DELETE FROM outbound_product_line WHERE outbound_inventory_id_id = $1', [
          jobId,
        ])
      } else {
        // Fallback: use Payload API with pagination to ensure we get all records
        let hasMore = true
        let page = 1
        const limit = 100

        while (hasMore) {
          const productLines = await payload.find({
            collection: 'outbound-product-line',
            where: {
              outboundInventoryId: {
                equals: jobId,
              },
            },
            limit,
            page,
          })

          for (const line of productLines.docs) {
            await payload.delete({
              collection: 'outbound-product-line',
              id: line.id,
            })
          }

          hasMore = productLines.hasNextPage
          page++
        }
      }
    } catch (dbError) {
      // If direct DB access fails, fall back to Payload API with pagination
      console.warn('Direct DB deletion failed, using Payload API:', dbError)
      let hasMore = true
      let page = 1
      const limit = 100

      while (hasMore) {
        const productLines = await payload.find({
          collection: 'outbound-product-line',
          where: {
            outboundInventoryId: {
              equals: jobId,
            },
          },
          limit,
          page,
        })

        for (const line of productLines.docs) {
          await payload.delete({
            collection: 'outbound-product-line',
            id: line.id,
          })
        }

        hasMore = productLines.hasNextPage
        page++
      }
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
      { status: 500 },
    )
  }
}
