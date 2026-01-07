'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import * as React from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

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
  collection: 'customers' | 'paying-customers' | 'empty-parks' | 'wharves'
  id: number
}

interface Step3LocationsProps {
  formData: {
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
  onUpdate: (data: Partial<Step3LocationsProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step3Locations({ formData, onUpdate, errors }: Step3LocationsProps) {
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [emptyParks, setEmptyParks] = useState<EmptyPark[]>([])
  const [wharves, setWharves] = useState<Wharf[]>([])
  const [containerSizes, setContainerSizes] = useState<ContainerSize[]>([])
  const [unifiedLocations, setUnifiedLocations] = useState<UnifiedLocationOption[]>([])

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [customersRes, payingCustomersRes, emptyParksRes, wharvesRes, containerSizesRes] =
        await Promise.all([
          fetch('/api/customers?limit=100'),
          fetch('/api/paying-customers?limit=100'),
          fetch('/api/empty-parks?limit=100'),
          fetch('/api/wharves?limit=100'),
          fetch('/api/container-sizes?limit=100'),
        ])

      // Get data directly from responses before updating state
      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []
      let emptyParksData: EmptyPark[] = []
      let wharvesData: Wharf[] = []
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
      if (containerSizesRes.ok) {
        const data = await containerSizesRes.json()
        containerSizesData = data.containerSizes || []
        setContainerSizes(containerSizesData)
      }

      // Create unified location list using data directly from API responses
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
    loadOptions()
  }, [loadOptions])

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

    // Parse collection and ID
    const [collection, idStr] = valueStr.split(':')
    const locationId = parseInt(idStr, 10)

    if (!collection || !locationId) {
      console.warn(`Invalid location value format: ${valueStr}`)
      return
    }

    // Auto-fetch location data (we'll update ID and address fields together after fetching)
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
      } else {
        console.warn('Unknown collection:', collection)
        return
      }

      console.log(`Fetching location data from ${apiPath} for ${field}`)
      const res = await fetch(apiPath)

      if (res.ok) {
        const data = await res.json()
        console.log(`API response for ${field}:`, data)

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
            console.log(`Customer data for ${field}:`, { street, city, state, postcode })
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
            console.log(`Paying customer data for ${field}:`, { street, city, state, postcode })
          } else if (collection === 'empty-parks' && data.emptyPark) {
            const ep = data.emptyPark as EmptyPark
            street = ep.address?.street || ''
            city = ep.address?.city || ''
            state = ep.address?.state || ''
            postcode = ep.address?.postcode || ''
            console.log(`Empty park data for ${field}:`, { street, city, state, postcode })
          } else if (collection === 'wharves' && data.wharf) {
            const wh = data.wharf as Wharf
            street = wh.address?.street || ''
            city = wh.address?.city || ''
            state = wh.address?.state || ''
            postcode = wh.address?.postcode || ''
            console.log(`Wharf data for ${field}:`, { street, city, state, postcode })
          } else {
            console.warn(`No data found for ${collection} in response:`, data)
          }

          // Update all address fields in a single call to ensure React batches the update
          const updateData = {
            [field]: valueStr, // Ensure ID is also included
            [`${field === 'fromId' ? 'from' : 'to'}Address`]: street,
            [`${field === 'fromId' ? 'from' : 'to'}City`]: city,
            [`${field === 'fromId' ? 'from' : 'to'}State`]: state,
            [`${field === 'fromId' ? 'from' : 'to'}Postcode`]: postcode,
          }

          console.log(`Updating ${field} with address fields:`, updateData)
          onUpdate(updateData)
        } else {
          console.warn(`API response not successful for ${field}:`, data)
          // Still update the ID even if address fetch fails
          onUpdate({ [field]: valueStr })
        }
      } else {
        const errorData = await res.json().catch(() => ({}))
        console.error(`Failed to fetch location for ${field}:`, res.status, errorData)
        // Still update the ID even if API call fails
        onUpdate({ [field]: valueStr })
      }
    } catch (error) {
      console.error(`Error fetching location for ${field}:`, error)
      // Still update the ID even if there's an error
      onUpdate({ [field]: valueStr })
    }
  }

  const handleContainerSizeChange = (sizeIds: number[]) => {
    onUpdate({ containerSizeIds: sizeIds })

    // Update quantities - remove quantities for deselected sizes, keep existing for selected sizes
    // Don't set default to 0 - only keep existing valid quantities (>= 1)
    const currentQuantities = formData.containerQuantities || {}
    const newQuantities: Record<string, number> = {}

    sizeIds.forEach((sizeId) => {
      const sizeIdStr = String(sizeId)
      const existingQty = currentQuantities[sizeIdStr]
      // Only keep existing quantity if it's valid (>= 1)
      if (existingQty && existingQty >= 1) {
        newQuantities[sizeIdStr] = existingQty
      }
      // Otherwise don't add it - user must enter a quantity
    })

    onUpdate({ containerQuantities: newQuantities })
  }

  const handleQuantityChange = (sizeId: number, quantity: number) => {
    const sizeIdStr = String(sizeId)
    const currentQuantities = formData.containerQuantities || {}
    const newQuantities = { ...currentQuantities }

    // Only update if quantity is valid (>= 1), otherwise remove it
    if (quantity && quantity >= 1) {
      newQuantities[sizeIdStr] = quantity
    } else {
      // Remove invalid/zero quantities
      delete newQuantities[sizeIdStr]
    }

    onUpdate({
      containerQuantities: newQuantities,
    })
  }

  const selectedSizes = containerSizes.filter((size) =>
    formData.containerSizeIds?.includes(size.id),
  )

  // Compute values once - use unifiedLocations array as dependency, not just length
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

  return (
    <div className="space-y-6">
      {/* From Location */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">From Location</h3>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Address"
            value={formData.fromAddress || ''}
            readOnly
            className="bg-muted"
          />
          <FormInput label="City" value={formData.fromCity || ''} readOnly className="bg-muted" />
          <FormInput label="State" value={formData.fromState || ''} readOnly className="bg-muted" />
          <FormInput
            label="Postcode"
            value={formData.fromPostcode || ''}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>

      {/* To Location */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">To Location</h3>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormInput
            label="Address"
            value={formData.toAddress || ''}
            readOnly
            className="bg-muted"
          />
          <FormInput label="City" value={formData.toCity || ''} readOnly className="bg-muted" />
          <FormInput label="State" value={formData.toState || ''} readOnly className="bg-muted" />
          <FormInput
            label="Postcode"
            value={formData.toPostcode || ''}
            readOnly
            className="bg-muted"
          />
        </div>
      </div>

      {/* Container Sizes */}
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
                  {size.size}{size.attribute ? ` ${size.attribute}` : ''}
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
                    // Parse as number, but don't default to 0 - let handleQuantityChange handle validation
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
    </div>
  )
}
