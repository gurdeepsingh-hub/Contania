'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp } from 'lucide-react'

type ProductLine = {
  id: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  recievedQty?: number
  palletSpaces?: number
}

type PutAwayRecord = {
  id: number
  inboundProductLineId: number | { id: number }
  skuId: number | { id: number }
  location: string
  huQty: number
  lpnNumber: string
}

type Warehouse = {
  id: number
  name: string
}

type Store = {
  id: number
  storeName: string
  warehouseId: number | { id: number }
  zoneType: 'Indock' | 'Outdock' | 'Storage'
  countable?: boolean
}

interface PutAwayFormProps {
  jobId: number
  productLines: ProductLine[]
  warehouseId: number
  onComplete: () => void
  onCancel?: () => void
  existingPutAwayRecords?: PutAwayRecord[] // Existing put-away records to check against
}

export function PutAwayForm({
  jobId,
  productLines,
  warehouseId,
  onComplete,
  onCancel,
  existingPutAwayRecords = [],
}: PutAwayFormProps) {
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [saving, setSaving] = useState(false)
  const [bulkPutAway, setBulkPutAway] = useState<Record<number, boolean>>({})
  const [locations, setLocations] = useState<Record<number, Record<number, string>>>({})
  const [bulkLocations, setBulkLocations] = useState<Record<number, string>>({})
  const [lpns, setLpns] = useState<Record<number, string[]>>({})
  const [expandedLines, setExpandedLines] = useState<Record<number, boolean>>({})

  // Get existing put-away records for each product line
  const getExistingPutAwayRecords = (productLineId: number): PutAwayRecord[] => {
    return existingPutAwayRecords.filter((record) => {
      const recordProductLineId =
        typeof record.inboundProductLineId === 'object'
          ? record.inboundProductLineId.id
          : record.inboundProductLineId
      return recordProductLineId === productLineId
    })
  }

  // Check if a product line is fully put away
  const isProductLineFullyPutAway = (line: ProductLine): boolean => {
    const palletCount = getPalletCount(line)
    if (palletCount === 0) return false

    const existingRecords = getExistingPutAwayRecords(line.id)
    return existingRecords.length >= palletCount
  }

  // Initialize bulk put-away as checked (default) for all product lines
  useEffect(() => {
    const initialBulk: Record<number, boolean> = {}
    productLines.forEach((line) => {
      initialBulk[line.id] = true
    })
    setBulkPutAway(initialBulk)
  }, [productLines])

  // Generate LPNs when component mounts
  useEffect(() => {
    const generateLPNs = async () => {
      const lpnMap: Record<number, string[]> = {}
      let totalPallets = 0

      // Calculate total pallets needed
      for (const line of productLines) {
        const palletCount = getPalletCount(line)
        if (palletCount > 0) {
          totalPallets += palletCount
        }
      }

      if (totalPallets === 0) {
        return
      }

      try {
        const res = await fetch('/api/put-away-stock/generate-lpns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ count: totalPallets }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.lpns) {
            let lpnIndex = 0
            for (const line of productLines) {
              const palletCount = getPalletCount(line)
              if (palletCount > 0) {
                lpnMap[line.id] = data.lpns.slice(lpnIndex, lpnIndex + palletCount)
                lpnIndex += palletCount
              }
            }
            setLpns(lpnMap)
          }
        }
      } catch (error) {
        console.error('Error generating LPNs:', error)
        toast.error('Failed to generate LPN numbers')
      }
    }

    generateLPNs()
  }, [productLines])

  // Load warehouse data
  useEffect(() => {
    const loadWarehouse = async () => {
      try {
        const res = await fetch(`/api/warehouses/${warehouseId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.warehouse) {
            setWarehouse(data.warehouse)
          }
        }
      } catch (error) {
        console.error('Error loading warehouse:', error)
        toast.error('Failed to load warehouse data')
      }
    }

    if (warehouseId) {
      loadWarehouse()
    }
  }, [warehouseId])

  // Load stores for this warehouse
  useEffect(() => {
    const loadStores = async () => {
      try {
        const res = await fetch(`/api/stores?limit=1000&depth=0`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.stores) {
            // Filter stores by warehouseId
            const warehouseStores = data.stores.filter((store: Store) => {
              const storeWarehouseId = typeof store.warehouseId === 'object' 
                ? store.warehouseId.id 
                : store.warehouseId
              return storeWarehouseId === warehouseId
            })
            setStores(warehouseStores)
          }
        }
      } catch (error) {
        console.error('Error loading stores:', error)
        toast.error('Failed to load store locations')
      }
    }

    if (warehouseId) {
      loadStores()
    }
  }, [warehouseId])

  // Calculate number of pallets for a product line based on RECEIVED qty only
  const getPalletCount = (line: ProductLine): number => {
    // Use received qty, not expected qty (palletSpaces is based on expected qty)
    if (line.recievedQty && line.lpnQty) {
      const lpnQtyNum = parseFloat(line.lpnQty)
      if (lpnQtyNum > 0) {
        return Math.ceil(line.recievedQty / lpnQtyNum)
      }
    }
    // If no received qty, return 0 (can't put away if nothing received)
    return 0
  }

  // Calculate HU quantity per pallet
  // Logic: Fill pallets with capacity (lpnQty), then assign remaining qty to last pallet
  const getHuQtyPerPallet = (
    line: ProductLine,
    palletIndex: number,
    palletCount: number,
  ): number => {
    if (!line.recievedQty || !line.lpnQty || palletCount === 0) {
      return 0
    }

    const lpnQtyNum = parseFloat(line.lpnQty)
    if (lpnQtyNum <= 0) {
      return 0
    }

    // Fill all pallets except the last one with full capacity
    if (palletIndex < palletCount - 1) {
      return lpnQtyNum
    }

    // Last pallet gets the remaining quantity
    const fullPalletsQty = lpnQtyNum * (palletCount - 1)
    const remainingQty = line.recievedQty - fullPalletsQty
    return remainingQty > 0 ? remainingQty : 0
  }

  // Get SKU ID from product line
  const getSkuId = (line: ProductLine): number => {
    if (typeof line.skuId === 'object' && line.skuId?.id) {
      return line.skuId.id
    }
    if (typeof line.skuId === 'number') {
      return line.skuId
    }
    return 0
  }

  // Get SKU description (truncated to 2 lines)
  const getSkuDescription = (line: ProductLine): string => {
    if (typeof line.skuId === 'object' && line.skuId?.skuCode) {
      return `${line.skuId.skuCode} - ${line.skuDescription || ''}`
    }
    return line.skuDescription || 'N/A'
  }

  // Truncate text to 2 lines
  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + '...'
  }

  // Get warehouse store locations
  const getStoreLocations = (): string[] => {
    if (!stores || stores.length === 0) {
      return []
    }
    return stores.map((s) => s.storeName).filter(Boolean)
  }

  // Toggle expanded state for accordion
  const toggleExpanded = (lineId: number) => {
    setExpandedLines((prev) => ({
      ...prev,
      [lineId]: !prev[lineId],
    }))
  }

  // Handle bulk location change
  const handleBulkLocationChange = (productLineId: number, location: string) => {
    setBulkLocations((prev) => ({ ...prev, [productLineId]: location }))
    // Clear individual locations when bulk is enabled
    setLocations((prev) => {
      const newLocations = { ...prev }
      delete newLocations[productLineId]
      return newLocations
    })
  }

  // Handle individual location change
  const handleLocationChange = (productLineId: number, palletIndex: number, location: string) => {
    setLocations((prev) => ({
      ...prev,
      [productLineId]: {
        ...prev[productLineId],
        [palletIndex]: location,
      },
    }))
  }

  // Toggle bulk put-away
  const toggleBulkPutAway = (productLineId: number) => {
    setBulkPutAway((prev) => {
      const newValue = !prev[productLineId]
      if (newValue) {
        // Clear individual locations when enabling bulk
        setLocations((prev) => {
          const newLocations = { ...prev }
          delete newLocations[productLineId]
          return newLocations
        })
      } else {
        // Clear bulk location when disabling bulk
        setBulkLocations((prev) => {
          const newBulk = { ...prev }
          delete newBulk[productLineId]
          return newBulk
        })
      }
      return { ...prev, [productLineId]: newValue }
    })
  }

  // Validate form
  const validateForm = (): boolean => {
    for (const line of productLines) {
      const palletCount = getPalletCount(line)
      if (palletCount === 0) continue // Skip if no received qty

      // Skip validation if already fully put away
      if (isProductLineFullyPutAway(line)) continue

      const isBulk = bulkPutAway[line.id] ?? true
      const existingRecords = getExistingPutAwayRecords(line.id)

      // Only validate pallets that haven't been put away yet
      const remainingPallets = palletCount - existingRecords.length
      if (remainingPallets === 0) continue

      if (isBulk) {
        if (!bulkLocations[line.id]) {
          toast.error(`Please select a location for ${getSkuDescription(line)}`)
          return false
        }
      } else {
        // Check only remaining pallets
        for (let i = existingRecords.length; i < palletCount; i++) {
          if (!locations[line.id]?.[i]) {
            toast.error(
              `Please select locations for all remaining pallets of ${getSkuDescription(line)}`,
            )
            return false
          }
        }
      }
    }
    return true
  }

  // Handle form submission
  const handleSubmit = async () => {
    if (!validateForm()) {
      return
    }

    setSaving(true)
    try {
      const putAwayRecords: Array<{
        inboundProductLineId: number
        skuId: number
        location: string
        huQty: number
        lpnNumber: string
      }> = []

      for (const line of productLines) {
        const palletCount = getPalletCount(line)
        if (palletCount === 0) continue // Skip if no received qty

        // Skip if already fully put away
        if (isProductLineFullyPutAway(line)) continue

        const skuId = getSkuId(line)
        const isBulk = bulkPutAway[line.id] ?? true
        const lineLpns = lpns[line.id] || []
        const existingRecords = getExistingPutAwayRecords(line.id)
        const startIndex = existingRecords.length // Start from where we left off

        if (isBulk) {
          const location = bulkLocations[line.id]
          if (location) {
            // Create records for remaining pallets with same location
            for (let i = startIndex; i < palletCount; i++) {
              const huQty = getHuQtyPerPallet(line, i, palletCount)
              putAwayRecords.push({
                inboundProductLineId: line.id,
                skuId,
                location,
                huQty,
                lpnNumber: lineLpns[i] || '',
              })
            }
          }
        } else {
          // Create records with individual locations for remaining pallets
          for (let i = startIndex; i < palletCount; i++) {
            const location = locations[line.id]?.[i]
            if (location) {
              const huQty = getHuQtyPerPallet(line, i, palletCount)
              putAwayRecords.push({
                inboundProductLineId: line.id,
                skuId,
                location,
                huQty,
                lpnNumber: lineLpns[i] || '',
              })
            }
          }
        }
      }

      const res = await fetch('/api/put-away-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          warehouseId,
          putAwayRecords,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Put-away records created successfully')
          onComplete()
        } else {
          toast.error(data.message || 'Failed to create put-away records')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to create put-away records')
      }
    } catch (error) {
      console.error('Error submitting put-away:', error)
      toast.error('Failed to create put-away records')
    } finally {
      setSaving(false)
    }
  }

  const storeLocations = getStoreLocations()

  return (
    <div className="space-y-4">
      {productLines.map((line) => {
        const palletCount = getPalletCount(line)
        if (palletCount === 0) {
          // Skip product lines with no received qty
          return null
        }

        const skuId = getSkuId(line)
        const skuDescription = getSkuDescription(line)
        const isBulk = bulkPutAway[line.id] ?? true
        const bulkLocation = bulkLocations[line.id] || ''
        const individualLocations = locations[line.id] || {}
        const lineLpns = lpns[line.id] || []
        const isExpanded = expandedLines[line.id] ?? false
        const isFullyPutAway = isProductLineFullyPutAway(line)

        return (
          <Card key={line.id} className="overflow-hidden">
            {/* Compact Product Line Header */}
            <CardHeader className="pb-3">
              <div className="flex flex-col items-start justify-between gap-4">
                <div className="flex-1 flex justify-between items-center w-full min-w-0">
                  <div className="">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-semibold truncate">
                        {truncateText(skuDescription, 60)}
                      </CardTitle>
                      {line.batchNumber && (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          Batch: {line.batchNumber}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {palletCount} pallet{palletCount !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        Qty: {line.recievedQty || 0}
                      </span>
                      {isFullyPutAway && (
                        <span className="text-xs text-green-600 font-medium whitespace-nowrap">
                          ✓ All Put Away
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {line.skuDescription}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(line.id)}
                    className="h-8 w-8 p-0"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  {!isFullyPutAway && (
                    <>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={isBulk}
                          onChange={() => toggleBulkPutAway(line.id)}
                          className="w-4 h-4"
                        />
                        <span>Bulk</span>
                      </label>
                      {isBulk && (
                        <FormSelect
                          value={bulkLocation}
                          onChange={(e) => handleBulkLocationChange(line.id, e.target.value)}
                          options={storeLocations.map((loc) => ({
                            value: loc,
                            label: loc,
                          }))}
                          placeholder="Select location..."
                          containerClassName="min-w-[200px]"
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </CardHeader>

            {/* Accordion Content */}
            {isExpanded && (
              <CardContent className="pt-0">
                <div className="overflow-x-auto">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead className="sticky top-0 bg-background border-b">
                        <tr>
                          <th className="text-left p-2 font-medium">Sr. No.</th>
                          <th className="text-left p-2 font-medium">LPN Number</th>
                          <th className="text-left p-2 font-medium">SKU ID</th>
                          <th className="text-left p-2 font-medium">Qty HU</th>
                          <th className="text-left p-2 font-medium">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: palletCount }).map((_, index) => {
                          const existingRecords = getExistingPutAwayRecords(line.id)
                          const existingRecord = existingRecords[index]
                          const isPutAway = !!existingRecord
                          const srNo = index + 1

                          return (
                            <tr key={index} className="border-b">
                              <td className="p-2">
                                <span className="font-medium">{srNo}</span>
                              </td>
                              <td className="p-2">
                                <span className="font-mono font-semibold text-primary">
                                  {isPutAway
                                    ? existingRecord.lpnNumber
                                    : lineLpns[index] || 'Generating...'}
                                </span>
                                {isPutAway && (
                                  <span className="ml-2 text-xs text-green-600">(Put Away)</span>
                                )}
                              </td>
                              <td className="p-2">
                                <span>{skuId}</span>
                              </td>
                              <td className="p-2">
                                <span>
                                  {isPutAway
                                    ? existingRecord.huQty
                                    : getHuQtyPerPallet(line, index, palletCount)}
                                </span>
                              </td>
                              <td className="p-2">
                                {isPutAway ? (
                                  <span className="text-sm text-muted-foreground">
                                    {existingRecord.location} (Put Away)
                                  </span>
                                ) : isBulk && index === 0 ? (
                                  <FormSelect
                                    value={bulkLocation}
                                    onChange={(e) =>
                                      handleBulkLocationChange(line.id, e.target.value)
                                    }
                                    options={storeLocations.map((loc) => ({
                                      value: loc,
                                      label: loc,
                                    }))}
                                    placeholder="Select location..."
                                    containerClassName="min-w-[200px]"
                                  />
                                ) : isBulk ? (
                                  <span className="text-sm text-muted-foreground">
                                    {bulkLocation || 'Same as above'}
                                  </span>
                                ) : (
                                  <FormSelect
                                    value={individualLocations[index] || ''}
                                    onChange={(e) =>
                                      handleLocationChange(line.id, index, e.target.value)
                                    }
                                    options={storeLocations.map((loc) => ({
                                      value: loc,
                                      label: loc,
                                    }))}
                                    placeholder="Select location..."
                                    containerClassName="min-w-[200px]"
                                  />
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        )
      })}

      {productLines.filter((line) => getPalletCount(line) > 0).length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No product lines with received quantities to put away.
        </div>
      )}

      {storeLocations.length === 0 && (
        <div className="text-center py-4 text-muted-foreground">
          No storage locations found for this warehouse. Please add stores in Entity Settings first.
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4 border-t">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={saving || storeLocations.length === 0 || Object.keys(lpns).length === 0}
        >
          {saving ? 'Saving...' : 'Save Put-Away'}
        </Button>
      </div>
    </div>
  )
}
