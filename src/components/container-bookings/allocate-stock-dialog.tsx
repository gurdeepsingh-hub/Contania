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
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { toast } from 'sonner'
import { Save, Plus, X } from 'lucide-react'
import { StockAllocationExport } from './stock-allocation-export'

type SKU = {
  id: number
  skuCode: string
  description?: string
  huPerSu?: number
  weightPerHU_kg?: number
  lengthPerHU_mm?: number
  widthPerHU_mm?: number
  heightPerHU_mm?: number
}

type BatchOption = {
  batchNumber: string
  skuId: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
}

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  expectedQty?: number
  allocatedQty?: number
  expectedWeight?: number
  allocatedWeight?: number
  expectedCubicPerHU?: number
  allocatedCubicPerHU?: number
  weightPerHU?: number
  lpnQty?: string
  sqmPerSU?: number
  pltQty?: number
  LPN?: Array<{ lpnNumber: string }>
  location?: string
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type StockAllocation = {
  id: number
  containerDetailId?: number | { id: number; containerNumber?: string }
  productLines?: ProductLine[]
  stage?: string
}

interface AllocateStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bookingId: number
  containerId: number
  allocationId?: number // Optional: if editing existing allocation
  onComplete?: () => void
}

export function AllocateStockDialog({
  open,
  onOpenChange,
  bookingId,
  containerId,
  allocationId,
  onComplete,
}: AllocateStockDialogProps) {
  const [allocation, setAllocation] = useState<StockAllocation | null>(null)
  const [productLines, setProductLines] = useState<ProductLine[]>([])
  const [skuOptions, setSkuOptions] = useState<SKU[]>([])
  const [batchOptions, setBatchOptions] = useState<BatchOption[]>([])
  const [warehouseId, setWarehouseId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingBatches, setLoadingBatches] = useState(false)
  const [showLpnAllocation, setShowLpnAllocation] = useState(false)

  useEffect(() => {
    if (open) {
      loadContainer()
      loadSkus()
      if (allocationId) {
        loadAllocation()
      } else {
        // New allocation - start with empty product lines
        setAllocation(null)
        setProductLines([])
        setShowLpnAllocation(false)
      }
    }
  }, [open, allocationId, containerId])

  // Check if we should show LPN allocation mode
  useEffect(() => {
    if (allocation && allocation.productLines && allocation.productLines.length > 0) {
      // Show LPN allocation if:
      // 1. Any product line has expectedQty > allocatedQty (needs more stock)
      // 2. OR if allocationId exists (editing existing allocation)
      const needsAllocation = allocation.productLines.some(
        (line: ProductLine) => 
          line.expectedQty && 
          line.expectedQty > 0 && 
          (!line.allocatedQty || line.allocatedQty < line.expectedQty)
      )
      setShowLpnAllocation(needsAllocation || !!allocationId)
    } else if (allocationId) {
      // If we have an allocationId but no product lines loaded yet, show LPN allocation
      setShowLpnAllocation(true)
    } else {
      setShowLpnAllocation(false)
    }
  }, [allocation, allocationId])

  const loadContainer = async () => {
    try {
      const res = await fetch(`/api/container-details/${containerId}?depth=1`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.containerDetail) {
          const container = data.containerDetail
          const whId =
            typeof container.warehouseId === 'object'
              ? container.warehouseId.id
              : container.warehouseId
          if (whId) {
            setWarehouseId(whId)
            loadBatches(whId)
          }
        }
      }
    } catch (error) {
      console.error('Error loading container:', error)
    }
  }

  const loadBatches = async (whId: number) => {
    if (!whId) return

    setLoadingBatches(true)
    try {
      const res = await fetch(`/api/batches?warehouseId=${whId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.batches) {
          setBatchOptions(data.batches)
        }
      }
    } catch (error) {
      console.error('Error loading batches:', error)
    } finally {
      setLoadingBatches(false)
    }
  }

  const loadSkus = async () => {
    setLoadingSkus(true)
    try {
      const res = await fetch('/api/skus?limit=1000')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.skus) {
          setSkuOptions(data.skus)
        }
      }
    } catch (error) {
      console.error('Error loading SKUs:', error)
    } finally {
      setLoadingSkus(false)
    }
  }

  const loadAllocation = async () => {
    if (!allocationId) return

    setLoading(true)
    try {
      const res = await fetch(
        `/api/export-container-bookings/${bookingId}/stock-allocations/${allocationId}?depth=2`,
      )
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.stockAllocation) {
          setAllocation(data.stockAllocation)
          setProductLines(data.stockAllocation.productLines || [])
        } else {
          toast.error('Failed to load allocation data')
        }
      } else {
        toast.error('Failed to load allocation data')
      }
    } catch (error) {
      console.error('Error loading allocation:', error)
      toast.error('Failed to load allocation data')
    } finally {
      setLoading(false)
    }
  }

  const addProductLine = () => {
    setProductLines([...productLines, {}])
  }

  const removeProductLine = (index: number) => {
    setProductLines(productLines.filter((_, i) => i !== index))
  }

  const handleBatchChange = async (index: number, batchNumber: string) => {
    const updated = [...productLines]
    updated[index] = { ...updated[index], batchNumber }

    // Find the batch to get SKU ID
    const batch = batchOptions.find((b) => b.batchNumber === batchNumber)
    if (!batch) {
      setProductLines(updated)
      return
    }

    const batchSkuId =
      typeof batch.skuId === 'object' ? batch.skuId.id : batch.skuId
    if (!batchSkuId) {
      setProductLines(updated)
      return
    }

    // Auto-set SKU from batch
    updated[index].skuId = batchSkuId
    updated[index].skuDescription = batch.skuDescription || ''

    // Fetch SKU details to populate other fields
    try {
      const res = await fetch(`/api/skus/${batchSkuId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.sku) {
          const sku = data.sku as SKU
          updated[index].skuDescription = sku.description || ''
          updated[index].lpnQty = sku.huPerSu?.toString() || ''
          updated[index].weightPerHU = sku.weightPerHU_kg

          // Auto-calculate cubic from SKU dimensions
          if (
            sku.lengthPerHU_mm &&
            sku.widthPerHU_mm &&
            sku.heightPerHU_mm
          ) {
            const cubicM3 =
              (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) /
              1_000_000_000
            updated[index].expectedCubicPerHU = cubicM3
            updated[index].allocatedCubicPerHU = cubicM3
          }

          // Calculate pltQty if allocatedQty exists
          if (updated[index].allocatedQty && sku.huPerSu) {
            updated[index].pltQty = updated[index].allocatedQty / sku.huPerSu
          }
        }
      }
    } catch (error) {
      console.error('Error fetching SKU:', error)
    }

    setProductLines(updated)
  }

  const updateProductLine = async (
    index: number,
    field: keyof ProductLine,
    value: any,
  ) => {
    // Prevent NaN values from being stored
    if (typeof value === 'number' && isNaN(value)) {
      value = undefined
    }
    
    const updated = [...productLines]
    updated[index] = { ...updated[index], [field]: value }

    // If SKU changed, fetch SKU details
    if (field === 'skuId' && value) {
      const skuId = typeof value === 'object' ? value.id : value
      try {
        const res = await fetch(`/api/skus/${skuId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.sku) {
            const sku = data.sku as SKU
            updated[index].skuDescription = sku.description || ''
            updated[index].lpnQty = sku.huPerSu?.toString() || ''
            updated[index].weightPerHU = sku.weightPerHU_kg

            // Auto-calculate cubic from SKU dimensions
            if (
              sku.lengthPerHU_mm &&
              sku.widthPerHU_mm &&
              sku.heightPerHU_mm
            ) {
              const cubicM3 =
                (sku.lengthPerHU_mm * sku.widthPerHU_mm * sku.heightPerHU_mm) /
                1_000_000_000
              updated[index].expectedCubicPerHU = cubicM3
              updated[index].allocatedCubicPerHU = cubicM3
            }

            // Calculate pltQty if allocatedQty exists
            if (updated[index].allocatedQty && sku.huPerSu) {
              updated[index].pltQty = updated[index].allocatedQty / sku.huPerSu
            }
          }
        }
      } catch (error) {
        console.error('Error fetching SKU:', error)
      }
    }

    // Calculate pltQty when allocatedQty changes
    if (field === 'allocatedQty' && updated[index].skuId) {
      const skuId = typeof updated[index].skuId === 'object' 
        ? updated[index].skuId.id 
        : updated[index].skuId
      const sku = skuOptions.find((s) => s.id === skuId)
      if (sku && sku.huPerSu && value) {
        updated[index].pltQty = Number(value) / sku.huPerSu
      }
    }

    setProductLines(updated)
  }

  const handleSave = async () => {
    // Validate product lines
    const validLines = productLines.filter(
      (line) => line.skuId && (line.expectedQty || line.allocatedQty),
    )

    if (validLines.length === 0) {
      toast.error('Please add at least one product line with SKU and quantity')
      return
    }

    setSaving(true)
    try {
      const payload = {
        containerDetailId: containerId,
        stage: 'allocated',
        productLines: validLines.map((line) => {
          const productLine: any = {
            skuId: typeof line.skuId === 'object' ? line.skuId.id : line.skuId,
            skuDescription: line.skuDescription,
            batchNumber: line.batchNumber || '',
            expectedQty: line.expectedQty || 0,
            allocatedQty: line.allocatedQty || 0,
            LPN: line.LPN || [],
          }

          // Only include optional fields if they have values
          if (line.expectedWeight !== undefined && line.expectedWeight !== null) {
            productLine.expectedWeight = line.expectedWeight
          }
          if (line.allocatedWeight !== undefined && line.allocatedWeight !== null) {
            productLine.allocatedWeight = line.allocatedWeight
          }
          if (line.expectedCubicPerHU !== undefined && line.expectedCubicPerHU !== null) {
            productLine.expectedCubicPerHU = line.expectedCubicPerHU
          }
          if (line.allocatedCubicPerHU !== undefined && line.allocatedCubicPerHU !== null) {
            productLine.allocatedCubicPerHU = line.allocatedCubicPerHU
          }
          if (line.weightPerHU !== undefined && line.weightPerHU !== null) {
            productLine.weightPerHU = line.weightPerHU
          }
          if (line.lpnQty) {
            productLine.lpnQty = line.lpnQty
          }
          if (line.sqmPerSU !== undefined && line.sqmPerSU !== null) {
            productLine.sqmPerSU = line.sqmPerSU
          }
          if (line.pltQty !== undefined && line.pltQty !== null) {
            productLine.pltQty = line.pltQty
          }
          if (line.location) {
            productLine.location = line.location
          }
          if (line.expiryDate) {
            productLine.expiryDate = line.expiryDate
          }
          if (line.attribute1) {
            productLine.attribute1 = line.attribute1
          }
          if (line.attribute2) {
            productLine.attribute2 = line.attribute2
          }

          return productLine
        }),
      }

      let res
      if (allocationId) {
        // Update existing allocation
        res = await fetch(
          `/api/export-container-bookings/${bookingId}/stock-allocations/${allocationId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
      } else {
        // Create new allocation
        res = await fetch(
          `/api/export-container-bookings/${bookingId}/stock-allocations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        )
      }

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success(
            allocationId
              ? 'Stock allocation updated successfully'
              : 'Stock allocation created successfully',
          )
          onOpenChange(false)
          if (onComplete) {
            onComplete()
          }
        } else {
          toast.error(data.message || 'Failed to save allocation')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save allocation')
      }
    } catch (error) {
      console.error('Error saving allocation:', error)
      toast.error('Failed to save allocation')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  const handleAllocationComplete = () => {
    if (allocationId) {
      loadAllocation() // Reload to show updated allocation
    }
    if (onComplete) {
      onComplete()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showLpnAllocation
              ? 'Allocate Stock from LPNs'
              : allocationId
                ? 'Edit Stock Allocation'
                : 'Allocate Stock'}
          </DialogTitle>
          <DialogDescription>
            {showLpnAllocation
              ? 'Allocate available stock (LPNs) to product lines. Stock will be allocated from batches that match the product line requirements.'
              : 'Add product lines and allocate stock for this container. SKU details will be auto-populated when selected.'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="text-center py-8">Loading allocation data...</div>
          ) : showLpnAllocation && allocationId ? (
            <StockAllocationExport
              bookingId={bookingId}
              allocationId={allocationId}
              onAllocationComplete={handleAllocationComplete}
            />
          ) : (
            <>
              <div className="space-y-4">
                {productLines.map((line, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 bg-muted/50 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">Product Line {index + 1}</h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeProductLine(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {warehouseId ? (
                        <FormCombobox
                          label="Batch Number"
                          required
                          options={batchOptions.map((batch) => ({
                            value: batch.batchNumber,
                            label: batch.batchNumber,
                          }))}
                          value={line.batchNumber || ''}
                          onValueChange={(value) => {
                            if (value) {
                              handleBatchChange(index, value.toString())
                            } else {
                              updateProductLine(index, 'batchNumber', '')
                            }
                          }}
                          placeholder={
                            loadingBatches ? 'Loading batches...' : 'Select batch number'
                          }
                          disabled={loadingBatches || saving}
                        />
                      ) : (
                        <FormInput
                          label="Batch Number"
                          value={line.batchNumber || ''}
                          onChange={(e) =>
                            updateProductLine(index, 'batchNumber', e.target.value)
                          }
                          placeholder="Loading warehouse..."
                          disabled={true}
                        />
                      )}

                      <FormCombobox
                        label="SKU"
                        required
                        options={skuOptions.map((sku) => ({
                          value: sku.id.toString(),
                          label: `${sku.skuCode} - ${sku.description || ''}`,
                        }))}
                        value={
                          line.skuId
                            ? typeof line.skuId === 'object'
                              ? line.skuId.id.toString()
                              : line.skuId.toString()
                            : ''
                        }
                        onValueChange={(value) => {
                          if (value) {
                            const sku = skuOptions.find(
                              (s) => s.id.toString() === value.toString(),
                            )
                            updateProductLine(index, 'skuId', sku ? sku.id : Number(value))
                          } else {
                            updateProductLine(index, 'skuId', undefined)
                          }
                        }}
                        placeholder={
                          loadingSkus ? 'Loading SKUs...' : 'Select SKU'
                        }
                        disabled={loadingSkus || saving}
                      />

                      <FormInput
                        label="Expected Qty"
                        type="number"
                        min="0"
                        value={line.expectedQty || ''}
                        onChange={(e) =>
                          updateProductLine(
                            index,
                            'expectedQty',
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        placeholder="Expected quantity"
                        disabled={saving}
                      />

                      <FormInput
                        label="Allocated Qty"
                        type="number"
                        min="0"
                        value={line.allocatedQty || ''}
                        onChange={(e) =>
                          updateProductLine(
                            index,
                            'allocatedQty',
                            e.target.value ? Number(e.target.value) : undefined,
                          )
                        }
                        placeholder="Allocated quantity"
                        disabled={saving}
                        required
                      />

                      <FormInput
                        label="Expected Weight (kg)"
                        type="number"
                        min="0"
                        step="any"
                        value={line.expectedWeight != null ? line.expectedWeight : ''}
                        onChange={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || value === null || value === undefined) {
                            updateProductLine(index, 'expectedWeight', undefined)
                            return
                          }
                          const numValue = Number(value)
                          if (isNaN(numValue)) {
                            // Don't update if invalid number
                            return
                          }
                          updateProductLine(index, 'expectedWeight', numValue)
                        }}
                        placeholder="Expected weight (optional)"
                        disabled={saving}
                      />

                      <FormInput
                        label="Allocated Weight (kg)"
                        type="number"
                        min="0"
                        step="any"
                        value={line.allocatedWeight != null ? line.allocatedWeight : ''}
                        onChange={(e) => {
                          const value = e.target.value.trim()
                          if (value === '' || value === null || value === undefined) {
                            updateProductLine(index, 'allocatedWeight', undefined)
                            return
                          }
                          const numValue = Number(value)
                          if (isNaN(numValue)) {
                            // Don't update if invalid number
                            return
                          }
                          updateProductLine(index, 'allocatedWeight', numValue)
                        }}
                        placeholder="Allocated weight (optional)"
                        disabled={saving}
                      />

                      <FormInput
                        label="Location"
                        value={line.location || ''}
                        onChange={(e) =>
                          updateProductLine(index, 'location', e.target.value)
                        }
                        placeholder="Storage location"
                        disabled={saving}
                      />

                      {line.skuDescription && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-muted-foreground">
                            <strong>Description:</strong> {line.skuDescription}
                          </p>
                        </div>
                      )}

                      {line.lpnQty && (
                        <div className="md:col-span-2 text-sm text-muted-foreground">
                          <strong>LPN Qty:</strong> {line.lpnQty}
                          {line.pltQty && (
                            <span className="ml-4">
                              <strong>Pallet Qty:</strong> {line.pltQty.toFixed(2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={addProductLine}
                  disabled={saving}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product Line
                </Button>
              </div>

              <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving
                    ? 'Saving...'
                    : allocationId
                      ? 'Update Allocation'
                      : 'Create Allocation'}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

