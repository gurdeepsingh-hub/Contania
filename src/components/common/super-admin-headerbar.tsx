'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { NavigationMenu, NavigationItem } from './navigation-menu'

// Safe hook to get auth - returns null if not in AuthProvider
function useAuthSafe() {
  try {
    return useAuth()
  } catch {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      login: async () => undefined,
      logout: async () => {},
      checkAuth: async () => {},
      setUser: () => {},
    }
  }
}

export function SuperAdminHeaderbar() {
  const { user } = useAuthSafe()
  const pathname = usePathname()
  const router = useRouter()

  // Only show for authenticated super admin users
  if (!user || (user as { role?: string }).role !== 'superadmin') {
    return null
  }

  // Super admin navigation items - using icons available in NavigationMenu
  const navigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconName: 'LayoutDashboard',
      href: '/super-admin',
      // Only active when exactly on /super-admin, not on sub-pages
      active: pathname === '/super-admin',
    },
    {
      id: 'tenants',
      label: 'Tenants',
      iconName: 'Users2', // Using Users2 as Building2 is not in NavigationMenu iconMap
      href: '/super-admin/tenants',
      // Active when on any tenants page (list or details)
      active: pathname.startsWith('/super-admin/tenants'),
    },
    {
      id: 'settings',
      label: 'Settings',
      iconName: 'Cog',
      href: '/super-admin/settings',
      active: pathname.startsWith('/super-admin/settings'),
    },
  ]

  return (
    <NavigationMenu
      items={navigationItems}
      onItemClick={(item) => {
        router.push(item.href)
      }}
    />
  )
}
