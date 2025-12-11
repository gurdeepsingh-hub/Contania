/**
 * Permission utility functions for checking user access based on role permissions
 */

type PermissionString =
  | 'dashboard_view'
  | 'dashboard_edit'
  | 'containers_view'
  | 'containers_create'
  | 'containers_edit'
  | 'containers_delete'
  | 'inventory_view'
  | 'inventory_create'
  | 'inventory_edit'
  | 'inventory_delete'
  | 'transportation_view'
  | 'transportation_create'
  | 'transportation_edit'
  | 'transportation_delete'
  | 'map_view'
  | 'map_edit'
  | 'reports_view'
  | 'reports_create'
  | 'reports_delete'
  | 'settings_view'
  | 'settings_manage_users'
  | 'settings_manage_roles'
  | 'settings_entity_settings'
  | 'settings_user_settings'
  | 'settings_personalization'
  | 'freight_view'
  | 'freight_create'
  | 'freight_edit'
  | 'freight_delete'

type Section =
  | 'dashboard'
  | 'containers'
  | 'inventory'
  | 'transportation'
  | 'map'
  | 'reports'
  | 'settings'
  | 'freight'

type PermissionGroup = {
  [key in PermissionString]?: boolean | null
}

type RolePermissions = {
  permissions?: PermissionGroup
}

export type UserWithRole = {
  id?: number | string
  role?: number | string | RolePermissions | { id: number; permissions?: PermissionGroup }
  [key: string]: unknown
}

/**
 * Get all permissions from a user's role
 * Returns an array of permission strings that are enabled
 */
export function getUserPermissions(user: UserWithRole | null | undefined): string[] {
  if (!user || !user.role) {
    return []
  }

  const role = typeof user.role === 'object' ? user.role : null
  if (!role) {
    // Role is just an ID, needs to be populated - return empty array
    // In this case, the calling code should populate the role before checking permissions
    return []
  }

  const permissions = (role as RolePermissions).permissions
  if (!permissions) {
    return []
  }

  const permissionKeys: PermissionString[] = [
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
    'freight_view',
    'freight_create',
    'freight_edit',
    'freight_delete',
  ]

  return permissionKeys.filter((key) => permissions[key] === true)
}

/**
 * Check if user has a specific permission
 */
export function hasPermission(
  user: UserWithRole | null | undefined,
  permission: PermissionString,
): boolean {
  if (!user || !user.role) {
    return false
  }

  const role = typeof user.role === 'object' ? user.role : null
  if (!role || !(role as RolePermissions).permissions) {
    return false
  }

  const permissions = (role as RolePermissions).permissions
  return permissions?.[permission] === true
}

/**
 * Check if user has any access to a section (has at least view permission)
 */
export function canAccessSection(user: UserWithRole | null | undefined, section: Section): boolean {
  return hasViewPermission(user, section)
}

/**
 * Check if user has view permission for a section
 */
export function hasViewPermission(
  user: UserWithRole | null | undefined,
  section: Section,
): boolean {
  return hasPermission(user, `${section}_view` as PermissionString)
}

/**
 * Check if user has edit permission for a section
 */
export function hasEditPermission(
  user: UserWithRole | null | undefined,
  section: Section,
): boolean {
  return hasPermission(user, `${section}_edit` as PermissionString)
}

/**
 * Check if user has create permission for a section
 */
export function hasCreatePermission(
  user: UserWithRole | null | undefined,
  section: Section,
): boolean {
  return hasPermission(user, `${section}_create` as PermissionString)
}

/**
 * Check if user has delete permission for a section
 */
export function hasDeletePermission(
  user: UserWithRole | null | undefined,
  section: Section,
): boolean {
  return hasPermission(user, `${section}_delete` as PermissionString)
}

/**
 * Check if user can manage tenant users
 */
export function canManageUsers(user: UserWithRole | null | undefined): boolean {
  return hasPermission(user, 'settings_manage_users')
}

/**
 * Check if user can manage roles
 */
export function canManageRoles(user: UserWithRole | null | undefined): boolean {
  return hasPermission(user, 'settings_manage_roles')
}

/**
 * Check if user is admin (has system role or all permissions)
 */
export function isAdmin(user: UserWithRole | null | undefined): boolean {
  if (!user || !user.role) {
    return false
  }

  const role = typeof user.role === 'object' ? user.role : null
  if (!role) {
    return false
  }

  // Check if it's a system role
  if ((role as { isSystemRole?: boolean }).isSystemRole === true) {
    return true
  }

  // Check if user has all critical permissions (admin typically has all)
  const criticalPermissions: PermissionString[] = [
    'settings_manage_users',
    'settings_manage_roles',
    'dashboard_view',
  ]

  return criticalPermissions.every((perm) => hasPermission(user, perm))
}
