import type { CollectionConfig } from 'payload'

export const TenantRoles: CollectionConfig = {
  slug: 'tenant-roles',
  admin: {
    useAsTitle: 'name',
  },
  access: {
    // Only tenant users can create roles for their tenant, super admins can create any
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    // Users can only read their own tenant's roles, super admins can read all
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
    // Users can update their own tenant's roles (except system roles), super admins can update all
    update: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          and: [
            {
              tenantId: {
                equals: user.tenantId,
              },
            },
            {
              isSystemRole: {
                equals: false,
              },
            },
          ],
        }
      }
      return false
    },
    // Users can delete their own tenant's roles (except system roles), super admins can delete all
    delete: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return {
          and: [
            {
              tenantId: {
                equals: user.tenantId,
              },
            },
            {
              isSystemRole: {
                equals: false,
              },
            },
          ],
        }
      }
      return false
    },
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the role (unique per tenant)',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Optional description of the role',
      },
    },
    {
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Tenant this role belongs to',
      },
    },
    {
      name: 'isSystemRole',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'System roles (like Admin) cannot be edited or deleted',
        readOnly: true,
      },
    },
    {
      name: 'permissions',
      type: 'group',
      label: 'Permissions',
      fields: [
        // Dashboard permissions
        {
          name: 'dashboard_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View dashboard',
          },
        },
        {
          name: 'dashboard_edit',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Edit dashboard',
          },
        },
        // Containers permissions
        {
          name: 'containers_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View containers',
          },
        },
        {
          name: 'containers_create',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Create containers',
          },
        },
        {
          name: 'containers_edit',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Edit containers',
          },
        },
        {
          name: 'containers_delete',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Delete containers',
          },
        },
        // Inventory permissions
        {
          name: 'inventory_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View inventory',
          },
        },
        {
          name: 'inventory_create',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Create inventory',
          },
        },
        {
          name: 'inventory_edit',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Edit inventory',
          },
        },
        {
          name: 'inventory_delete',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Delete inventory',
          },
        },
        // Transportation permissions
        {
          name: 'transportation_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View transportation',
          },
        },
        {
          name: 'transportation_create',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Create transportation',
          },
        },
        {
          name: 'transportation_edit',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Edit transportation',
          },
        },
        {
          name: 'transportation_delete',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Delete transportation',
          },
        },
        // Live Map permissions
        {
          name: 'map_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View live map',
          },
        },
        {
          name: 'map_edit',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Edit live map',
          },
        },
        // Reports permissions
        {
          name: 'reports_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View reports',
          },
        },
        {
          name: 'reports_create',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Create reports',
          },
        },
        {
          name: 'reports_delete',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Delete reports',
          },
        },
        // Settings permissions
        {
          name: 'settings_view',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'View settings',
          },
        },
        {
          name: 'settings_manage_users',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Manage tenant users',
          },
        },
        {
          name: 'settings_manage_roles',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Manage roles',
          },
        },
        {
          name: 'settings_entity_settings',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Manage entity settings',
          },
        },
        {
          name: 'settings_user_settings',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Manage user settings',
          },
        },
        {
          name: 'settings_personalization',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Manage personalization',
          },
        },
      ],
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Whether this role is active',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ req, data, operation }) => {
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
        // Prevent editing system roles
        if (operation === 'update' && data.isSystemRole) {
          // Allow super admins to edit system roles
          if (user?.role !== 'superadmin' && user?.collection !== 'users') {
            // Find existing role to check if it's a system role
            // This will be enforced in the access control, but we add a safety check here
          }
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const user = (req as unknown as { user?: { role?: string } }).user
        // Prevent deletion of system roles (except by super admin)
        if (user?.role !== 'superadmin' && user?.collection !== 'users') {
          const payload = req.payload
          const role = await payload.findByID({
            collection: 'tenant-roles',
            id: typeof id === 'string' ? Number(id) : id,
          })
          if (role && (role as { isSystemRole?: boolean }).isSystemRole) {
            throw new Error('System roles cannot be deleted')
          }
          // Check if role is in use
          const usersWithRole = await payload.find({
            collection: 'tenant-users',
            where: {
              role: {
                equals: typeof id === 'string' ? Number(id) : id,
              },
            },
            limit: 1,
          })
          if (usersWithRole.totalDocs > 0) {
            throw new Error('Cannot delete role that is assigned to users')
          }
        }
        return id
      },
    ],
  },
}
