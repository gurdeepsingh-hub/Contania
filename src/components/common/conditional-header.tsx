'use client'

import { useEffect, useState } from 'react'
import { Header } from './header'

export function ConditionalHeader() {
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
      } catch (e) {
        // fallback
      }

      // Check if we are squarely on the root domain
      if (hostname === rootDomain || hostname === 'www.' + rootDomain || hostname === 'localhost') {
         setIsSubdomain(false)
         return
      }

      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      const subdomain = subdomainMatch ? subdomainMatch[1] : null
      
      // If there's a subdomain and it's not 'www' or 'localhost', we're on a tenant subdomain
      // Also ensure we aren't misinterpreting root domain parts as subdomain if regex matched containa.io -> containa
      let isTenantSubdomain = !!(subdomain && subdomain !== 'www' && subdomain !== 'localhost')
      
      if (subdomainMatch && subdomainMatch[2] === rootDomain.split('.').pop()) { 
         // simplistic check, better:
         // If hostname is containa.io, match[1]=containa, match[2]=io.
         // If hostname is tenant.containa.io, match[1]=tenant, match[2]=containa.io
      }

      // Better logic:
      // If the hostname ends with rootDomain and is not equal to rootDomain
      
      if (hostname === rootDomain) {
          isTenantSubdomain = false
      }
      
      setIsSubdomain(isTenantSubdomain)
    }
  }, [])

  // Don't render Header on subdomains - tenant pages have their own header
  if (!isClient || isSubdomain) {
    return null
  }

  // Only show Header on main domain
  return <Header />
}

