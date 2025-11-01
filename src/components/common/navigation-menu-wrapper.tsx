'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { NavigationMenu } from './navigation-menu'
import { createNavigationItems, getActivePageFromPath } from '@/lib/navigation-config'

export function NavigationMenuWrapper() {
  const { user } = useAuthStore()
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
