'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { InventorySearchForm } from '@/components/inventory/inventory-search-form'
import { InventoryResultsDisplay } from '@/components/inventory/inventory-results-display'
import { hasViewPermission } from '@/lib/permissions'
import type { AggregatedInventoryItem } from '@/lib/inventory-helpers'

type Warehouse = {
  id: number
  name: string
}

type SearchFilters = {
  customerName: string
  skuId: string
  batch: string
  skuDescription: string
  lpn: string
  expiry: string
  containerNumber: string
  customerReference: string
  inboundOrderNumber: string
  attribute1: string
  attribute2: string
  locationFrom: string
  locationTo: string
}

export default function InventoryPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(null)
  const [results, setResults] = useState<AggregatedInventoryItem[]>([])
  const [loadingWarehouses, setLoadingWarehouses] = useState(false)
  const [loadingResults, setLoadingResults] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentFilters, setCurrentFilters] = useState<SearchFilters | null>(null)
  const [currentUser, setCurrentUser] = useState<{
    id?: number
    role?: number | string | { id: number; permissions?: Record<string, boolean> }
  } | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
              if (!hasViewPermission(fullUserData.user, 'inventory')) {
                router.push('/dashboard')
                return
              }
            }
          } else {
            setCurrentUser(data.user)
          }
          setAuthChecked(true)
        }
      } catch (error) {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (tenant && authChecked) {
      loadWarehouses()
    }
  }, [tenant, authChecked])

  const loadWarehouses = async () => {
    try {
      setLoadingWarehouses(true)
      // Fetch warehouses with inventory_view permission (less restrictive than settings)
      const res = await fetch('/api/warehouses?limit=100')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setWarehouses(data.warehouses || [])
          // Auto-select first warehouse if only one
          if (data.warehouses && data.warehouses.length === 1) {
            setSelectedWarehouseId(data.warehouses[0].id)
          }
        }
      } else {
        // If permission denied, try to fetch with basic auth
        console.warn('Could not load warehouses, permission may be insufficient')
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    } finally {
      setLoadingWarehouses(false)
    }
  }

  const handleSearch = async (filters?: SearchFilters) => {
    if (!selectedWarehouseId) {
      return
    }

    // Store current filters for refresh
    if (filters) {
      setCurrentFilters(filters)
    }

    try {
      setLoadingResults(true)
      const res = await fetch('/api/inventory/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          warehouseId: selectedWarehouseId,
          ...(filters || currentFilters || {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setResults(data.results || [])
        }
      } else {
        const error = await res.json()
        console.error('Search error:', error)
      }
    } catch (error) {
      console.error('Error searching inventory:', error)
    } finally {
      setLoadingResults(false)
    }
  }

  const handleRefresh = () => {
    handleSearch(currentFilters || undefined)
  }

  if (loading || !authChecked || loadingWarehouses) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Tenant not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Inventory Management</h1>
        <p className="text-muted-foreground">Search and manage your inventory across warehouses</p>
      </div>

      {/* Warehouse Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Warehouse</CardTitle>
          <CardDescription>Choose a warehouse to view inventory</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="warehouse">Warehouse</Label>
            <Select
              id="warehouse"
              value={selectedWarehouseId?.toString() || ''}
              onChange={(e) => {
                const warehouseId = e.target.value ? Number(e.target.value) : null
                setSelectedWarehouseId(warehouseId)
                setResults([]) // Clear results when warehouse changes
              }}
            >
              <option value="">Select a warehouse...</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Search Form */}
      {selectedWarehouseId && (
        <>
          <InventorySearchForm
            warehouseId={selectedWarehouseId}
            onSearch={handleSearch}
            loading={loadingResults}
          />

          {/* Results */}
          {results.length > 0 && (
            <InventoryResultsDisplay
              results={results}
              loading={loadingResults}
              currentUser={currentUser}
              onRefresh={handleRefresh}
            />
          )}
        </>
      )}

      {selectedWarehouseId && results.length === 0 && !loadingResults && (
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-muted-foreground">
              Select search criteria and click Search to view inventory.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

