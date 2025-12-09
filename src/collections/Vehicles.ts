import type { CollectionConfig } from 'payload'

export const Vehicles: CollectionConfig = {
  slug: 'vehicles',
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
        description: 'Links vehicle to their company (tenant)',
      },
    },
    {
      name: 'fleetNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal fleet identification number',
      },
    },
    {
      name: 'rego',
      type: 'text',
      required: true,
      admin: {
        description: 'Vehicle registration number',
      },
    },
    {
      name: 'regoExpiryDate',
      type: 'date',
      admin: {
        description: 'Expiry date of the vehicle registration',
      },
    },
    {
      name: 'gpsId',
      type: 'text',
      admin: {
        description: 'External GPS device ID linked to the vehicle',
      },
    },
    {
      name: 'description',
      type: 'text',
      admin: {
        description: 'Optional vehicle description or notes',
      },
    },
    {
      name: 'defaultDepotId',
      type: 'relationship',
      relationTo: 'warehouses',
      admin: {
        description: 'Default depot/warehouse where vehicle is based',
      },
    },
    {
      name: 'aTrailerId',
      type: 'relationship',
      relationTo: 'trailer-types',
      admin: {
        description: 'Assigned A trailer type',
      },
    },
    {
      name: 'bTrailerId',
      type: 'relationship',
      relationTo: 'trailer-types',
      admin: {
        description: 'Assigned B trailer type',
      },
    },
    {
      name: 'cTrailerId',
      type: 'relationship',
      relationTo: 'trailer-types',
      admin: {
        description: 'Assigned C trailer type',
      },
    },
    {
      name: 'sideloader',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        description: 'Whether vehicle is equipped with sideloader (YES/NO)',
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

