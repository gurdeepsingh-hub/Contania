import type { CollectionConfig } from 'payload'

/**
 * Generate a random alphanumeric LPN code
 */
function generateLPNCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return 'LPN' + result
}

/**
 * Generate a unique LPN number for a tenant
 */
async function generateUniqueLPN(
  payload: any,
  tenantId: number | string,
  maxAttempts: number = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const lpn = generateLPNCode(8) // 8 character code after "LPN"

    // Check if this LPN already exists for this tenant
    const existing = await payload.find({
      collection: 'put-away-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenantId,
            },
          },
          {
            lpnNumber: {
              equals: lpn,
            },
          },
        ],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      return lpn
    }
  }

  // Fallback: use timestamp-based LPN if all attempts fail
  return generateLPNCode(6) + Date.now().toString().slice(-4)
}

export const PutAwayStock: CollectionConfig = {
  slug: 'put-away-stock',
  admin: {
    useAsTitle: 'lpnNumber',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') {
        // Super admins can see all, but exclude soft-deleted unless explicitly requested
        // Return true to allow access, filtering will be handled by API routes
        return true
      }
      if (user?.tenantId) {
        const where: any = {
          and: [
            {
              tenantId: {
                equals: user.tenantId,
              },
            },
            {
              isDeleted: {
                equals: false,
              },
            },
          ],
        }
        return where
      }
      return false
    },
    update: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    delete: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
  },
  fields: [
    {
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Links put-away stock to their company (tenant)',
      },
    },
    {
      name: 'lpnNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Unique License Plate Number for this tenant (auto-generated)',
        readOnly: true,
      },
    },
    {
      name: 'inboundInventoryId',
      type: 'relationship',
      relationTo: 'inbound-inventory',
      admin: {
        description: 'Links to the inbound inventory job (for inbound jobs)',
      },
    },
    {
      name: 'inboundProductLineId',
      type: 'relationship',
      relationTo: 'inbound-product-line',
      admin: {
        description: 'Links to the specific product line (for inbound jobs)',
      },
    },
    {
      name: 'containerDetailId',
      type: 'relationship',
      relationTo: 'container-details',
      admin: {
        description: 'Links to container detail (for container bookings)',
      },
    },
    {
      name: 'containerStockAllocationId',
      type: 'relationship',
      relationTo: 'container-stock-allocations',
      admin: {
        description: 'Links to container stock allocation product line (for container bookings)',
      },
    },
    {
      name: 'skuId',
      type: 'relationship',
      relationTo: 'skus',
      required: true,
      admin: {
        description: 'References SKU (product) record',
      },
    },
    {
      name: 'warehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      required: true,
      admin: {
        description: 'Warehouse where stock is stored',
      },
    },
    {
      name: 'location',
      type: 'text',
      required: true,
      admin: {
        description: 'Storage location within the warehouse (from Stores collection)',
      },
    },
    {
      name: 'huQty',
      type: 'number',
      required: true,
      admin: {
        description: 'Quantity of handling units per pallet',
      },
    },
    {
      name: 'originalHuQty',
      type: 'number',
      admin: {
        description: 'Original quantity when pallet was created (for tracking partial allocations)',
      },
    },
    {
      name: 'remainingHuQty',
      type: 'number',
      admin: {
        description: 'Current remaining quantity (for partially allocated pallets)',
      },
    },
    {
      name: 'isLoosened',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Flag indicating if this is a loosened stock record (aggregated loosened items)',
      },
    },
    {
      name: 'loosenedQty',
      type: 'number',
      admin: {
        description: 'Quantity of loosened items aggregated in this record',
      },
    },
    {
      name: 'parentLpnId',
      type: 'relationship',
      relationTo: 'put-away-stock',
      admin: {
        description: 'Reference to original LPN if this is a loosened record created from a partial allocation',
      },
    },
    {
      name: 'loosenedSkuId',
      type: 'relationship',
      relationTo: 'skus',
      admin: {
        description: 'SKU for loosened items (when isLoosened is true)',
      },
    },
    {
      name: 'loosenedBatchNumber',
      type: 'text',
      admin: {
        description: 'Batch number for loosened items (when isLoosened is true)',
      },
    },
    // Outbound allocation tracking fields
    {
      name: 'outboundInventoryId',
      type: 'relationship',
      relationTo: 'outbound-inventory',
      admin: {
        description: 'Outbound job this LPN is allocated to (if allocated)',
      },
    },
    {
      name: 'outboundProductLineId',
      type: 'relationship',
      relationTo: 'outbound-product-line',
      admin: {
        description: 'Outbound product line this LPN is allocated to (if allocated)',
      },
    },
    {
      name: 'allocationStatus',
      type: 'select',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Reserved', value: 'reserved' },
        { label: 'Allocated', value: 'allocated' },
        { label: 'Picked', value: 'picked' },
        { label: 'Dispatched', value: 'dispatched' },
      ],
      defaultValue: 'available',
      admin: {
        description: 'Current allocation status of this LPN',
      },
    },
    {
      name: 'allocatedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when this LPN was allocated to an outbound job',
      },
    },
    {
      name: 'allocatedBy',
      type: 'relationship',
      relationTo: 'tenant-users',
      admin: {
        description: 'User who allocated this LPN',
      },
    },
    {
      name: 'isDeleted',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Soft delete flag',
        hidden: true,
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when item was deleted',
        hidden: true,
      },
    },
    {
      name: 'deletedBy',
      type: 'relationship',
      relationTo: 'tenant-users',
      admin: {
        description: 'User who deleted this item',
        hidden: true,
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeDelete: [
      async ({ req, id }) => {
        const payload = req.payload

        // Check if item is already soft-deleted (permanent delete)
        const item = await payload.findByID({
          collection: 'put-away-stock',
          id,
        })

        if ((item as { isDeleted?: boolean }).isDeleted) {
          // Item is already soft-deleted, allow permanent deletion
          return
        }

        // Soft delete instead of hard delete
        const userId = (req.user as { id?: number | string })?.id

        const updateData: any = {
          deletedAt: new Date().toISOString(),
          isDeleted: true,
        }

        // Only set deletedBy if user exists
        if (userId) {
          updateData.deletedBy = userId
        }

        try {
          await payload.update({
            collection: 'put-away-stock',
            id,
            data: updateData,
          })
        } catch (error) {
          // If update fails, log but still prevent deletion
          console.error('Error during soft delete:', error)
        }

        // Prevent actual deletion by throwing error
        throw new Error('Item soft deleted')
      },
    ],
    beforeChange: [
      async ({ req, data, operation, originalDoc }) => {
        const user = (
          req as unknown as {
            user?: { role?: string; tenantId?: number | string; collection?: string }
          }
        ).user
        // If creating/updating and user has tenantId, ensure it matches
        if (user?.tenantId && data.tenantId !== user.tenantId) {
          // Super admins can set any tenantId, but regular users cannot
          if (user.role !== 'superadmin' && user.collection !== 'users') {
            data.tenantId = user.tenantId
          }
        }

        // Generate unique LPN when creating a new record (only if not provided)
        if (operation === 'create' && !data.lpnNumber && req?.payload && data.tenantId) {
          const tenantId =
            typeof data.tenantId === 'object' ? (data.tenantId as { id: number }).id : data.tenantId
          if (tenantId) {
            // Generate special LPN for loosened items
            if (data.isLoosened && data.loosenedSkuId && data.loosenedBatchNumber) {
              const skuId = typeof data.loosenedSkuId === 'object' 
                ? (data.loosenedSkuId as { id: number }).id 
                : data.loosenedSkuId
              const batchNumber = data.loosenedBatchNumber as string
              data.lpnNumber = `LOOSENED-${skuId}-${batchNumber}`
            } else {
              data.lpnNumber = await generateUniqueLPN(req.payload, tenantId)
            }
          }
        }
        // If LPN is provided, use it (from form generation)

        // Initialize originalHuQty and remainingHuQty for new records
        if (operation === 'create') {
          if (!data.originalHuQty && data.huQty) {
            data.originalHuQty = data.huQty
          }
          if (!data.remainingHuQty && data.huQty) {
            data.remainingHuQty = data.huQty
          }
        }

        // Maintain remainingHuQty consistency
        if (operation === 'update' && data.huQty !== undefined && !data.isLoosened) {
          // If huQty is being updated and it's not a loosened record, update remainingHuQty
          if (originalDoc && !data.originalHuQty) {
            // Preserve originalHuQty if not being changed
            const existingOriginal = (originalDoc as any).originalHuQty || (originalDoc as any).huQty
            data.originalHuQty = existingOriginal
          }
          // Update remainingHuQty to match huQty if not explicitly set
          if (data.remainingHuQty === undefined) {
            data.remainingHuQty = data.huQty
          }
        }

        // Prevent double allocation: if trying to allocate an already allocated LPN
        if (
          operation === 'update' &&
          (data as any).allocationStatus === 'allocated' &&
          originalDoc
        ) {
          // Use originalDoc which contains the existing document for update operations
          const existing = originalDoc as any

          // If LPN is already allocated to a different outbound job, prevent re-allocation
          const existingAllocationStatus = existing.allocationStatus
          const existingOutboundId = existing.outboundInventoryId

          if (existingAllocationStatus === 'allocated' && existingOutboundId) {
            const existingOutboundIdValue =
              typeof existingOutboundId === 'object' ? existingOutboundId.id : existingOutboundId
            const newOutboundId =
              typeof (data as any).outboundInventoryId === 'object'
                ? ((data as any).outboundInventoryId as { id: number }).id
                : (data as any).outboundInventoryId

            if (
              existingOutboundIdValue &&
              newOutboundId &&
              existingOutboundIdValue !== newOutboundId
            ) {
              throw new Error(
                `LPN ${existing.lpnNumber} is already allocated to another outbound job`,
              )
            }
          }
        }

        return data
      },
    ],
  },
}
