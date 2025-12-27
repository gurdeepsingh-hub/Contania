'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save } from 'lucide-react'
import Link from 'next/link'

type UnifiedLocationOption = {
  value: string | number
  label: string
}

export default function ImportDriverAllocationPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [allocation, setAllocation] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [allLocations, setAllLocations] = useState<UnifiedLocationOption[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string }>>([])
  const [vehicles, setVehicles] = useState<Array<{ id: number; fleetNumber?: string; rego?: string }>>([])
  const [dataLoaded, setDataLoaded] = useState(false)

  // Load locations, drivers, and vehicles for name resolution
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const [
          customersRes,
          payingCustomersRes,
          emptyParksRes,
          wharvesRes,
          warehousesRes,
          driversRes,
          vehiclesRes,
        ] = await Promise.all([
          fetch('/api/customers?limit=1000'),
          fetch('/api/paying-customers?limit=1000'),
          fetch('/api/empty-parks?limit=1000'),
          fetch('/api/wharves?limit=1000'),
          fetch('/api/warehouses?limit=1000'),
          fetch('/api/drivers?limit=1000'),
          fetch('/api/vehicles?limit=1000'),
        ])

        let customersData: Array<{ id: number; customer_name: string }> = []
        let payingCustomersData: Array<{ id: number; customer_name: string }> = []
        let emptyParksData: Array<{ id: number; name: string }> = []
        let wharvesData: Array<{ id: number; name: string }> = []
        let warehousesData: Array<{ id: number; name: string }> = []
        let driversData: Array<{ id: number; name: string }> = []
        let vehiclesData: Array<{ id: number; fleetNumber?: string; rego?: string }> = []

        if (customersRes.ok) {
          const data = await customersRes.json()
          if (data.success) customersData = data.customers || []
        }
        if (payingCustomersRes.ok) {
          const data = await payingCustomersRes.json()
          if (data.success) payingCustomersData = data.payingCustomers || []
        }
        if (emptyParksRes.ok) {
          const data = await emptyParksRes.json()
          if (data.success) emptyParksData = data.emptyParks || []
        }
        if (wharvesRes.ok) {
          const data = await wharvesRes.json()
          if (data.success) wharvesData = data.wharves || []
        }
        if (warehousesRes.ok) {
          const data = await warehousesRes.json()
          if (data.success) warehousesData = data.warehouses || []
        }
        if (driversRes.ok) {
          const data = await driversRes.json()
          if (data.success) driversData = data.drivers || []
        }
        if (vehiclesRes.ok) {
          const data = await vehiclesRes.json()
          if (data.success) vehiclesData = data.vehicles || []
        }

        const all: UnifiedLocationOption[] = [
          ...customersData.map((cust) => ({
            value: `customers:${cust.id}`,
            label: `${cust.customer_name} [Customer]`,
          })),
          ...payingCustomersData.map((cust) => ({
            value: `paying-customers:${cust.id}`,
            label: `${cust.customer_name} [Paying Customer]`,
          })),
          ...emptyParksData.map((ep) => ({
            value: `empty-parks:${ep.id}`,
            label: `${ep.name} [Empty Park]`,
          })),
          ...wharvesData.map((wh) => ({
            value: `wharves:${wh.id}`,
            label: `${wh.name} [Wharf]`,
          })),
          ...warehousesData.map((wh) => ({
            value: `warehouses:${wh.id}`,
            label: `${wh.name} [Warehouse]`,
          })),
        ]
        setAllLocations(all)
        setDrivers(driversData)
        setVehicles(vehiclesData)
        setDataLoaded(true)
      } catch (error) {
        console.error('Error loading data:', error)
        setDataLoaded(true) // Set to true even on error to prevent infinite loading
      }
    }

    loadLocations()
  }, [])

  useEffect(() => {
    if (bookingId) {
      loadData()
    }
  }, [bookingId])

  // Helper function to get location display name
  const getLocationDisplayName = (locationId: number | string | undefined): string => {
    if (!locationId) return '-'

    // If it's already in "collection:id" format, use it directly
    if (typeof locationId === 'string' && locationId.includes(':')) {
      const [collection, idStr] = locationId.split(':')
      const id = parseInt(idStr, 10)
      if (collection && !isNaN(id)) {
        const location = allLocations.find((loc) => {
          const [locCollection, locIdStr] = String(loc.value).split(':')
          return locCollection === collection && parseInt(locIdStr, 10) === id
        })
        return location ? location.label : locationId
      }
      return locationId
    }

    // If it's a number, search all collections for this ID
    const numId = typeof locationId === 'number' ? locationId : parseInt(String(locationId), 10)
    if (!isNaN(numId)) {
      // Search all collections for this ID
      const found = allLocations.find((loc) => {
        const [locCollection, locIdStr] = String(loc.value).split(':')
        return parseInt(locIdStr, 10) === numId
      })
      if (found) {
        return found.label
      }
    }

    // Fallback: return the original value
    return String(locationId)
  }

  // Helper functions to get driver and vehicle names
  const getDriverName = (driverId?: number | string | { id: number; name?: string }): string => {
    if (!driverId && driverId !== 0) return 'Not assigned'
    if (typeof driverId === 'object' && driverId !== null) {
      return driverId.name || 'Unknown'
    }
    // Convert to number if it's a string
    const id = typeof driverId === 'string' ? parseInt(driverId, 10) : Number(driverId)
    if (isNaN(id)) return String(driverId)
    
    // Wait for drivers to load
    if (!dataLoaded) {
      return `Loading...`
    }
    
    const driver = drivers.find((d) => d.id === id)
    return driver ? driver.name : `ID: ${id}`
  }

  const getVehicleName = (vehicleId?: number | string | { id: number; fleetNumber?: string; rego?: string }): string => {
    if (!vehicleId && vehicleId !== 0) return 'Not assigned'
    if (typeof vehicleId === 'object' && vehicleId !== null) {
      return vehicleId.fleetNumber || vehicleId.rego || 'Unknown'
    }
    // Convert to number if it's a string
    const id = typeof vehicleId === 'string' ? parseInt(vehicleId, 10) : Number(vehicleId)
    if (isNaN(id)) return String(vehicleId)
    
    // Wait for vehicles to load
    if (!dataLoaded) {
      return `Loading...`
    }
    
    const vehicle = vehicles.find((v) => v.id === id)
    return vehicle ? (vehicle.fleetNumber || vehicle.rego || 'Unknown') : `ID: ${id}`
  }

  const loadData = async () => {
    try {
      setLoadingData(true)
      const res = await fetch(`/api/import-container-bookings/${bookingId}/driver-allocation`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setAllocation(data.driverAllocation)
        }
      }
    } catch (error) {
      console.error('Error loading driver allocation:', error)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Driver Allocation</h1>
            <p className="text-muted-foreground">Manage driver allocation for this booking</p>
          </div>
        </div>
        <Button>
          <Save className="h-4 w-4 mr-1" />
          Save Changes
        </Button>
      </div>

      {allocation ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {allocation.fullContainer && (
            <Card>
              <CardHeader>
                <CardTitle>Full Container Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {(allocation.fullContainer.legs && allocation.fullContainer.legs.length > 0) ||
                allocation.fullContainer.date ||
                allocation.fullContainer.time ||
                allocation.fullContainer.vehicleId ||
                allocation.fullContainer.driverId ? (
                  <div className="space-y-4">
                    {(allocation.fullContainer.date ||
                      allocation.fullContainer.time ||
                      allocation.fullContainer.vehicleId ||
                      allocation.fullContainer.driverId) && (
                      <div className="border-b pb-3 space-y-2">
                        {allocation.fullContainer.date && (
                          <div className="text-sm">
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(allocation.fullContainer.date).toLocaleDateString()}
                          </div>
                        )}
                        {allocation.fullContainer.time && (
                          <div className="text-sm">
                            <span className="font-medium">Time:</span> {allocation.fullContainer.time}
                          </div>
                        )}
                        {allocation.fullContainer.vehicleId && (
                          <div className="text-sm">
                            <span className="font-medium">Vehicle:</span>{' '}
                            {getVehicleName(allocation.fullContainer.vehicleId)}
                          </div>
                        )}
                        {allocation.fullContainer.driverId && (
                          <div className="text-sm">
                            <span className="font-medium">Driver:</span>{' '}
                            {getDriverName(allocation.fullContainer.driverId)}
                          </div>
                        )}
                      </div>
                    )}
                    {allocation.fullContainer.legs && allocation.fullContainer.legs.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium">Legs</h4>
                        {allocation.fullContainer.legs.map((leg: any, idx: number) => (
                          <div key={idx} className="border rounded-lg p-3">
                            <div className="text-sm space-y-1">
                              <div>
                                <span className="font-medium">From:</span>{' '}
                                {getLocationDisplayName(leg.from)}
                              </div>
                              <div>
                                <span className="font-medium">To:</span> {getLocationDisplayName(leg.to)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No full container allocation configured
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {allocation.emptyContainer && (
            <Card>
              <CardHeader>
                <CardTitle>Empty Container Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {(allocation.emptyContainer.legs && allocation.emptyContainer.legs.length > 0) ||
                allocation.emptyContainer.date ||
                allocation.emptyContainer.time ||
                allocation.emptyContainer.vehicleId ||
                allocation.emptyContainer.driverId ? (
                  <div className="space-y-4">
                    {(allocation.emptyContainer.date ||
                      allocation.emptyContainer.time ||
                      allocation.emptyContainer.vehicleId ||
                      allocation.emptyContainer.driverId) && (
                      <div className="border-b pb-3 space-y-2">
                        {allocation.emptyContainer.date && (
                          <div className="text-sm">
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(allocation.emptyContainer.date).toLocaleDateString()}
                          </div>
                        )}
                        {allocation.emptyContainer.time && (
                          <div className="text-sm">
                            <span className="font-medium">Time:</span>{' '}
                            {allocation.emptyContainer.time}
                          </div>
                        )}
                        {allocation.emptyContainer.vehicleId && (
                          <div className="text-sm">
                            <span className="font-medium">Vehicle:</span>{' '}
                            {getVehicleName(allocation.emptyContainer.vehicleId)}
                          </div>
                        )}
                        {allocation.emptyContainer.driverId && (
                          <div className="text-sm">
                            <span className="font-medium">Driver:</span>{' '}
                            {getDriverName(allocation.emptyContainer.driverId)}
                          </div>
                        )}
                      </div>
                    )}
                    {allocation.emptyContainer.legs &&
                      allocation.emptyContainer.legs.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Legs</h4>
                          {allocation.emptyContainer.legs.map((leg: any, idx: number) => (
                            <div key={idx} className="border rounded-lg p-3">
                              <div className="text-sm space-y-1">
                                <div>
                                  <span className="font-medium">From:</span>{' '}
                                  {String(leg.from || '-')}
                                </div>
                                <div>
                                  <span className="font-medium">To:</span> {String(leg.to || '-')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No empty container allocation configured
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No driver allocation configured</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

