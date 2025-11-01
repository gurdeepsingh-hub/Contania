'use client'

import * as React from 'react'
import { LogOut, Settings, Bell, Search, Users } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/ui/logo'
import { getLogoProps } from '@/lib/logo-config'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
// import { TenantSelector } from "@/components/ui/tenant-selector"

interface HeaderProps {
  className?: string
  notifications?: number
}

export function Header({ className, notifications = 0 }: HeaderProps) {
  const { user, logout } = useAuthStore()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (_error) {
      // Logout failed
    }
  }

  // Get unified header logo configuration
  const headerLogoProps = getLogoProps('header')

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
        <div className="flex items-center">
          <Logo {...headerLogoProps} href="/" />
        </div>

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
              <Button variant="ghost" size="sm" asChild>
                <Link href="/signin">Sign In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">Get Started</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
