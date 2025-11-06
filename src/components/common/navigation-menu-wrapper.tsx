'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { NavigationMenu } from './navigation-menu'
import { createNavigationItems, getActivePageFromPath } from '@/lib/navigation-config'

// Safe hook for NavigationMenuWrapper - used for tenant users
function useAuthSafe() {
  try {
    return useAuth()
  } catch {
    return { user: null, isAuthenticated: false }
  }
}

export function NavigationMenuWrapper() {
  const { user } = useAuthSafe()
  const pathname = usePathname()
  const router = useRouter()

  if (!user) {
    return null
  }

  const activePage = getActivePageFromPath(pathname)
  const navigationItems = createNavigationItems(activePage)

  return (
    <NavigationMenu
      items={navigationItems}
      onItemClick={(item) => {
        router.push(item.href)
      }}
    />
  )
}
