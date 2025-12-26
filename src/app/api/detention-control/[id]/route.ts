import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const detentionControlId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const detentionControl = await payload.findByID({
      collection: 'detention-control',
      id: detentionControlId,
      depth,
    })

    if (!detentionControl) {
      return NextResponse.json({ message: 'Detention control not found' }, { status: 404 })
    }

    const detentionControlTenantId =
      typeof (detentionControl as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (detentionControl as { tenantId: { id: number } }).tenantId.id
        : (detentionControl as { tenantId?: number }).tenantId

    if (detentionControlTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Detention control does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      detentionControl,
    })
  } catch (error) {
    console.error('Error fetching detention control:', error)
    return NextResponse.json({ message: 'Failed to fetch detention control' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const detentionControlId = Number(resolvedParams.id)
    const body = await request.json()

    const detentionControlToUpdate = await payload.findByID({
      collection: 'detention-control',
      id: detentionControlId,
    })

    if (!detentionControlToUpdate) {
      return NextResponse.json({ message: 'Detention control not found' }, { status: 404 })
    }

    const detentionControlTenantId =
      typeof (detentionControlToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (detentionControlToUpdate as { tenantId: { id: number } }).tenantId.id
        : (detentionControlToUpdate as { tenantId?: number }).tenantId

    if (detentionControlTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Detention control does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.shippingLineId !== undefined) updateData.shippingLineId = body.shippingLineId
    if (body.containerType !== undefined) updateData.containerType = body.containerType
    if (body.importFreeDays !== undefined) updateData.importFreeDays = body.importFreeDays || undefined

    const updatedDetentionControl = await payload.update({
      collection: 'detention-control',
      id: detentionControlId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      detentionControl: updatedDetentionControl,
    })
  } catch (error) {
    console.error('Error updating detention control:', error)
    return NextResponse.json({ message: 'Failed to update detention control' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const detentionControlId = Number(resolvedParams.id)

    const detentionControlToDelete = await payload.findByID({
      collection: 'detention-control',
      id: detentionControlId,
    })

    if (!detentionControlToDelete) {
      return NextResponse.json({ message: 'Detention control not found' }, { status: 404 })
    }

    const detentionControlTenantId =
      typeof (detentionControlToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (detentionControlToDelete as { tenantId: { id: number } }).tenantId.id
        : (detentionControlToDelete as { tenantId?: number }).tenantId

    if (detentionControlTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Detention control does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'detention-control',
      id: detentionControlId,
    })

    return NextResponse.json({
      success: true,
      message: 'Detention control deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting detention control:', error)
    return NextResponse.json({ message: 'Failed to delete detention control' }, { status: 500 })
  }
}


