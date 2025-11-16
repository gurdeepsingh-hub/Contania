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
    const customerId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the customer
    const customer = await payload.findByID({
      collection: 'customers',
      id: customerId,
      depth,
    })

    if (!customer) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 })
    }

    // Verify customer belongs to this tenant
    const customerTenantId = typeof (customer as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (customer as { tenantId: { id: number } }).tenantId.id
      : (customer as { tenantId?: number }).tenantId

    if (customerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      customer,
    })
  } catch (error) {
    console.error('Error fetching customer:', error)
    return NextResponse.json(
      { message: 'Failed to fetch customer' },
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
    const customerId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the customer to update
    const customerToUpdate = await payload.findByID({
      collection: 'customers',
      id: customerId,
    })

    if (!customerToUpdate) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 })
    }

    // Verify customer belongs to this tenant
    const customerTenantId = typeof (customerToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (customerToUpdate as { tenantId: { id: number } }).tenantId.id
      : (customerToUpdate as { tenantId?: number }).tenantId

    if (customerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name || undefined
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone || undefined
    if (body.street !== undefined) updateData.street = body.street || undefined
    if (body.city !== undefined) updateData.city = body.city || undefined
    if (body.state !== undefined) updateData.state = body.state || undefined
    if (body.postcode !== undefined) updateData.postcode = body.postcode || undefined

    // Update customer
    const updatedCustomer = await payload.update({
      collection: 'customers',
      id: customerId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      customer: updatedCustomer,
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json(
      { message: 'Failed to update customer' },
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
    const customerId = Number(resolvedParams.id)

    // Get the customer to delete
    const customerToDelete = await payload.findByID({
      collection: 'customers',
      id: customerId,
    })

    if (!customerToDelete) {
      return NextResponse.json({ message: 'Customer not found' }, { status: 404 })
    }

    // Verify customer belongs to this tenant
    const customerTenantId = typeof (customerToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (customerToDelete as { tenantId: { id: number } }).tenantId.id
      : (customerToDelete as { tenantId?: number }).tenantId

    if (customerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete customer
    await payload.delete({
      collection: 'customers',
      id: customerId,
    })

    return NextResponse.json({
      success: true,
      message: 'Customer deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting customer:', error)
    return NextResponse.json(
      { message: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}

