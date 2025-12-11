'use client'

import { useEffect, useState } from 'react'
import { AuthProvider } from '@/lib/auth-context'

export function ConditionalAuthProvider({ children }: { children: React.ReactNode }) {
  const [isSubdomain, setIsSubdomain] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Check if we're on a subdomain by examining hostname
    // Check if we're on a subdomain by examining hostname
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://containa.io'
      let rootDomain = 'containa.io'
      
      try {
        rootDomain = new URL(appUrl).hostname
      } catch (e) { /* ignore */ }

      if (hostname === rootDomain || hostname === 'www.' + rootDomain || hostname === 'localhost') {
         setIsSubdomain(false)
         return
      }

      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      const subdomain = subdomainMatch ? subdomainMatch[1] : null
      
      // If there's a subdomain and it's not 'www' or 'localhost', we're on a tenant subdomain
      setIsSubdomain(!!(subdomain && subdomain !== 'www' && subdomain !== 'localhost' && hostname !== rootDomain))
    }
  }, [])

  // On server or during hydration, default to showing AuthProvider
  // This prevents hydration mismatches
  if (!isClient) {
    return <AuthProvider>{children}</AuthProvider>
  }

  // Only wrap with AuthProvider if NOT on a subdomain
  // On subdomains, tenant authentication is handled separately
  if (isSubdomain) {
    return <>{children}</>
  }

  return <AuthProvider>{children}</AuthProvider>
}

