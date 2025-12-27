'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContainerProductLineFormImport } from '@/components/container-bookings/container-product-line-form-import'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

type ContainerDetail = {
  id: number
  containerNumber: string
}

type StockAllocation = {
  id?: number
  containerDetailId: number
  containerBookingId: number
  stage: 'expected' | 'received' | 'put_away'
  productLines?: any[]
}

interface Step6StockAllocationImportProps {
  bookingId: number
  bookingStatus?: string
  formData: {
    containerDetails?: ContainerDetail[]
    stockAllocations?: StockAllocation[]
  }
  onUpdate: (data: Partial<Step6StockAllocationImportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step6StockAllocationImport({
  bookingId,
  bookingStatus,
  formData,
  onUpdate,
  errors,
}: Step6StockAllocationImportProps) {
  // During job creation (draft status), only allow 'expected' stage
  const isCreating = bookingStatus === 'draft' || !bookingStatus
  const allowedStages = isCreating ? ['expected'] : ['expected', 'received', 'put_away']
  const [allocations, setAllocations] = useState<StockAllocation[]>(
    formData.stockAllocations || [],
  )
  const [showProductLineModal, setShowProductLineModal] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null)
  const [selectedStage, setSelectedStage] = useState<'expected' | 'received' | 'put_away'>('expected')
  const [saving, setSaving] = useState(false)

  const containers = formData.containerDetails || []

  const addProductLine = (containerId: number, stage: 'expected' | 'received' | 'put_away') => {
    setSelectedContainerId(containerId)
    setSelectedStage(stage)
    setShowProductLineModal(true)
  }

  const handleProductLineSave = async (productLine: any) => {
    if (!selectedContainerId || saving) return

    setSaving(true)
    try {
      // Map product line fields to match ContainerStockAllocations schema
      const mappedProductLine = {
        skuId: productLine.skuId,
        skuDescription: productLine.skuDescription,
        batchNumber: productLine.batchNumber,
        lpnQty: productLine.lpnQty,
        sqmPerSU: productLine.sqmPerSU,
        // Import-specific fields
        expectedQtyImport: productLine.expectedQty || productLine.expectedQtyImport,
        recievedQty: productLine.recievedQty,
        expectedWeightImport: productLine.expectedWeight || productLine.expectedWeightImport,
        recievedWeight: productLine.recievedWeight,
        weightPerHU: productLine.weightPerHU,
        expectedCubicPerHU: productLine.expectedCubicPerHU,
        recievedCubicPerHU: productLine.recievedCubicPerHU,
        palletSpaces: productLine.palletSpaces,
        expiryDate: productLine.expiryDate,
        attribute1: productLine.attribute1,
        attribute2: productLine.attribute2,
      }

      const res = await fetch(`/api/import-container-bookings/${bookingId}/stock-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerDetailId: selectedContainerId,
          containerBookingId: bookingId,
          stage: selectedStage,
          productLines: [mappedProductLine],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Stock allocation saved')
          setShowProductLineModal(false)
          setSelectedContainerId(null)
          // Reload allocations
          await loadAllocations()
        } else {
          toast.error(data.message || 'Failed to save stock allocation')
        }
      } else {
        const error = await res.json().catch(() => ({ message: 'Failed to save stock allocation' }))
        toast.error(error.message || 'Failed to save stock allocation')
      }
    } catch (error) {
      console.error('Error saving stock allocation:', error)
      toast.error('Failed to save stock allocation')
    } finally {
      setSaving(false)
    }
  }

  const loadAllocations = async () => {
    try {
      // Request depth=2 to properly fetch product lines and their relationships (SKU, LPNs, etc.)
      const res = await fetch(`/api/import-container-bookings/${bookingId}/stock-allocations?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stockAllocations) {
          setAllocations(data.stockAllocations)
          onUpdate({ stockAllocations: data.stockAllocations })
        }
      }
    } catch (error) {
      console.error('Error loading allocations:', error)
    }
  }

