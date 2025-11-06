import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // This collection is used for platform-level super admins
  auth: true,
  // restrict management (create/read/update/delete) to superadmins only
  access: {
    create: ({ req }) => {
      const u = (req as unknown as { user?: { role?: string } }).user
      return !!(u && u.role === 'superadmin')
    },
    read: () => {
      return true
    },
    update: ({ req }) => {
      const u = (req as unknown as { user?: { role?: string } }).user
      return !!(u && u.role === 'superadmin')
    },
    delete: ({ req }) => {
      const u = (req as unknown as { user?: { role?: string } }).user
      return !!(u && u.role === 'superadmin')
    },
  },
  fields: [
    // Email & password are provided by Payload when `auth: true` is set
    {
      name: 'fullName',
      type: 'text',
      required: true,
    },
    {
      name: 'role',
      type: 'select',
      defaultValue: 'superadmin',
      options: [{ label: 'Super Admin', value: 'superadmin' }],
      admin: {
        description: 'Platform-level role (only superadmin supported currently)',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
      admin: {
        description: 'Account status of the admin',
      },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      admin: {
        description: 'Timestamp of last successful login',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
    {
      name: 'deletedAt',
      type: 'date',
      admin: {
        description: 'Soft deletion timestamp',
        date: {
          pickerAppearance: 'dayAndTime',
        },
      },
    },
  ],
}
