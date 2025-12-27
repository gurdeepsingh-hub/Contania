interface NavigationItem {
  id: string
  label: string
  href: string
  iconName: string
  active: boolean
  disabled?: boolean
}

// Shared navigation configuration following official Next.js patterns
// This ensures consistency across all pages and follows the DRY principle
export const createNavigationItems = (activePage?: string): NavigationItem[] => [
  {
    id: 'dashboard',
    label: 'Dashboard',
    iconName: 'LayoutDashboard',
    href: '/dashboard',
    active: activePage === 'dashboard',
  },
  {
    id: 'containers',
    label: 'Containers',
    iconName: 'Container',
    href: '/containers',
    active: activePage === 'containers',
  },

  {
    id: 'warehouse-inventory',
    label: 'Inventory',
    iconName: 'Package',
    href: '/warehouse-inventory',
    active: activePage === 'warehouse-inventory',
  },
  {
    id: 'transportation',
    label: 'Transportation',
    iconName: 'Truck',
    href: '/transportation',
    active: activePage === 'transportation',
  },
  {
    id: 'map',
    label: 'Live Map',
    iconName: 'Map',
    href: '/map',
    active: activePage === 'map',
  },
  {
    id: 'reports',
    label: 'Reports',
    iconName: 'FileText',
    href: '/reports',
    active: activePage === 'reports',
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'Cog',
    href: '/settings',
    active:
      activePage === 'settings' ||
      activePage === 'entity-settings' ||
      activePage === 'customers' ||
      activePage === 'wharves' ||
      activePage === 'vessels' ||
      activePage === 'empty-parks' ||
      activePage === 'shipping-lines' ||
      activePage === 'warehouses' ||
      activePage === 'warehouse-zones' ||
      activePage === 'delay-points' ||
      activePage === 'container-sizes' ||
      activePage === 'container-weights' ||
      activePage === 'damage-codes' ||
      activePage === 'detention-control',
  },
]

// Helper function to get the active page from the current pathname
export const getActivePageFromPath = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean)
  return segments[0] || 'dashboard'
}

// Helper function to create navigation items with automatic active state
export const createNavigationItemsWithPath = (pathname: string): NavigationItem[] => {
  const activePage = getActivePageFromPath(pathname)
  return createNavigationItems(activePage)
}

// Tenant navigation configuration
export const createTenantNavigationItems = (
  activePage?: string,
  permissions?: string[]
): NavigationItem[] => {
  const items: NavigationItem[] = []

  // Dashboard - show if user has dashboard_view permission
  if (!permissions || permissions.includes('dashboard_view')) {
    items.push({
      id: 'dashboard',
      label: 'Dashboard',
      iconName: 'LayoutDashboard',
      href: '/dashboard',
      active: activePage === 'dashboard',
    })
  }

  // Freight - show if user has freight_view permission
  if (!permissions || permissions.includes('freight_view')) {
    items.push({
      id: 'freight',
      label: 'Freight',
      iconName: 'Truck',
      href: '/dashboard/freight',
      active: activePage === 'freight' || (activePage?.startsWith('freight-') ?? false),
    })
  }

  // Inventory - show if user has inventory_view permission
  if (!permissions || permissions.includes('inventory_view')) {
    items.push({
      id: 'inventory',
      label: 'Inventory',
      iconName: 'Package',
      href: '/dashboard/inventory',
      active: activePage === 'inventory' || (activePage?.startsWith('inventory-') ?? false),
    })
  }

  // Container Bookings - show if user has containers_view permission
  if (!permissions || permissions.includes('containers_view')) {
    items.push({
      id: 'container-bookings',
      label: 'Container Bookings',
      iconName: 'Container',
      href: '/dashboard/container-bookings',
      active:
        activePage === 'container-bookings' ||
        activePage === 'container-bookings-import' ||
        activePage === 'container-bookings-export' ||
        (activePage?.startsWith('container-bookings-') ?? false),
    })
  }

  // Settings - show if user has settings_view permission
  if (!permissions || permissions.includes('settings_view')) {
    items.push({
      id: 'settings',
      label: 'Settings',
      iconName: 'Cog',
      href: '/dashboard/settings',
      active: activePage === 'settings' || (activePage?.startsWith('settings-') ?? false),
    })
  }

  return items
}

// Helper function to get the active page from tenant pathname
export const getActiveTenantPageFromPath = (pathname: string): string => {
  const segments = pathname.split('/').filter(Boolean)
  // Handle /dashboard and /dashboard/* routes
  if (segments.length >= 2 && segments[0] === 'dashboard') {
    if (segments[1] === 'settings') {
      // Handle /dashboard/settings and sub-routes
      if (segments.length >= 3) {
        return `settings-${segments[2]}` // e.g., settings-user-roles, settings-tenant-users
      }
      return 'settings'
    }
    if (segments[1] === 'freight') {
      // Handle /dashboard/freight and sub-routes
      if (segments.length >= 3) {
        return `freight-${segments[2]}` // e.g., freight-inbound
      }
      return 'freight'
    }
    if (segments[1] === 'inventory') {
      // Handle /dashboard/inventory and sub-routes
      if (segments.length >= 3) {
        return `inventory-${segments[2]}` // e.g., inventory-batch
      }
      return 'inventory'
    }
    if (segments[1] === 'container-bookings') {
      // Handle /dashboard/container-bookings and sub-routes
      if (segments.length >= 3) {
        if (segments[2] === 'import-container-bookings' || segments[2] === 'export-container-bookings') {
          return `container-bookings-${segments[2].replace('container-bookings', '').replace('-', '')}`
        }
        return `container-bookings-${segments[2]}`
      }
      return 'container-bookings'
    }
    if (segments[1] === 'import-container-bookings' || segments[1] === 'export-container-bookings') {
      return `container-bookings-${segments[1].replace('container-bookings', '').replace('-', '')}`
    }
    return segments[1] || 'dashboard'
  }
  return segments[0] || 'dashboard'
}