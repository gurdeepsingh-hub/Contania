'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContainerProductLineFormExport } from '@/components/container-bookings/container-product-line-form-export'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'

type ContainerDetail = {
  id: number
  containerNumber: string
  warehouseId?: number | { id: number } | null
}

type StockAllocation = {
  id?: number
  containerDetailId: number
  containerBookingId: number
  stage: 'allocated' | 'picked' | 'dispatched'
  productLines?: any[]
}

interface Step6StockAllocationExportProps {
  bookingId: number
  bookingStatus?: string
  formData: {
    containerDetails?: ContainerDetail[]
    stockAllocations?: StockAllocation[]
  }
  warehouseId?: number
  onUpdate: (data: Partial<Step6StockAllocationExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step6StockAllocationExport({
  bookingId,
  bookingStatus,
  formData,
  warehouseId,
  onUpdate,
  errors,
}: Step6StockAllocationExportProps) {
  // During job creation (draft status), only allow 'allocated' stage
  const isCreating = bookingStatus === 'draft' || !bookingStatus
  const allowedStages = isCreating ? ['allocated'] : ['allocated', 'picked', 'dispatched']
  const [allocations, setAllocations] = useState<StockAllocation[]>(formData.stockAllocations || [])
  const [showProductLineModal, setShowProductLineModal] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null)
  const [selectedStage, setSelectedStage] = useState<'allocated' | 'picked' | 'dispatched'>(
    'allocated',
  )

  const containers = formData.containerDetails || []

  const addProductLine = (containerId: number, stage: 'allocated' | 'picked' | 'dispatched') => {
    setSelectedContainerId(containerId)
    setSelectedStage(stage)
    setShowProductLineModal(true)
  }

  const handleProductLineSave = async (productLine: any) => {
    if (!selectedContainerId) return

    try {
      const res = await fetch(`/api/export-container-bookings/${bookingId}/stock-allocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerDetailId: selectedContainerId,
          containerBookingId: bookingId,
          stage: selectedStage,
          productLines: [productLine],
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Stock allocation saved')
          setShowProductLineModal(false)
          setSelectedContainerId(null)
          // Reload allocations
          loadAllocations()
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save stock allocation')
      }
    } catch (error) {
      console.error('Error saving stock allocation:', error)
      toast.error('Failed to save stock allocation')
    }
  }

  const loadAllocations = async () => {
    try {
      // Request depth=2 to properly fetch product lines and their relationships (SKU, LPNs, etc.)
      const res = await fetch(
        `/api/export-container-bookings/${bookingId}/stock-allocations?depth=2`,
      )
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
                {(allowedStages as Array<'allocated' | 'picked' | 'dispatched'>).map((stage) => {
                  const stageAllocations = containerAllocations.filter((a) => a.stage === stage)
                  const isDisabled = isCreating && stage !== 'allocated'
                  return (
                    <div key={stage} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium capitalize">{stage}</h4>
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
                                      className="border-l-4 border-l-purple-500 pl-3 py-2 bg-muted/30 rounded text-sm"
                                    >
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div>
                                          <span className="text-xs text-muted-foreground">
                                            SKU:{' '}
                                          </span>
                                          <span className="font-medium">
                                            {typeof line.skuId === 'object'
                                              ? line.skuId?.skuCode || line.skuDescription
                                              : line.skuDescription || 'N/A'}
                                          </span>
                                        </div>
                                        <div>
                                          <span className="text-xs text-muted-foreground">
                                            Batch:{' '}
                                          </span>
                                          <span className="font-medium">
                                            {line.batchNumber || '-'}
                                          </span>
                                        </div>
                                        {stage === 'allocated' && (
                                          <>
                                            <div>
                                              <span className="text-xs text-muted-foreground">
                                                Allocated Qty:{' '}
                                              </span>
                                              <span className="font-medium">
                                                {line.allocatedQty || '-'}
                                              </span>
                                            </div>
                                            {line.allocatedWeight && (
                                              <div>
                                                <span className="text-xs text-muted-foreground">
                                                  Weight:{' '}
                                                </span>
                                                <span className="font-medium">
                                                  {line.allocatedWeight} kg
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {stage === 'picked' && (
                                          <>
                                            <div>
                                              <span className="text-xs text-muted-foreground">
                                                Picked Qty:{' '}
                                              </span>
                                              <span className="font-medium">
                                                {line.pickedQty || '-'}
                                              </span>
                                            </div>
                                            {line.pickedWeight && (
                                              <div>
                                                <span className="text-xs text-muted-foreground">
                                                  Weight:{' '}
                                                </span>
                                                <span className="font-medium">
                                                  {line.pickedWeight} kg
                                                </span>
                                              </div>
                                            )}
                                          </>
                                        )}
                                        {line.LPN &&
                                          Array.isArray(line.LPN) &&
                                          line.LPN.length > 0 && (
                                            <div className="col-span-2">
                                              <span className="text-xs text-muted-foreground">
                                                LPNs:{' '}
                                              </span>
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {line.LPN.map((lpn: any, lpnIdx: number) => (
                                                  <span
                                                    key={lpnIdx}
                                                    className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded"
                                                  >
                                                    {lpn.lpnNumber || lpn}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        {line.location && (
                                          <div>
                                            <span className="text-xs text-muted-foreground">
                                              Location:{' '}
                                            </span>
                                            <span className="font-medium">{line.location}</span>
                                          </div>
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

      <Dialog open={showProductLineModal} onOpenChange={setShowProductLineModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Product Line - Stage: {selectedStage}</DialogTitle>
          </DialogHeader>
          {selectedContainerId && (() => {
            // Get warehouseId from the selected container's details
            const selectedContainer = containers.find((c) => c.id === selectedContainerId)
            // Handle warehouseId as both object (from API) and number (from form)
            const containerWarehouseId = selectedContainer?.warehouseId
              ? typeof selectedContainer.warehouseId === 'object' && selectedContainer.warehouseId !== null
                ? (selectedContainer.warehouseId as any)?.id || selectedContainer.warehouseId
                : selectedContainer.warehouseId
              : warehouseId
            
            return (
              <ContainerProductLineFormExport
                containerDetailId={selectedContainerId}
                containerBookingId={bookingId}
                warehouseId={containerWarehouseId}
                stage={selectedStage}
                onSave={handleProductLineSave}
                onCancel={() => {
                  setShowProductLineModal(false)
                  setSelectedContainerId(null)
                }}
              />
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
