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
    const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
    const subdomain = subdomainMatch ? subdomainMatch[1] : null

    if (!subdomain || subdomain === 'www' || subdomain === 'localhost') {
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

