'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PickupLPNInput } from '@/components/freight/pickup-lpn-input'
import { toast } from 'sonner'
import { Loader2, Package, Truck } from 'lucide-react'

type AllocatedLPN = {
  id: number
  lpnNumber: string
  location: string
  huQty: number
  isPickedUp: boolean
  allocationId: number
  productLineIndex: number
}

type ProductLineInfo = {
  allocationId: number
  productLineIndex: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  expectedQty?: number
  allocatedQty?: number
  pickedQty?: number
}

type StockAllocation = {
  id: number
  containerDetailId?: number | { id: number; containerNumber?: string }
  productLines?: Array<{
    skuId?: number | { id: number; skuCode?: string; description?: string }
    skuDescription?: string
    batchNumber?: string
    expectedQty?: number
    allocatedQty?: number
    pickedQty?: number
  }>
  stage?: string
}

interface PickStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: number
  containerId: number
  allocationId?: number // Optional: filter to specific allocation
  onComplete?: () => void
}

export function PickStockDialog({
  open,
  onOpenChange,
  bookingId,
  containerId,
  allocationId,
  onComplete,
}: PickStockDialogProps) {
  const [allocations, setAllocations] = useState<StockAllocation[]>([])
  const [productLineInfo, setProductLineInfo] = useState<Record<string, ProductLineInfo>>({})
  const [allocatedLPNs, setAllocatedLPNs] = useState<Record<string, AllocatedLPN[]>>({})
  const [selectedLPNs, setSelectedLPNs] = useState<Record<string, string[]>>({})
  const [bufferQtys, setBufferQtys] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && containerId) {
      loadData()
    } else {
      // Reset state when dialog closes
      setSelectedLPNs({})
      setBufferQtys({})
      setNotes({})
    }
  }, [open, containerId, allocationId])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load allocations
      const url = allocationId
        ? `/api/export-container-bookings/${bookingId}/stock-allocations/${allocationId}?depth=2`
        : `/api/export-container-bookings/${bookingId}/stock-allocations?containerDetailId=${containerId}&depth=2`

      const res = await fetch(url)
      if (!res.ok) {
        toast.error('Failed to load allocation data')
        return
      }

      const data = await res.json()
      if (!data.success) {
        toast.error('Failed to load allocation data')
        return
      }

      const allocationsData = allocationId
        ? [data.stockAllocation]
        : data.stockAllocations || []

      // Filter to only allocations for this container and stage 'allocated'
      const filteredAllocations = allocationsData.filter((alloc: StockAllocation) => {
        const allocContainerId =
          typeof alloc.containerDetailId === 'object'
            ? alloc.containerDetailId.id
            : alloc.containerDetailId
        return allocContainerId === containerId && alloc.stage === 'allocated'
      })

      setAllocations(filteredAllocations)

      // Load allocated LPNs
      const lpnRes = await fetch(
        `/api/export-container-bookings/${bookingId}/containers/${containerId}/allocated-lpns`
      )
      if (!lpnRes.ok) {
        toast.error('Failed to load allocated LPNs')
        return
      }

      const lpnData = await lpnRes.json()
      if (!lpnData.success) {
        toast.error('Failed to load allocated LPNs')
        return
      }

      // Build product line info and LPN mappings
      const productLineInfoMap: Record<string, ProductLineInfo> = {}
      const lpnMap: Record<string, AllocatedLPN[]> = {}

      filteredAllocations.forEach((alloc: StockAllocation) => {
        if (alloc.productLines && alloc.productLines.length > 0) {
          alloc.productLines.forEach((line, lineIndex) => {
            if (line.allocatedQty && line.allocatedQty > 0) {
              const key = `${alloc.id}-${lineIndex}`
              productLineInfoMap[key] = {
                allocationId: alloc.id,
                productLineIndex: lineIndex,
                skuId: line.skuId,
                skuDescription: line.skuDescription,
                batchNumber: line.batchNumber,
                expectedQty: line.expectedQty,
                allocatedQty: line.allocatedQty,
                pickedQty: line.pickedQty,
              }

              // Get LPNs for this product line
              const lpnKey = `${alloc.id}-${lineIndex}`
              const lpns = lpnData.allocatedLPNs[lpnKey] || []
              lpnMap[key] = lpns.map((lpn: any) => ({
                id: lpn.id,
                lpnNumber: lpn.lpnNumber,
                location: lpn.location,
                huQty: lpn.huQty,
                isPickedUp: lpn.isPickedUp,
                allocationId: alloc.id,
                productLineIndex: lineIndex,
              }))
            }
          })
        }
      })

      setProductLineInfo(productLineInfoMap)
      setAllocatedLPNs(lpnMap)
    } catch (error) {
      console.error('Error loading data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleLPNAdd = (key: string, lpnNumber: string) => {
    setSelectedLPNs((prev) => {
      const current = prev[key] || []
      if (!current.includes(lpnNumber)) {
        return { ...prev, [key]: [...current, lpnNumber] }
      }
      return prev
    })
  }

  const handleLPNRemove = (key: string, lpnNumber: string) => {
    setSelectedLPNs((prev) => {
      const current = prev[key] || []
      return { ...prev, [key]: current.filter((lpn) => lpn !== lpnNumber) }
    })
  }

  const handleLPNAddBulk = (key: string, lpnNumbers: string[]) => {
    setSelectedLPNs((prev) => {
      const current = prev[key] || []
      const newLPNs = lpnNumbers.filter((lpn) => !current.includes(lpn))
      return { ...prev, [key]: [...current, ...newLPNs] }
    })
  }

  const calculatePickedUpQty = (key: string): number => {
    const lpnNumbers = selectedLPNs[key] || []
    const lpns = allocatedLPNs[key] || []
    return lpnNumbers.reduce((sum, lpnNumber) => {
      const lpn = lpns.find((l) => l.lpnNumber === lpnNumber)
      return sum + (lpn?.huQty || 0)
    }, 0)
  }

  const calculateFinalQty = (key: string): number => {
    const pickedUpQty = calculatePickedUpQty(key)
    const bufferQty = bufferQtys[key] || 0
    return pickedUpQty + bufferQty
  }

  const handleSave = async () => {
    // Validate that at least one product line has LPNs selected
    const hasSelections = Object.values(selectedLPNs).some((lpns) => lpns.length > 0)
    if (!hasSelections) {
      toast.error('Please select at least one LPN to pick up')
      return
    }

    setSaving(true)
    try {
      const pickups: Array<{
        allocationId: number
        productLineIndex: number
        lpnIds: number[]
        bufferQty?: number
        notes?: string
      }> = []

      // Build pickup requests for each product line with selected LPNs
      for (const [key, lpnNumbers] of Object.entries(selectedLPNs)) {
        if (lpnNumbers.length === 0) continue

        const info = productLineInfo[key]
        if (!info) continue

        const lpns = allocatedLPNs[key] || []
        const lpnIds = lpnNumbers
          .map((lpnNumber) => {
            const lpn = lpns.find((l) => l.lpnNumber === lpnNumber)
            return lpn?.id
          })
          .filter((id): id is number => id !== undefined)

        if (lpnIds.length > 0) {
          pickups.push({
            allocationId: info.allocationId,
            productLineIndex: info.productLineIndex,
            lpnIds,
            bufferQty: bufferQtys[key] || 0,
            notes: notes[key] || '',
          })
        }
      }

      if (pickups.length === 0) {
        toast.error('No valid LPNs selected')
        return
      }

      const res = await fetch(
        `/api/export-container-bookings/${bookingId}/containers/${containerId}/pickup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pickups }),
        }
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to create pickup records')
      }

      const data = await res.json()
      if (data.success) {
        toast.success(`Successfully recorded pickup for ${pickups.length} product line(s)`)
        onOpenChange(false)
        if (onComplete) {
          onComplete()
        }
      } else {
        throw new Error(data.message || 'Failed to create pickup records')
      }
    } catch (error) {
      console.error('Error saving pickup:', error)
      toast.error(
        error instanceof Error ? error.message : 'Failed to save pickup',
      )
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick Stock</DialogTitle>
            <DialogDescription>
              Record which LPN pallets have been picked up for this container.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading pickup information...</span>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  const productLineKeys = Object.keys(productLineInfo)

  if (productLineKeys.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pick Stock</DialogTitle>
            <DialogDescription>
              Record which LPN pallets have been picked up for this container.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No allocated product lines found for this container.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick Stock</DialogTitle>
          <DialogDescription>
            Select LPNs that have been picked up. Select LPNs for each product line and add buffer
            quantity if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {productLineKeys.map((key) => {
            const info = productLineInfo[key]
            const lpns = allocatedLPNs[key] || []
            const selectedLPNsForLine = selectedLPNs[key] || []
            const pickedUpQty = calculatePickedUpQty(key)
            const bufferQty = bufferQtys[key] || 0
            const finalQty = calculateFinalQty(key)

            // Get SKU display
            const skuCode =
              info.skuId && typeof info.skuId === 'object'
                ? info.skuId.skuCode || `SKU-${info.skuId.id}`
                : info.skuId
                ? `SKU-${info.skuId}`
                : 'N/A'

            return (
              <Card key={key}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Product Line (Allocation {info.allocationId}, Line {info.productLineIndex + 1})
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {info.batchNumber && (
                      <div>
                        <span className="font-medium">Batch:</span> {info.batchNumber}
                      </div>
                    )}
                    {skuCode !== 'N/A' && (
                      <div>
                        <span className="font-medium">SKU:</span> {skuCode}
                      </div>
                    )}
                    {info.skuDescription && (
                      <div>
                        <span className="font-medium">Description:</span> {info.skuDescription}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <div>
                      <span className="font-medium">Expected:</span> {info.expectedQty || 0}
                    </div>
                    <div>
                      <span className="font-medium">Allocated:</span> {info.allocatedQty || 0}
                    </div>
                    {info.pickedQty && info.pickedQty > 0 && (
                      <div>
                        <span className="font-medium">Already Picked:</span> {info.pickedQty}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* LPN Input */}
                  <div>
                    <Label className="mb-2 block">Select LPNs to Pick Up</Label>
                    <PickupLPNInput
                      availableLPNs={lpns}
                      selectedLPNs={selectedLPNsForLine}
                      onLPNAdd={(lpnNumber) => handleLPNAdd(key, lpnNumber)}
                      onLPNRemove={(lpnNumber) => handleLPNRemove(key, lpnNumber)}
                      onLPNAddBulk={(lpnNumbers) => handleLPNAddBulk(key, lpnNumbers)}
                    />
                  </div>

                  {/* Quantity Summary */}
                  {selectedLPNsForLine.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 p-3 bg-muted rounded-md">
                      <div>
                        <div className="text-xs text-muted-foreground">Picked Up Qty</div>
                        <div className="text-lg font-semibold">{pickedUpQty}</div>
                      </div>
                      <div>
                        <Label htmlFor={`buffer-${key}`} className="text-xs">
                          Buffer Qty
                        </Label>
                        <Input
                          id={`buffer-${key}`}
                          type="number"
                          min="0"
                          value={bufferQty}
                          onChange={(e) =>
                            setBufferQtys((prev) => ({
                              ...prev,
                              [key]: parseFloat(e.target.value) || 0,
                            }))
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Final Pickup Qty</div>
                        <div className="text-lg font-semibold text-green-600">{finalQty}</div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  <div>
                    <Label htmlFor={`notes-${key}`}>Notes (Optional)</Label>
                    <Textarea
                      id={`notes-${key}`}
                      value={notes[key] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder="Add any notes about this pickup..."
                      rows={2}
                      className="mt-1"
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Recording Pickup...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Record Pickup
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
