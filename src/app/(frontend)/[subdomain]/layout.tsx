import React from 'react'
import { TenantProvider } from '@/lib/tenant-context'
import { TenantHeader } from '@/components/common/tenant-header'
import { NavigationMenuWrapper } from '@/components/common/navigation-menu-wrapper'

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <TenantHeader />
      <NavigationMenuWrapper />
      <main>{children}</main>
    </TenantProvider>
  )
}

