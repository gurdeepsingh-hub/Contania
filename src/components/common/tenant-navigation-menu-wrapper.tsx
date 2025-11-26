'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { NavigationMenu } from './navigation-menu'
import { createTenantNavigationItems, getActiveTenantPageFromPath } from '@/lib/navigation-config'
import { getUserPermissions } from '@/lib/permissions'

type TenantUser = {
  id?: number | string
  email?: string
  fullName?: string
  userGroup?: string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export function TenantNavigationMenuWrapper() {
  const pathname = usePathname()
  const router = useRouter()
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if tenant user is authenticated and get user info with role
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.user) {
            setTenantUser(data.user)
            // Get permissions from user's role
            const userPermissions = getUserPermissions(data.user)
            setPermissions(userPermissions)
          }
        }
      } catch (error) {
        // Not authenticated
        setTenantUser(null)
        setPermissions([])
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Don't show navigation if not authenticated or still loading
  if (isLoading || !tenantUser) {
    return null
  }

  // Get active page from pathname
  const activePage = getActiveTenantPageFromPath(pathname)

  // Create navigation items based on permissions
  const navigationItems = createTenantNavigationItems(activePage, permissions)

  // Don't show navigation if there are no items (shouldn't happen, but safety check)
  if (navigationItems.length === 0) {
    return null
  }

  return (
    <NavigationMenu
      items={navigationItems}
      onItemClick={(item) => {
        router.push(item.href)
      }}
    />
  )
}
