import type { CollectionConfig } from 'payload'

export const DetentionControl: CollectionConfig = {
  slug: 'detention-control',
  admin: {
    useAsTitle: 'id',
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
        description: 'Links detention control to their company (tenant)',
      },
    },
    {
      name: 'shippingLineId',
      type: 'relationship',
      relationTo: 'shipping-lines',
      required: true,
      admin: {
        description: 'Shipping line for detention control',
      },
    },
    {
      name: 'containerType',
      type: 'select',
      required: true,
      options: [
        { label: 'RF', value: 'RF' },
        { label: 'DRY', value: 'DRY' },
      ],
      admin: {
        description: 'Container type',
      },
    },
    {
      name: 'calculateImportFreeDaysUsing',
      type: 'text',
      admin: {
        description: 'Method to calculate import free days (auto-fetched from shipping line)',
        readOnly: true,
      },
    },
    {
      name: 'importFreeDays',
      type: 'number',
      admin: {
        description: 'Number of import free days',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
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
        return data
      },
      async ({ data, req }) => {
        // Auto-fetch calculateImportFreeDaysUsing from shipping line
        if (data.shippingLineId && req?.payload) {
          try {
            const shippingLineId =
              typeof data.shippingLineId === 'object'
                ? (data.shippingLineId as { id: number }).id
                : data.shippingLineId

            if (shippingLineId) {
              const shippingLine = await req.payload.findByID({
                collection: 'shipping-lines',
                id: shippingLineId,
              })

              if (shippingLine) {
                const sl = shippingLine as { calculateImportFreeDaysUsing?: string }
                data.calculateImportFreeDaysUsing = sl.calculateImportFreeDaysUsing || ''
              }
            }
          } catch (error) {
            console.error('Error fetching shipping line:', error)
          }
        }

        return data
      },
    ],
  },
}


