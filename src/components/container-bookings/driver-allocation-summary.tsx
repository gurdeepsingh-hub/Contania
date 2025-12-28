'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Truck, ArrowRight, MapPin } from 'lucide-react'
import Link from 'next/link'

type BookingType = 'import' | 'export'

interface DriverAllocationLeg {
  from?: string | number
  to?: string | number
}

interface DriverAllocationSection {
  date?: string
  time?: string
  vehicleId?: number | { id: number; registrationNumber?: string }
  driverId?: number | { id: number; fullName?: string }
  legs?: DriverAllocationLeg[]
}

interface DriverAllocation {
  emptyContainer?: DriverAllocationSection
  fullContainer?: DriverAllocationSection
}

interface DriverAllocationSummaryProps {
  allocation: DriverAllocation | null
  bookingId: number
  bookingType: BookingType
}

type UnifiedLocationOption = {
  value: string | number
  label: string
}

export function DriverAllocationSummary({
  allocation,
  bookingId,
  bookingType,
}: DriverAllocationSummaryProps) {
  const [allLocations, setAllLocations] = useState<UnifiedLocationOption[]>([])
  const [drivers, setDrivers] = useState<Array<{ id: number; name: string }>>([])
  const [vehicles, setVehicles] = useState<
    Array<{ id: number; fleetNumber?: string; rego?: string }>
  >([])

  // Load locations, drivers, and vehicles for name resolution
  useEffect(() => {
    const loadData = async () => {
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
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }

    loadData()
  }, [])

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

  // Handle both old format (arrays) and new format (objects with legs)
  const emptyLegs = Array.isArray(allocation?.emptyContainer)
    ? allocation.emptyContainer
    : allocation?.emptyContainer?.legs || []
  const fullLegs = Array.isArray(allocation?.fullContainer)
    ? allocation.fullContainer
    : allocation?.fullContainer?.legs || []
  const totalLegs = emptyLegs.length + fullLegs.length

  const emptySection = Array.isArray(allocation?.emptyContainer) ? null : allocation?.emptyContainer
  const fullSection = Array.isArray(allocation?.fullContainer) ? null : allocation?.fullContainer

  const getDriverName = (
    driverId?: number | { id: number; fullName?: string; name?: string },
  ): string => {
    if (!driverId) return 'Not assigned'
    if (typeof driverId === 'object') {
      return driverId.name || driverId.fullName || 'Unknown'
    }
    // Look up driver by ID
    const driver = drivers.find((d) => d.id === driverId)
    return driver ? driver.name : 'Unknown'
  }

  const getVehicleReg = (
    vehicleId?:
      | number
      | { id: number; registrationNumber?: string; fleetNumber?: string; rego?: string },
  ): string => {
    if (!vehicleId) return 'Not assigned'
    if (typeof vehicleId === 'object') {
      return vehicleId.fleetNumber || vehicleId.rego || vehicleId.registrationNumber || 'Unknown'
    }
    // Look up vehicle by ID
    const vehicle = vehicles.find((v) => v.id === vehicleId)
    return vehicle ? vehicle.fleetNumber || vehicle.rego || 'Unknown' : 'Unknown'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Driver Allocation</CardTitle>
            <CardDescription>
              {totalLegs} leg{totalLegs !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <Link
            href={
              bookingType === 'import'
                ? `/dashboard/import-container-bookings/${bookingId}/driver-allocation`
                : `/dashboard/export-container-bookings/${bookingId}/driver-allocation`
            }
          >
            <Button variant="outline" size="sm">
              Manage
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bookingType === 'import' ? (
            <>
              {fullLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Full Container</h4>
                  <div className="space-y-2">
                    {fullLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {getLocationDisplayName(leg.from)} → {getLocationDisplayName(leg.to)}
                        </span>
                      </div>
                    ))}
                    {fullLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{fullLegs.length - 3} more leg{fullLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                    {fullSection &&
                      (fullSection.date ||
                        fullSection.time ||
                        fullSection.vehicleId ||
                        fullSection.driverId) && (
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {fullSection.date && (
                            <div>Date: {new Date(fullSection.date).toLocaleDateString()}</div>
                          )}
                          {fullSection.time && <div>Time: {fullSection.time}</div>}
                          {fullSection.vehicleId && (
                            <div>Vehicle: {getVehicleReg(fullSection.vehicleId)}</div>
                          )}
                          {fullSection.driverId && (
                            <div>Driver: {getDriverName(fullSection.driverId)}</div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              )}
              {emptyLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Empty Container</h4>
                  <div className="space-y-2">
                    {emptyLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {getLocationDisplayName(leg.from)} → {getLocationDisplayName(leg.to)}
                        </span>
                      </div>
                    ))}
                    {emptyLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{emptyLegs.length - 3} more leg{emptyLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                    {emptySection &&
                      (emptySection.date ||
                        emptySection.time ||
                        emptySection.vehicleId ||
                        emptySection.driverId) && (
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {emptySection.date && (
                            <div>Date: {new Date(emptySection.date).toLocaleDateString()}</div>
                          )}
                          {emptySection.time && <div>Time: {emptySection.time}</div>}
                          {emptySection.vehicleId && (
                            <div>Vehicle: {getVehicleReg(emptySection.vehicleId)}</div>
                          )}
                          {emptySection.driverId && (
                            <div>Driver: {getDriverName(emptySection.driverId)}</div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {emptyLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Empty Container</h4>
                  <div className="space-y-2">
                    {emptyLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {getLocationDisplayName(leg.from)} → {getLocationDisplayName(leg.to)}
                        </span>
                      </div>
                    ))}
                    {emptyLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{emptyLegs.length - 3} more leg{emptyLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                    {emptySection &&
                      (emptySection.date ||
                        emptySection.time ||
                        emptySection.vehicleId ||
                        emptySection.driverId) && (
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {emptySection.date && (
                            <div>Date: {new Date(emptySection.date).toLocaleDateString()}</div>
                          )}
                          {emptySection.time && <div>Time: {emptySection.time}</div>}
                          {emptySection.vehicleId && (
                            <div>Vehicle: {getVehicleReg(emptySection.vehicleId)}</div>
                          )}
                          {emptySection.driverId && (
                            <div>Driver: {getDriverName(emptySection.driverId)}</div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              )}
              {fullLegs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Full Container</h4>
                  <div className="space-y-2">
                    {fullLegs.slice(0, 3).map((leg, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {getLocationDisplayName(leg.from)} → {getLocationDisplayName(leg.to)}
                        </span>
                      </div>
                    ))}
                    {fullLegs.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        +{fullLegs.length - 3} more leg{fullLegs.length - 3 !== 1 ? 's' : ''}
                      </p>
                    )}
                    {fullSection &&
                      (fullSection.date ||
                        fullSection.time ||
                        fullSection.vehicleId ||
                        fullSection.driverId) && (
                        <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                          {fullSection.date && (
                            <div>Date: {new Date(fullSection.date).toLocaleDateString()}</div>
                          )}
                          {fullSection.time && <div>Time: {fullSection.time}</div>}
                          {fullSection.vehicleId && (
                            <div>Vehicle: {getVehicleReg(fullSection.vehicleId)}</div>
                          )}
                          {fullSection.driverId && (
                            <div>Driver: {getDriverName(fullSection.driverId)}</div>
                          )}
                        </div>
                      )}
                  </div>
                </div>
              )}
            </>
          )}
          {totalLegs === 0 && (
            <p className="text-muted-foreground text-center py-2">
              No driver allocation configured
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
