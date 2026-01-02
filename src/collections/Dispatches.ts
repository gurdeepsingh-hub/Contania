import type { CollectionConfig } from 'payload'

export const Dispatches: CollectionConfig = {
  slug: 'dispatches',
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
        description: 'Links dispatch to their company (tenant)',
      },
    },
    {
      name: 'outboundInventoryId',
      type: 'relationship',
      relationTo: 'outbound-inventory',
      required: true,
      admin: {
        description: 'Links dispatch to outbound job',
      },
    },
    {
      name: 'dispatchDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date for dispatch',
        date: {
          pickerAppearance: 'dayOnly',
        },
      },
    },
    {
      name: 'dispatchTime',
      type: 'text',
      required: true,
      admin: {
        description: 'Time for dispatch (e.g., "14:30" or "2:30 PM")',
      },
    },
    {
      name: 'driverId',
      type: 'relationship',
      relationTo: 'drivers',
      admin: {
        description: 'Driver assigned to this dispatch',
      },
    },
    {
      name: 'vehicleId',
      type: 'relationship',
      relationTo: 'vehicles',
      required: true,
      admin: {
        description: 'Vehicle assigned to this dispatch',
      },
    },
    {
      name: 'status',
      type: 'select',
      options: [
        { label: 'Planned', value: 'planned' },
        { label: 'Allocated', value: 'allocated' },
      ],
      defaultValue: 'planned',
      admin: {
        description: 'Status of the dispatch entry',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes about the dispatch',
      },
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'tenant-users',
      admin: {
        description: 'User who created this dispatch entry',
      },
    },
    {
      name: 'allocatedAt',
      type: 'date',
      admin: {
        description: 'Timestamp when dispatch was allocated',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ req, data, operation }) => {
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

        // Auto-populate tenantId from outboundInventoryId if not set
        // Note: This is synchronous, so we'll handle it in API routes instead

        // Auto-populate createdBy on create
        if (operation === 'create' && user && (user as { collection?: string }).collection === 'tenant-users') {
          data.createdBy = (user as { id?: number }).id
        }

        // Auto-populate allocatedAt when status changes to 'allocated'
        if (data.status === 'allocated' && operation === 'update' && req?.payload) {
          const originalDoc = (req as any).originalDoc
          if (originalDoc && originalDoc.status !== 'allocated') {
            data.allocatedAt = new Date().toISOString()
          }
        }

        return data
      },
    ],
  },
}

