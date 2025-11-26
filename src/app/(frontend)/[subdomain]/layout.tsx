import React from 'react'
import { TenantProvider } from '@/lib/tenant-context'
import { TenantHeader } from '@/components/common/tenant-header'
import { TenantNavigationMenuWrapper } from '@/components/common/tenant-navigation-menu-wrapper'
import { Toaster } from 'sonner'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <TenantHeader />
      <TenantNavigationMenuWrapper />
      <main>{children}</main>
      <Toaster position="top-right" />
    </TenantProvider>
  )
}

