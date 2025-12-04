import type { CollectionConfig } from 'payload'

export const Trailers: CollectionConfig = {
  slug: 'trailers',
  admin: {
    useAsTitle: 'fleetNumber',
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
        description: 'Links trailer to their company (tenant)',
      },
    },
    {
      name: 'fleetNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Trailer fleet ID',
      },
    },
    {
      name: 'rego',
      type: 'text',
      required: true,
      admin: {
        description: 'Trailer registration number',
      },
    },
    {
      name: 'regoExpiryDate',
      type: 'date',
      admin: {
        description: 'Registration expiry date',
      },
    },
    {
      name: 'trailerTypeId',
      type: 'relationship',
      relationTo: 'trailer-types',
      admin: {
        description: 'Trailer type reference',
      },
    },
    {
      name: 'maxWeightKg',
      type: 'number',
      admin: {
        description: 'Max allowed weight (kg)',
      },
    },
    {
      name: 'maxCubeM3',
      type: 'number',
      admin: {
        description: 'Max cubic volume (m³)',
      },
    },
    {
      name: 'maxPallet',
      type: 'number',
      admin: {
        description: 'Max pallet capacity',
      },
    },
    {
      name: 'defaultWarehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      admin: {
        description: 'Default warehouse',
      },
    },
    {
      name: 'dangerousCertNumber',
      type: 'text',
      admin: {
        description: 'Dangerous goods certificate number',
      },
    },
    {
      name: 'dangerousCertExpiry',
      type: 'date',
      admin: {
        description: 'Dangerous goods certificate expiry',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Notes or description',
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

