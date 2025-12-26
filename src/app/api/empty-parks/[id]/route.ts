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
    const emptyParkId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const emptyPark = await payload.findByID({
      collection: 'empty-parks',
      id: emptyParkId,
      depth,
    })

    if (!emptyPark) {
      return NextResponse.json({ message: 'Empty park not found' }, { status: 404 })
    }

    const emptyParkTenantId =
      typeof (emptyPark as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (emptyPark as { tenantId: { id: number } }).tenantId.id
        : (emptyPark as { tenantId?: number }).tenantId

    if (emptyParkTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Empty park does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      emptyPark,
    })
  } catch (error) {
    console.error('Error fetching empty park:', error)
    return NextResponse.json({ message: 'Failed to fetch empty park' }, { status: 500 })
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
    const emptyParkId = Number(resolvedParams.id)
    const body = await request.json()

    const emptyParkToUpdate = await payload.findByID({
      collection: 'empty-parks',
      id: emptyParkId,
    })

    if (!emptyParkToUpdate) {
      return NextResponse.json({ message: 'Empty park not found' }, { status: 404 })
    }

    const emptyParkTenantId =
      typeof (emptyParkToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (emptyParkToUpdate as { tenantId: { id: number } }).tenantId.id
        : (emptyParkToUpdate as { tenantId?: number }).tenantId

    if (emptyParkTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Empty park does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contactName !== undefined) updateData.contactName = body.contactName || undefined
    if (body.contactPhoneNumber !== undefined) updateData.contactPhoneNumber = body.contactPhoneNumber || undefined
    if (body.address !== undefined) updateData.address = body.address || undefined

    const updatedEmptyPark = await payload.update({
      collection: 'empty-parks',
      id: emptyParkId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      emptyPark: updatedEmptyPark,
    })
  } catch (error) {
    console.error('Error updating empty park:', error)
    return NextResponse.json({ message: 'Failed to update empty park' }, { status: 500 })
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
    const emptyParkId = Number(resolvedParams.id)

    const emptyParkToDelete = await payload.findByID({
      collection: 'empty-parks',
      id: emptyParkId,
    })

    if (!emptyParkToDelete) {
      return NextResponse.json({ message: 'Empty park not found' }, { status: 404 })
    }

    const emptyParkTenantId =
      typeof (emptyParkToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (emptyParkToDelete as { tenantId: { id: number } }).tenantId.id
        : (emptyParkToDelete as { tenantId?: number }).tenantId

    if (emptyParkTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Empty park does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'empty-parks',
      id: emptyParkId,
    })

    return NextResponse.json({
      success: true,
      message: 'Empty park deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting empty park:', error)
    return NextResponse.json({ message: 'Failed to delete empty park' }, { status: 500 })
  }
}


