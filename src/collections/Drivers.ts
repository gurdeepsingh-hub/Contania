import type { CollectionConfig } from 'payload'

export const Drivers: CollectionConfig = {
  slug: 'drivers',
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
        description: 'Links driver to their company (tenant)',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Full name of driver',
      },
    },
    {
      name: 'phoneNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Driver contact number',
      },
    },
    {
      name: 'vehicleId',
      type: 'relationship',
      relationTo: 'vehicles',
      admin: {
        description: 'Assigned vehicle',
      },
    },
    {
      name: 'defaultDepotId',
      type: 'relationship',
      relationTo: 'warehouses',
      admin: {
        description: 'Default depot/warehouse for the driver',
      },
    },
    {
      name: 'abn',
      type: 'text',
      admin: {
        description: 'Australian Business Number (if applicable)',
      },
    },
    {
      name: 'addressStreet',
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
        description: 'State/Province',
      },
    },
    {
      name: 'postcode',
      type: 'text',
      admin: {
        description: 'Postcode/ZIP',
      },
    },
    {
      name: 'employeeType',
      type: 'select',
      required: true,
      options: [
        { label: 'Casual', value: 'Casual' },
        { label: 'Permanent', value: 'Permanent' },
      ],
      admin: {
        description: 'Casual or Permanent',
      },
    },
    {
      name: 'drivingLicenceNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Driver licence number',
      },
    },
    {
      name: 'licenceExpiry',
      type: 'date',
      admin: {
        description: 'Driver licence expiry date',
      },
    },
    {
      name: 'licencePhotoUrl',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'URL or file path to uploaded licence photo',
      },
    },
    {
      name: 'dangerousGoodsCertNumber',
      type: 'text',
      admin: {
        description: 'Dangerous Goods certificate number',
      },
    },
    {
      name: 'dangerousGoodsCertExpiry',
      type: 'date',
      admin: {
        description: 'DG certificate expiry date',
      },
    },
    {
      name: 'msicNumber',
      type: 'text',
      admin: {
        description: 'Maritime Security Identification Card number',
      },
    },
    {
      name: 'msicExpiry',
      type: 'date',
      admin: {
        description: 'MSIC expiry date',
      },
    },
    {
      name: 'msicPhotoUrl',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'URL or file path to uploaded MSIC photo',
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

