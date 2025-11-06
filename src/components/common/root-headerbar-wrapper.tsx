'use client'

import { useEffect, useState } from 'react'
import { SuperAdminHeaderbar } from './super-admin-headerbar'

export function RootHeaderbarWrapper() {
  const [isSubdomain, setIsSubdomain] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Check if we're on a subdomain
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      const subdomain = subdomainMatch ? subdomainMatch[1] : null
      
      // If there's a subdomain and it's not 'www' or 'localhost', we're on a tenant subdomain
      setIsSubdomain(!!(subdomain && subdomain !== 'www' && subdomain !== 'localhost'))
    }
  }, [])

  // Don't render on subdomains - tenant pages have their own layout
  if (!isClient || isSubdomain) {
    return null
  }

  // On root domain, only show headerbar for super admin users
  // SuperAdminHeaderbar handles its own visibility check
  return <SuperAdminHeaderbar />
}

