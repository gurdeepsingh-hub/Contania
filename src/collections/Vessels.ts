import type { CollectionConfig } from 'payload'

export const Vessels: CollectionConfig = {
  slug: 'vessels',
  admin: {
    useAsTitle: 'vesselName',
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
        description: 'Links vessel to their company (tenant)',
      },
    },
    {
      name: 'vesselName',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of vessel',
      },
    },
    {
      name: 'voyageNumber',
      type: 'text',
      admin: {
        description: 'Voyage number',
      },
    },
    {
      name: 'lloydsNumber',
      type: 'text',
      admin: {
        description: 'Lloyds number',
      },
    },
    {
      name: 'wharfId',
      type: 'relationship',
      relationTo: 'wharves',
      admin: {
        description: 'Wharf associated with vessel',
      },
    },
    {
      name: 'jobType',
      type: 'select',
      required: true,
      options: [
        { label: 'Import', value: 'import' },
        { label: 'Export', value: 'export' },
      ],
      admin: {
        description: 'Type of job (import or export)',
      },
    },
    // Import fields
    {
      name: 'eta',
      type: 'date',
      admin: {
        description: 'Estimated Time of Arrival (for import)',
        condition: (data) => (data as { jobType?: string }).jobType === 'import',
      },
    },
    {
      name: 'availability',
      type: 'date',
      admin: {
        description: 'Availability date (for import)',
        condition: (data) => (data as { jobType?: string }).jobType === 'import',
      },
    },
    {
      name: 'storageStart',
      type: 'date',
      admin: {
        description: 'Storage start date (for import)',
        condition: (data) => (data as { jobType?: string }).jobType === 'import',
      },
    },
    {
      name: 'firstFreeImportDate',
      type: 'date',
      admin: {
        description: 'First free import date (for import)',
        condition: (data) => (data as { jobType?: string }).jobType === 'import',
      },
    },
    // Export fields
    {
      name: 'etd',
      type: 'date',
      admin: {
        description: 'Estimated Time of Departure (for export)',
        condition: (data) => (data as { jobType?: string }).jobType === 'export',
      },
    },
    {
      name: 'receivalStart',
      type: 'date',
      admin: {
        description: 'Receival start date (for export)',
        condition: (data) => (data as { jobType?: string }).jobType === 'export',
      },
    },
    {
      name: 'cutoff',
      type: 'date',
      admin: {
        description: 'Cutoff date (for export)',
        condition: (data) => (data as { jobType?: string }).jobType === 'export',
      },
    },
    {
      name: 'reeferCutoff',
      type: 'date',
      admin: {
        description: 'Reefer cutoff date (for export)',
        condition: (data) => (data as { jobType?: string }).jobType === 'export',
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


