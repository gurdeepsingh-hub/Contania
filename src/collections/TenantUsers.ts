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
      name: 'role',
      type: 'relationship',
      relationTo: 'tenant-roles',
      required: true,
      admin: {
        description: 'Role assigned to the user',
      },
    },
    // Keep userGroup for backward compatibility during migration (deprecated)
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
        description: 'DEPRECATED: Use role field instead. This field is kept for backward compatibility.',
        hidden: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
      admin: {
        description: 'User account status',
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
    afterChange: [
      async ({ doc, operation, req }) => {
        // On create, if this is the first user for the tenant and no role is assigned,
        // assign the admin role
        if (operation === 'create' && !doc.role) {
          try {
            const payload = req.payload
            const tenantId = typeof (doc as { tenantId?: number | { id: number } }).tenantId === 'object'
              ? ((doc as { tenantId?: { id: number } }).tenantId as { id: number }).id
              : (doc as { tenantId?: number }).tenantId

            if (!tenantId) return doc

            // Check if there are any other users for this tenant
            const existingUsers = await payload.find({
              collection: 'tenant-users',
              where: {
                and: [
                  {
                    tenantId: {
                      equals: tenantId,
                    },
                  },
                  {
                    id: {
                      not_equals: doc.id,
                    },
                  },
                ],
              },
              limit: 1,
            })

            // If this is the first user, assign admin role
            if (existingUsers.totalDocs === 0) {
              // Find or create admin role for this tenant
              const adminRoles = await payload.find({
                collection: 'tenant-roles',
                where: {
                  and: [
                    {
                      tenantId: {
                        equals: tenantId,
                      },
                    },
                    {
                      isSystemRole: {
                        equals: true,
                      },
                    },
                  ],
                },
                limit: 1,
              })

              let adminRoleId: number | undefined

              if (adminRoles.totalDocs > 0) {
                adminRoleId = adminRoles.docs[0].id as number
              } else {
                // Create admin role if it doesn't exist
                const allPermissions: Record<string, boolean> = {}
                const permissionKeys = [
                  'dashboard_view',
                  'dashboard_edit',
                  'containers_view',
                  'containers_create',
                  'containers_edit',
                  'containers_delete',
                  'inventory_view',
                  'inventory_create',
                  'inventory_edit',
                  'inventory_delete',
                  'transportation_view',
                  'transportation_create',
                  'transportation_edit',
                  'transportation_delete',
                  'map_view',
                  'map_edit',
                  'reports_view',
                  'reports_create',
                  'reports_delete',
                  'settings_view',
                  'settings_manage_users',
                  'settings_manage_roles',
                  'settings_entity_settings',
                  'settings_user_settings',
                  'settings_personalization',
                ]

                permissionKeys.forEach((key) => {
                  allPermissions[key] = true
                })

                const adminRole = await payload.create({
                  collection: 'tenant-roles',
                  data: {
                    name: 'Admin',
                    description: 'Administrator role with full access to all features',
                    tenantId: tenantId,
                    isSystemRole: true,
                    isActive: true,
                    permissions: allPermissions,
                  },
                })

                adminRoleId = adminRole.id as number
              }

              // Update the user with admin role
              if (adminRoleId) {
                await payload.update({
                  collection: 'tenant-users',
                  id: doc.id as number,
                  data: {
                    role: adminRoleId,
                  },
                })
              }
            }
          } catch (error) {
            console.error('Error assigning admin role to first user:', error)
            // Don't fail user creation if role assignment fails
          }
        }

        return doc
      },
    ],
  },
}

