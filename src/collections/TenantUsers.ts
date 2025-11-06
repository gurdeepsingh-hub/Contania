import type { CollectionConfig } from 'payload'

export const TenantUsers: CollectionConfig = {
  slug: 'tenant-users',
  admin: {
    useAsTitle: 'email',
  },
  // This collection is used for tenant-specific users
  auth: true,
  access: {
    // Tenant users can create other users in their tenant, super admins can create any
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    // Users can only read their own tenant's users, super admins can read all
    read: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string; collection?: string } }).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        // Filter by tenantId in the query
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
      }
      return false
    },
    // Users can update their own tenant's users, super admins can update all
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
    // Users can delete their own tenant's users, super admins can delete all
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
        description: 'Links user to their company (tenant)',
      },
    },
    {
      name: 'username',
      type: 'text',
      admin: {
        description: "User's chosen username (unique within tenant)",
      },
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      admin: {
        description: "Full name of the user",
      },
    },
    // Email is provided by Payload when `auth: true` is set
    {
      name: 'phoneMobile',
      type: 'text',
      admin: {
        description: 'Mobile contact number',
      },
    },
    {
      name: 'phoneFixed',
      type: 'text',
      admin: {
        description: 'Fixed-line phone number',
      },
    },
    {
      name: 'ddi',
      type: 'text',
      admin: {
        description: 'Direct Dial-In extension (optional)',
      },
    },
    // Password is provided by Payload when `auth: true` is set
    {
      name: 'position',
      type: 'text',
      admin: {
        description: 'Job title or position in the company',
      },
    },
    {
      name: 'userGroup',
      type: 'select',
      options: [
        { label: 'Admin', value: 'Admin' },
        { label: 'Dispatcher', value: 'Dispatcher' },
        { label: 'Driver', value: 'Driver' },
        { label: 'Manager', value: 'Manager' },
      ],
      admin: {
        description: 'Role or group the user belongs to',
      },
    },
    // Note: depot and warehouse relationships will be added when those collections exist
    // {
    //   name: 'depot',
    //   type: 'relationship',
    //   relationTo: 'depots',
    //   admin: {
    //     description: 'Default depot assigned to the user',
    //   },
    // },
    // {
    //   name: 'warehouse',
    //   type: 'relationship',
    //   relationTo: 'warehouses',
    //   admin: {
    //     description: 'Default warehouse for the user',
    //   },
    // },
  ],
  // Add hooks to enforce tenant isolation when needed
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

