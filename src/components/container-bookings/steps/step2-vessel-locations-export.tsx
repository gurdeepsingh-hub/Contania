'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import * as React from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VesselForm } from '@/components/entity-forms/vessel-form'
import { toast } from 'sonner'

type Vessel = {
  id: number
  vesselName: string
  voyageNumber?: string
  lloydsNumber?: string
  etd?: string
  receivalStart?: string
  cutoff?: boolean
  wharfId?: number | { id: number; name?: string }
}

type Customer = {
  id: number
  customer_name: string
  street?: string
  city?: string
  state?: string
  postcode?: string
}

type PayingCustomer = {
  id: number
  customer_name: string
  delivery_street?: string
  delivery_city?: string
  delivery_state?: string
  delivery_postcode?: string
  delivery_same_as_billing?: boolean
  billing_street?: string
  billing_city?: string
  billing_state?: string
  billing_postcode?: string
}

type EmptyPark = {
  id: number
  name: string
  address?: {
    street?: string
    city?: string
    state?: string
    postcode?: string
  }
}

type Wharf = {
  id: number
  name: string
  address?: {
    street?: string
    city?: string
    state?: string
    postcode?: string
  }
}

type Warehouse = {
  id: number
  name: string
  type?: 'Depot' | 'Warehouse' | null
  street?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
}

type ContainerSize = {
  id: number
  size: number
  attribute?: string
  code?: string
  description?: string
}

type UnifiedLocationOption = {
  value: string // Format: "collection:id"
  label: string
  collection: 'customers' | 'paying-customers' | 'empty-parks' | 'wharves' | 'warehouses'
  id: number
}

