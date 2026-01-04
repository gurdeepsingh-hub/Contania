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
    const containerSizeId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const containerSize = await payload.findByID({
      collection: 'container-sizes',
      id: containerSizeId,
      depth,
    })

    if (!containerSize) {
      return NextResponse.json({ message: 'Container size not found' }, { status: 404 })
    }

    const containerSizeTenantId =
      typeof (containerSize as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerSize as { tenantId: { id: number } }).tenantId.id
        : (containerSize as { tenantId?: number }).tenantId

    if (containerSizeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container size does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      containerSize,
    })
  } catch (error) {
    console.error('Error fetching container size:', error)
    return NextResponse.json({ message: 'Failed to fetch container size' }, { status: 500 })
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
    const containerSizeId = Number(resolvedParams.id)
    const body = await request.json()

    const containerSizeToUpdate = await payload.findByID({
      collection: 'container-sizes',
      id: containerSizeId,
    })

    if (!containerSizeToUpdate) {
      return NextResponse.json({ message: 'Container size not found' }, { status: 404 })
    }

    const containerSizeTenantId =
      typeof (containerSizeToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerSizeToUpdate as { tenantId: { id: number } }).tenantId.id
        : (containerSizeToUpdate as { tenantId?: number }).tenantId

    if (containerSizeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container size does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.size !== undefined) updateData.size = body.size
    if (body.description !== undefined) updateData.description = body.description || undefined
    if (body.attribute !== undefined) updateData.attribute = body.attribute || undefined
    if (body.weight !== undefined) updateData.weight = body.weight || undefined

    const updatedContainerSize = await payload.update({
      collection: 'container-sizes',
      id: containerSizeId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      containerSize: updatedContainerSize,
    })
  } catch (error) {
    console.error('Error updating container size:', error)
    return NextResponse.json({ message: 'Failed to update container size' }, { status: 500 })
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
    const containerSizeId = Number(resolvedParams.id)

    const containerSizeToDelete = await payload.findByID({
      collection: 'container-sizes',
      id: containerSizeId,
    })

    if (!containerSizeToDelete) {
      return NextResponse.json({ message: 'Container size not found' }, { status: 404 })
    }

    const containerSizeTenantId =
      typeof (containerSizeToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerSizeToDelete as { tenantId: { id: number } }).tenantId.id
        : (containerSizeToDelete as { tenantId?: number }).tenantId

    if (containerSizeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container size does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'container-sizes',
      id: containerSizeId,
    })

    return NextResponse.json({
      success: true,
      message: 'Container size deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting container size:', error)
    return NextResponse.json({ message: 'Failed to delete container size' }, { status: 500 })
  }
}


