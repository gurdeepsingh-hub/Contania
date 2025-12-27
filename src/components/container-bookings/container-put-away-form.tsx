'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FormSelect } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp } from 'lucide-react'

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  recievedQty?: number
  palletSpaces?: number
}

type PutAwayRecord = {
  id: number
  containerDetailId: number | { id: number }
  containerStockAllocationId: number | { id: number }
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

// Product line with allocation context
type ProductLineWithContext = ProductLine & {
  allocationId: number
  productLineIndex: number
  uniqueKey: string // For React keys
}

interface ContainerPutAwayFormProps {
  bookingId: number
  containerId: number
  warehouseId: number
  allocationId?: number // Optional: filter to specific allocation
  onComplete: () => void
  onCancel?: () => void
  existingPutAwayRecords?: PutAwayRecord[] // Existing put-away records to check against
}

export function ContainerPutAwayForm({
  bookingId,
  containerId,
  warehouseId,
  allocationId,
  onComplete,
  onCancel,
  existingPutAwayRecords = [],
}: ContainerPutAwayFormProps) {
  const [warehouse, setWarehouse] = useState<Warehouse | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [saving, setSaving] = useState(false)
  const [bulkPutAway, setBulkPutAway] = useState<Record<string, boolean>>({})
  const [locations, setLocations] = useState<Record<string, Record<number, string>>>({})
  const [bulkLocations, setBulkLocations] = useState<Record<string, string>>({})
  const [lpns, setLpns] = useState<Record<string, string[]>>({})
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({})
  const [allocations, setAllocations] = useState<any[]>([])
  const [loadingAllocations, setLoadingAllocations] = useState(true)

  // Load allocations to get product line context
  useEffect(() => {
    const loadAllocations = async () => {
      setLoadingAllocations(true)
      try {
        const res = await fetch(
          `/api/import-container-bookings/${bookingId}/stock-allocations?containerDetailId=${containerId}&depth=2`,
        )
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            setAllocations(data.stockAllocations || data.containerStockAllocations || [])
          }
        }
      } catch (error) {
        console.error('Error loading allocations:', error)
      } finally {
        setLoadingAllocations(false)
      }
    }
    loadAllocations()
  }, [containerId, bookingId])

  // Create product lines with context (allocation ID and index)
  // Filter allocations to only include those for this specific container
  // If allocationId is provided, filter to that specific allocation
  const containerAllocations = allocations.filter((allocation: any) => {
    const allocationContainerId =
      typeof allocation.containerDetailId === 'object'
        ? allocation.containerDetailId.id
        : allocation.containerDetailId

    if (allocationContainerId !== containerId) return false

    // If allocationId is specified, only include that allocation
    if (allocationId) {
      const allocId = typeof allocation.id === 'object' ? allocation.id.id : allocation.id
      return allocId === allocationId
    }

    return true
  })

  const productLinesWithContext: ProductLineWithContext[] = containerAllocations.flatMap(
    (allocation) => {
      return (allocation.productLines || [])
        .map((line: ProductLine, index: number) => ({
          ...line,
          allocationId: allocation.id,
          productLineIndex: index,
          uniqueKey: `${allocation.id}-${index}`,
        }))
        .filter((line: ProductLineWithContext) => line.recievedQty && line.recievedQty > 0)
    },
  )

  // Get existing put-away records for a product line (by allocation and SKU ID)
  const getExistingPutAwayRecords = (allocationId: number, skuId: number): PutAwayRecord[] => {
    return existingPutAwayRecords.filter((record) => {
      const recordAllocationId =
        typeof record.containerStockAllocationId === 'object'
          ? record.containerStockAllocationId.id
          : record.containerStockAllocationId
      const recordSkuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
      // Match by allocation ID and SKU ID
      return recordAllocationId === allocationId && recordSkuId === skuId
    })
  }

  // Check if a product line is fully put away
  const isProductLineFullyPutAway = (line: ProductLineWithContext): boolean => {
    const palletCount = getPalletCount(line)
    if (palletCount === 0) return false

    const skuId = getSkuId(line)
    const existingRecords = getExistingPutAwayRecords(line.allocationId, skuId)
    return existingRecords.length >= palletCount
  }

  // Initialize bulk put-away as checked (default) for all product lines
  useEffect(() => {
    const initialBulk: Record<string, boolean> = {}
    productLinesWithContext.forEach((line) => {
      initialBulk[line.uniqueKey] = true
    })
    setBulkPutAway(initialBulk)
  }, [productLinesWithContext.length])

  // Generate LPNs when component mounts
  useEffect(() => {
    const generateLPNs = async () => {
      const lpnMap: Record<string, string[]> = {}
      let totalPallets = 0

      // Calculate total pallets needed
      for (const line of productLinesWithContext) {
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
            for (const line of productLinesWithContext) {
              const palletCount = getPalletCount(line)
              if (palletCount > 0) {
                lpnMap[line.uniqueKey] = data.lpns.slice(lpnIndex, lpnIndex + palletCount)
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
  }, [productLinesWithContext.length])

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
              const storeWarehouseId =
                typeof store.warehouseId === 'object' ? store.warehouseId.id : store.warehouseId
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
  const getPalletCount = (line: ProductLineWithContext): number => {
    if (line.recievedQty && line.lpnQty) {
      const lpnQtyNum = parseFloat(line.lpnQty)
      if (lpnQtyNum > 0) {
        return Math.ceil(line.recievedQty / lpnQtyNum)
      }
    }
    return 0
  }

  // Calculate HU quantity per pallet
  const getHuQtyPerPallet = (
    line: ProductLineWithContext,
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

    if (palletIndex < palletCount - 1) {
      return lpnQtyNum
    }

    const fullPalletsQty = lpnQtyNum * (palletCount - 1)
    const remainingQty = line.recievedQty - fullPalletsQty
    return remainingQty > 0 ? remainingQty : 0
  }

  // Get SKU ID from product line
  const getSkuId = (line: ProductLineWithContext): number => {
    if (typeof line.skuId === 'object' && line.skuId?.id) {
      return line.skuId.id
    }
    if (typeof line.skuId === 'number') {
      return line.skuId
    }
    return 0
  }

  // Get SKU description
  const getSkuDescription = (line: ProductLineWithContext): string => {
    if (typeof line.skuId === 'object' && line.skuId?.skuCode) {
      return `${line.skuId.skuCode} - ${line.skuDescription || ''}`
    }
    return line.skuDescription || 'N/A'
  }

  // Truncate text
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

  // Toggle expanded state
  const toggleExpanded = (uniqueKey: string) => {
    setExpandedLines((prev) => ({
      ...prev,
      [uniqueKey]: !prev[uniqueKey],
    }))
  }

  // Handle bulk location change
  const handleBulkLocationChange = (uniqueKey: string, location: string) => {
    setBulkLocations((prev) => ({ ...prev, [uniqueKey]: location }))
    setLocations((prev) => {
      const newLocations = { ...prev }
      delete newLocations[uniqueKey]
      return newLocations
    })
  }

  // Handle individual location change
  const handleLocationChange = (uniqueKey: string, palletIndex: number, location: string) => {
    setLocations((prev) => ({
      ...prev,
      [uniqueKey]: {
        ...prev[uniqueKey],
        [palletIndex]: location,
      },
    }))
  }

  // Toggle bulk put-away
  const toggleBulkPutAway = (uniqueKey: string) => {
    setBulkPutAway((prev) => {
      const newValue = !prev[uniqueKey]
      if (newValue) {
        setLocations((prev) => {
          const newLocations = { ...prev }
          delete newLocations[uniqueKey]
          return newLocations
        })
      } else {
        setBulkLocations((prev) => {
          const newBulk = { ...prev }
          delete newBulk[uniqueKey]
          return newBulk
        })
      }
      return { ...prev, [uniqueKey]: newValue }
    })
  }

  // Validate form - allow partial put-away (only require at least one location selected)
  const validateForm = (): boolean => {
    let hasAtLeastOneLocation = false

    for (const line of productLinesWithContext) {
      const palletCount = getPalletCount(line)
      if (palletCount === 0) continue

      if (isProductLineFullyPutAway(line)) continue

      const isBulk = bulkPutAway[line.uniqueKey] ?? true
      const skuId = getSkuId(line)
      const existingRecords = getExistingPutAwayRecords(line.allocationId, skuId)
      const startIndex = existingRecords.length
      const remainingPallets = palletCount - startIndex
      if (remainingPallets === 0) continue

      if (isBulk) {
        if (bulkLocations[line.uniqueKey]) {
          hasAtLeastOneLocation = true
        }
      } else {
        // Check if at least one pallet has a location
        for (let i = startIndex; i < palletCount; i++) {
          if (locations[line.uniqueKey]?.[i]) {
            hasAtLeastOneLocation = true
            break
          }
        }
      }
    }

    if (!hasAtLeastOneLocation) {
      toast.error('Please select at least one location for put-away')
      return false
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
        productLineIndex: number
        skuId: number
        location: string
        huQty: number
        lpnNumber: string
      }> = []

      for (const line of productLinesWithContext) {
        const palletCount = getPalletCount(line)
        if (palletCount === 0) continue

        if (isProductLineFullyPutAway(line)) continue

        const skuId = getSkuId(line)
        const isBulk = bulkPutAway[line.uniqueKey] ?? true
        const lineLpns = lpns[line.uniqueKey] || []
        const existingRecords = getExistingPutAwayRecords(line.allocationId, skuId)
        const startIndex = existingRecords.length

        if (isBulk) {
          const location = bulkLocations[line.uniqueKey]
          if (location) {
            for (let i = startIndex; i < palletCount; i++) {
              const huQty = getHuQtyPerPallet(line, i, palletCount)
              putAwayRecords.push({
                productLineIndex: line.productLineIndex,
                skuId,
                location,
                huQty,
                lpnNumber: lineLpns[i] || '',
              })
            }
          }
        } else {
          for (let i = startIndex; i < palletCount; i++) {
            const location = locations[line.uniqueKey]?.[i]
            if (location) {
              const huQty = getHuQtyPerPallet(line, i, palletCount)
              putAwayRecords.push({
                productLineIndex: line.productLineIndex,
                skuId,
                location,
                huQty,
                lpnNumber: lineLpns[i] || '',
              })
            }
          }
        }
      }

      const res = await fetch(
        `/api/import-container-bookings/${bookingId}/containers/${containerId}/put-away`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseId,
            putAwayRecords,
          }),
        },
      )

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

  // Show loading state while allocations are being fetched
  if (loadingAllocations) {
    return <div className="text-center py-8 text-muted-foreground">Loading product lines...</div>
  }

  return (
    <div className="space-y-4">
      {productLinesWithContext.map((line) => {
        const palletCount = getPalletCount(line)
        if (palletCount === 0) {
          return null
        }

        const skuId = getSkuId(line)
        const skuDescription = getSkuDescription(line)
        const isBulk = bulkPutAway[line.uniqueKey] ?? true
        const bulkLocation = bulkLocations[line.uniqueKey] || ''
        const individualLocations = locations[line.uniqueKey] || {}
        const lineLpns = lpns[line.uniqueKey] || []
        const isExpanded = expandedLines[line.uniqueKey] ?? false
        const isFullyPutAway = isProductLineFullyPutAway(line)

        return (
          <Card key={line.uniqueKey} className="overflow-hidden">
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
                    onClick={() => toggleExpanded(line.uniqueKey)}
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
                          onChange={() => toggleBulkPutAway(line.uniqueKey)}
                          className="w-4 h-4"
                        />
                        <span>Bulk</span>
                      </label>
                      {isBulk && (
                        <FormSelect
                          value={bulkLocation}
                          onChange={(e) => handleBulkLocationChange(line.uniqueKey, e.target.value)}
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
                          const skuId = getSkuId(line)
                          const existingRecords = getExistingPutAwayRecords(
                            line.allocationId,
                            skuId,
                          )
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
                                      handleBulkLocationChange(line.uniqueKey, e.target.value)
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
                                      handleLocationChange(line.uniqueKey, index, e.target.value)
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

      {!loadingAllocations &&
        productLinesWithContext.filter((line) => getPalletCount(line) > 0).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No product lines with received quantities to put away.
          </div>
        )}

      {!loadingAllocations && storeLocations.length === 0 && (
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
