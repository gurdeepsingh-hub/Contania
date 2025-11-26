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
  maxAttempts: number = 10
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
      required: true,
      admin: {
        description: 'Links to the inbound inventory job',
      },
    },
    {
      name: 'inboundProductLineId',
      type: 'relationship',
      relationTo: 'inbound-product-line',
      required: true,
      admin: {
        description: 'Links to the specific product line',
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
        description: 'Storage location within the warehouse (from warehouse stores)',
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
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ req, data, operation }) => {
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
            data.lpnNumber = await generateUniqueLPN(req.payload, tenantId)
          }
        }
        // If LPN is provided, use it (from form generation)

        return data
      },
    ],
  },
}

