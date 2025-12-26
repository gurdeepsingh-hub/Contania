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
    const containerWeightId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const containerWeight = await payload.findByID({
      collection: 'container-weights',
      id: containerWeightId,
      depth,
    })

    if (!containerWeight) {
      return NextResponse.json({ message: 'Container weight not found' }, { status: 404 })
    }

    const containerWeightTenantId =
      typeof (containerWeight as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerWeight as { tenantId: { id: number } }).tenantId.id
        : (containerWeight as { tenantId?: number }).tenantId

    if (containerWeightTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container weight does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      containerWeight,
    })
  } catch (error) {
    console.error('Error fetching container weight:', error)
    return NextResponse.json({ message: 'Failed to fetch container weight' }, { status: 500 })
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
    const containerWeightId = Number(resolvedParams.id)
    const body = await request.json()

    const containerWeightToUpdate = await payload.findByID({
      collection: 'container-weights',
      id: containerWeightId,
    })

    if (!containerWeightToUpdate) {
      return NextResponse.json({ message: 'Container weight not found' }, { status: 404 })
    }

    const containerWeightTenantId =
      typeof (containerWeightToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerWeightToUpdate as { tenantId: { id: number } }).tenantId.id
        : (containerWeightToUpdate as { tenantId?: number }).tenantId

    if (containerWeightTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container weight does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.size !== undefined) updateData.size = body.size
    if (body.attribute !== undefined) updateData.attribute = body.attribute
    if (body.weight !== undefined) updateData.weight = body.weight

    const updatedContainerWeight = await payload.update({
      collection: 'container-weights',
      id: containerWeightId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      containerWeight: updatedContainerWeight,
    })
  } catch (error) {
    console.error('Error updating container weight:', error)
    return NextResponse.json({ message: 'Failed to update container weight' }, { status: 500 })
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
    const containerWeightId = Number(resolvedParams.id)

    const containerWeightToDelete = await payload.findByID({
      collection: 'container-weights',
      id: containerWeightId,
    })

    if (!containerWeightToDelete) {
      return NextResponse.json({ message: 'Container weight not found' }, { status: 404 })
    }

    const containerWeightTenantId =
      typeof (containerWeightToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (containerWeightToDelete as { tenantId: { id: number } }).tenantId.id
        : (containerWeightToDelete as { tenantId?: number }).tenantId

    if (containerWeightTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Container weight does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'container-weights',
      id: containerWeightId,
    })

    return NextResponse.json({
      success: true,
      message: 'Container weight deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting container weight:', error)
    return NextResponse.json({ message: 'Failed to delete container weight' }, { status: 500 })
  }
}


