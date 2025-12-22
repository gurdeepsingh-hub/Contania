'use client'

import { useEffect } from 'react'
import { useTenant } from '@/lib/tenant-context'

export function TenantTitle() {
  const { tenant, loading } = useTenant()

  useEffect(() => {
    if (!loading) {
      if (tenant?.companyName) {
        document.title = `${tenant.companyName} - Containa - Transport Management System`
      } else {
        document.title = 'Containa - Transport Management System'
      }
    }
  }, [tenant, loading])

  return null
}

