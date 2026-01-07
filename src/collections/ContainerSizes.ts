import type { CollectionConfig } from 'payload'

export const ContainerSizes: CollectionConfig = {
  slug: 'container-sizes',
  admin: {
    useAsTitle: 'size',
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
        description: 'Links container size to their company (tenant)',
      },
    },
    {
      name: 'size',
      type: 'number',
      required: true,
      admin: {
        description: 'Container size (e.g., 20, 40)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Description of container size',
      },
    },
    {
      name: 'attribute',
      type: 'select',
      options: [
        { label: 'HC', value: 'HC' },
        { label: 'RF', value: 'RF' },
        { label: 'GP', value: 'GP' },
        { label: 'TK', value: 'TK' },
        { label: 'OT', value: 'OT' },
      ],
      admin: {
        description: 'Container attribute type',
      },
    },
    {
      name: 'weight',
      type: 'number',
      admin: {
        description: 'Weight in kg',
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


