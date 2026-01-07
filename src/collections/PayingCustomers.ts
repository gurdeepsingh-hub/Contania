import type { CollectionConfig } from 'payload'

export const PayingCustomers: CollectionConfig = {
  slug: 'paying-customers',
  admin: {
    useAsTitle: 'customer_name',
    description: 'Customer - Billing and payment information',
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
        description: 'Links customer to their company (tenant)',
      },
    },
    {
      name: 'customer_name',
      type: 'text',
      required: true,
      admin: {
        description: 'Official name of the customer (client responsible for billing)',
        label: 'Customer Name',
      },
    },
    {
      name: 'abn',
      type: 'text',
      admin: {
        description: 'Business number for invoicing',
        label: 'ABN',
      },
    },
    {
      name: 'email',
      type: 'email',
      admin: {
        description: 'Customer email address',
        label: 'Email',
      },
    },
    {
      name: 'contact_name',
      type: 'text',
      admin: {
        description: 'Primary contact person for billing',
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
      name: 'billing_street',
      type: 'text',
      admin: {
        description: 'Billing street address',
        label: 'Billing Street',
      },
    },
    {
      name: 'billing_city',
      type: 'text',
      admin: {
        description: 'Billing city',
        label: 'Billing City',
      },
    },
    {
      name: 'billing_state',
      type: 'text',
      admin: {
        description: 'Billing state or province',
        label: 'Billing State',
      },
    },
    {
      name: 'billing_postcode',
      type: 'text',
      admin: {
        description: 'Billing postal/ZIP code',
        label: 'Billing Postcode',
      },
    },
    {
      name: 'delivery_same_as_billing',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'If true, delivery address = billing address',
        label: 'Delivery Same as Billing',
      },
    },
    {
      name: 'delivery_street',
      type: 'text',
      admin: {
        description: 'Delivery street address',
        label: 'Delivery Street',
      },
    },
    {
      name: 'delivery_city',
      type: 'text',
      admin: {
        description: 'Delivery city',
        label: 'Delivery City',
      },
    },
    {
      name: 'delivery_state',
      type: 'text',
      admin: {
        description: 'Delivery state or province',
        label: 'Delivery State',
      },
    },
    {
      name: 'delivery_postcode',
      type: 'text',
      admin: {
        description: 'Delivery postal/ZIP code',
        label: 'Delivery Postcode',
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
