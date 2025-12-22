'use client'

import * as React from 'react'
import { LogOut, Settings, Bell, Search, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/ui/logo'
import { getLogoProps } from '@/lib/logo-config'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { useTenant } from '@/lib/tenant-context'
// import { TenantSelector } from "@/components/ui/tenant-selector"

interface HeaderProps {
  className?: string
  notifications?: number
}

// Safe hook to get tenant - returns null if not in TenantProvider
function useTenantSafe() {
  try {
    return useTenant()
  } catch {
    return { tenant: null, loading: false, setTenant: () => {} }
  }
}

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

export function Header({ className, notifications = 0 }: HeaderProps) {
  const { user, logout } = useAuthSafe()
  const { tenant } = useTenantSafe()

  const handleLogout = async () => {
    try {
      await logout()
      // Redirect to home page after logout
      window.location.href = '/'
    } catch (_error) {
      // Logout failed, still redirect
      window.location.href = '/'
    }
  }

  // Get unified header logo configuration
  const headerLogoProps = getLogoProps('header')

  // Show tenant company name on subdomain, otherwise show Containa logo
  const brandDisplay = tenant ? (
    <Link href="/" className="font-semibold text-lg hover:opacity-90 transition-opacity">
      {tenant.companyName}
    </Link>
  ) : (
    <Logo {...headerLogoProps} href="/" />
  )

  return (
    <header
      data-slot="header"
      className={cn(
        'top-0 z-50 sticky bg-background/95 supports-[backdrop-filter]:bg-background/60 backdrop-blur border-b w-full',
        className,
      )}
    >
      <div className="flex justify-between items-center mx-auto px-6 sm:px-8 lg:px-12 max-w-7xl h-16">
        {/* Logo and Brand */}
        <div className="flex items-center">{brandDisplay}</div>

        {/* User Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Tenant Selector - Show when authenticated */}
          {user && (
            <>
              {/* <TenantSelector /> */}
              <div className="bg-border w-px h-6" /> {/* Divider */}
              {/* Search */}
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Search className="w-4 h-4" />
              </Button>
              {/* Notifications */}
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-4 h-4" />
                {notifications > 0 && (
                  <Badge
                    variant="destructive"
                    className="-top-1 -right-1 absolute p-0 rounded-full size-5 text-xs"
                  >
                    {notifications > 99 ? '99+' : notifications}
                  </Badge>
                )}
              </Button>
              {/* Settings */}
              <Button variant="ghost" size="icon" className="hidden sm:flex">
                <Settings className="w-4 h-4" />
              </Button>
            </>
          )}

          {/* User Menu - Show authenticated user or public buttons */}
          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex justify-center items-center bg-primary rounded-full w-8 h-8">
                <Users className="w-4 h-4 text-primary-foreground" />
              </div>
              <Button variant="destructivePrimary" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Button size="sm" asChild>
                <Link href="/onboarding">Sign Up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
