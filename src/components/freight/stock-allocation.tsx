'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { Loader2, Package } from 'lucide-react'

type AvailableLPN = {
  id: number
  lpnNumber: string
  location: string
  huQty: number
  inboundProductLineId: number
  isAllocatedToOtherJob?: boolean
  allocatedToJobId?: number | null
  allocatedToJobCode?: string | null
}

type AvailabilityData = {
  productLineId: number
  batchNumber: string
  skuId: number
  requiredQty: number
  availableQty: number
  availableLPNs: AvailableLPN[]
}

interface StockAllocationProps {
  outboundInventoryId: number
  onAllocationComplete?: () => void
  productLineId?: number // Optional: filter to specific product line
}

export function StockAllocation({ outboundInventoryId, onAllocationComplete, productLineId }: StockAllocationProps) {
  const [loading, setLoading] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [availability, setAvailability] = useState<AvailabilityData[]>([])
  const [selectedLPNs, setSelectedLPNs] = useState<Record<number, string[]>>({})
  const [allocationMode, setAllocationMode] = useState<Record<number, 'manual' | 'auto'>>({})

  useEffect(() => {
    loadAvailability()
  }, [outboundInventoryId])

  const loadAvailability = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/outbound-inventory/${outboundInventoryId}/available-stock`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.availability) {
          // Filter to specific product line if provided
          const filteredAvailability = productLineId
            ? data.availability.filter((item: AvailabilityData) => item.productLineId === productLineId)
            : data.availability
          setAvailability(filteredAvailability)
          // Initialize allocation mode as auto for all
          const modes: Record<number, 'manual' | 'auto'> = {}
          filteredAvailability.forEach((item: AvailabilityData) => {
            modes[item.productLineId] = 'auto'
          })
          setAllocationMode(modes)
        }
      } else {
        toast.error('Failed to load available stock')
      }
    } catch (error) {
      console.error('Error loading availability:', error)
      toast.error('Failed to load available stock')
    } finally {
      setLoading(false)
    }
  }

  const toggleLPNSelection = (productLineId: number, lpnNumber: string, isDisabled: boolean) => {
    if (isDisabled) {
      return // Don't allow selection of disabled LPNs
    }
    setSelectedLPNs((prev) => {
      const current = prev[productLineId] || []
      const updated = current.includes(lpnNumber)
        ? current.filter((lpn) => lpn !== lpnNumber)
        : [...current, lpnNumber]
      return { ...prev, [productLineId]: updated }
    })
  }

  const handleAllocate = async () => {
    setAllocating(true)
    try {
      const allocations = availability
        .map((item) => {
          // Skip if no stock available
          if (item.availableQty === 0) {
            return null
          }

          if (allocationMode[item.productLineId] === 'manual') {
            // Manual allocation - use selected LPNs (filter out disabled ones)
            const lpnIds = (selectedLPNs[item.productLineId] || []).filter((lpnNumber) => {
              const lpn = item.availableLPNs.find((l) => l.lpnNumber === lpnNumber)
              return lpn && !lpn.isAllocatedToOtherJob
            })
            if (lpnIds.length === 0) {
              return null
            }
            return {
              productLineId: item.productLineId,
              batchNumber: item.batchNumber,
              lpnIds,
            }
          } else {
            // Auto allocation - allocate available quantity if less than required, otherwise required quantity
            const quantityToAllocate =
              item.availableQty < item.requiredQty ? item.availableQty : item.requiredQty
            return {
              productLineId: item.productLineId,
              batchNumber: item.batchNumber,
              quantity: quantityToAllocate,
            }
          }
        })
        .filter(Boolean)

      if (allocations.length === 0) {
        toast.error('No allocations to process')
        return
      }

      const res = await fetch(`/api/outbound-inventory/${outboundInventoryId}/allocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          if (data.errors && data.errors.length > 0) {
            data.errors.forEach((err: { productLineId: number; error: string }) => {
              toast.error(`Product line ${err.productLineId}: ${err.error}`)
            })
          }
          if (data.allocations && data.allocations.length > 0) {
            toast.success(`Successfully allocated ${data.allocations.length} product line(s)`)
            if (onAllocationComplete) {
              onAllocationComplete()
            }
            // Reload availability to show updated stock
            loadAvailability()
          }
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to allocate stock')
      }
    } catch (error) {
      console.error('Error allocating stock:', error)
      toast.error('Failed to allocate stock')
    } finally {
      setAllocating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading available stock...</span>
      </div>
    )
  }

  if (availability.length === 0) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No product lines found. Add product lines first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Stock Allocation</h3>
        <Button onClick={handleAllocate} disabled={allocating}>
          {allocating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Allocating...
            </>
          ) : (
            'Allocate Stock'
          )}
        </Button>
      </div>

      <div className="space-y-4">
        {availability.map((item) => {
          const isManualMode = allocationMode[item.productLineId] === 'manual'
          const selectedCount = selectedLPNs[item.productLineId]?.length || 0
          const selectedQty = isManualMode
            ? item.availableLPNs
                .filter((lpn) => selectedLPNs[item.productLineId]?.includes(lpn.lpnNumber))
                .reduce((sum, lpn) => sum + lpn.huQty, 0)
            : 0

          return (
            <Card key={item.productLineId}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    Batch: {item.batchNumber} | Required: {item.requiredQty} | Available:{' '}
                    {item.availableQty}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant={allocationMode[item.productLineId] === 'auto' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setAllocationMode((prev) => ({ ...prev, [item.productLineId]: 'auto' }))
                      }
                    >
                      Auto
                    </Button>
                    <Button
                      variant={allocationMode[item.productLineId] === 'manual' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() =>
                        setAllocationMode((prev) => ({ ...prev, [item.productLineId]: 'manual' }))
                      }
                    >
                      Manual
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {item.availableQty === 0 ? (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800">
                      No stock available for this batch. This batch has no stock left or has not been received/put away.
                    </p>
                  </div>
                ) : item.availableQty < item.requiredQty ? (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="text-sm text-yellow-800">
                      Warning: Insufficient stock. Available: {item.availableQty}, Required:{' '}
                      {item.requiredQty}. You can still allocate all available stock ({item.availableQty} units).
                    </p>
                  </div>
                ) : null}

                {isManualMode ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Select LPNs manually ({selectedCount} selected, {selectedQty} qty)
                    </p>
                    {item.availableLPNs.length > 0 ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                          {item.availableLPNs.map((lpn) => {
                            const isDisabled = lpn.isAllocatedToOtherJob === true
                            return (
                              <div
                                key={lpn.id}
                                className={`flex items-center space-x-2 p-2 border rounded ${
                                  isDisabled
                                    ? 'bg-gray-100 opacity-60 cursor-not-allowed'
                                    : 'hover:bg-muted cursor-pointer'
                                }`}
                                onClick={() =>
                                  toggleLPNSelection(item.productLineId, lpn.lpnNumber, isDisabled)
                                }
                                title={
                                  isDisabled
                                    ? `This LPN is allocated to job ${lpn.allocatedToJobCode || lpn.allocatedToJobId || 'another job'}`
                                    : undefined
                                }
                              >
                                <Checkbox
                                  checked={
                                    !isDisabled &&
                                    (selectedLPNs[item.productLineId]?.includes(lpn.lpnNumber) || false)
                                  }
                                  disabled={isDisabled}
                                  onCheckedChange={() =>
                                    toggleLPNSelection(item.productLineId, lpn.lpnNumber, isDisabled)
                                  }
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">
                                    {lpn.lpnNumber}
                                    {isDisabled && (
                                      <span className="ml-2 text-xs text-red-600">(Allocated)</span>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Qty: {lpn.huQty} | Location: {lpn.location}
                                  </p>
                                  {isDisabled && lpn.allocatedToJobCode && (
                                    <p className="text-xs text-red-600 mt-1">
                                      Allocated to: {lpn.allocatedToJobCode}
                                    </p>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        {item.availableLPNs.some((lpn) => lpn.isAllocatedToOtherJob) && (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <p className="text-xs text-yellow-800">
                              Some LPNs are already allocated to other jobs and cannot be selected.
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No available LPNs</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      Auto-allocation: Will allocate {item.requiredQty} units from available stock
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Available LPNs: {item.availableLPNs.length} ({item.availableQty} total qty)
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
