import type { CollectionConfig } from 'payload'

export const TrailerTypes: CollectionConfig = {
  slug: 'trailer-types',
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
        description: 'Links trailer type to their company (tenant)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Trailer type name',
      },
    },
    {
      name: 'maxWeightKg',
      type: 'number',
      admin: {
        description: 'Maximum weight capacity in kg',
      },
    },
    {
      name: 'maxCubicM3',
      type: 'number',
      admin: {
        description: 'Maximum cubic volume in m³',
      },
    },
    {
      name: 'maxPallet',
      type: 'number',
      admin: {
        description: 'Maximum pallet capacity',
      },
    },
    {
      name: 'trailerA',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this type supports Trailer A',
      },
    },
    {
      name: 'trailerB',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this type supports Trailer B',
      },
    },
    {
      name: 'trailerC',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Whether this type supports Trailer C',
      },
    },
    {
      name: 'trailerAEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable Trailer A configuration',
      },
    },
    {
      name: 'trailerAMaxWeight',
      type: 'number',
      admin: {
        description: 'Maximum weight capacity for Trailer A in kg',
        condition: (data) => data.trailerAEnabled === true,
      },
    },
    {
      name: 'trailerATeuCapacity',
      type: 'select',
      options: [
        {
          label: 'Empty',
          value: '0',
        },
        {
          label: '1',
          value: '1',
        },
        {
          label: '2',
          value: '2',
        },
      ],
      admin: {
        description: 'TEU capacity for Trailer A',
        condition: (data) => data.trailerAEnabled === true,
      },
    },
    {
      name: 'trailerBEnabled',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Enable Trailer B configuration',
      },
    },
    {
      name: 'trailerBMaxWeight',
      type: 'number',
      admin: {
        description: 'Maximum weight capacity for Trailer B in kg',
        condition: (data) => data.trailerBEnabled === true,
      },
    },
    {
      name: 'trailerBTeuCapacity',
      type: 'select',
      options: [
        {
          label: 'Empty',
          value: '0',
        },
        {
          label: '1',
          value: '1',
        },
        {
          label: '2',
          value: '2',
        },
      ],
      admin: {
        description: 'TEU capacity for Trailer B',
        condition: (data) => data.trailerBEnabled === true,
      },
    },
    {
      name: 'maxTeuCapacity',
      type: 'number',
      admin: {
        description: 'Maximum TEU capacity (calculated from Trailer A and B TEU capacities)',
        readOnly: true,
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
        
        // Calculate maxTeuCapacity from Trailer A and B TEU capacities
        let maxTeu = 0
        if (data.trailerAEnabled && data.trailerATeuCapacity) {
          const trailerATeu = parseInt(data.trailerATeuCapacity, 10) || 0
          maxTeu += trailerATeu
        }
        if (data.trailerBEnabled && data.trailerBTeuCapacity) {
          const trailerBTeu = parseInt(data.trailerBTeuCapacity, 10) || 0
          maxTeu += trailerBTeu
        }
        data.maxTeuCapacity = maxTeu
        
        return data
      },
    ],
  },
}

