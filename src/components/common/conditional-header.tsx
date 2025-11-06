'use client'

import { useEffect, useState } from 'react'
import { Header } from './header'

export function ConditionalHeader() {
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

  // Don't render Header on subdomains - tenant pages have their own header
  if (!isClient || isSubdomain) {
    return null
  }

  // Only show Header on main domain
  return <Header />
}

