import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { hasPermission, canManageUsers, canManageRoles } from '@/lib/permissions'

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

type PermissionChecker = (user: any) => boolean

type TenantContextResult =
  | { error: string; status: number }
  | { payload: any; tenant: any; currentUser: any }

/**
 * Unified helper function to get tenant context and verify permissions
 * @param request - Next.js request object
 * @param permissionCheck - Optional permission check. Can be:
 *   - A PermissionString to check specific permission
 *   - A PermissionChecker function (e.g., canManageUsers)
 *   - null to skip permission check (just verify tenant membership)
 * @returns Tenant context with payload, tenant, and user, or error object
 */
export async function getTenantContext(
  request: NextRequest,
  permissionCheck?: PermissionString | PermissionChecker | null,
): Promise<TenantContextResult> {
  const payload = await getPayload({ config })
  let subdomain = request.headers.get('x-tenant-subdomain')

  // If subdomain not in header (client-side fetch), extract from hostname
  if (!subdomain) {
    const hostname = request.headers.get('host') || ''
    const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
    subdomain = subdomainMatch ? subdomainMatch[1] : null

    // Ignore 'www' and 'localhost' as subdomains
    if (subdomain === 'www' || subdomain === 'localhost') {
      subdomain = null
    }
  }

  if (!subdomain) {
    return { error: 'No tenant context', status: 401 }
  }

  // Verify user is authenticated
  const { user } = await payload.auth({
    headers: request.headers,
  })

  if (!user) {
    return { error: 'Not authenticated', status: 401 }
  }

  // Verify user is from tenant-users collection
  if ((user as { collection?: string }).collection !== 'tenant-users') {
    return { error: 'Invalid user type', status: 403 }
  }

  // Get tenant from subdomain
  const tenantResult = await payload.find({
    collection: 'tenants',
    where: {
      subdomain: {
        equals: subdomain.toLowerCase(),
      },
    },
    limit: 1,
  })

  if (tenantResult.docs.length === 0) {
    return { error: 'Tenant not found', status: 404 }
  }

  const tenant = tenantResult.docs[0]

  // Verify user belongs to the tenant
  const tenantUser = user as { tenantId?: number | { id: number }; id?: number }
  const tenantUserId =
    typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

  if (tenantUserId !== tenant.id) {
    return { error: 'User does not belong to this tenant', status: 403 }
  }

  // If permission check is requested, verify it
  if (permissionCheck !== null && permissionCheck !== undefined) {
    // Fetch user with role populated to check permissions
    const fullUser = await payload.findByID({
      collection: 'tenant-users',
      id: user.id as number,
      depth: 1,
    })

    let hasAccess = false

    // Check if it's a function (like canManageUsers) or a permission string
    if (typeof permissionCheck === 'function') {
      hasAccess = permissionCheck(fullUser)
    } else {
      // It's a PermissionString
      hasAccess = hasPermission(fullUser, permissionCheck)
    }

    if (!hasAccess) {
      // Generate appropriate error message
      let errorMessage = 'Insufficient permissions'
      if (typeof permissionCheck === 'string') {
        if (permissionCheck === 'settings_entity_settings') {
          errorMessage = 'Insufficient permissions to manage entity settings'
        } else if (permissionCheck === 'settings_manage_users') {
          errorMessage = 'Insufficient permissions to manage tenant users'
        } else if (permissionCheck === 'settings_manage_roles') {
          errorMessage = 'Insufficient permissions to manage roles'
        }
      } else if (permissionCheck === canManageUsers) {
        errorMessage = 'Insufficient permissions to manage tenant users'
      } else if (permissionCheck === canManageRoles) {
        errorMessage = 'Insufficient permissions to manage roles'
      }

      return { error: errorMessage, status: 403 }
    }
  }

  return { payload, tenant, currentUser: user }
}
