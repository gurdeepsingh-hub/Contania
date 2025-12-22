import React from 'react'
import { TenantProvider } from '@/lib/tenant-context'
import { TenantHeader } from '@/components/common/tenant-header'
import { TenantNavigationMenuWrapper } from '@/components/common/tenant-navigation-menu-wrapper'
import { TenantTitle } from '@/components/common/tenant-title'
import { Toaster } from 'sonner'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <TenantTitle />
      <TenantHeader />
      <TenantNavigationMenuWrapper />
      <main>{children}</main>
      <Toaster position="top-right" />
    </TenantProvider>
  )
}

