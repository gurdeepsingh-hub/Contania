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
    const shippingLineId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const shippingLine = await payload.findByID({
      collection: 'shipping-lines',
      id: shippingLineId,
      depth,
    })

    if (!shippingLine) {
      return NextResponse.json({ message: 'Shipping line not found' }, { status: 404 })
    }

    const shippingLineTenantId =
      typeof (shippingLine as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (shippingLine as { tenantId: { id: number } }).tenantId.id
        : (shippingLine as { tenantId?: number }).tenantId

    if (shippingLineTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Shipping line does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      shippingLine,
    })
  } catch (error) {
    console.error('Error fetching shipping line:', error)
    return NextResponse.json({ message: 'Failed to fetch shipping line' }, { status: 500 })
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
    const shippingLineId = Number(resolvedParams.id)
    const body = await request.json()

    const shippingLineToUpdate = await payload.findByID({
      collection: 'shipping-lines',
      id: shippingLineId,
    })

    if (!shippingLineToUpdate) {
      return NextResponse.json({ message: 'Shipping line not found' }, { status: 404 })
    }

    const shippingLineTenantId =
      typeof (shippingLineToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (shippingLineToUpdate as { tenantId: { id: number } }).tenantId.id
        : (shippingLineToUpdate as { tenantId?: number }).tenantId

    if (shippingLineTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Shipping line does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contactName !== undefined) updateData.contactName = body.contactName || undefined
    if (body.contactPhoneNumber !== undefined) updateData.contactPhoneNumber = body.contactPhoneNumber || undefined
    if (body.address !== undefined) updateData.address = body.address || undefined
    if (body.importFreeDays !== undefined) updateData.importFreeDays = body.importFreeDays || undefined
    if (body.calculateImportFreeDaysUsing !== undefined) updateData.calculateImportFreeDaysUsing = body.calculateImportFreeDaysUsing || undefined

    const updatedShippingLine = await payload.update({
      collection: 'shipping-lines',
      id: shippingLineId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      shippingLine: updatedShippingLine,
    })
  } catch (error) {
    console.error('Error updating shipping line:', error)
    return NextResponse.json({ message: 'Failed to update shipping line' }, { status: 500 })
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
    const shippingLineId = Number(resolvedParams.id)

    const shippingLineToDelete = await payload.findByID({
      collection: 'shipping-lines',
      id: shippingLineId,
    })

    if (!shippingLineToDelete) {
      return NextResponse.json({ message: 'Shipping line not found' }, { status: 404 })
    }

    const shippingLineTenantId =
      typeof (shippingLineToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (shippingLineToDelete as { tenantId: { id: number } }).tenantId.id
        : (shippingLineToDelete as { tenantId?: number }).tenantId

    if (shippingLineTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Shipping line does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'shipping-lines',
      id: shippingLineId,
    })

    return NextResponse.json({
      success: true,
      message: 'Shipping line deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting shipping line:', error)
    return NextResponse.json({ message: 'Failed to delete shipping line' }, { status: 500 })
  }
}


