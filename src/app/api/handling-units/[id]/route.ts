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
    const handlingUnitId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the handling unit
    const handlingUnit = await payload.findByID({
      collection: 'handling-units',
      id: handlingUnitId,
      depth,
    })

    if (!handlingUnit) {
      return NextResponse.json({ message: 'Handling unit not found' }, { status: 404 })
    }

    // Verify handling unit belongs to this tenant
    const handlingUnitTenantId = typeof (handlingUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (handlingUnit as { tenantId: { id: number } }).tenantId.id
      : (handlingUnit as { tenantId?: number }).tenantId

    if (handlingUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Handling unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      handlingUnit,
    })
  } catch (error) {
    console.error('Error fetching handling unit:', error)
    return NextResponse.json(
      { message: 'Failed to fetch handling unit' },
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
    const handlingUnitId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the handling unit to update
    const handlingUnitToUpdate = await payload.findByID({
      collection: 'handling-units',
      id: handlingUnitId,
    })

    if (!handlingUnitToUpdate) {
      return NextResponse.json({ message: 'Handling unit not found' }, { status: 404 })
    }

    // Verify handling unit belongs to this tenant
    const handlingUnitTenantId = typeof (handlingUnitToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (handlingUnitToUpdate as { tenantId: { id: number } }).tenantId.id
      : (handlingUnitToUpdate as { tenantId?: number }).tenantId

    if (handlingUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Handling unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.abbreviation !== undefined) updateData.abbreviation = body.abbreviation || undefined

    // Update handling unit
    const updatedHandlingUnit = await payload.update({
      collection: 'handling-units',
      id: handlingUnitId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      handlingUnit: updatedHandlingUnit,
    })
  } catch (error) {
    console.error('Error updating handling unit:', error)
    return NextResponse.json(
      { message: 'Failed to update handling unit' },
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
    const handlingUnitId = Number(resolvedParams.id)

    // Get the handling unit to delete
    const handlingUnitToDelete = await payload.findByID({
      collection: 'handling-units',
      id: handlingUnitId,
    })

    if (!handlingUnitToDelete) {
      return NextResponse.json({ message: 'Handling unit not found' }, { status: 404 })
    }

    // Verify handling unit belongs to this tenant
    const handlingUnitTenantId = typeof (handlingUnitToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (handlingUnitToDelete as { tenantId: { id: number } }).tenantId.id
      : (handlingUnitToDelete as { tenantId?: number }).tenantId

    if (handlingUnitTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Handling unit does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete handling unit
    await payload.delete({
      collection: 'handling-units',
      id: handlingUnitId,
    })

    return NextResponse.json({
      success: true,
      message: 'Handling unit deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting handling unit:', error)
    return NextResponse.json(
      { message: 'Failed to delete handling unit' },
      { status: 500 }
    )
  }
}

