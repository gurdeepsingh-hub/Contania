'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

type Vehicle = {
  id: number
  rego?: string
  fleetNumber?: string
  make?: string
  model?: string
}

type Driver = {
  id: number
  name?: string
  phoneNumber?: string
}

type RoutingLeg = {
  from: string | number
  to: string | number
}

type UnifiedLocationOption = {
  value: string | number
  label: string
}

type DriverAllocationData = {
  emptyContainer?: {
    date?: string
    time?: string
    vehicleId?: number
    driverId?: number
    legs?: RoutingLeg[]
  }
  fullContainer?: {
    date?: string
    time?: string
    vehicleId?: number
    driverId?: number
    legs?: RoutingLeg[]
  }
}

interface DriverAllocationSectionProps {
  order: 'full-first' | 'empty-first'
  formData: DriverAllocationData
  routingData?: {
    emptyRouting?: {
      pickupLocationId?: number | string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
    }
    fullRouting?: {
      pickupLocationId?: number | string
      viaLocations?: (number | string)[]
      dropoffLocationId?: number | string
    }
  }
  step3Data?: {
    fromId?: number | string
    toId?: number | string
  }
  onUpdate: (data: Partial<DriverAllocationData>) => void
  errors?: Record<string, string>
}

export function DriverAllocationSection({
  order,
  formData,
  routingData,
  step3Data,
  onUpdate,
  errors,
}: DriverAllocationSectionProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [customers, setCustomers] = useState<Array<{ id: number; customer_name: string }>>([])
  const [payingCustomers, setPayingCustomers] = useState<
    Array<{ id: number; customer_name: string }>
  >([])
  const [emptyParks, setEmptyParks] = useState<Array<{ id: number; name: string }>>([])
  const [wharves, setWharves] = useState<Array<{ id: number; name: string }>>([])
  const [allLocations, setAllLocations] = useState<UnifiedLocationOption[]>([])
  const [loading, setLoading] = useState(false)

  // Helper function to get location display name from "collection:id" format
  const getLocationDisplayName = (locationId: number | string | undefined): string => {
    if (!locationId) return ''

    const locationValue = typeof locationId === 'string' ? locationId : `customers:${locationId}`
    const [collection, idStr] = locationValue.split(':')
    const id = parseInt(idStr, 10)

    if (!collection || !id) return String(locationId)

    // Find in allLocations
    const location = allLocations.find((loc) => {
      const [locCollection, locIdStr] = String(loc.value).split(':')
      return locCollection === collection && parseInt(locIdStr, 10) === id
    })

    return location ? location.label : String(locationId)
  }

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [
        vehiclesRes,
        driversRes,
        customersRes,
        payingCustomersRes,
        emptyParksRes,
        wharvesRes,
      ] = await Promise.all([
        fetch('/api/vehicles?limit=100'),
        fetch('/api/drivers?limit=100'),
        fetch('/api/customers?limit=100'),
        fetch('/api/paying-customers?limit=100'),
        fetch('/api/empty-parks?limit=100'),
        fetch('/api/wharves?limit=100'),
      ])

      // Get data directly from responses before updating state
      let vehiclesData: Vehicle[] = []
      let driversData: Driver[] = []
      let customersData: Array<{ id: number; customer_name: string }> = []
      let payingCustomersData: Array<{ id: number; customer_name: string }> = []
      let emptyParksData: Array<{ id: number; name: string }> = []
      let wharvesData: Array<{ id: number; name: string }> = []

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json()
        if (data.success && data.vehicles) {
          vehiclesData = data.vehicles || []
          setVehicles(vehiclesData)
        }
      }
      if (driversRes.ok) {
        const data = await driversRes.json()
        if (data.success && data.drivers) {
          driversData = data.drivers || []
          setDrivers(driversData)
        }
      }
      if (customersRes.ok) {
        const data = await customersRes.json()
        customersData = data.customers || []
        setCustomers(customersData)
      }
      if (payingCustomersRes.ok) {
        const data = await payingCustomersRes.json()
        payingCustomersData = data.payingCustomers || []
        setPayingCustomers(payingCustomersData)
      }
      if (emptyParksRes.ok) {
        const data = await emptyParksRes.json()
        emptyParksData = data.emptyParks || []
        setEmptyParks(emptyParksData)
      }
      if (wharvesRes.ok) {
        const data = await wharvesRes.json()
        wharvesData = data.wharves || []
        setWharves(wharvesData)
      }

      // Create all locations list (customers, paying-customers, empty-parks, wharves)
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
      ]
      setAllLocations(all)
    } catch (error) {
      console.error('Error loading options:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  // Track if we've already initialized legs to prevent infinite loops
  const initializedRef = useRef(false)
  const routingDataRef = useRef<string>('')
  const step3DataRef = useRef<string>('')

  // Generate legs from routing data
  useEffect(() => {
    // Create stable string representations for comparison
    const routingKey = JSON.stringify({
      emptyRouting: routingData?.emptyRouting,
      fullRouting: routingData?.fullRouting,
      order,
    })
    const step3Key = JSON.stringify({
      fromId: step3Data?.fromId,
      toId: step3Data?.toId,
    })

    // Skip if data hasn't changed
    if (
      routingDataRef.current === routingKey &&
      step3DataRef.current === step3Key &&
      initializedRef.current
    ) {
      return
    }

    // Skip if legs already exist (user may have manually edited them)
    if (
      (formData.emptyContainer?.legs && formData.emptyContainer.legs.length > 0) ||
      (formData.fullContainer?.legs && formData.fullContainer.legs.length > 0)
    ) {
      routingDataRef.current = routingKey
      step3DataRef.current = step3Key
      initializedRef.current = true
      return
    }

    if (routingData && step3Data?.fromId && step3Data?.toId) {
      const emptyLegs: RoutingLeg[] = []
      const fullLegs: RoutingLeg[] = []

      if (order === 'full-first') {
        // Import: Full → Empty
        // Generate empty legs first to get the last To for full container's first From
        // Empty: From Step 4 empty pickup → Via → To Step 3 From
        if (routingData.emptyRouting) {
          const via = routingData.emptyRouting.viaLocations || []
          const pickupLocationId = routingData.emptyRouting.pickupLocationId
          const dropoffLocationId = routingData.emptyRouting.dropoffLocationId || step3Data.fromId

          if (via.length === 0) {
            // No via locations: single leg from pickup to Step 3 From
            if (pickupLocationId) {
              emptyLegs.push({
                from: pickupLocationId,
                to: dropoffLocationId,
              })
            }
          } else {
            // Has via locations: create legs through vias
            let currentFrom = pickupLocationId
            if (!currentFrom) {
              // If no pickup location, skip empty legs
            } else {
              via.forEach((viaLoc) => {
                if (viaLoc && currentFrom) {
                  emptyLegs.push({
                    from: currentFrom,
                    to: viaLoc,
                  })
                  currentFrom = viaLoc
                }
              })
              // Final leg to dropoff
              if (dropoffLocationId) {
                emptyLegs.push({
                  from: currentFrom,
                  to: dropoffLocationId,
                })
              }
            }
          }
        }

        // Full: From last To of empty section → Via → To Step 3 To
        if (routingData.fullRouting) {
          const via = routingData.fullRouting.viaLocations || []
          const dropoffLocationId = routingData.fullRouting.dropoffLocationId || step3Data.toId
          // First From = last To of empty section (or Step 3 From if no empty legs)
          const lastEmptyTo =
            emptyLegs.length > 0
              ? emptyLegs[emptyLegs.length - 1].to
              : routingData.emptyRouting?.dropoffLocationId || step3Data.fromId

          if (via.length === 0) {
            // No via locations: single leg from last empty To to Step 3 To
            fullLegs.push({
              from: lastEmptyTo,
              to: dropoffLocationId,
            })
          } else {
            // Has via locations: create legs through vias
            let currentFrom = lastEmptyTo
            via.forEach((viaLoc) => {
              fullLegs.push({
                from: currentFrom,
                to: viaLoc,
              })
              currentFrom = viaLoc
            })
            // Final leg to dropoff
            fullLegs.push({
              from: currentFrom,
              to: dropoffLocationId,
            })
          }
        }
      } else {
        // Export: Empty → Full
        // Empty: From Step 4 empty pickup → Via → To Step 3 From
        if (routingData.emptyRouting) {
          const via = routingData.emptyRouting.viaLocations || []
          const pickupLocationId = routingData.emptyRouting.pickupLocationId || step3Data.fromId
          const dropoffLocationId = routingData.emptyRouting.dropoffLocationId || step3Data.fromId

          if (via.length === 0) {
            // No via locations: single leg from pickup to Step 3 From
            emptyLegs.push({
              from: pickupLocationId,
              to: dropoffLocationId,
            })
          } else {
            // Has via locations: create legs through vias
            let currentFrom = pickupLocationId
            via.forEach((viaLoc) => {
              emptyLegs.push({
                from: currentFrom,
                to: viaLoc,
              })
              currentFrom = viaLoc
            })
            // Final leg to dropoff
            emptyLegs.push({
              from: currentFrom,
              to: dropoffLocationId,
            })
          }
        }

        // Full: From last Empty To → Via → To Step 3 To
        if (routingData.fullRouting) {
          const via = routingData.fullRouting.viaLocations || []
          const lastEmptyTo =
            emptyLegs.length > 0
              ? emptyLegs[emptyLegs.length - 1].to
              : routingData.emptyRouting?.dropoffLocationId || step3Data.fromId
          const dropoffLocationId = routingData.fullRouting.dropoffLocationId || step3Data.toId

          if (via.length === 0) {
            // No via locations: single leg from last empty to to Step 3 To
            fullLegs.push({
              from: lastEmptyTo,
              to: dropoffLocationId,
            })
          } else {
            // Has via locations: create legs through vias
            let currentFrom = lastEmptyTo
            via.forEach((viaLoc) => {
              fullLegs.push({
                from: currentFrom,
                to: viaLoc,
              })
              currentFrom = viaLoc
            })
            // Final leg to dropoff
            fullLegs.push({
              from: currentFrom,
              to: dropoffLocationId,
            })
          }
        }
      }

      // Only update if legs don't exist yet and we have legs to add
      // Always include both sections to preserve existing data
      const updates: Partial<DriverAllocationData> = {}
      let needsUpdate = false

      if (emptyLegs.length > 0 && !formData.emptyContainer?.legs) {
        updates.emptyContainer = {
          ...formData.emptyContainer,
          legs: emptyLegs,
        }
        needsUpdate = true
      } else {
        updates.emptyContainer = formData.emptyContainer || {}
      }

      if (fullLegs.length > 0 && !formData.fullContainer?.legs) {
        updates.fullContainer = {
          ...formData.fullContainer,
          legs: fullLegs,
        }
        needsUpdate = true
      } else {
        updates.fullContainer = formData.fullContainer || {}
      }

      if (needsUpdate) {
        onUpdate(updates)
      }

      // Update refs after processing
      routingDataRef.current = routingKey
      step3DataRef.current = step3Key
      initializedRef.current = true
    }
  }, [
    routingData,
    step3Data,
    order,
    formData.emptyContainer?.legs,
    formData.fullContainer?.legs,
    onUpdate,
  ])

  const updateSectionField = (
    section: 'emptyContainer' | 'fullContainer',
    field: 'date' | 'time' | 'vehicleId' | 'driverId',
    value: any,
  ) => {
    const sectionData = formData[section] || {}
    const otherSection = section === 'emptyContainer' ? 'fullContainer' : 'emptyContainer'
    
    // Always include both sections to preserve the other section's data
    onUpdate({
      [section]: {
        ...sectionData,
        [field]: value,
      },
      [otherSection]: formData[otherSection] || {},
    })
  }

  const updateLeg = (
    section: 'emptyContainer' | 'fullContainer',
    legIndex: number,
    field: keyof RoutingLeg,
    value: any,
  ) => {
    const sectionData = formData[section] || { legs: [] }
    const legs = [...(sectionData.legs || [])]
    legs[legIndex] = { ...legs[legIndex], [field]: value }
    const otherSection = section === 'emptyContainer' ? 'fullContainer' : 'emptyContainer'
    
    // Always include both sections to preserve the other section's data
    onUpdate({ 
      [section]: { ...sectionData, legs },
      [otherSection]: formData[otherSection] || {},
    })
  }

  const addLeg = (section: 'emptyContainer' | 'fullContainer') => {
    const sectionData = formData[section] || { legs: [] }
    const legs = [...(sectionData.legs || []), { from: '', to: '' }]
    const otherSection = section === 'emptyContainer' ? 'fullContainer' : 'emptyContainer'
    
    // Always include both sections to preserve the other section's data
    onUpdate({ 
      [section]: { ...sectionData, legs },
      [otherSection]: formData[otherSection] || {},
    })
  }

  const removeLeg = (section: 'emptyContainer' | 'fullContainer', legIndex: number) => {
    const sectionData = formData[section] || { legs: [] }
    const legs = sectionData.legs?.filter((_, i) => i !== legIndex) || []
    const otherSection = section === 'emptyContainer' ? 'fullContainer' : 'emptyContainer'
    
    // Always include both sections to preserve the other section's data
    onUpdate({ 
      [section]: { ...sectionData, legs },
      [otherSection]: formData[otherSection] || {},
    })
  }

  const renderLegs = (title: string, section: 'emptyContainer' | 'fullContainer') => {
    const sectionData = formData[section] || {}
    const legs = sectionData.legs || []

    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{title}</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => addLeg(section)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Leg
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Section-level fields: Date, Time, Vehicle, Driver */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-b pb-4">
            <FormInput
              label="Date"
              type="date"
              value={
                sectionData.date ? new Date(sectionData.date).toISOString().split('T')[0] : ''
              }
              onChange={(e) =>
                updateSectionField(
                  section,
                  'date',
                  e.target.value ? new Date(e.target.value).toISOString() : undefined,
                )
              }
            />
            <FormInput
              label="Time"
              type="time"
              value={sectionData.time || ''}
              onChange={(e) => updateSectionField(section, 'time', e.target.value)}
            />
            <FormCombobox
              label="Vehicle"
              placeholder="Select vehicle..."
              options={vehicles.map((v) => ({
                value: v.id,
                label: `${v.fleetNumber || ''}${v.rego ? ` (${v.rego})` : ''}`.trim() || `Vehicle ${v.id}`,
              }))}
              value={sectionData.vehicleId}
              onValueChange={(value) =>
                updateSectionField(
                  section,
                  'vehicleId',
                  typeof value === 'number' ? value : undefined,
                )
              }
            />
            <FormCombobox
              label="Driver"
              placeholder="Select driver..."
              options={drivers.map((d) => ({
                value: d.id,
                label: `${d.name || ''}${d.phoneNumber ? ` (${d.phoneNumber})` : ''}`.trim() || `Driver ${d.id}`,
              }))}
              value={sectionData.driverId}
              onValueChange={(value) =>
                updateSectionField(
                  section,
                  'driverId',
                  typeof value === 'number' ? value : undefined,
                )
              }
            />
          </div>

          {/* Legs section */}
          <div className="space-y-4">
            {legs.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No legs defined. Legs will be auto-generated from routing data.
              </div>
            )}
            {legs.map((leg, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">Leg {index + 1}</h4>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLeg(section, index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormInput
                    label="From"
                    value={getLocationDisplayName(leg.from)}
                    readOnly
                    className="bg-muted"
                  />
                  <FormInput
                    label="To"
                    value={getLocationDisplayName(leg.to)}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {order === 'full-first' ? (
          <>
            {renderLegs('Full Container Allocation', 'fullContainer')}
            {renderLegs('Empty Container Allocation', 'emptyContainer')}
          </>
        ) : (
          <>
            {renderLegs('Empty Container Allocation', 'emptyContainer')}
            {renderLegs('Full Container Allocation', 'fullContainer')}
          </>
        )}
      </div>
    </div>
  )
}
