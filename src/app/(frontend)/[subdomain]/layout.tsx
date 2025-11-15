import React from 'react'
import { TenantProvider } from '@/lib/tenant-context'
import { TenantHeader } from '@/components/common/tenant-header'
import { TenantNavigationMenuWrapper } from '@/components/common/tenant-navigation-menu-wrapper'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <TenantHeader />
      <TenantNavigationMenuWrapper />
      <main>{children}</main>
    </TenantProvider>
  )
}

