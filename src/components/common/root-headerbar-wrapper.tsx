'use client'

import { useEffect, useState } from 'react'
import { SuperAdminHeaderbar } from './super-admin-headerbar'

export function RootHeaderbarWrapper() {
  const [isSubdomain, setIsSubdomain] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Check if we're on a subdomain
    // Check if we're on a subdomain
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://containa.io'
      let rootDomain = 'containa.io'
      
      try {
        rootDomain = new URL(appUrl).hostname
      } catch (e) { /* ignore */ }

      // Check if we are on the root domain directly
      if (hostname === rootDomain || hostname === 'www.' + rootDomain || hostname === 'localhost') {
         setIsSubdomain(false)
         return
      }

      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      const subdomain = subdomainMatch ? subdomainMatch[1] : null
      
      // If there's a subdomain and it's not 'www' or 'localhost', we're on a tenant subdomain
      // Additionally, ensure we aren't matching the TLD of the root domain as a subdomain
      // (e.g. containa.io -> containa shouldn't happen if we caught it above, but double check)
      const isTenantSubdomain = !!(subdomain && subdomain !== 'www' && subdomain !== 'localhost' && hostname !== rootDomain)
      
      setIsSubdomain(isTenantSubdomain)
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

