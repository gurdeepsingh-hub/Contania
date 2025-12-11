'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

type Tenant = {
  id: number
  companyName: string
  subdomain: string
  email: string
  [key: string]: any
}

type TenantContextType = {
  tenant: Tenant | null
  loading: boolean
  setTenant: (tenant: Tenant | null) => void
}

const TenantContext = createContext<TenantContextType | undefined>(undefined)

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Extract subdomain from current hostname
    const hostname = window.location.hostname
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://containa.io'
    let rootDomain = 'containa.io'

    try {
       rootDomain = new URL(appUrl).hostname
    } catch (e) {
       // fallback
    }

    // Check if we are on the root domain
    if (
        hostname === rootDomain || 
        hostname === 'www.' + rootDomain || 
        hostname === 'localhost'
    ) {
      setLoading(false)
      return
    }

    let subdomain: string | null = null
    const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
    
    // If we have a match, and the remaining part is the root domain (or localhost for dev)
    if (subdomainMatch) {
        if (subdomainMatch[2] === rootDomain) {
            subdomain = subdomainMatch[1]
        } else if (hostname !== 'localhost' && !hostname.endsWith(rootDomain)) {
            // Handle localhost with subdomain e.g. tenant.localhost
            // But if we are here, hostname is likely tenant.localhost and rootDomain is likely containa.io (if dev env not matching prod)
            // If dev env, we might need looser check. 
            // For now, let's stick to the previous simple logic BUT excluded the root domain case above.
            subdomain = subdomainMatch[1]
        }
    }

    if (!subdomain || subdomain === 'www') {
      setLoading(false)
      return
    }

    // Fetch tenant data
    const fetchTenant = async () => {
      try {
        const res = await fetch(`/api/tenant/current`)
        if (res.ok) {
          const data = await res.json()
          setTenant(data.tenant)
        } else {
          // Log error response for debugging
          const errorData = await res.json().catch(() => ({}))
          console.error('Error fetching tenant:', {
            status: res.status,
            statusText: res.statusText,
            error: errorData,
            subdomain: subdomain
          })
        }
      } catch (error) {
        console.error('Error fetching tenant:', error, { subdomain })
      } finally {
        setLoading(false)
      }
    }

    fetchTenant()
  }, [])

  return (
    <TenantContext.Provider value={{ tenant, loading, setTenant }}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider')
  }
  return context
}

