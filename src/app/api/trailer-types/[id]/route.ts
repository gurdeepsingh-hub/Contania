import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const trailerTypeId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the trailer type
    const trailerType = await payload.findByID({
      collection: 'trailer-types',
      id: trailerTypeId,
      depth,
    })

    if (!trailerType) {
      return NextResponse.json({ message: 'Trailer type not found' }, { status: 404 })
    }

    // Verify trailer type belongs to this tenant
    const trailerTypeTenantId = typeof (trailerType as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailerType as { tenantId: { id: number } }).tenantId.id
      : (trailerType as { tenantId?: number }).tenantId

    if (trailerTypeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer type does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      trailerType,
    })
  } catch (error) {
    console.error('Error fetching trailer type:', error)
    return NextResponse.json(
      { message: 'Failed to fetch trailer type' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const trailerTypeId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the trailer type to update
    const trailerTypeToUpdate = await payload.findByID({
      collection: 'trailer-types',
      id: trailerTypeId,
    })

    if (!trailerTypeToUpdate) {
      return NextResponse.json({ message: 'Trailer type not found' }, { status: 404 })
    }

    // Verify trailer type belongs to this tenant
    const trailerTypeTenantId = typeof (trailerTypeToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailerTypeToUpdate as { tenantId: { id: number } }).tenantId.id
      : (trailerTypeToUpdate as { tenantId?: number }).tenantId

    if (trailerTypeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer type does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.maxWeightKg !== undefined) updateData.maxWeightKg = body.maxWeightKg || undefined
    if (body.maxCubicM3 !== undefined) updateData.maxCubicM3 = body.maxCubicM3 || undefined
    if (body.maxPallet !== undefined) updateData.maxPallet = body.maxPallet || undefined
    if (body.trailerA !== undefined) updateData.trailerA = body.trailerA
    if (body.trailerB !== undefined) updateData.trailerB = body.trailerB
    if (body.trailerC !== undefined) updateData.trailerC = body.trailerC

    // Update trailer type
    const updatedTrailerType = await payload.update({
      collection: 'trailer-types',
      id: trailerTypeId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      trailerType: updatedTrailerType,
    })
  } catch (error) {
    console.error('Error updating trailer type:', error)
    return NextResponse.json(
      { message: 'Failed to update trailer type' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const context = await getTenantContext(request, 'settings_entity_settings')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const trailerTypeId = Number(resolvedParams.id)

    // Get the trailer type to delete
    const trailerTypeToDelete = await payload.findByID({
      collection: 'trailer-types',
      id: trailerTypeId,
    })

    if (!trailerTypeToDelete) {
      return NextResponse.json({ message: 'Trailer type not found' }, { status: 404 })
    }

    // Verify trailer type belongs to this tenant
    const trailerTypeTenantId = typeof (trailerTypeToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailerTypeToDelete as { tenantId: { id: number } }).tenantId.id
      : (trailerTypeToDelete as { tenantId?: number }).tenantId

    if (trailerTypeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer type does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete trailer type
    await payload.delete({
      collection: 'trailer-types',
      id: trailerTypeId,
    })

    return NextResponse.json({
      success: true,
      message: 'Trailer type deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting trailer type:', error)
    return NextResponse.json(
      { message: 'Failed to delete trailer type' },
      { status: 500 }
    )
  }
}

