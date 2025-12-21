'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Search, X } from 'lucide-react'
import { useDebounce } from '@/lib/hooks'

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

type InventorySearchFormProps = {
  warehouseId: number | null
  onSearch: (filters: SearchFilters) => void
  loading?: boolean
}

export function InventorySearchForm({
  warehouseId,
  onSearch,
  loading = false,
}: InventorySearchFormProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    customerName: '',
    skuId: '',
    batch: '',
    skuDescription: '',
    lpn: '',
    expiry: '',
    containerNumber: '',
    customerReference: '',
    inboundOrderNumber: '',
    attribute1: '',
    attribute2: '',
    locationFrom: '',
    locationTo: '',
  })

  const [suggestions, setSuggestions] = useState<Record<string, string[]>>({})
  const [showSuggestions, setShowSuggestions] = useState<Record<string, boolean>>({})

  // Debounce search term for autocomplete
  const debouncedSkuId = useDebounce(filters.skuId, 300)
  const debouncedBatch = useDebounce(filters.batch, 300)
  const debouncedCustomerName = useDebounce(filters.customerName, 300)

  // Fetch autocomplete suggestions with contextual filtering
  const fetchSuggestions = useCallback(
    async (field: string, searchTerm: string, fetchDefaults = false) => {
      // For default suggestions, allow empty search term
      if (!fetchDefaults && (!searchTerm || searchTerm.length < 2)) {
        setSuggestions((prev) => ({ ...prev, [field]: [] }))
        return
      }

      try {
        const params = new URLSearchParams({
          field,
          search: searchTerm || '',
        })
        if (warehouseId) {
          params.append('warehouseId', warehouseId.toString())
        }
        if (fetchDefaults) {
          params.append('fetchDefaults', 'true')
        }

        // Add contextual filters based on already filled fields
        if (filters.skuId && field !== 'skuId') {
          params.append('skuId', filters.skuId)
        }
        if (filters.batch && field !== 'batch') {
          params.append('batch', filters.batch)
        }

        const res = await fetch(`/api/inventory/autocomplete?${params}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setSuggestions((prev) => ({ ...prev, [field]: data.suggestions || [] }))
          }
        }
      } catch (error) {
        console.error(`Error fetching suggestions for ${field}:`, error)
      }
    },
    [warehouseId, filters.skuId, filters.batch],
  )

  // Fetch related data for auto-fill
  const fetchRelatedData = useCallback(
    async (field: string, value: string) => {
      if (!value || !warehouseId) return

      try {
        const params = new URLSearchParams({
          field,
          value,
          warehouseId: warehouseId.toString(),
        })

        const res = await fetch(`/api/inventory/related-data?${params}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            // Auto-fill related fields
            if (field === 'batch' && data.data.skuId) {
              setFilters((prev) => ({ ...prev, skuId: data.data.skuId }))
            } else if (field === 'skuId') {
              if (data.data.skuDescription) {
                setFilters((prev) => ({ ...prev, skuDescription: data.data.skuDescription }))
              }
              if (data.data.expiry) {
                setFilters((prev) => ({ ...prev, expiry: data.data.expiry }))
              }
              if (data.data.attribute1) {
                setFilters((prev) => ({ ...prev, attribute1: data.data.attribute1 }))
              }
              if (data.data.attribute2) {
                setFilters((prev) => ({ ...prev, attribute2: data.data.attribute2 }))
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error fetching related data for ${field}:`, error)
      }
    },
    [warehouseId],
  )

  // Auto-fill related data when SKU ID is manually entered (not from dropdown)
  useEffect(() => {
    if (debouncedSkuId && debouncedSkuId.length >= 2 && warehouseId) {
      // Only auto-fill if SKU ID was typed, not selected from dropdown
      // We'll trigger this on blur or after a delay
      const timer = setTimeout(() => {
        fetchRelatedData('skuId', debouncedSkuId)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [debouncedSkuId, warehouseId, fetchRelatedData])

  // Auto-fill SKU ID when batch is manually entered
  useEffect(() => {
    if (debouncedBatch && debouncedBatch.length >= 2 && warehouseId) {
      const timer = setTimeout(() => {
        fetchRelatedData('batch', debouncedBatch)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [debouncedBatch, warehouseId, fetchRelatedData])

  const handleFieldChange = (field: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setShowSuggestions((prev) => ({ ...prev, [field]: true }))

    // Fetch suggestions as user types
    // Map locationFrom/locationTo to 'location' field for API
    const apiField = field === 'locationFrom' || field === 'locationTo' ? 'location' : field
    const minLength = field === 'locationFrom' || field === 'locationTo' ? 1 : 2
    if (value && value.length >= minLength) {
      fetchSuggestions(apiField, value, false)
    } else {
      setSuggestions((prev) => ({ ...prev, [field]: [] }))
    }
  }

  const handleFieldFocus = (field: keyof SearchFilters) => {
    setShowSuggestions((prev) => ({ ...prev, [field]: true }))
    // Fetch default suggestions when field is focused
    const currentValue = filters[field]
    // Map locationFrom/locationTo to 'location' field for API
    const apiField = field === 'locationFrom' || field === 'locationTo' ? 'location' : field
    if (!currentValue || currentValue.length === 0) {
      fetchSuggestions(apiField, '', true)
    } else if (currentValue.length >= (field === 'locationFrom' || field === 'locationTo' ? 1 : 2)) {
      fetchSuggestions(apiField, currentValue, false)
    }
  }

  const handleSuggestionSelect = (field: keyof SearchFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setShowSuggestions((prev) => ({ ...prev, [field]: false }))

    // Auto-fill related fields when a suggestion is selected
    if (field === 'batch' && value) {
      // Batch → SKU ID
      fetchRelatedData('batch', value)
    } else if (field === 'skuId' && value) {
      // SKU ID → Description, Expiry, Attribute1, Attribute2
      fetchRelatedData('skuId', value)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!warehouseId) {
      return
    }
    onSearch(filters)
  }

  const handleClear = () => {
    setFilters({
      customerName: '',
      skuId: '',
      batch: '',
      skuDescription: '',
      lpn: '',
      expiry: '',
      containerNumber: '',
      customerReference: '',
      inboundOrderNumber: '',
      attribute1: '',
      attribute2: '',
      locationFrom: '',
      locationTo: '',
    })
    setSuggestions({})
    setShowSuggestions({})
  }

  const hasFilters = Object.values(filters).some((v) => v.trim() !== '')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customer Name */}
            <div className="space-y-2 relative">
              <Label htmlFor="customerName">Customer Name</Label>
              <div className="relative">
                <Input
                  id="customerName"
                  value={filters.customerName}
                  onChange={(e) => handleFieldChange('customerName', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('customerName')}
                />
                {showSuggestions.customerName &&
                  suggestions.customerName &&
                  suggestions.customerName.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.customerName.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('customerName', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* SKU ID */}
            <div className="space-y-2 relative">
              <Label htmlFor="skuId">SKU ID</Label>
              <div className="relative">
                <Input
                  id="skuId"
                  value={filters.skuId}
                  onChange={(e) => handleFieldChange('skuId', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('skuId')}
                />
                {showSuggestions.skuId &&
                  suggestions.skuId &&
                  suggestions.skuId.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.skuId.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('skuId', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Batch */}
            <div className="space-y-2 relative">
              <Label htmlFor="batch">Batch</Label>
              <div className="relative">
                <Input
                  id="batch"
                  value={filters.batch}
                  onChange={(e) => handleFieldChange('batch', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('batch')}
                />
                {showSuggestions.batch &&
                  suggestions.batch &&
                  suggestions.batch.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.batch.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('batch', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* SKU Description */}
            <div className="space-y-2 relative">
              <Label htmlFor="skuDescription">SKU Description</Label>
              <div className="relative">
                <Input
                  id="skuDescription"
                  value={filters.skuDescription}
                  onChange={(e) => handleFieldChange('skuDescription', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('skuDescription')}
                />
                {showSuggestions.skuDescription &&
                  suggestions.skuDescription &&
                  suggestions.skuDescription.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.skuDescription.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('skuDescription', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* LPN */}
            <div className="space-y-2 relative">
              <Label htmlFor="lpn">LPN</Label>
              <div className="relative">
                <Input
                  id="lpn"
                  value={filters.lpn}
                  onChange={(e) => handleFieldChange('lpn', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('lpn')}
                />
                {showSuggestions.lpn &&
                  suggestions.lpn &&
                  suggestions.lpn.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.lpn.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('lpn', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label htmlFor="expiry">Expiry</Label>
              <Input
                id="expiry"
                type="date"
                value={filters.expiry}
                onChange={(e) => handleFieldChange('expiry', e.target.value)}
              />
            </div>

            {/* Container Number */}
            <div className="space-y-2 relative">
              <Label htmlFor="containerNumber">Container Number</Label>
              <div className="relative">
                <Input
                  id="containerNumber"
                  value={filters.containerNumber}
                  onChange={(e) => handleFieldChange('containerNumber', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('containerNumber')}
                />
                {showSuggestions.containerNumber &&
                  suggestions.containerNumber &&
                  suggestions.containerNumber.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.containerNumber.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('containerNumber', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Customer Reference */}
            <div className="space-y-2 relative">
              <Label htmlFor="customerReference">Customer Reference</Label>
              <div className="relative">
                <Input
                  id="customerReference"
                  value={filters.customerReference}
                  onChange={(e) => handleFieldChange('customerReference', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('customerReference')}
                />
                {showSuggestions.customerReference &&
                  suggestions.customerReference &&
                  suggestions.customerReference.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.customerReference.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('customerReference', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Inbound Order Number */}
            <div className="space-y-2 relative">
              <Label htmlFor="inboundOrderNumber">Inbound Order Number</Label>
              <div className="relative">
                <Input
                  id="inboundOrderNumber"
                  value={filters.inboundOrderNumber}
                  onChange={(e) => handleFieldChange('inboundOrderNumber', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('inboundOrderNumber')}
                />
                {showSuggestions.inboundOrderNumber &&
                  suggestions.inboundOrderNumber &&
                  suggestions.inboundOrderNumber.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.inboundOrderNumber.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('inboundOrderNumber', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Attribute 1 */}
            <div className="space-y-2 relative">
              <Label htmlFor="attribute1">Attribute 1</Label>
              <div className="relative">
                <Input
                  id="attribute1"
                  value={filters.attribute1}
                  onChange={(e) => handleFieldChange('attribute1', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('attribute1')}
                />
                {showSuggestions.attribute1 &&
                  suggestions.attribute1 &&
                  suggestions.attribute1.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.attribute1.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('attribute1', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Attribute 2 */}
            <div className="space-y-2 relative">
              <Label htmlFor="attribute2">Attribute 2</Label>
              <div className="relative">
                <Input
                  id="attribute2"
                  value={filters.attribute2}
                  onChange={(e) => handleFieldChange('attribute2', e.target.value)}
                  placeholder="Type to search..."
                  onFocus={() => handleFieldFocus('attribute2')}
                />
                {showSuggestions.attribute2 &&
                  suggestions.attribute2 &&
                  suggestions.attribute2.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.attribute2.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('attribute2', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Location Range From */}
            <div className="space-y-2 relative">
              <Label htmlFor="locationFrom">Location Range From</Label>
              <div className="relative">
                <Input
                  id="locationFrom"
                  value={filters.locationFrom}
                  onChange={(e) => handleFieldChange('locationFrom', e.target.value)}
                  placeholder="e.g., A01"
                  onFocus={() => handleFieldFocus('locationFrom')}
                />
                {showSuggestions.locationFrom &&
                  suggestions.location &&
                  suggestions.location.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.location.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('locationFrom', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Location Range To */}
            <div className="space-y-2 relative">
              <Label htmlFor="locationTo">Location Range To</Label>
              <div className="relative">
                <Input
                  id="locationTo"
                  value={filters.locationTo}
                  onChange={(e) => handleFieldChange('locationTo', e.target.value)}
                  placeholder="e.g., A10"
                  onFocus={() => handleFieldFocus('locationTo')}
                />
                {showSuggestions.locationTo &&
                  suggestions.location &&
                  suggestions.location.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                      {suggestions.location.map((suggestion) => (
                        <div
                          key={suggestion}
                          className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => handleSuggestionSelect('locationTo', suggestion)}
                        >
                          {suggestion}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={!warehouseId || loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
            {hasFilters && (
              <Button type="button" variant="outline" onClick={handleClear}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}


