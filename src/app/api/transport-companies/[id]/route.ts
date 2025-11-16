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
    const transportCompanyId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the transport company
    const transportCompany = await payload.findByID({
      collection: 'transport-companies',
      id: transportCompanyId,
      depth,
    })

    if (!transportCompany) {
      return NextResponse.json({ message: 'Transport company not found' }, { status: 404 })
    }

    // Verify transport company belongs to this tenant
    const transportCompanyTenantId = typeof (transportCompany as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (transportCompany as { tenantId: { id: number } }).tenantId.id
      : (transportCompany as { tenantId?: number }).tenantId

    if (transportCompanyTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Transport company does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      transportCompany,
    })
  } catch (error) {
    console.error('Error fetching transport company:', error)
    return NextResponse.json(
      { message: 'Failed to fetch transport company' },
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
    const transportCompanyId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the transport company to update
    const transportCompanyToUpdate = await payload.findByID({
      collection: 'transport-companies',
      id: transportCompanyId,
    })

    if (!transportCompanyToUpdate) {
      return NextResponse.json({ message: 'Transport company not found' }, { status: 404 })
    }

    // Verify transport company belongs to this tenant
    const transportCompanyTenantId = typeof (transportCompanyToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (transportCompanyToUpdate as { tenantId: { id: number } }).tenantId.id
      : (transportCompanyToUpdate as { tenantId?: number }).tenantId

    if (transportCompanyTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Transport company does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.name !== undefined) updateData.name = body.name
    if (body.contact !== undefined) updateData.contact = body.contact || undefined
    if (body.mobile !== undefined) updateData.mobile = body.mobile || undefined

    // Update transport company
    const updatedTransportCompany = await payload.update({
      collection: 'transport-companies',
      id: transportCompanyId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      transportCompany: updatedTransportCompany,
    })
  } catch (error) {
    console.error('Error updating transport company:', error)
    return NextResponse.json(
      { message: 'Failed to update transport company' },
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
    const transportCompanyId = Number(resolvedParams.id)

    // Get the transport company to delete
    const transportCompanyToDelete = await payload.findByID({
      collection: 'transport-companies',
      id: transportCompanyId,
    })

    if (!transportCompanyToDelete) {
      return NextResponse.json({ message: 'Transport company not found' }, { status: 404 })
    }

    // Verify transport company belongs to this tenant
    const transportCompanyTenantId = typeof (transportCompanyToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (transportCompanyToDelete as { tenantId: { id: number } }).tenantId.id
      : (transportCompanyToDelete as { tenantId?: number }).tenantId

    if (transportCompanyTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Transport company does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete transport company
    await payload.delete({
      collection: 'transport-companies',
      id: transportCompanyId,
    })

    return NextResponse.json({
      success: true,
      message: 'Transport company deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting transport company:', error)
    return NextResponse.json(
      { message: 'Failed to delete transport company' },
      { status: 500 }
    )
  }
}

