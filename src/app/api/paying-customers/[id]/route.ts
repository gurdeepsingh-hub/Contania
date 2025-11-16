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
    const payingCustomerId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 0

    // Get the paying customer
    const payingCustomer = await payload.findByID({
      collection: 'paying-customers',
      id: payingCustomerId,
      depth,
    })

    if (!payingCustomer) {
      return NextResponse.json({ message: 'Paying customer not found' }, { status: 404 })
    }

    // Verify paying customer belongs to this tenant
    const payingCustomerTenantId = typeof (payingCustomer as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (payingCustomer as { tenantId: { id: number } }).tenantId.id
      : (payingCustomer as { tenantId?: number }).tenantId

    if (payingCustomerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Paying customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      payingCustomer,
    })
  } catch (error) {
    console.error('Error fetching paying customer:', error)
    return NextResponse.json(
      { message: 'Failed to fetch paying customer' },
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
    const payingCustomerId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the paying customer to update
    const payingCustomerToUpdate = await payload.findByID({
      collection: 'paying-customers',
      id: payingCustomerId,
    })

    if (!payingCustomerToUpdate) {
      return NextResponse.json({ message: 'Paying customer not found' }, { status: 404 })
    }

    // Verify paying customer belongs to this tenant
    const payingCustomerTenantId = typeof (payingCustomerToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (payingCustomerToUpdate as { tenantId: { id: number } }).tenantId.id
      : (payingCustomerToUpdate as { tenantId?: number }).tenantId

    if (payingCustomerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Paying customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name
    if (body.abn !== undefined) updateData.abn = body.abn || undefined
    if (body.email !== undefined) updateData.email = body.email || undefined
    if (body.contact_name !== undefined) updateData.contact_name = body.contact_name || undefined
    if (body.contact_phone !== undefined) updateData.contact_phone = body.contact_phone || undefined
    if (body.billing_street !== undefined) updateData.billing_street = body.billing_street || undefined
    if (body.billing_city !== undefined) updateData.billing_city = body.billing_city || undefined
    if (body.billing_state !== undefined) updateData.billing_state = body.billing_state || undefined
    if (body.billing_postcode !== undefined) updateData.billing_postcode = body.billing_postcode || undefined
    if (body.delivery_same_as_billing !== undefined) updateData.delivery_same_as_billing = body.delivery_same_as_billing
    if (body.delivery_street !== undefined) updateData.delivery_street = body.delivery_street || undefined
    if (body.delivery_city !== undefined) updateData.delivery_city = body.delivery_city || undefined
    if (body.delivery_state !== undefined) updateData.delivery_state = body.delivery_state || undefined
    if (body.delivery_postcode !== undefined) updateData.delivery_postcode = body.delivery_postcode || undefined

    // Update paying customer
    const updatedPayingCustomer = await payload.update({
      collection: 'paying-customers',
      id: payingCustomerId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      payingCustomer: updatedPayingCustomer,
    })
  } catch (error) {
    console.error('Error updating paying customer:', error)
    return NextResponse.json(
      { message: 'Failed to update paying customer' },
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
    const payingCustomerId = Number(resolvedParams.id)

    // Get the paying customer to delete
    const payingCustomerToDelete = await payload.findByID({
      collection: 'paying-customers',
      id: payingCustomerId,
    })

    if (!payingCustomerToDelete) {
      return NextResponse.json({ message: 'Paying customer not found' }, { status: 404 })
    }

    // Verify paying customer belongs to this tenant
    const payingCustomerTenantId = typeof (payingCustomerToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (payingCustomerToDelete as { tenantId: { id: number } }).tenantId.id
      : (payingCustomerToDelete as { tenantId?: number }).tenantId

    if (payingCustomerTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Paying customer does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete paying customer
    await payload.delete({
      collection: 'paying-customers',
      id: payingCustomerId,
    })

    return NextResponse.json({
      success: true,
      message: 'Paying customer deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting paying customer:', error)
    return NextResponse.json(
      { message: 'Failed to delete paying customer' },
      { status: 500 }
    )
  }
}

