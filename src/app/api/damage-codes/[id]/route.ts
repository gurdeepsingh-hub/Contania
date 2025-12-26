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
    const damageCodeId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const damageCode = await payload.findByID({
      collection: 'damage-codes',
      id: damageCodeId,
      depth,
    })

    if (!damageCode) {
      return NextResponse.json({ message: 'Damage code not found' }, { status: 404 })
    }

    const damageCodeTenantId =
      typeof (damageCode as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (damageCode as { tenantId: { id: number } }).tenantId.id
        : (damageCode as { tenantId?: number }).tenantId

    if (damageCodeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Damage code does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      damageCode,
    })
  } catch (error) {
    console.error('Error fetching damage code:', error)
    return NextResponse.json({ message: 'Failed to fetch damage code' }, { status: 500 })
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
    const damageCodeId = Number(resolvedParams.id)
    const body = await request.json()

    const damageCodeToUpdate = await payload.findByID({
      collection: 'damage-codes',
      id: damageCodeId,
    })

    if (!damageCodeToUpdate) {
      return NextResponse.json({ message: 'Damage code not found' }, { status: 404 })
    }

    const damageCodeTenantId =
      typeof (damageCodeToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (damageCodeToUpdate as { tenantId: { id: number } }).tenantId.id
        : (damageCodeToUpdate as { tenantId?: number }).tenantId

    if (damageCodeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Damage code does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.freightType !== undefined) updateData.freightType = body.freightType
    if (body.reason !== undefined) updateData.reason = body.reason

    const updatedDamageCode = await payload.update({
      collection: 'damage-codes',
      id: damageCodeId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      damageCode: updatedDamageCode,
    })
  } catch (error) {
    console.error('Error updating damage code:', error)
    return NextResponse.json({ message: 'Failed to update damage code' }, { status: 500 })
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
    const damageCodeId = Number(resolvedParams.id)

    const damageCodeToDelete = await payload.findByID({
      collection: 'damage-codes',
      id: damageCodeId,
    })

    if (!damageCodeToDelete) {
      return NextResponse.json({ message: 'Damage code not found' }, { status: 404 })
    }

    const damageCodeTenantId =
      typeof (damageCodeToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (damageCodeToDelete as { tenantId: { id: number } }).tenantId.id
        : (damageCodeToDelete as { tenantId?: number }).tenantId

    if (damageCodeTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Damage code does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'damage-codes',
      id: damageCodeId,
    })

    return NextResponse.json({
      success: true,
      message: 'Damage code deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting damage code:', error)
    return NextResponse.json({ message: 'Failed to delete damage code' }, { status: 500 })
  }
}


