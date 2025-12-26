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
    const delayPointId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const delayPoint = await payload.findByID({
      collection: 'delay-points',
      id: delayPointId,
      depth,
    })

    if (!delayPoint) {
      return NextResponse.json({ message: 'Delay point not found' }, { status: 404 })
    }

    const delayPointTenantId =
      typeof (delayPoint as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (delayPoint as { tenantId: { id: number } }).tenantId.id
        : (delayPoint as { tenantId?: number }).tenantId

    if (delayPointTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Delay point does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      delayPoint,
    })
  } catch (error) {
    console.error('Error fetching delay point:', error)
    return NextResponse.json({ message: 'Failed to fetch delay point' }, { status: 500 })
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
    const delayPointId = Number(resolvedParams.id)
    const body = await request.json()

    const delayPointToUpdate = await payload.findByID({
      collection: 'delay-points',
      id: delayPointId,
    })

    if (!delayPointToUpdate) {
      return NextResponse.json({ message: 'Delay point not found' }, { status: 404 })
    }

    const delayPointTenantId =
      typeof (delayPointToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (delayPointToUpdate as { tenantId: { id: number } }).tenantId.id
        : (delayPointToUpdate as { tenantId?: number }).tenantId

    if (delayPointTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Delay point does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contactName !== undefined) updateData.contactName = body.contactName || undefined
    if (body.contactPhoneNumber !== undefined) updateData.contactPhoneNumber = body.contactPhoneNumber || undefined
    if (body.address !== undefined) updateData.address = body.address || undefined

    const updatedDelayPoint = await payload.update({
      collection: 'delay-points',
      id: delayPointId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      delayPoint: updatedDelayPoint,
    })
  } catch (error) {
    console.error('Error updating delay point:', error)
    return NextResponse.json({ message: 'Failed to update delay point' }, { status: 500 })
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
    const delayPointId = Number(resolvedParams.id)

    const delayPointToDelete = await payload.findByID({
      collection: 'delay-points',
      id: delayPointId,
    })

    if (!delayPointToDelete) {
      return NextResponse.json({ message: 'Delay point not found' }, { status: 404 })
    }

    const delayPointTenantId =
      typeof (delayPointToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (delayPointToDelete as { tenantId: { id: number } }).tenantId.id
        : (delayPointToDelete as { tenantId?: number }).tenantId

    if (delayPointTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Delay point does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'delay-points',
      id: delayPointId,
    })

    return NextResponse.json({
      success: true,
      message: 'Delay point deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting delay point:', error)
    return NextResponse.json({ message: 'Failed to delete delay point' }, { status: 500 })
  }
}


