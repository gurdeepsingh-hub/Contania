'use client'

import * as React from 'react'
import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { getLogoProps } from '@/lib/logo-config'
import { cn } from '@/lib/utils'
import { useTenant } from '@/lib/tenant-context'
import { useState, useEffect } from 'react'

interface TenantHeaderProps {
  className?: string
}

type TenantUser = {
  id: string | number
  email: string
  fullName?: string
  [key: string]: unknown
}

export function TenantHeader({ className }: TenantHeaderProps) {
  const { tenant } = useTenant()
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if tenant user is authenticated
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (res.ok) {
          const data = await res.json()
          setTenantUser(data.user)
        }
      } catch (error) {
        // Not authenticated
        setTenantUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      // Call logout API to clear server-side cookie
      await fetch('/api/users/logout', {
        method: 'POST',
      })
      
      // Clear client-side state and redirect to login page
      setTenantUser(null)
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
      // Still redirect even if API call fails
      window.location.href = '/'
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
        {/* Left side - Contania Logo */}
        <div className="flex items-center">
          <Logo {...headerLogoProps} href="/" />
        </div>

        {/* Right side - Company Name and Logout */}
        <div className="flex items-center gap-4">
          {tenant && (
            <div className="font-semibold text-lg text-muted-foreground">
              {tenant.companyName}
            </div>
          )}
          
          {!isLoading && tenantUser && (
            <>
              <div className="bg-border w-px h-6" />
              <Button variant="destructivePrimary" size="sm" onClick={handleLogout}>
                <LogOut className="mr-2 size-4" />
                Sign Out
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

