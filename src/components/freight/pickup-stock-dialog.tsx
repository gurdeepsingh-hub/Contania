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
import { PickupLPNInput } from './pickup-lpn-input'
import { toast } from 'sonner'
import { Loader2, Package, Truck } from 'lucide-react'

type AllocatedLPN = {
  id: number
  lpnNumber: string
  location: string
  huQty: number
  isPickedUp: boolean
}

type PickupInfo = {
  productLineId: number
  allocatedLPNs: AllocatedLPN[]
  existingPickups: Array<{
    id: number
    pickedUpQty: number
    bufferQty: number
    finalPickedUpQty: number
    pickupStatus: string
    createdAt: string
  }>
}

type ProductLineDetails = {
  id: number
  batchNumber?: string
  skuId?: number | { id: number; skuCode?: string }
  skuDescription?: string
}

interface PickupStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: number
}

export function PickupStockDialog({ open, onOpenChange, jobId }: PickupStockDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [jobStatus, setJobStatus] = useState<string>('')
  const [pickupInfo, setPickupInfo] = useState<Record<number, PickupInfo>>({})
  const [productLineDetails, setProductLineDetails] = useState<Record<number, ProductLineDetails>>({})
  const [selectedLPNs, setSelectedLPNs] = useState<Record<number, string[]>>({})
  const [bufferQtys, setBufferQtys] = useState<Record<number, number>>({})
  const [notes, setNotes] = useState<Record<number, string>>({})

  useEffect(() => {
    if (open && jobId) {
      loadPickupInfo()
    }
  }, [open, jobId])

  const loadPickupInfo = async () => {
    setLoading(true)
    try {
      // First, get all product lines for this job
      const jobRes = await fetch(`/api/outbound-inventory/${jobId}?depth=2`)
      if (!jobRes.ok) {
        toast.error('Failed to load job details')
        return
      }

      const jobData = await jobRes.json()
      if (!jobData.success || !jobData.job.productLines) {
        toast.error('No product lines found')
        return
      }

      // Store job status
      setJobStatus(jobData.job.status || 'draft')

      // Store product line details
      const detailsMap: Record<number, ProductLineDetails> = {}
      jobData.job.productLines.forEach((line: any) => {
        if (line.id) {
          detailsMap[line.id] = {
            id: line.id,
            batchNumber: line.batchNumber,
            skuId: line.skuId,
            skuDescription: line.skuDescription,
          }
        }
      })
      setProductLineDetails(detailsMap)

      // Load pickup info for each product line
      const infoPromises = jobData.job.productLines.map(async (line: any) => {
        const res = await fetch(`/api/outbound-product-lines/${line.id}/pickup-info`)
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            return { productLineId: line.id, info: data }
          }
        }
        return null
      })

      const results = await Promise.all(infoPromises)
      const infoMap: Record<number, PickupInfo> = {}

      results.forEach((result) => {
        if (result) {
          infoMap[result.productLineId] = {
            productLineId: result.productLineId,
            allocatedLPNs: result.info.allocatedLPNs,
            existingPickups: result.info.existingPickups,
          }
        }
      })

      setPickupInfo(infoMap)
    } catch (error) {
      console.error('Error loading pickup info:', error)
      toast.error('Failed to load pickup information')
    } finally {
      setLoading(false)
    }
  }

  const handleLPNAdd = (productLineId: number, lpnNumber: string) => {
    setSelectedLPNs((prev) => {
      const current = prev[productLineId] || []
      if (!current.includes(lpnNumber)) {
        return { ...prev, [productLineId]: [...current, lpnNumber] }
      }
      return prev
    })
  }

  const handleLPNRemove = (productLineId: number, lpnNumber: string) => {
    setSelectedLPNs((prev) => {
      const current = prev[productLineId] || []
      return { ...prev, [productLineId]: current.filter((lpn) => lpn !== lpnNumber) }
    })
  }

  const handleLPNAddBulk = (productLineId: number, lpnNumbers: string[]) => {
    setSelectedLPNs((prev) => {
      const current = prev[productLineId] || []
      const newLPNs = lpnNumbers.filter(lpn => !current.includes(lpn))
      return { ...prev, [productLineId]: [...current, ...newLPNs] }
    })
  }

  const calculatePickedUpQty = (productLineId: number): number => {
    const lpnNumbers = selectedLPNs[productLineId] || []
    const info = pickupInfo[productLineId]
    if (!info) return 0

    return lpnNumbers.reduce((sum, lpnNumber) => {
      const lpn = info.allocatedLPNs.find((l) => l.lpnNumber === lpnNumber)
      return sum + (lpn?.huQty || 0)
    }, 0)
  }

  const calculateFinalQty = (productLineId: number): number => {
    const pickedUpQty = calculatePickedUpQty(productLineId)
    const bufferQty = bufferQtys[productLineId] || 0
    return pickedUpQty + bufferQty
  }

  const handleSubmit = async () => {
    // Validate that at least one product line has LPNs selected
    const hasSelections = Object.values(selectedLPNs).some((lpns) => lpns.length > 0)
    if (!hasSelections) {
      toast.error('Please select at least one LPN to pick up')
      return
    }

    setSubmitting(true)
    try {
      const promises = Object.keys(selectedLPNs).map(async (productLineIdStr) => {
        const productLineId = parseInt(productLineIdStr, 10)
        const lpnNumbers = selectedLPNs[productLineId]
        if (lpnNumbers.length === 0) return null

        const res = await fetch(`/api/outbound-product-lines/${productLineId}/pickup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lpnNumbers,
            bufferQty: bufferQtys[productLineId] || 0,
            notes: notes[productLineId] || '',
          }),
        })

        if (!res.ok) {
          const error = await res.json()
          throw new Error(error.message || 'Failed to create pickup record')
        }

        return res.json()
      })

      const results = await Promise.all(promises)
      const successful = results.filter((r) => r !== null)

      if (successful.length > 0) {
        toast.success(`Successfully recorded pickup for ${successful.length} product line(s)`)
        onOpenChange(false)
        // Reset state
        setSelectedLPNs({})
        setBufferQtys({})
        setNotes({})
        // Reload page to show updated status
        if (typeof window !== 'undefined') {
          window.location.reload()
        }
      }
    } catch (error: any) {
      console.error('Error submitting pickup:', error)
      toast.error(error.message || 'Failed to record pickup')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCompletePickup = async () => {
    if (!confirm('Are you sure you want to complete pickup? This will mark the job as ready to dispatch.')) {
      return
    }

    setCompleting(true)
    try {
      const res = await fetch(`/api/outbound-inventory/${jobId}/complete-pickup`, {
        method: 'POST',
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.message || 'Failed to complete pickup')
      }

      toast.success('Pickup completed. Job is now ready to dispatch.')
      onOpenChange(false)
      // Reload page to show updated status
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    } catch (error: any) {
      console.error('Error completing pickup:', error)
      toast.error(error.message || 'Failed to complete pickup')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pickup Stock</DialogTitle>
            <DialogDescription>
              Record which LPN pallets have been picked up for this job.
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

  const productLineIds = Object.keys(pickupInfo).map((id) => parseInt(id, 10))

  if (productLineIds.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pickup Stock</DialogTitle>
            <DialogDescription>
              Record which LPN pallets have been picked up for this job.
            </DialogDescription>
          </DialogHeader>
          <div className="text-center py-8">
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No product lines found. Add product lines first.</p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pickup Stock</DialogTitle>
          <DialogDescription>
            Record which LPN pallets have been picked up. Select LPNs for each product line and add
            buffer quantity if needed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {productLineIds.map((productLineId) => {
            const info = pickupInfo[productLineId]
            const details = productLineDetails[productLineId]
            const selectedLPNsForLine = selectedLPNs[productLineId] || []
            const pickedUpQty = calculatePickedUpQty(productLineId)
            const bufferQty = bufferQtys[productLineId] || 0
            const finalQty = calculateFinalQty(productLineId)
            const hasExistingPickup = info.existingPickups.length > 0

            // Get SKU ID display
            const skuIdDisplay =
              details?.skuId && typeof details.skuId === 'object'
                ? details.skuId.skuCode || `SKU-${details.skuId.id}`
                : details?.skuId
                ? `SKU-${details.skuId}`
                : 'N/A'

            return (
              <Card key={productLineId}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Product Line #{productLineId}
                    {hasExistingPickup && (
                      <span className="text-xs font-normal text-green-600">
                        (Already has pickup record)
                      </span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {details?.batchNumber && (
                      <div>
                        <span className="font-medium">Batch:</span> {details.batchNumber}
                      </div>
                    )}
                    {skuIdDisplay !== 'N/A' && (
                      <div>
                        <span className="font-medium">SKU ID:</span> {skuIdDisplay}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* LPN Input */}
                  <div>
                    <Label className="mb-2 block">Select LPNs to Pick Up</Label>
                    <PickupLPNInput
                      availableLPNs={info.allocatedLPNs}
                      selectedLPNs={selectedLPNsForLine}
                      onLPNAdd={(lpnNumber) => handleLPNAdd(productLineId, lpnNumber)}
                      onLPNRemove={(lpnNumber) => handleLPNRemove(productLineId, lpnNumber)}
                      onLPNAddBulk={(lpnNumbers) => handleLPNAddBulk(productLineId, lpnNumbers)}
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
                        <Label htmlFor={`buffer-${productLineId}`} className="text-xs">
                          Buffer Qty
                        </Label>
                        <Input
                          id={`buffer-${productLineId}`}
                          type="number"
                          min="0"
                          value={bufferQty}
                          onChange={(e) =>
                            setBufferQtys((prev) => ({
                              ...prev,
                              [productLineId]: parseFloat(e.target.value) || 0,
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
                    <Label htmlFor={`notes-${productLineId}`}>Notes (Optional)</Label>
                    <Textarea
                      id={`notes-${productLineId}`}
                      value={notes[productLineId] || ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [productLineId]: e.target.value }))
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

        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <div>
            {jobStatus === 'picked' && (
              <Button
                variant="default"
                onClick={handleCompletePickup}
                disabled={completing || submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {completing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Completing...
                  </>
                ) : (
                  <>
                    <Package className="h-4 w-4 mr-2" />
                    Complete Pickup
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting || completing}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting || completing}>
              {submitting ? (
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
        </div>
      </DialogContent>
    </Dialog>
  )
}

