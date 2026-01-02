import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const { id } = await params
    const dispatchId = parseInt(id, 10)

    if (isNaN(dispatchId)) {
      return NextResponse.json({ message: 'Invalid dispatch ID' }, { status: 400 })
    }

    // Verify tenant ownership
    const dispatch = await payload.findByID({
      collection: 'dispatches',
      id: dispatchId,
      depth: 1,
    })

    const dispatchTenantId =
      typeof dispatch.tenantId === 'object' ? dispatch.tenantId.id : dispatch.tenantId
    if (dispatchTenantId !== tenant.id) {
      return NextResponse.json({ message: 'Dispatch not found' }, { status: 404 })
    }

    // Only allow allocation if status is 'planned'
    if (dispatch.status !== 'planned') {
      return NextResponse.json(
        { message: 'Can only allocate dispatch entries with status "planned"' },
        { status: 400 },
      )
    }

    // Update dispatch status to 'allocated'
    const updatedDispatch = await payload.update({
      collection: 'dispatches',
      id: dispatchId,
      data: {
        status: 'allocated',
        allocatedAt: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      dispatch: updatedDispatch,
      message: 'Dispatch allocated successfully',
    })
  } catch (error: any) {
    console.error('Error allocating dispatch:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to allocate dispatch' },
      { status: 500 },
    )
  }
}
