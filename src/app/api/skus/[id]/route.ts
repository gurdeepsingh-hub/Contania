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
    const skuId = Number(resolvedParams.id)

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 1

    // Get the SKU
    const sku = await payload.findByID({
      collection: 'skus',
      id: skuId,
      depth,
    })

    if (!sku) {
      return NextResponse.json({ message: 'SKU not found' }, { status: 404 })
    }

    // Verify SKU belongs to this tenant
    const skuTenantId = typeof (sku as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (sku as { tenantId: { id: number } }).tenantId.id
      : (sku as { tenantId?: number }).tenantId

    if (skuTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'SKU does not belong to this tenant' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      sku,
    })
  } catch (error) {
    console.error('Error fetching SKU:', error)
    return NextResponse.json(
      { message: 'Failed to fetch SKU' },
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
    const skuId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the SKU to update
    const skuToUpdate = await payload.findByID({
      collection: 'skus',
      id: skuId,
    })

    if (!skuToUpdate) {
      return NextResponse.json({ message: 'SKU not found' }, { status: 404 })
    }

    // Verify SKU belongs to this tenant
    const skuTenantId = typeof (skuToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (skuToUpdate as { tenantId: { id: number } }).tenantId.id
      : (skuToUpdate as { tenantId?: number }).tenantId

    if (skuTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'SKU does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Verify relationships belong to tenant if they're being updated
    if (body.customerId !== undefined && body.customerId !== null) {
      const customer = await payload.findByID({
        collection: 'customers',
        id: Number(body.customerId),
      })
      const customerTenantId = typeof (customer as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (customer as { tenantId: { id: number } }).tenantId.id
        : (customer as { tenantId?: number }).tenantId
      if (customerTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Customer does not belong to this tenant' },
          { status: 400 }
        )
      }
    }

    if (body.storageUnitId !== undefined && body.storageUnitId !== null) {
      const storageUnit = await payload.findByID({
        collection: 'storage-units',
        id: Number(body.storageUnitId),
      })
      const storageUnitTenantId = typeof (storageUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (storageUnit as { tenantId: { id: number } }).tenantId.id
        : (storageUnit as { tenantId?: number }).tenantId
      if (storageUnitTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Storage unit does not belong to this tenant' },
          { status: 400 }
        )
      }
    }

    if (body.handlingUnitId !== undefined && body.handlingUnitId !== null) {
      const handlingUnit = await payload.findByID({
        collection: 'handling-units',
        id: Number(body.handlingUnitId),
      })
      const handlingUnitTenantId = typeof (handlingUnit as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (handlingUnit as { tenantId: { id: number } }).tenantId.id
        : (handlingUnit as { tenantId?: number }).tenantId
      if (handlingUnitTenantId !== tenant.id) {
        return NextResponse.json(
          { message: 'Handling unit does not belong to this tenant' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {}
    if (body.skuCode !== undefined) updateData.skuCode = body.skuCode
    if (body.description !== undefined) updateData.description = body.description || undefined
    if (body.customerId !== undefined) updateData.customerId = body.customerId ? Number(body.customerId) : undefined
    if (body.storageUnitId !== undefined) updateData.storageUnitId = body.storageUnitId ? Number(body.storageUnitId) : undefined
    if (body.handlingUnitId !== undefined) updateData.handlingUnitId = body.handlingUnitId ? Number(body.handlingUnitId) : undefined
    if (body.huPerSu !== undefined) updateData.huPerSu = body.huPerSu !== null ? Number(body.huPerSu) : undefined
    if (body.receiveHU !== undefined) updateData.receiveHU = body.receiveHU || undefined
    if (body.pickHU !== undefined) updateData.pickHU = body.pickHU || undefined
    if (body.pickStrategy !== undefined) updateData.pickStrategy = body.pickStrategy || undefined
    if (body.lengthPerHU_mm !== undefined) updateData.lengthPerHU_mm = body.lengthPerHU_mm !== null ? Number(body.lengthPerHU_mm) : undefined
    if (body.widthPerHU_mm !== undefined) updateData.widthPerHU_mm = body.widthPerHU_mm !== null ? Number(body.widthPerHU_mm) : undefined
    if (body.heightPerHU_mm !== undefined) updateData.heightPerHU_mm = body.heightPerHU_mm !== null ? Number(body.heightPerHU_mm) : undefined
    if (body.weightPerHU_kg !== undefined) updateData.weightPerHU_kg = body.weightPerHU_kg !== null ? Number(body.weightPerHU_kg) : undefined
    if (body.casesPerLayer !== undefined) updateData.casesPerLayer = body.casesPerLayer !== null ? Number(body.casesPerLayer) : undefined
    if (body.layersPerPallet !== undefined) updateData.layersPerPallet = body.layersPerPallet !== null ? Number(body.layersPerPallet) : undefined
    if (body.casesPerPallet !== undefined) updateData.casesPerPallet = body.casesPerPallet !== null ? Number(body.casesPerPallet) : undefined
    if (body.eachsPerCase !== undefined) updateData.eachsPerCase = body.eachsPerCase !== null ? Number(body.eachsPerCase) : undefined
    if (body.isExpriy !== undefined) updateData.isExpriy = body.isExpriy === true
    if (body.isAttribute1 !== undefined) updateData.isAttribute1 = body.isAttribute1 === true
    if (body.isAttribute2 !== undefined) updateData.isAttribute2 = body.isAttribute2 === true
    if (body.expiryDate !== undefined) updateData.expiryDate = body.expiryDate ? new Date(body.expiryDate) : undefined
    if (body.attribute1 !== undefined) updateData.attribute1 = body.attribute1 || undefined
    if (body.attribute2 !== undefined) updateData.attribute2 = body.attribute2 || undefined

    // If storage unit is being updated, fetch new palletSpaces
    if (body.storageUnitId !== undefined && body.storageUnitId !== null) {
      const storageUnit = await payload.findByID({
        collection: 'storage-units',
        id: Number(body.storageUnitId),
      })
      const palletSpaces = (storageUnit as { palletSpaces?: number }).palletSpaces
      if (palletSpaces !== undefined) {
        updateData.palletSpacesOfStorageUnit = palletSpaces
      }
    }

    // Update SKU
    const updatedSKU = await payload.update({
      collection: 'skus',
      id: skuId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      sku: updatedSKU,
    })
  } catch (error) {
    console.error('Error updating SKU:', error)
    return NextResponse.json(
      { message: 'Failed to update SKU' },
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
    const skuId = Number(resolvedParams.id)

    // Get the SKU to delete
    const skuToDelete = await payload.findByID({
      collection: 'skus',
      id: skuId,
    })

    if (!skuToDelete) {
      return NextResponse.json({ message: 'SKU not found' }, { status: 404 })
    }

    // Verify SKU belongs to this tenant
    const skuTenantId = typeof (skuToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
      ? (skuToDelete as { tenantId: { id: number } }).tenantId.id
      : (skuToDelete as { tenantId?: number }).tenantId

    if (skuTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'SKU does not belong to this tenant' },
        { status: 403 }
      )
    }

    // Delete SKU
    await payload.delete({
      collection: 'skus',
      id: skuId,
    })

    return NextResponse.json({
      success: true,
      message: 'SKU deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting SKU:', error)
    return NextResponse.json(
      { message: 'Failed to delete SKU' },
      { status: 500 }
    )
  }
}

