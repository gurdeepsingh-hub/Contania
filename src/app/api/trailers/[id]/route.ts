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
    const trailerId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the trailer
    const trailer = await payload.findByID({
      collection: 'trailers',
      id: trailerId,
      depth,
    })

    if (!trailer) {
      return NextResponse.json({ message: 'Trailer not found' }, { status: 404 })
    }

    // Verify trailer belongs to this tenant
    const trailerTenantId = typeof (trailer as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailer as { tenantId: { id: number } }).tenantId.id
      : (trailer as { tenantId?: number }).tenantId

    if (trailerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      trailer,
    })
  } catch (error) {
    console.error('Error fetching trailer:', error)
    return NextResponse.json(
      { message: 'Failed to fetch trailer' },
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
    const trailerId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the trailer to update
    const trailerToUpdate = await payload.findByID({
      collection: 'trailers',
      id: trailerId,
    })

    if (!trailerToUpdate) {
      return NextResponse.json({ message: 'Trailer not found' }, { status: 404 })
    }

    // Verify trailer belongs to this tenant
    const trailerTenantId = typeof (trailerToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailerToUpdate as { tenantId: { id: number } }).tenantId.id
      : (trailerToUpdate as { tenantId?: number }).tenantId

    if (trailerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.fleetNumber !== undefined) updateData.fleetNumber = body.fleetNumber
    if (body.rego !== undefined) updateData.rego = body.rego
    if (body.regoExpiryDate !== undefined) updateData.regoExpiryDate = body.regoExpiryDate || undefined
    if (body.trailerTypeId !== undefined) updateData.trailerTypeId = body.trailerTypeId || undefined
    if (body.maxWeightKg !== undefined) updateData.maxWeightKg = body.maxWeightKg || undefined
    if (body.maxCubeM3 !== undefined) updateData.maxCubeM3 = body.maxCubeM3 || undefined
    if (body.maxPallet !== undefined) updateData.maxPallet = body.maxPallet || undefined
    if (body.defaultWarehouseId !== undefined) updateData.defaultWarehouseId = body.defaultWarehouseId || undefined
    if (body.dangerousCertNumber !== undefined) updateData.dangerousCertNumber = body.dangerousCertNumber || undefined
    if (body.dangerousCertExpiry !== undefined) updateData.dangerousCertExpiry = body.dangerousCertExpiry || undefined
    if (body.description !== undefined) updateData.description = body.description || undefined

    // Update trailer
    const updatedTrailer = await payload.update({
      collection: 'trailers',
      id: trailerId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      trailer: updatedTrailer,
    })
  } catch (error) {
    console.error('Error updating trailer:', error)
    return NextResponse.json(
      { message: 'Failed to update trailer' },
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
    const trailerId = Number(resolvedParams.id)

    // Get the trailer to delete
    const trailerToDelete = await payload.findByID({
      collection: 'trailers',
      id: trailerId,
    })

    if (!trailerToDelete) {
      return NextResponse.json({ message: 'Trailer not found' }, { status: 404 })
    }

    // Verify trailer belongs to this tenant
    const trailerTenantId = typeof (trailerToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (trailerToDelete as { tenantId: { id: number } }).tenantId.id
      : (trailerToDelete as { tenantId?: number }).tenantId

    if (trailerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Trailer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete trailer
    await payload.delete({
      collection: 'trailers',
      id: trailerId,
    })

    return NextResponse.json({
      success: true,
      message: 'Trailer deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting trailer:', error)
    return NextResponse.json(
      { message: 'Failed to delete trailer' },
      { status: 500 }
    )
  }
}

