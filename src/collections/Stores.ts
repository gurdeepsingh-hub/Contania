import type { CollectionConfig } from 'payload'

export const Stores: CollectionConfig = {
  slug: 'stores',
  admin: {
    useAsTitle: 'storeName',
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
        description: 'Links store to their company (tenant)',
      },
    },
    {
      name: 'warehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      required: true,
      admin: {
        description: 'Warehouse this store belongs to',
      },
    },
    {
      name: 'storeName',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the store',
      },
    },
    {
      name: 'countable',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this store is countable',
      },
    },
    {
      name: 'zoneType',
      type: 'select',
      required: true,
      options: [
        { label: 'Indock', value: 'Indock' },
        { label: 'Outdock', value: 'Outdock' },
        { label: 'Storage', value: 'Storage' },
      ],
      admin: {
        description: 'Zone type for the store',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        const user = (
          req as unknown as {
            user?: {
              role?: string
              tenantId?: number | string | { id: number }
              collection?: string
            }
          }
        )?.user
        // If creating/updating and user has tenantId, ensure it matches
        if (user?.tenantId) {
          const userTenantId = typeof user.tenantId === 'object' ? user.tenantId.id : user.tenantId
          const dataTenantId =
            typeof data.tenantId === 'object' ? (data.tenantId as { id: number }).id : data.tenantId

          if (dataTenantId && dataTenantId !== userTenantId) {
            // Super admins can set any tenantId, but regular users cannot
            if (user.role !== 'superadmin' && user.collection !== 'users') {
              data.tenantId = userTenantId
            }
          }
        }
        return data
      },
      async ({ data, req }) => {
        // Auto-set tenantId from warehouse if not set
        if (data.warehouseId && !data.tenantId && req?.payload) {
          try {
            const warehouseId =
              typeof data.warehouseId === 'object'
                ? (data.warehouseId as { id: number }).id
                : data.warehouseId

            if (warehouseId) {
              const warehouse = await req.payload.findByID({
                collection: 'warehouses',
                id: warehouseId,
              })

              if (warehouse) {
                const warehouseTenantId =
                  typeof (warehouse as { tenantId?: number | { id: number } }).tenantId === 'object'
                    ? (warehouse as { tenantId: { id: number } }).tenantId.id
                    : (warehouse as { tenantId?: number }).tenantId

                if (warehouseTenantId) {
                  data.tenantId = warehouseTenantId
                }
              }
            }
          } catch (error) {
            console.error('Error fetching warehouse for tenantId:', error)
          }
        }
        return data
      },
    ],
  },
}
