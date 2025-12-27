'use client'

import { useState, useEffect, useCallback } from 'react'
import { FormInput, FormCombobox, FormTextarea } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'

type ShippingLine = {
  id: number
  name: string
}

type EmptyPark = {
  id: number
  name: string
}

type Warehouse = {
  id: number
  name: string
}

type Wharf = {
  id: number
  name: string
}

type UnifiedLocationOption = {
  value: string | number
  label: string
}

type RoutingData = {
  emptyRouting?: {
    shippingLineId?: number
    pickupLocationId?: number | string
    pickupLocationCollection?: string
    pickupDate?: string
    viaLocations?: (number | string)[]
    viaLocationsCollections?: string[]
    dropoffLocationId?: number | string
    dropoffLocationCollection?: string
    dropoffDate?: string
    requestedDeliveryDate?: string
  }
  fullRouting?: {
    pickupLocationId?: number | string
    pickupLocationCollection?: string
    pickupDate?: string
    viaLocations?: (number | string)[]
    viaLocationsCollections?: string[]
    dropoffLocationId?: number | string
    dropoffLocationCollection?: string
    dropoffDate?: string
  }
  instructions?: string
  jobNotes?: string
  releaseNumber?: string // Export only
  weight?: string // Export only
}

interface RoutingSectionProps {
  order: 'full-first' | 'empty-first'
  formData: RoutingData
  onUpdate: (data: Partial<RoutingData>) => void
  step3Data?: {
    fromId?: number | string
    toId?: number | string
  }
  errors?: Record<string, string>
  isExport?: boolean // To show export-only fields (releaseNumber, weight)
}

