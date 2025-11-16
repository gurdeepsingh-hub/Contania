import type { CollectionConfig } from 'payload'

export const PayingCustomers: CollectionConfig = {
  slug: 'paying-customers',
  admin: {
    useAsTitle: 'customer_name',
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
        description: 'Links paying customer to their company (tenant)',
      },
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      admin: {
        description: 'Official name of the paying customer (client responsible for billing)',
      },
    },
    {
      name: 'abn',
      type: 'text',
      admin: {
        description: 'Business number for invoicing',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Customer email address',
      },
    },
    {
      name: 'contact_name',
      type: 'text',
      admin: {
        description: 'Primary contact person for billing',
      },
    },
    {
      name: 'contact_phone',
      type: 'text',
      admin: {
        description: 'Contact phone number',
      },
    },
    {
      name: 'billing_street',
      type: 'text',
      admin: {
        description: 'Billing street address',
      },
    },
    {
      name: 'billing_city',
      type: 'text',
      admin: {
        description: 'Billing city',
      },
    },
    {
      name: 'billing_state',
      type: 'text',
      admin: {
        description: 'Billing state or province',
      },
    },
    {
      name: 'billing_postcode',
      type: 'text',
      admin: {
        description: 'Billing postal/ZIP code',
      },
    },
    {
      name: 'delivery_same_as_billing',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'If true, delivery address = billing address',
      },
    },
    {
      name: 'delivery_street',
      type: 'text',
      admin: {
        description: 'Delivery street address',
      },
    },
    {
      name: 'delivery_city',
      type: 'text',
      admin: {
        description: 'Delivery city',
      },
    },
    {
      name: 'delivery_state',
      type: 'text',
      admin: {
        description: 'Delivery state or province',
      },
    },
    {
      name: 'delivery_postcode',
      type: 'text',
      admin: {
        description: 'Delivery postal/ZIP code',
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

