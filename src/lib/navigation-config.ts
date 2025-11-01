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
      activePage === 'warehouse-zones',
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