export function RoutingSection({
  order,
  formData,
  onUpdate,
  step3Data,
  errors,
  isExport = false,
}: RoutingSectionProps) {
  const [loading, setLoading] = useState(false)
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([])
  const [emptyParks, setEmptyParks] = useState<EmptyPark[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [wharves, setWharves] = useState<Wharf[]>([])
  const [customers, setCustomers] = useState<Array<{ id: number; customer_name: string }>>([])
  const [payingCustomers, setPayingCustomers] = useState<
    Array<{ id: number; customer_name: string }>
  >([])
  const [unifiedLocations, setUnifiedLocations] = useState<UnifiedLocationOption[]>([])
  const [allLocations, setAllLocations] = useState<UnifiedLocationOption[]>([])

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
        shippingLinesRes,
        emptyParksRes,
        warehousesRes,
        wharvesRes,
        customersRes,
        payingCustomersRes,
      ] = await Promise.all([
        fetch('/api/shipping-lines?limit=100'),
        fetch('/api/empty-parks?limit=100'),
        fetch('/api/warehouses?limit=100'),
        fetch('/api/wharves?limit=100'),
        fetch('/api/customers?limit=100'),
        fetch('/api/paying-customers?limit=100'),
      ])

      // Get data directly from responses before updating state
      let shippingLinesData: ShippingLine[] = []
      let emptyParksData: EmptyPark[] = []
      let warehousesData: Warehouse[] = []
      let wharvesData: Wharf[] = []
      let customersData: Array<{ id: number; customer_name: string }> = []
      let payingCustomersData: Array<{ id: number; customer_name: string }> = []

      if (shippingLinesRes.ok) {
        const data = await shippingLinesRes.json()
        shippingLinesData = data.shippingLines || []
        setShippingLines(shippingLinesData)
      }
      if (emptyParksRes.ok) {
        const data = await emptyParksRes.json()
        emptyParksData = data.emptyParks || []
        setEmptyParks(emptyParksData)
      }
      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        warehousesData = data.warehouses || []
        setWarehouses(warehousesData)
      }
      if (wharvesRes.ok) {
        const data = await wharvesRes.json()
        wharvesData = data.wharves || []
        setWharves(wharvesData)
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

      // Create unified location list for via locations (warehouses, wharves, empty-parks)
      // Using "collection:id" format for consistency
      const unified: UnifiedLocationOption[] = [
        ...warehousesData.map((wh) => ({
          value: `warehouses:${wh.id}`,
          label: `${wh.name} [Warehouse]`,
        })),
        ...wharvesData.map((wh) => ({
          value: `wharves:${wh.id}`,
          label: `${wh.name} [Wharf]`,
        })),
        ...emptyParksData.map((ep) => ({
          value: `empty-parks:${ep.id}`,
          label: `${ep.name} [Empty Park]`,
        })),
      ]
      setUnifiedLocations(unified)

      // Create all locations list for dropoff/pickup (customers, paying-customers, empty-parks, wharves)
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

  // Auto-fill dropoff locations from Step 3
  useEffect(() => {
    if (step3Data?.fromId && step3Data?.toId) {
      // Ensure fromId and toId are in "collection:id" format
      const fromIdValue =
        typeof step3Data.fromId === 'string'
          ? step3Data.fromId
          : step3Data.fromId
            ? `customers:${step3Data.fromId}`
            : undefined

      const toIdValue =
        typeof step3Data.toId === 'string'
          ? step3Data.toId
          : step3Data.toId
            ? `customers:${step3Data.toId}`
            : undefined

      if (!fromIdValue || !toIdValue) {
        return
      }

      // Parse collections from step3Data if available
      const fromParsed = parseLocationValue(fromIdValue)
      const toParsed = parseLocationValue(toIdValue)

      // Build update object with all routing changes in a single call to avoid race conditions
      const updates: Partial<RoutingData> = {}

      if (order === 'full-first') {
        // Import: Full → Empty
        // Full pickup = Step 3 From, Full dropoff = Step 3 To
        // Empty dropoff = Step 3 From
        if (fromParsed.id !== undefined && fromParsed.collection) {
          updates.fullRouting = {
            ...formData.fullRouting,
            pickupLocationId: fromParsed.id,
            pickupLocationCollection: fromParsed.collection,
          }
        }
        if (toParsed.id !== undefined && toParsed.collection) {
          updates.fullRouting = {
            ...(updates.fullRouting || formData.fullRouting),
            dropoffLocationId: toParsed.id,
            dropoffLocationCollection: toParsed.collection,
          }
        }
        if (fromParsed.id !== undefined && fromParsed.collection) {
          updates.emptyRouting = {
            ...formData.emptyRouting,
            dropoffLocationId: fromParsed.id,
            dropoffLocationCollection: fromParsed.collection,
          }
        }
      } else {
        // Export: Empty → Full
        // Empty dropoff = Step 3 From
        // Full pickup = Step 3 From, Full dropoff = Step 3 To
        if (fromParsed.id !== undefined && fromParsed.collection) {
          updates.emptyRouting = {
            ...formData.emptyRouting,
            dropoffLocationId: fromParsed.id,
            dropoffLocationCollection: fromParsed.collection,
          }
          updates.fullRouting = {
            ...formData.fullRouting,
            pickupLocationId: fromParsed.id,
            pickupLocationCollection: fromParsed.collection,
          }
        }
        if (toParsed.id !== undefined && toParsed.collection) {
          updates.fullRouting = {
            ...(updates.fullRouting || formData.fullRouting),
            dropoffLocationId: toParsed.id,
            dropoffLocationCollection: toParsed.collection,
          }
        }
      }

      // Only call onUpdate once with all changes
      if (Object.keys(updates).length > 0) {
        onUpdate(updates)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step3Data?.fromId, step3Data?.toId, order])

  // Helper to extract collection and ID from "collection:id" format
  const parseLocationValue = (
    value: string | number | undefined,
  ): { id: number | undefined; collection: string | undefined } => {
    if (!value) return { id: undefined, collection: undefined }
    if (typeof value === 'number') return { id: value, collection: undefined }
    if (typeof value === 'string' && value.includes(':')) {
      const [collection, idStr] = value.split(':')
      const id = parseInt(idStr, 10)
      return { id: !isNaN(id) ? id : undefined, collection }
    }
    return { id: undefined, collection: undefined }
  }

  const updateEmptyRouting = (field: string, value: any, collection?: string) => {
    const update: any = {
      emptyRouting: {
        ...formData.emptyRouting,
        [field]: value,
      },
    }

    // If collection is provided, also update the collection field
    if (collection && (field === 'pickupLocationId' || field === 'dropoffLocationId')) {
      update.emptyRouting[`${field.replace('Id', '')}Collection`] = collection
    }

    onUpdate(update)
  }

  const updateFullRouting = (field: string, value: any, collection?: string) => {
    const update: any = {
      fullRouting: {
        ...formData.fullRouting,
        [field]: value,
      },
    }

    // If collection is provided, also update the collection field
    if (collection && (field === 'pickupLocationId' || field === 'dropoffLocationId')) {
      update.fullRouting[`${field.replace('Id', '')}Collection`] = collection
    }

    onUpdate(update)
  }

  const addViaLocation = (section: 'empty' | 'full') => {
    if (section === 'empty') {
      const currentVia = formData.emptyRouting?.viaLocations || []
      updateEmptyRouting('viaLocations', [...currentVia, ''])
    } else {
      const currentVia = formData.fullRouting?.viaLocations || []
      updateFullRouting('viaLocations', [...currentVia, ''])
    }
  }

  const removeViaLocation = (section: 'empty' | 'full', index: number) => {
    if (section === 'empty') {
      const currentVia = formData.emptyRouting?.viaLocations || []
      const currentCollections = formData.emptyRouting?.viaLocationsCollections || []
      onUpdate({
        emptyRouting: {
          ...formData.emptyRouting,
          viaLocations: currentVia.filter((_, i) => i !== index),
          viaLocationsCollections: currentCollections.filter((_, i) => i !== index),
        },
      })
    } else {
      const currentVia = formData.fullRouting?.viaLocations || []
      const currentCollections = formData.fullRouting?.viaLocationsCollections || []
      onUpdate({
        fullRouting: {
          ...formData.fullRouting,
          viaLocations: currentVia.filter((_, i) => i !== index),
          viaLocationsCollections: currentCollections.filter((_, i) => i !== index),
        },
      })
    }
  }

  const updateViaLocation = (section: 'empty' | 'full', index: number, value: string | number) => {
    const parsed = parseLocationValue(value)

    if (section === 'empty') {
      const currentVia = formData.emptyRouting?.viaLocations || []
      const currentCollections = formData.emptyRouting?.viaLocationsCollections || []
      const updated = [...currentVia]
      const updatedCollections = [...currentCollections]

      if (parsed.id !== undefined) {
        // Store numeric ID only
        updated[index] = parsed.id
        // Store collection separately if provided
        if (parsed.collection) {
          // Ensure collections array is long enough
          while (updatedCollections.length < updated.length) {
            updatedCollections.push('')
          }
          updatedCollections[index] = parsed.collection
        }
        // Update both IDs and collections in a single call
        onUpdate({
          emptyRouting: {
            ...formData.emptyRouting,
            viaLocations: updated,
            viaLocationsCollections: updatedCollections,
          },
        })
      } else {
        // Fallback: store value as-is (shouldn't happen in normal flow)
        updated[index] = value
        onUpdate({
          emptyRouting: {
            ...formData.emptyRouting,
            viaLocations: updated,
          },
        })
      }
    } else {
      const currentVia = formData.fullRouting?.viaLocations || []
      const currentCollections = formData.fullRouting?.viaLocationsCollections || []
      const updated = [...currentVia]
      const updatedCollections = [...currentCollections]

      if (parsed.id !== undefined) {
        // Store numeric ID only
        updated[index] = parsed.id
        // Store collection separately if provided
        if (parsed.collection) {
          // Ensure collections array is long enough
          while (updatedCollections.length < updated.length) {
            updatedCollections.push('')
          }
          updatedCollections[index] = parsed.collection
        }
        // Update both IDs and collections in a single call
        onUpdate({
          fullRouting: {
            ...formData.fullRouting,
            viaLocations: updated,
            viaLocationsCollections: updatedCollections,
          },
        })
      } else {
        // Fallback: store value as-is (shouldn't happen in normal flow)
        updated[index] = value
        onUpdate({
          fullRouting: {
            ...formData.fullRouting,
            viaLocations: updated,
          },
        })
      }
    }
  }

  const renderRoutingSection = (
    title: string,
    section: 'empty' | 'full',
    routing: RoutingData['emptyRouting'] | RoutingData['fullRouting'],
  ) => {
    const isFirst =
      (order === 'full-first' && section === 'full') ||
      (order === 'empty-first' && section === 'empty')

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {section === 'empty' && (
            <FormCombobox
              label="Shipping Line"
              placeholder="Select shipping line..."
              options={shippingLines.map((sl) => ({
                value: sl.id,
                label: sl.name,
              }))}
              value={(routing as RoutingData['emptyRouting'])?.shippingLineId}
              onValueChange={(value) =>
                updateEmptyRouting('shippingLineId', typeof value === 'number' ? value : undefined)
              }
              error={errors?.['emptyRouting.shippingLineId']}
            />
          )}

          {section === 'empty' && (
            <FormCombobox
              label="Pickup Location (Empty Park)"
              placeholder="Select empty park..."
              options={emptyParks.map((ep) => ({
                value: ep.id,
                label: ep.name,
              }))}
              value={
                typeof (routing as RoutingData['emptyRouting'])?.pickupLocationId === 'string'
                  ? undefined
                  : (routing as RoutingData['emptyRouting'])?.pickupLocationId
              }
              onValueChange={(value) => {
                const parsed = parseLocationValue(value)
                if (parsed.id !== undefined) {
                  updateEmptyRouting('pickupLocationId', parsed.id, parsed.collection)
                } else {
                  updateEmptyRouting('pickupLocationId', value)
                }
              }}
              error={errors?.['emptyRouting.pickupLocationId']}
            />
          )}

          {section === 'full' && (
            <FormInput
              label="Pickup Location"
              value={
                getLocationDisplayName(routing?.pickupLocationId) ||
                (step3Data?.fromId ? getLocationDisplayName(step3Data.fromId) : '')
              }
              readOnly
              className="bg-muted"
              placeholder="Will be prefilled from Step 3"
            />
          )}

          <FormInput
            label="Pickup Date"
            type="date"
            value={
              routing?.pickupDate ? new Date(routing.pickupDate).toISOString().split('T')[0] : ''
            }
            onChange={(e) => {
              if (section === 'empty') {
                updateEmptyRouting('pickupDate', e.target.value)
              } else {
                updateFullRouting('pickupDate', e.target.value)
              }
            }}
            error={
              errors?.[section === 'empty' ? 'emptyRouting.pickupDate' : 'fullRouting.pickupDate']
            }
          />

          {/* Via Locations */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Via Locations</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addViaLocation(section)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Via Location
              </Button>
            </div>
            {(routing?.viaLocations || []).map((via, index) => (
              <div key={index} className="flex gap-2 items-start">
                <FormCombobox
                  label={`Via ${index + 1}`}
                  placeholder="Select via location..."
                  options={unifiedLocations}
                  value={
                    typeof via === 'string'
                      ? via
                      : via
                        ? (unifiedLocations.find((loc) => {
                            const [collection, idStr] = String(loc.value).split(':')
                            return parseInt(idStr, 10) === via
                          })?.value as string | undefined)
                        : undefined
                  }
                  onValueChange={(value) => updateViaLocation(section, index, value || '')}
                  containerClassName="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="mt-8"
                  onClick={() => removeViaLocation(section, index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <FormCombobox
            label="Dropoff Location"
            placeholder="Select dropoff location..."
            options={allLocations}
            value={
              typeof routing?.dropoffLocationId === 'string'
                ? routing.dropoffLocationId
                : routing?.dropoffLocationId
                  ? `customers:${routing.dropoffLocationId}`
                  : undefined
            }
            onValueChange={(value) => {
              if (!value) {
                if (section === 'empty') {
                  updateEmptyRouting('dropoffLocationId', undefined)
                } else {
                  updateFullRouting('dropoffLocationId', undefined)
                }
                return
              }

              const parsed = parseLocationValue(value)
              if (parsed.id !== undefined) {
                // Always pass collection if available, otherwise try to find it from allLocations
                let collection = parsed.collection
                if (!collection && typeof value === 'string') {
                  // Try to find collection from allLocations options
                  const location = allLocations.find((loc) => String(loc.value) === value)
                  if (location) {
                    const [coll] = String(location.value).split(':')
                    collection = coll
                  }
                }

                if (section === 'empty') {
                  updateEmptyRouting('dropoffLocationId', parsed.id, collection)
                } else {
                  updateFullRouting('dropoffLocationId', parsed.id, collection)
                }
              } else {
                // Fallback: try to parse as "collection:id" format
                if (typeof value === 'string' && value.includes(':')) {
                  const [collection, idStr] = value.split(':')
                  const id = parseInt(idStr, 10)
                  if (!isNaN(id)) {
                    if (section === 'empty') {
                      updateEmptyRouting('dropoffLocationId', id, collection)
                    } else {
                      updateFullRouting('dropoffLocationId', id, collection)
                    }
                  }
                } else {
                  if (section === 'empty') {
                    updateEmptyRouting('dropoffLocationId', value)
                  } else {
                    updateFullRouting('dropoffLocationId', value)
                  }
                }
              }
            }}
            error={
              errors?.[
                section === 'empty'
                  ? 'emptyRouting.dropoffLocationId'
                  : 'fullRouting.dropoffLocationId'
              ]
            }
          />

          <FormInput
            label="Dropoff Date"
            type="date"
            value={
              routing?.dropoffDate ? new Date(routing.dropoffDate).toISOString().split('T')[0] : ''
            }
            onChange={(e) => {
              if (section === 'empty') {
                updateEmptyRouting('dropoffDate', e.target.value)
              } else {
                updateFullRouting('dropoffDate', e.target.value)
              }
            }}
            error={
              errors?.[section === 'empty' ? 'emptyRouting.dropoffDate' : 'fullRouting.dropoffDate']
            }
          />

          {section === 'empty' && (
            <FormInput
              label="Requested Delivery Date"
              type="date"
              value={
                (routing as RoutingData['emptyRouting'])?.requestedDeliveryDate
                  ? new Date((routing as RoutingData['emptyRouting'])?.requestedDeliveryDate || '')
                      .toISOString()
                      .split('T')[0]
                  : ''
              }
              onChange={(e) => updateEmptyRouting('requestedDeliveryDate', e.target.value)}
              error={errors?.['emptyRouting.requestedDeliveryDate']}
            />
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {order === 'full-first' ? (
          <>
            {renderRoutingSection('Full Container Routing', 'full', formData.fullRouting)}
            {renderRoutingSection('Empty Container Routing', 'empty', formData.emptyRouting)}
          </>
        ) : (
          <>
            {renderRoutingSection('Empty Container Routing', 'empty', formData.emptyRouting)}
            {renderRoutingSection('Full Container Routing', 'full', formData.fullRouting)}
          </>
        )}
      </div>

      {/* More Info Section */}
      <Card>
        <CardHeader>
          <CardTitle>More Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormTextarea
            label="Instructions"
            placeholder="Enter any special instructions..."
            value={formData.instructions || ''}
            onChange={(e) => onUpdate({ instructions: e.target.value })}
            rows={4}
            error={errors?.['instructions']}
          />
          <FormTextarea
            label="Job Notes"
            placeholder="Enter job notes..."
            value={formData.jobNotes || ''}
            onChange={(e) => onUpdate({ jobNotes: e.target.value })}
            rows={4}
            error={errors?.['jobNotes']}
          />
          {isExport && (
            <>
              <FormTextarea
                label="Release Number"
                placeholder="Enter release number..."
                value={formData.releaseNumber || ''}
                onChange={(e) => onUpdate({ releaseNumber: e.target.value })}
                rows={2}
                error={errors?.['releaseNumber']}
              />
              <FormTextarea
                label="Weight"
                placeholder="Enter weight information..."
                value={formData.weight || ''}
                onChange={(e) => onUpdate({ weight: e.target.value })}
                rows={2}
                error={errors?.['weight']}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