interface Step2VesselLocationsExportProps {
  formData: {
    vesselId?: number
    etd?: string
    receivalStart?: string
    cutoff?: boolean
    fromId?: number | string
    toId?: number | string
    containerSizeIds?: number[]
    containerQuantities?: Record<string, number>
    fromAddress?: string
    fromCity?: string
    fromState?: string
    fromPostcode?: string
    toAddress?: string
    toCity?: string
    toState?: string
    toPostcode?: string
  }
  onUpdate: (data: Partial<Step2VesselLocationsExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step2VesselLocationsExport({
  formData,
  onUpdate,
  errors,
}: Step2VesselLocationsExportProps) {
  const [loading, setLoading] = useState(false)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [selectedWharf, setSelectedWharf] = useState<Wharf | null>(null)
  const [showVesselModal, setShowVesselModal] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [emptyParks, setEmptyParks] = useState<EmptyPark[]>([])
  const [wharves, setWharves] = useState<Wharf[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [containerSizes, setContainerSizes] = useState<ContainerSize[]>([])
  const [unifiedLocations, setUnifiedLocations] = useState<UnifiedLocationOption[]>([])

  const loadVessels = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/vessels?jobType=export&limit=100')
      if (res.ok) {
        const data = await res.json()
        setVessels(data.vessels || [])
      }
    } catch (error) {
      console.error('Error loading vessels:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [customersRes, payingCustomersRes, emptyParksRes, wharvesRes, warehousesRes, containerSizesRes] =
        await Promise.all([
          fetch('/api/customers?limit=100'),
          fetch('/api/paying-customers?limit=100'),
          fetch('/api/empty-parks?limit=100'),
          fetch('/api/wharves?limit=100'),
          fetch('/api/warehouses?limit=100'),
          fetch('/api/container-sizes?limit=100'),
        ])

      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []
      let emptyParksData: EmptyPark[] = []
      let wharvesData: Wharf[] = []
      let warehousesData: Warehouse[] = []
      let containerSizesData: ContainerSize[] = []

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
      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        warehousesData = data.warehouses || []
        setWarehouses(warehousesData)
      }
      if (containerSizesRes.ok) {
        const data = await containerSizesRes.json()
        containerSizesData = data.containerSizes || []
        setContainerSizes(containerSizesData)
      }

      const unified: UnifiedLocationOption[] = [
        ...customersData.map((cust) => ({
          value: `customers:${cust.id}`,
          label: `${cust.customer_name} [Consignee/Consignor]`,
          collection: 'customers' as const,
          id: cust.id,
        })),
        ...payingCustomersData.map((cust) => ({
          value: `paying-customers:${cust.id}`,
          label: `${cust.customer_name} [Customer]`,
          collection: 'paying-customers' as const,
          id: cust.id,
        })),
        ...emptyParksData.map((ep) => ({
          value: `empty-parks:${ep.id}`,
          label: `${ep.name} [Empty Park]`,
          collection: 'empty-parks' as const,
          id: ep.id,
        })),
        ...wharvesData.map((wh) => ({
          value: `wharves:${wh.id}`,
          label: `${wh.name} [Wharf]`,
          collection: 'wharves' as const,
          id: wh.id,
        })),
        ...warehousesData.map((wh) => ({
          value: `warehouses:${wh.id}`,
          label: `${wh.name} [${wh.type || 'Warehouse'}]`,
          collection: 'warehouses' as const,
          id: wh.id,
        })),
      ]
      setUnifiedLocations(unified)
    } catch (error) {
      console.error('Error loading options:', error)
      toast.error('Failed to load options')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVessels()
    loadOptions()
  }, [loadVessels, loadOptions])

  // Load vessel details and auto-populate wharf to "to" field for export
  useEffect(() => {
    if (formData.vesselId) {
      fetch(`/api/vessels/${formData.vesselId}`)
        .then((res) => res.json())
        .then(async (data) => {
          if (data.success && data.vessel) {
            const vessel = data.vessel as Vessel
            setSelectedVessel(vessel)

            const updates: any = {}

            // Auto-fill vessel fields if not already set
            if (vessel.etd && !formData.etd) {
              updates.etd = vessel.etd
            }
            if (vessel.receivalStart && !formData.receivalStart) {
              updates.receivalStart = vessel.receivalStart
            }
            if (vessel.cutoff !== undefined && formData.cutoff === undefined) {
              updates.cutoff = !!vessel.cutoff
            }

            // Auto-populate wharf to "to" field for export jobs (always override when vessel is selected)
            if (vessel.wharfId) {
              const wharfId =
                typeof vessel.wharfId === 'object' ? vessel.wharfId.id : vessel.wharfId
              const wharfValue = `wharves:${wharfId}`

              console.log('[Step2 Export] Auto-filling wharf to to field:', { wharfId, wharfValue })

              // Fetch wharf details
              try {
                const wharfRes = await fetch(`/api/wharves/${wharfId}`)
                if (wharfRes.ok) {
                  const wharfData = await wharfRes.json()
                  console.log('[Step2 Export] Wharf API response:', wharfData)
                  if (wharfData.success && wharfData.wharf) {
                    const wh = wharfData.wharf as Wharf
                    setSelectedWharf(wh)
                    updates.toId = wharfValue
                    updates.toAddress = wh.address?.street || ''
                    updates.toCity = wh.address?.city || ''
                    updates.toState = wh.address?.state || ''
                    updates.toPostcode = wh.address?.postcode || ''
                    console.log('[Step2 Export] Setting to field updates:', updates)
                  }
                } else {
                  console.error('[Step2 Export] Failed to fetch wharf:', wharfRes.status)
                  // Still set the ID even if address fetch fails
                  updates.toId = wharfValue
                  setSelectedWharf(null)
                }
              } catch (error) {
                console.error('[Step2 Export] Error fetching wharf:', error)
                // Still set the ID even if address fetch fails
                updates.toId = wharfValue
                setSelectedWharf(null)
              }
            } else {
              setSelectedWharf(null)
            }

            // Batch all updates
            if (Object.keys(updates).length > 0) {
              onUpdate(updates)
            }
          }
        })
        .catch((error) => console.error('Error fetching vessel:', error))
    } else {
      setSelectedVessel(null)
      setSelectedWharf(null)
      // Clear wharf-related fields when vessel is cleared
      // Check if current toId is a wharf and clear it
      if (formData.toId) {
        const toIdStr =
          typeof formData.toId === 'string' ? formData.toId : `customers:${formData.toId}`
        if (toIdStr.startsWith('wharves:')) {
          onUpdate({
            toId: undefined,
            toAddress: undefined,
            toCity: undefined,
            toState: undefined,
            toPostcode: undefined,
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.vesselId])

  const handleVesselCreated = (vessel: Vessel) => {
    if (!vessel.id) return
    setVessels((prev) => [...prev, vessel])
    loadVessels().then(() => {
      onUpdate({ vesselId: vessel.id })
      setShowVesselModal(false)
    })
  }

  const handleLocationChange = async (
    field: 'fromId' | 'toId',
    locationValue: string | number | undefined,
  ) => {

    if (!locationValue || locationValue === '') {
      onUpdate({
        [field]: undefined,
        [`${field === 'fromId' ? 'from' : 'to'}Address`]: undefined,
        [`${field === 'fromId' ? 'from' : 'to'}City`]: undefined,
        [`${field === 'fromId' ? 'from' : 'to'}State`]: undefined,
        [`${field === 'fromId' ? 'from' : 'to'}Postcode`]: undefined,
      })
      return
    }

    const valueStr = typeof locationValue === 'string' ? locationValue : String(locationValue)
    const [collection, idStr] = valueStr.split(':')
    const locationId = parseInt(idStr, 10)

    if (!collection || !locationId) {
      console.warn(`Invalid location value format: ${valueStr}`)
      return
    }

    try {
      let apiPath = ''
      if (collection === 'customers') {
        apiPath = `/api/customers/${locationId}`
      } else if (collection === 'paying-customers') {
        apiPath = `/api/paying-customers/${locationId}`
      } else if (collection === 'empty-parks') {
        apiPath = `/api/empty-parks/${locationId}`
      } else if (collection === 'wharves') {
        apiPath = `/api/wharves/${locationId}`
      } else if (collection === 'warehouses') {
        apiPath = `/api/warehouses/${locationId}`
      } else {
        console.warn('Unknown collection:', collection)
        return
      }

      const res = await fetch(apiPath)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          let street = ''
          let city = ''
          let state = ''
          let postcode = ''

          if (collection === 'customers' && data.customer) {
            const cust = data.customer as Customer
            street = cust.street || ''
            city = cust.city || ''
            state = cust.state || ''
            postcode = cust.postcode || ''
          } else if (collection === 'paying-customers' && data.payingCustomer) {
            const cust = data.payingCustomer as PayingCustomer
            street =
              cust.delivery_street ||
              (cust.delivery_same_as_billing ? cust.billing_street : undefined) ||
              ''
            city =
              cust.delivery_city ||
              (cust.delivery_same_as_billing ? cust.billing_city : undefined) ||
              ''
            state =
              cust.delivery_state ||
              (cust.delivery_same_as_billing ? cust.billing_state : undefined) ||
              ''
            postcode =
              cust.delivery_postcode ||
              (cust.delivery_same_as_billing ? cust.billing_postcode : undefined) ||
              ''
          } else if (collection === 'empty-parks' && data.emptyPark) {
            const ep = data.emptyPark as EmptyPark
            street = ep.address?.street || ''
            city = ep.address?.city || ''
            state = ep.address?.state || ''
            postcode = ep.address?.postcode || ''
          } else if (collection === 'wharves' && data.wharf) {
            const wh = data.wharf as Wharf
            street = wh.address?.street || ''
            city = wh.address?.city || ''
            state = wh.address?.state || ''
            postcode = wh.address?.postcode || ''
          } else if (collection === 'warehouses' && data.warehouse) {
            const wh = data.warehouse as Warehouse
            street = wh.street || ''
            city = wh.city || ''
            state = wh.state || ''
            postcode = wh.postcode || ''
          }

          onUpdate({
            [field]: valueStr,
            [`${field === 'fromId' ? 'from' : 'to'}Address`]: street,
            [`${field === 'fromId' ? 'from' : 'to'}City`]: city,
            [`${field === 'fromId' ? 'from' : 'to'}State`]: state,
            [`${field === 'fromId' ? 'from' : 'to'}Postcode`]: postcode,
          })
        } else {
          onUpdate({ [field]: valueStr })
        }
      } else {
        onUpdate({ [field]: valueStr })
      }
    } catch (error) {
      console.error(`Error fetching location for ${field}:`, error)
      onUpdate({ [field]: valueStr })
    }
  }

  const handleContainerSizeChange = (sizeIds: number[]) => {
    onUpdate({ containerSizeIds: sizeIds })

    const currentQuantities = formData.containerQuantities || {}
    const newQuantities: Record<string, number> = {}

    sizeIds.forEach((sizeId) => {
      const sizeIdStr = String(sizeId)
      const existingQty = currentQuantities[sizeIdStr]
      if (existingQty && existingQty >= 1) {
        newQuantities[sizeIdStr] = existingQty
      }
    })

    onUpdate({ containerQuantities: newQuantities })
  }

  const handleQuantityChange = (sizeId: number, quantity: number) => {
    const sizeIdStr = String(sizeId)
    const currentQuantities = formData.containerQuantities || {}
    const newQuantities = { ...currentQuantities }

    if (quantity && quantity >= 1) {
      newQuantities[sizeIdStr] = quantity
    } else {
      delete newQuantities[sizeIdStr]
    }

    onUpdate({
      containerQuantities: newQuantities,
    })
  }

  const selectedSizes = containerSizes.filter((size) =>
    formData.containerSizeIds?.includes(size.id),
  )

  const fromValue = React.useMemo(() => {
    const computed =
      typeof formData.fromId === 'string' && formData.fromId.includes(':')
        ? formData.fromId
        : typeof formData.fromId === 'number'
          ? `customers:${formData.fromId}`
          : undefined
    return computed
  }, [formData.fromId, unifiedLocations])

  const toValue = React.useMemo(() => {
    const computed =
      typeof formData.toId === 'string' && formData.toId.includes(':')
        ? formData.toId
        : typeof formData.toId === 'number'
          ? `customers:${formData.toId}`
          : undefined
    return computed
  }, [formData.toId, unifiedLocations])

  // Check if "to" field is prefilled from vessel wharf (for display message)
  const isToFieldPrefilled = React.useMemo(() => {
    return !!selectedVessel?.wharfId
  }, [selectedVessel])

  return (
    <div className="space-y-6">
      {/* Vessel, From, and To - Side by Side */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Vessel & Locations</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Vessel */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <FormCombobox
                  label="Vessel"
                  placeholder="Select vessel..."
                  options={vessels.map((v) => ({
                    value: v.id,
                    label: `${v.vesselName}${v.voyageNumber ? `/${v.voyageNumber}` : ''}`,
                  }))}
                  value={formData.vesselId}
                  onValueChange={(value) =>
                    onUpdate({ vesselId: typeof value === 'number' ? value : undefined })
                  }
                  error={errors?.vesselId}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="mt-8"
                onClick={() => setShowVesselModal(true)}
                title="Quick create vessel"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {/* Vessel Date Fields */}
            {selectedVessel && (
              <div className="space-y-3">
                <FormInput
                  label="ETD (Estimated Time of Departure)"
                  type="date"
                  value={formData.etd ? new Date(formData.etd).toISOString().split('T')[0] : ''}
                  onChange={(e) =>
                    onUpdate({
                      etd: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                    })
                  }
                  error={errors?.etd}
                />
                <FormInput
                  label="Receival Start Date"
                  type="date"
                  value={
                    formData.receivalStart
                      ? new Date(formData.receivalStart).toISOString().split('T')[0]
                      : ''
                  }
                  onChange={(e) =>
                    onUpdate({
                      receivalStart: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : undefined,
                    })
                  }
                  error={errors?.receivalStart}
                />
              </div>
            )}
          </div>

          {/* From Location */}
          <div className="space-y-4">
            <FormCombobox
              key={`from-${formData.fromId || 'empty'}-${unifiedLocations.length}`}
              label="From"
              required
              placeholder="Select origin location..."
              options={unifiedLocations.map((loc) => ({
                value: loc.value,
                label: loc.label,
              }))}
              value={fromValue}
              onValueChange={(value) => handleLocationChange('fromId', value)}
              error={errors?.fromId}
            />
            <div className="grid grid-cols-1 gap-2">
              <FormInput
                label="Address"
                value={formData.fromAddress || ''}
                readOnly
                className="bg-muted text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <FormInput
                  label="City"
                  value={formData.fromCity || ''}
                  readOnly
                  className="bg-muted text-xs"
                />
                <FormInput
                  label="State"
                  value={formData.fromState || ''}
                  readOnly
                  className="bg-muted text-xs"
                />
              </div>
              <FormInput
                label="Postcode"
                value={formData.fromPostcode || ''}
                readOnly
                className="bg-muted text-xs"
              />
            </div>
          </div>

          {/* To Location */}
          <div className="space-y-4">
            <FormCombobox
              key={`to-${formData.toId || 'empty'}-${unifiedLocations.length}`}
              label="To"
              required
              placeholder="Select destination location..."
              options={unifiedLocations.map((loc) => ({
                value: loc.value,
                label: loc.label,
              }))}
              value={toValue}
              onValueChange={(value) => handleLocationChange('toId', value)}
              error={errors?.toId}
            />
            {isToFieldPrefilled && (
              <p className="text-xs text-muted-foreground">Prefilled from vessel&apos;s wharf (editable)</p>
            )}
            <div className="grid grid-cols-1 gap-2">
              <FormInput
                label="Address"
                value={formData.toAddress || ''}
                readOnly
                className="bg-muted text-xs"
              />
              <div className="grid grid-cols-2 gap-2">
                <FormInput
                  label="City"
                  value={formData.toCity || ''}
                  readOnly
                  className="bg-muted text-xs"
                />
                <FormInput
                  label="State"
                  value={formData.toState || ''}
                  readOnly
                  className="bg-muted text-xs"
                />
              </div>
              <FormInput
                label="Postcode"
                value={formData.toPostcode || ''}
                readOnly
                className="bg-muted text-xs"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Container Sizes and Quantities */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Container Sizes</h3>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Select Container Sizes <span className="text-destructive">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {containerSizes.map((size) => {
              const isSelected = formData.containerSizeIds?.includes(size.id) || false
              return (
                <Button
                  key={size.id}
                  type="button"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => {
                    const currentIds = formData.containerSizeIds || []
                    if (isSelected) {
                      handleContainerSizeChange(currentIds.filter((id) => id !== size.id))
                    } else {
                      handleContainerSizeChange([...currentIds, size.id])
                    }
                  }}
                >
                  {size.size}
                  {size.attribute ? ` ${size.attribute}` : ''}
                </Button>
              )
            })}
          </div>
          {errors?.containerSizeIds && (
            <p className="text-sm text-destructive">{errors.containerSizeIds}</p>
          )}
        </div>

        {/* Container Quantities */}
        {selectedSizes.length > 0 && (
          <div className="space-y-4 mt-4">
            <h4 className="font-medium">Container Quantities</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedSizes.map((size) => (
                <FormInput
                  key={size.id}
                  label={`${size.size}${size.attribute ? ` ${size.attribute}` : ''} Quantity`}
                  type="number"
                  min="1"
                  required
                  value={formData.containerQuantities?.[String(size.id)] || ''}
                  onChange={(e) => {
                    const value = e.target.value
                    const numValue = value === '' ? 0 : parseInt(value, 10)
                    handleQuantityChange(size.id, isNaN(numValue) ? 0 : numValue)
                  }}
                  error={errors?.[`containerQuantities.${size.id}`]}
                />
              ))}
            </div>
            {errors?.containerQuantities && (
              <p className="text-sm text-destructive">{errors.containerQuantities}</p>
            )}
          </div>
        )}
      </div>

      {/* Vessel Form Modal */}
      <Dialog open={showVesselModal} onOpenChange={setShowVesselModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Vessel (Export)</DialogTitle>
          </DialogHeader>
          <VesselForm
            initialData={{ jobType: 'export' } as any}
            onSuccess={async (vessel) => {
              handleVesselCreated(vessel as Vessel)
            }}
            onCancel={() => setShowVesselModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
