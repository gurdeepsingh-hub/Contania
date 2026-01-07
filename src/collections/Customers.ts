import type { CollectionConfig } from 'payload'

export const Customers: CollectionConfig = {
  slug: 'customers',
  admin: {
    useAsTitle: 'customer_name',
    description: 'Consignee/Consignor - Delivery customer information',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
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
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
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
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
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
        description: 'Links consignee/consignor to their company (tenant)',
      },
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of consignee/consignor',
        label: 'Consignee/Consignor Name',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Consignee/consignor email address',
        label: 'Email',
      },
    },
    {
      name: 'contact_name',
      type: 'text',
      admin: {
        description: 'Primary contact name',
        label: 'Contact Name',
      },
    },
    {
      name: 'contact_phone',
      type: 'text',
      admin: {
        description: 'Contact phone number',
        label: 'Contact Phone',
      },
    },
    {
      name: 'street',
      type: 'text',
      admin: {
        description: 'Street address',
        label: 'Street',
      },
    },
    {
      name: 'city',
      type: 'text',
      admin: {
        description: 'City',
        label: 'City',
      },
    },
    {
      name: 'state',
      type: 'text',
      admin: {
        description: 'State or province',
        label: 'State',
      },
    },
    {
      name: 'postcode',
      type: 'text',
      admin: {
        description: 'Postal/ZIP code',
        label: 'Postcode',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      ({ req, data }) => {
        const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
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
