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
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    const record = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
      depth: 2,
    })

    if (!record) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Verify tenant ownership
    const recordTenantId =
      typeof record.tenantId === 'object' ? record.tenantId.id : record.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      record,
    })
  } catch (error) {
    console.error('Error fetching put-away record:', error)
    return NextResponse.json(
      { message: 'Failed to fetch put-away record' },
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
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)
    const body = await request.json()

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    // Verify record exists and belongs to tenant
    const existingRecord = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
    })

    if (!existingRecord) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    const recordTenantId =
      typeof existingRecord.tenantId === 'object'
        ? existingRecord.tenantId.id
        : existingRecord.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.location !== undefined) updateData.location = body.location
    if (body.huQty !== undefined) updateData.huQty = body.huQty

    const updatedRecord = await payload.update({
      collection: 'put-away-stock',
      id: recordId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      record: updatedRecord,
    })
  } catch (error) {
    console.error('Error updating put-away record:', error)
    return NextResponse.json(
      { message: 'Failed to update put-away record' },
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
    const resolvedParams = await params
    const recordId = Number(resolvedParams.id)

    if (isNaN(recordId)) {
      return NextResponse.json({ message: 'Invalid record ID' }, { status: 400 })
    }

    // Verify record exists and belongs to tenant
    const existingRecord = await payload.findByID({
      collection: 'put-away-stock',
      id: recordId,
    })

    if (!existingRecord) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    const recordTenantId =
      typeof existingRecord.tenantId === 'object'
        ? existingRecord.tenantId.id
        : existingRecord.tenantId
    if (recordTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Record not found' }, { status: 404 })
    }

    await payload.delete({
      collection: 'put-away-stock',
      id: recordId,
    })

    return NextResponse.json({
      success: true,
      message: 'Record deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting put-away record:', error)
    return NextResponse.json(
      { message: 'Failed to delete put-away record' },
      { status: 500 }
    )
  }
}