  useEffect(() => {
    if (bookingId) {
      loadAllocations()
    }
  }, [bookingId])

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Stock Allocation</h3>

      {containers.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No containers defined. Please complete Step 5 first.</p>
        </div>
      )}

      <div className="space-y-4">
        {containers.map((container) => {
          const containerAllocations = allocations.filter((a) => {
            const aContainerId =
              typeof a.containerDetailId === 'object'
                ? a.containerDetailId?.id || a.containerDetailId
                : a.containerDetailId
            return aContainerId === container.id
          })

          return (
            <Card key={container.id}>
              <CardHeader>
                <CardTitle>Container: {container.containerNumber}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(allowedStages as Array<'expected' | 'received' | 'put_away'>).map((stage) => {
                  const stageAllocations = containerAllocations.filter((a) => a.stage === stage)
                  const isDisabled = isCreating && stage !== 'expected'
                  return (
                    <div key={stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">{stage.replace('_', ' ')}</h4>
                        {!isDisabled && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => addProductLine(container.id, stage)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Product Line
                          </Button>
                        )}
                        {isDisabled && (
                          <span className="text-xs text-muted-foreground">
                            Available after job creation
                          </span>
                        )}
                      </div>
                      {stageAllocations.length > 0 && (
                        <div className="space-y-3 mt-3">
                          {stageAllocations.map((allocation) => (
                            <div key={allocation.id} className="space-y-2">
                              {allocation.productLines && allocation.productLines.length > 0 && (
                                <div className="space-y-2">
                                  {allocation.productLines.map((line: any, idx: number) => (
                                    <div
                                      key={idx}
                                      className="border-l-4 border-l-blue-500 pl-3 py-2 bg-muted/30 rounded text-sm"
                                    >
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div>
                                          <span className="text-xs text-muted-foreground">SKU: </span>
                                          <span className="font-medium">
                                            {typeof line.skuId === 'object'
                                              ? line.skuId?.skuCode || line.skuDescription
                                              : line.skuDescription || 'N/A'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-xs text-muted-foreground">Batch: </span>
                                          <span className="font-medium">{line.batchNumber || '-'}</span>
                                        </div>
                                        {stage === 'expected' && (
                                          <>
                                            <div>
                                              <span className="text-xs text-muted-foreground">
                                                Expected Qty:{' '}
                                              </span>
                                              <span className="font-medium">
                                                {line.expectedQtyImport || line.expectedQty || '-'}
                                              </span>
                                            </div>
                                            {line.expectedWeightImport && (
                                              <div>
                                                <span className="text-xs text-muted-foreground">
                                                  Weight:{' '}
                                                </span>
                                                <span className="font-medium">
                                                  {line.expectedWeightImport} kg
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {stage === 'received' && (
                                          <>
                                            <div>
                                              <span className="text-xs text-muted-foreground">
                                                Received Qty:{' '}
                                              </span>
                                              <span className="font-medium">
                                                {line.recievedQty || '-'}
                                              </span>
                                            </div>
                                            {line.recievedWeight && (
                                              <div>
                                                <span className="text-xs text-muted-foreground">
                                                  Weight:{' '}
                                                </span>
                                                <span className="font-medium">
                                                  {line.recievedWeight} kg
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={showProductLineModal} onOpenChange={(open) => {
        if (!open && !saving) {
          setShowProductLineModal(false)
          setSelectedContainerId(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product Line - Stage: {selectedStage}</DialogTitle>
          </DialogHeader>
          {saving && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">Saving product line...</p>
            </div>
          )}
          {selectedContainerId && !saving && (
            <ContainerProductLineFormImport
              containerDetailId={selectedContainerId}
              containerBookingId={bookingId}
              stage={selectedStage}
              onSave={handleProductLineSave}
              onCancel={() => {
                if (!saving) {
                  setShowProductLineModal(false)
                  setSelectedContainerId(null)
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

