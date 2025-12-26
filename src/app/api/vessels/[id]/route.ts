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
    const vesselId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const vessel = await payload.findByID({
      collection: 'vessels',
      id: vesselId,
      depth,
    })

    if (!vessel) {
      return NextResponse.json({ message: 'Vessel not found' }, { status: 404 })
    }

    const vesselTenantId =
      typeof (vessel as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (vessel as { tenantId: { id: number } }).tenantId.id
        : (vessel as { tenantId?: number }).tenantId

    if (vesselTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vessel does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      vessel,
    })
  } catch (error) {
    console.error('Error fetching vessel:', error)
    return NextResponse.json({ message: 'Failed to fetch vessel' }, { status: 500 })
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
    const vesselId = Number(resolvedParams.id)
    const body = await request.json()

    const vesselToUpdate = await payload.findByID({
      collection: 'vessels',
      id: vesselId,
    })

    if (!vesselToUpdate) {
      return NextResponse.json({ message: 'Vessel not found' }, { status: 404 })
    }

    const vesselTenantId =
      typeof (vesselToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (vesselToUpdate as { tenantId: { id: number } }).tenantId.id
        : (vesselToUpdate as { tenantId?: number }).tenantId

    if (vesselTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vessel does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.vesselName !== undefined) updateData.vesselName = body.vesselName
    if (body.voyageNumber !== undefined) updateData.voyageNumber = body.voyageNumber || undefined
    if (body.lloydsNumber !== undefined) updateData.lloydsNumber = body.lloydsNumber || undefined
    if (body.wharfId !== undefined) updateData.wharfId = body.wharfId || undefined
    if (body.jobType !== undefined) updateData.jobType = body.jobType

    // Import fields
    if (body.eta !== undefined) updateData.eta = body.eta || undefined
    if (body.availability !== undefined) updateData.availability = body.availability || undefined
    if (body.storageStart !== undefined) updateData.storageStart = body.storageStart || undefined
    if (body.firstFreeImportDate !== undefined) updateData.firstFreeImportDate = body.firstFreeImportDate || undefined

    // Export fields
    if (body.etd !== undefined) updateData.etd = body.etd || undefined
    if (body.receivalStart !== undefined) updateData.receivalStart = body.receivalStart || undefined
    if (body.cutoff !== undefined) updateData.cutoff = body.cutoff || undefined
    if (body.reeferCutoff !== undefined) updateData.reeferCutoff = body.reeferCutoff || undefined

    const updatedVessel = await payload.update({
      collection: 'vessels',
      id: vesselId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      vessel: updatedVessel,
    })
  } catch (error) {
    console.error('Error updating vessel:', error)
    return NextResponse.json({ message: 'Failed to update vessel' }, { status: 500 })
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
    const vesselId = Number(resolvedParams.id)

    const vesselToDelete = await payload.findByID({
      collection: 'vessels',
      id: vesselId,
    })

    if (!vesselToDelete) {
      return NextResponse.json({ message: 'Vessel not found' }, { status: 404 })
    }

    const vesselTenantId =
      typeof (vesselToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (vesselToDelete as { tenantId: { id: number } }).tenantId.id
        : (vesselToDelete as { tenantId?: number }).tenantId

    if (vesselTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Vessel does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'vessels',
      id: vesselId,
    })

    return NextResponse.json({
      success: true,
      message: 'Vessel deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting vessel:', error)
    return NextResponse.json({ message: 'Failed to delete vessel' }, { status: 500 })
  }
}


