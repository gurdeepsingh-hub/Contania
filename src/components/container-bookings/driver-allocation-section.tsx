'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Trash2 } from 'lucide-react'

type Vehicle = {
  id: number
  registration: string
  make?: string
  model?: string
}

type Driver = {
  id: number
  fullName: string
  phoneMobile?: string
}

type RoutingLeg = {
  from: string | number
  to: string | number
  via?: (string | number)[]
  date?: string
  time?: string
  vehicleId?: number
  driverId?: number
}

type DriverAllocationData = {
  emptyContainer?: {
    legs?: RoutingLeg[]
  }
  fullContainer?: {
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
  const [loading, setLoading] = useState(false)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
        fetch('/api/vehicles?limit=100'),
        fetch('/api/drivers?limit=100'),
      ])

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json()
        setVehicles(data.vehicles || [])
      }
      if (driversRes.ok) {
        const data = await driversRes.json()
        setDrivers(data.drivers || [])
      }
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
        // Full: From Step 3 From → Via → To Step 3 To
        if (routingData.fullRouting) {
          const via = routingData.fullRouting.viaLocations || []
          let currentFrom = step3Data.fromId
          via.forEach((viaLoc) => {
            fullLegs.push({
              from: currentFrom,
              to: viaLoc,
              via: [],
            })
            currentFrom = viaLoc
          })
          if (routingData.fullRouting.dropoffLocationId) {
            fullLegs.push({
              from: currentFrom,
              to: routingData.fullRouting.dropoffLocationId,
              via: [],
            })
          }
        }

        // Empty: From Step 3 To → Via → To Step 3 From
        if (routingData.emptyRouting) {
          const via = routingData.emptyRouting.viaLocations || []
          let currentFrom = step3Data.toId
          via.forEach((viaLoc) => {
            emptyLegs.push({
              from: currentFrom,
              to: viaLoc,
              via: [],
            })
            currentFrom = viaLoc
          })
          if (routingData.emptyRouting.dropoffLocationId) {
            emptyLegs.push({
              from: currentFrom,
              to: routingData.emptyRouting.dropoffLocationId,
              via: [],
            })
          }
        }
      } else {
        // Export: Empty → Full
        // Empty: From Step 3 From → Via → To Step 3 From (pickup empty)
        if (routingData.emptyRouting) {
          const via = routingData.emptyRouting.viaLocations || []
          let currentFrom = routingData.emptyRouting.pickupLocationId || step3Data.fromId
          via.forEach((viaLoc) => {
            emptyLegs.push({
              from: currentFrom,
              to: viaLoc,
              via: [],
            })
            currentFrom = viaLoc
          })
          if (routingData.emptyRouting.dropoffLocationId) {
            emptyLegs.push({
              from: currentFrom,
              to: routingData.emptyRouting.dropoffLocationId,
              via: [],
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
          let currentFrom = lastEmptyTo
          via.forEach((viaLoc) => {
            fullLegs.push({
              from: currentFrom,
              to: viaLoc,
              via: [],
            })
            currentFrom = viaLoc
          })
          if (routingData.fullRouting.dropoffLocationId) {
            fullLegs.push({
              from: currentFrom,
              to: routingData.fullRouting.dropoffLocationId,
              via: [],
            })
          }
        }
      }

      // Only update if legs don't exist yet and we have legs to add
      if (emptyLegs.length > 0 && !formData.emptyContainer?.legs) {
        onUpdate({ emptyContainer: { legs: emptyLegs } })
      }
      if (fullLegs.length > 0 && !formData.fullContainer?.legs) {
        onUpdate({ fullContainer: { legs: fullLegs } })
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

  const updateLeg = (
    section: 'emptyContainer' | 'fullContainer',
    legIndex: number,
    field: keyof RoutingLeg,
    value: any,
  ) => {
    const sectionData = formData[section] || { legs: [] }
    const legs = [...(sectionData.legs || [])]
    legs[legIndex] = { ...legs[legIndex], [field]: value }
    onUpdate({ [section]: { legs } })
  }

  const addLeg = (section: 'emptyContainer' | 'fullContainer') => {
    const sectionData = formData[section] || { legs: [] }
    const legs = [...(sectionData.legs || []), { from: '', to: '' }]
    onUpdate({ [section]: { legs } })
  }

  const removeLeg = (section: 'emptyContainer' | 'fullContainer', legIndex: number) => {
    const sectionData = formData[section] || { legs: [] }
    const legs = sectionData.legs?.filter((_, i) => i !== legIndex) || []
    onUpdate({ [section]: { legs } })
  }

  const renderLegs = (title: string, section: 'emptyContainer' | 'fullContainer') => {
    const legs = formData[section]?.legs || []

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
          {legs.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm">
              No legs defined. Legs will be auto-generated from routing data.
            </div>
          )}
          {legs.map((leg, index) => (
            <div key={index} className="border rounded-lg p-4 space-y-4">
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
                  value={typeof leg.from === 'string' ? leg.from : String(leg.from)}
                  onChange={(e) => updateLeg(section, index, 'from', e.target.value)}
                  readOnly
                  className="bg-muted"
                />
                <FormInput
                  label="To"
                  value={typeof leg.to === 'string' ? leg.to : String(leg.to)}
                  onChange={(e) => updateLeg(section, index, 'to', e.target.value)}
                  readOnly
                  className="bg-muted"
                />
                <FormInput
                  label="Date"
                  type="date"
                  value={leg.date ? new Date(leg.date).toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    updateLeg(
                      section,
                      index,
                      'date',
                      e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    )
                  }
                />
                <FormInput
                  label="Time"
                  type="time"
                  value={leg.time || ''}
                  onChange={(e) => updateLeg(section, index, 'time', e.target.value)}
                />
                <FormCombobox
                  label="Vehicle"
                  placeholder="Select vehicle..."
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: `${v.registration}${v.make ? ` - ${v.make} ${v.model || ''}` : ''}`,
                  }))}
                  value={leg.vehicleId}
                  onValueChange={(value) =>
                    updateLeg(
                      section,
                      index,
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
                    label: `${d.fullName}${d.phoneMobile ? ` - ${d.phoneMobile}` : ''}`,
                  }))}
                  value={leg.driverId}
                  onValueChange={(value) =>
                    updateLeg(
                      section,
                      index,
                      'driverId',
                      typeof value === 'number' ? value : undefined,
                    )
                  }
                />
              </div>
            </div>
          ))}
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
