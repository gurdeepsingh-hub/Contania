'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InventoryResultsDisplay } from '@/components/inventory/inventory-results-display'
import { ArrowLeft } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import type { AggregatedInventoryItem } from '@/lib/inventory-helpers'
import Link from 'next/link'

export default function InventoryDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [results, setResults] = useState<AggregatedInventoryItem[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([])
  const [currentUser, setCurrentUser] = useState<any>(null)

  const filterType = params.filterType as string
  const filterValue = decodeURIComponent(params.filterValue as string)

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
    if (authChecked && filterType && filterValue) {
      loadWarehouses()
    }
  }, [authChecked, filterType, filterValue])

  useEffect(() => {
    if (warehouses.length > 0 && filterType && filterValue) {
      loadFilteredInventory()
    }
  }, [warehouses, filterType, filterValue])

  const loadWarehouses = async () => {
    try {
      const res = await fetch('/api/warehouses')
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setWarehouses(data.warehouses || [])
        }
      }
    } catch (error) {
      console.error('Error loading warehouses:', error)
    }
  }

  const loadFilteredInventory = async () => {
    try {
      setLoadingResults(true)

      // Build filters based on filterType
      const filters: any = {}

      switch (filterType) {
        case 'batch':
          filters.batch = filterValue
          break
        case 'lpn':
          filters.lpn = filterValue
          break
        case 'location':
          filters.locationFrom = filterValue
          filters.locationTo = filterValue
          break
        case 'inbound-order':
          filters.inboundOrderNumber = filterValue
          break
        case 'customer-reference':
          filters.customerReference = filterValue
          break
        case 'container':
          filters.containerNumber = filterValue
          break
        case 'status':
          // Status filtering would need to be done on the results
          // For now, we'll search all and filter client-side
          break
        default:
          return
      }

      // Search across all warehouses for this filter
      const allResults: AggregatedInventoryItem[] = []

      for (const warehouse of warehouses) {
        const res = await fetch('/api/inventory/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            warehouseId: warehouse.id,
            ...filters,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.results) {
            // If filtering by status, filter results client-side
            if (filterType === 'status') {
              const filtered = data.results.filter((item: AggregatedInventoryItem) =>
                item.status.includes(filterValue)
              )
              allResults.push(...filtered)
            } else {
              allResults.push(...data.results)
            }
          }
        }
      }

      setResults(allResults)
    } catch (error) {
      console.error('Error loading filtered inventory:', error)
    } finally {
      setLoadingResults(false)
    }
  }

  const getFilterLabel = () => {
    switch (filterType) {
      case 'batch':
        return `Batch: ${filterValue}`
      case 'lpn':
        return `LPN: ${filterValue}`
      case 'location':
        return `Location: ${filterValue}`
      case 'inbound-order':
        return `Inbound Order: ${filterValue}`
      case 'customer-reference':
        return `Customer Reference: ${filterValue}`
      case 'container':
        return `Container: ${filterValue}`
      case 'status':
        return `Status: ${filterValue}`
      default:
        return filterValue
    }
  }

  if (loading || !authChecked) {
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
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/inventory">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Inventory
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mt-4">{getFilterLabel()}</h1>
          <p className="text-muted-foreground">Filtered inventory results</p>
        </div>
      </div>

      <InventoryResultsDisplay
        results={results}
        loading={loadingResults}
        currentUser={currentUser}
        onRefresh={loadFilteredInventory}
      />
    </div>
  )
}

