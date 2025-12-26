import type { CollectionConfig } from 'payload'

export const ShippingLines: CollectionConfig = {
  slug: 'shipping-lines',
  admin: {
    useAsTitle: 'name',
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
        description: 'Links shipping line to their company (tenant)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of shipping line',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Shipping line email address',
      },
    },
    {
      name: 'contactName',
      type: 'text',
      admin: {
        description: 'Primary contact name',
      },
    },
    {
      name: 'contactPhoneNumber',
      type: 'text',
      admin: {
        description: 'Contact phone number',
      },
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        {
          name: 'street',
          type: 'text',
          admin: {
            description: 'Street address',
          },
        },
        {
          name: 'city',
          type: 'text',
          admin: {
            description: 'City',
          },
        },
        {
          name: 'state',
          type: 'text',
          admin: {
            description: 'State or province',
          },
        },
        {
          name: 'postcode',
          type: 'text',
          admin: {
            description: 'Postal/ZIP code',
          },
        },
      ],
    },
    {
      name: 'importFreeDays',
      type: 'number',
      admin: {
        description: 'Number of import free days',
      },
    },
    {
      name: 'calculateImportFreeDaysUsing',
      type: 'select',
      options: [
        { label: 'Availability Date', value: 'availability_date' },
        { label: 'First Free Import Date', value: 'first_free_import_date' },
        { label: 'Discharge Date', value: 'discharge_date' },
        { label: 'Full Gate Out', value: 'full_gate_out' },
      ],
      admin: {
        description: 'Method to calculate import free days',
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
    ],
  },
}


