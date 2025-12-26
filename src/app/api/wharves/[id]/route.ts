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
    const wharfId = Number(resolvedParams.id)

    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    const wharf = await payload.findByID({
      collection: 'wharves',
      id: wharfId,
      depth,
    })

    if (!wharf) {
      return NextResponse.json({ message: 'Wharf not found' }, { status: 404 })
    }

    const wharfTenantId =
      typeof (wharf as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (wharf as { tenantId: { id: number } }).tenantId.id
        : (wharf as { tenantId?: number }).tenantId

    if (wharfTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Wharf does not belong to this tenant' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      success: true,
      wharf,
    })
  } catch (error) {
    console.error('Error fetching wharf:', error)
    return NextResponse.json({ message: 'Failed to fetch wharf' }, { status: 500 })
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
    const wharfId = Number(resolvedParams.id)
    const body = await request.json()

    const wharfToUpdate = await payload.findByID({
      collection: 'wharves',
      id: wharfId,
    })

    if (!wharfToUpdate) {
      return NextResponse.json({ message: 'Wharf not found' }, { status: 404 })
    }

    const wharfTenantId =
      typeof (wharfToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (wharfToUpdate as { tenantId: { id: number } }).tenantId.id
        : (wharfToUpdate as { tenantId?: number }).tenantId

    if (wharfTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Wharf does not belong to this tenant' },
        { status: 403 },
      )
    }

    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contactName !== undefined) updateData.contactName = body.contactName || undefined
    if (body.contactPhoneNumber !== undefined) updateData.contactPhoneNumber = body.contactPhoneNumber || undefined
    if (body.address !== undefined) updateData.address = body.address || undefined

    const updatedWharf = await payload.update({
      collection: 'wharves',
      id: wharfId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      wharf: updatedWharf,
    })
  } catch (error) {
    console.error('Error updating wharf:', error)
    return NextResponse.json({ message: 'Failed to update wharf' }, { status: 500 })
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
    const wharfId = Number(resolvedParams.id)

    const wharfToDelete = await payload.findByID({
      collection: 'wharves',
      id: wharfId,
    })

    if (!wharfToDelete) {
      return NextResponse.json({ message: 'Wharf not found' }, { status: 404 })
    }

    const wharfTenantId =
      typeof (wharfToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (wharfToDelete as { tenantId: { id: number } }).tenantId.id
        : (wharfToDelete as { tenantId?: number }).tenantId

    if (wharfTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Wharf does not belong to this tenant' },
        { status: 403 },
      )
    }

    await payload.delete({
      collection: 'wharves',
      id: wharfId,
    })

    return NextResponse.json({
      success: true,
      message: 'Wharf deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting wharf:', error)
    return NextResponse.json({ message: 'Failed to delete wharf' }, { status: 500 })
  }
}


