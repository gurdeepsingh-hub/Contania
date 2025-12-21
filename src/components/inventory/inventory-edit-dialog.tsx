'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
// Note: Install sonner for toast notifications: pnpm add sonner
// For now using alert as fallback
const toast = {
  success: (message: string) => alert(message),
  error: (message: string) => alert(message),
}

const editRecordSchema = z
  .object({
    location: z.string().min(1, 'Location is required'),
    huQty: z.number().min(1, 'HU Qty must be at least 1'),
    allocationStatus: z.enum(['available', 'allocated', 'picked']),
    batchNumber: z.string().optional(),
    outboundInventoryId: z.number().optional(),
    outboundProductLineId: z.number().optional(),
  })
  .refine(
    (data) => {
      // If status is allocated, outboundProductLineId is required
      if (data.allocationStatus === 'allocated' && !data.outboundProductLineId) {
        return false
      }
      return true
    },
    {
      message: 'Outbound product line is required when status is allocated',
      path: ['outboundProductLineId'],
    },
  )

type EditRecordFormData = z.infer<typeof editRecordSchema>

type PutAwayStockRecord = {
  id: number
  lpnNumber: string
  location: string
  huQty: number
  allocationStatus: 'available' | 'allocated' | 'picked'
  warehouseId?: number | { id: number }
  skuId?: number | { id: number }
  inboundProductLineId?: number | { id: number; batchNumber?: string; recievedQty?: number }
  outboundInventoryId?: number | { id: number }
  outboundProductLineId?: number | { id: number }
}

type InventoryEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordId: number | null
  onSuccess: () => void
}

export function InventoryEditDialog({
  open,
  onOpenChange,
  recordId,
  onSuccess,
}: InventoryEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [record, setRecord] = useState<PutAwayStockRecord | null>(null)
  const [fetching, setFetching] = useState(false)
  const [locations, setLocations] = useState<string[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [outboundJobs, setOutboundJobs] = useState<Array<{ id: number; jobCode?: string }>>([])
  const [loadingJobs, setLoadingJobs] = useState(false)
  const [productLines, setProductLines] = useState<
    Array<{ id: number; skuDescription?: string; batchNumber?: string }>
  >([])
  const [loadingProductLines, setLoadingProductLines] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
    setValue,
  } = useForm<EditRecordFormData>({
    resolver: zodResolver(editRecordSchema),
  })

  const allocationStatus = watch('allocationStatus')
  const outboundInventoryId = watch('outboundInventoryId')

  // Fetch record when dialog opens
  useEffect(() => {
    if (open && recordId) {
      fetchRecord()
    } else {
      setRecord(null)
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordId])

  const fetchRecord = async () => {
    if (!recordId) return

    try {
      setFetching(true)
      const res = await fetch(`/api/inventory/records/${recordId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.record) {
          const rec = data.record as any
          setRecord(rec)
          setValue('location', rec.location)
          setValue('huQty', rec.huQty)
          setValue('allocationStatus', rec.allocationStatus)
          // Set batch number if available
          const productLine =
            typeof rec.inboundProductLineId === 'object' ? rec.inboundProductLineId : null
          if (productLine?.batchNumber) {
            setValue('batchNumber', productLine.batchNumber)
          }

          // Fetch locations for the warehouse
          const warehouseId =
            typeof rec.warehouseId === 'object' ? rec.warehouseId.id : rec.warehouseId
          // Get SKU ID from the record
          const skuId = typeof rec.skuId === 'object' ? rec.skuId.id : rec.skuId

          // Get existing outbound job ID if present
          const existingJobId = rec.outboundInventoryId
            ? typeof rec.outboundInventoryId === 'object'
              ? rec.outboundInventoryId.id
              : rec.outboundInventoryId
            : undefined

          if (warehouseId) {
            fetchLocations(warehouseId)
            // Fetch outbound jobs, including existing linked job
            if (skuId) {
              fetchOutboundJobs(warehouseId, skuId, existingJobId)
            } else {
              fetchOutboundJobs(warehouseId, undefined, existingJobId)
            }
          }

          // Set existing outbound allocation if present
          if (rec.outboundInventoryId) {
            const jobId = existingJobId
            setSelectedJobId(jobId)
            setValue('outboundInventoryId', jobId)
            if (jobId) {
              // Get SKU ID from record for filtering product lines
              const skuIdForProductLines = typeof rec.skuId === 'object' ? rec.skuId.id : rec.skuId
              fetchProductLines(jobId, skuIdForProductLines)
            }
          }
          if (rec.outboundProductLineId) {
            const productLineId =
              typeof rec.outboundProductLineId === 'object'
                ? rec.outboundProductLineId.id
                : rec.outboundProductLineId
            setValue('outboundProductLineId', productLineId)
          }
        } else {
          toast.error('Failed to load record')
          onOpenChange(false)
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to load record')
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error fetching record:', error)
      toast.error('Failed to load record')
      onOpenChange(false)
    } finally {
      setFetching(false)
    }
  }

  const fetchLocations = async (warehouseId: number) => {
    try {
      setLoadingLocations(true)
      const res = await fetch(`/api/inventory/locations?warehouseId=${warehouseId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setLocations(data.locations || [])
        }
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
    } finally {
      setLoadingLocations(false)
    }
  }

  const fetchOutboundJobs = async (warehouseId: number, skuId?: number, existingJobId?: number) => {
    try {
      setLoadingJobs(true)
      // Fetch jobs with depth=2 to include product lines in a single request
      const res = await fetch(`/api/outbound-inventory?limit=1000&depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.jobs) {
          // Filter jobs by warehouse
          const warehouseFilteredJobs = (data.jobs || []).filter((job: any) => {
            const jobWarehouseId =
              typeof job.warehouseId === 'object' ? job.warehouseId?.id : job.warehouseId
            return jobWarehouseId === warehouseId
          })

          // If SKU ID is provided, filter jobs that have product lines matching the SKU
          // Note: Always include the existing linked job even if it doesn't match SKU filter
          if (skuId) {
            const jobsWithMatchingSKU: any[] = []
            let existingJobFound = false

            // Check each job for matching product lines
            for (const job of warehouseFilteredJobs) {
              // Always include the existing linked job
              if (existingJobId && job.id === existingJobId) {
                jobsWithMatchingSKU.push(job)
                existingJobFound = true
                continue
              }

              try {
                // Fetch product lines for this job
                const jobRes = await fetch(`/api/outbound-inventory/${job.id}?depth=2`)
                if (jobRes.ok) {
                  const jobData = await jobRes.json()
                  if (jobData.success && jobData.job) {
                    const productLines = jobData.job.productLines || []
                    // Check if any product line has a SKU matching the LPN's SKU
                    const hasMatchingSKU = productLines.some((line: any) => {
                      const lineSkuId = typeof line.skuId === 'object' ? line.skuId?.id : line.skuId
                      return lineSkuId === skuId
                    })
                    if (hasMatchingSKU) {
                      jobsWithMatchingSKU.push(job)
                    }
                  }
                }
              } catch (error) {
                console.error(`Error checking product lines for job ${job.id}:`, error)
              }
            }

            // If existing job wasn't found in warehouse filtered jobs, fetch it separately
            if (existingJobId && !existingJobFound) {
              try {
                const existingJobRes = await fetch(
                  `/api/outbound-inventory/${existingJobId}?depth=2`,
                )
                if (existingJobRes.ok) {
                  const existingJobData = await existingJobRes.json()
                  if (existingJobData.success && existingJobData.job) {
                    jobsWithMatchingSKU.unshift(existingJobData.job) // Add to beginning
                  }
                }
              } catch (error) {
                console.error(`Error fetching existing job ${existingJobId}:`, error)
              }
            }

            setOutboundJobs(jobsWithMatchingSKU)
          } else {
            setOutboundJobs(warehouseFilteredJobs)
          }
        } else {
          setOutboundJobs([])
        }
      } else {
        setOutboundJobs([])
      }
    } catch (error) {
      console.error('Error fetching outbound jobs:', error)
      setOutboundJobs([])
    } finally {
      setLoadingJobs(false)
    }
  }

  const fetchProductLines = async (jobId: number, skuId?: number) => {
    try {
      setLoadingProductLines(true)
      const res = await fetch(`/api/outbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job?.productLines) {
          let productLines = data.job.productLines || []

          // If SKU ID is provided, filter product lines to only show those matching the SKU
          if (skuId) {
            productLines = productLines.filter((line: any) => {
              const lineSkuId = typeof line.skuId === 'object' ? line.skuId?.id : line.skuId
              return lineSkuId === skuId
            })
          }

          setProductLines(productLines)
        }
      }
    } catch (error) {
      console.error('Error fetching product lines:', error)
      setProductLines([])
    } finally {
      setLoadingProductLines(false)
    }
  }

  // Ensure form value is set when jobs finish loading and record has existing outbound job
  useEffect(() => {
    if (!loadingJobs && record?.outboundInventoryId) {
      const existingJobId =
        typeof record.outboundInventoryId === 'object'
          ? record.outboundInventoryId.id
          : record.outboundInventoryId

      // Always set the form value if we have an existing job ID
      // This ensures the dropdown shows the correct value even if jobs are still loading
      const currentValue = watch('outboundInventoryId')
      if (currentValue !== existingJobId) {
        setValue('outboundInventoryId', existingJobId)
        setSelectedJobId(existingJobId)

        // Fetch product lines for the existing job if not already loaded
        if (existingJobId && productLines.length === 0) {
          const skuId = record
            ? typeof record.skuId === 'object'
              ? record.skuId.id
              : record.skuId
            : undefined
          fetchProductLines(existingJobId, skuId)
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundJobs, loadingJobs, record?.outboundInventoryId])

  // Fetch outbound jobs when status changes to allocated/picked or when record loads with allocated/picked status
  useEffect(() => {
    if (
      (allocationStatus === 'allocated' || allocationStatus === 'picked') &&
      record?.warehouseId
    ) {
      const warehouseId =
        typeof record.warehouseId === 'object' ? record.warehouseId.id : record.warehouseId
      const skuId = record
        ? typeof record.skuId === 'object'
          ? record.skuId.id
          : record.skuId
        : undefined

      // Always fetch jobs when status is allocated/picked (they might have been cleared or not loaded yet)
      // Include existing linked job if present
      const existingJobId = record?.outboundInventoryId
        ? typeof record.outboundInventoryId === 'object'
          ? record.outboundInventoryId.id
          : record.outboundInventoryId
        : undefined

      if (warehouseId) {
        if (skuId) {
          fetchOutboundJobs(warehouseId, skuId, existingJobId)
        } else {
          fetchOutboundJobs(warehouseId, undefined, existingJobId)
        }
      }
    } else if (
      !allocationStatus ||
      (allocationStatus !== 'allocated' && allocationStatus !== 'picked')
    ) {
      // Clear jobs when status is not allocated/picked
      setOutboundJobs([])
      setSelectedJobId(null)
      setProductLines([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allocationStatus, record?.warehouseId, record?.skuId])

  // Watch for outbound job selection changes
  useEffect(() => {
    if (outboundInventoryId) {
      const jobId = typeof outboundInventoryId === 'number' ? outboundInventoryId : null
      if (jobId && jobId !== selectedJobId) {
        setSelectedJobId(jobId)
        // Get SKU ID from record for filtering product lines
        const skuId = record
          ? typeof record.skuId === 'object'
            ? (record.skuId as { id: number }).id
            : record.skuId
          : undefined
        fetchProductLines(jobId, skuId)
        // Clear product line selection when job changes
        setValue('outboundProductLineId', undefined)
      }
    } else {
      setSelectedJobId(null)
      setProductLines([])
      setValue('outboundProductLineId', undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundInventoryId, selectedJobId])

  const onSubmit = async (data: EditRecordFormData) => {
    if (!recordId) return

    try {
      setLoading(true)
      const res = await fetch(`/api/inventory/records/${recordId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Record updated successfully')
          onOpenChange(false)
          onSuccess()
        } else {
          toast.error(result.message || 'Failed to update record')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to update record')
      }
    } catch (error) {
      console.error('Error updating record:', error)
      toast.error('Failed to update record')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Inventory Record</DialogTitle>
          <DialogDescription>
            {record && `Update details for LPN: ${record.lpnNumber}`}
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-muted-foreground">Loading record...</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              {loadingLocations ? (
                <div className="text-sm text-muted-foreground">Loading locations...</div>
              ) : (
                <Controller
                  name="location"
                  control={control}
                  render={({ field }) => (
                    <Select id="location" {...field} disabled={loading}>
                      <option value="">Select a location...</option>
                      {locations.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </Select>
                  )}
                />
              )}
              {errors.location && (
                <p className="text-sm text-destructive">{errors.location.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="huQty">HU Qty</Label>
              <Input
                id="huQty"
                type="number"
                {...register('huQty', { valueAsNumber: true })}
                placeholder="0"
                min="1"
                disabled={loading}
              />
              {errors.huQty && <p className="text-sm text-destructive">{errors.huQty.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="batchNumber">Batch Number (LPN Only)</Label>
              <Input
                id="batchNumber"
                {...register('batchNumber')}
                placeholder="e.g., BATCH001"
                disabled={loading}
              />
              {errors.batchNumber && (
                <p className="text-sm text-destructive">{errors.batchNumber.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Changing batch will create a new batch entry for this LPN only
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allocationStatus">Allocation Status</Label>
              <select
                id="allocationStatus"
                {...register('allocationStatus')}
                disabled={loading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                {record?.allocationStatus === 'available' && (
                  <>
                    <option value="available">Available</option>
                    <option value="allocated" disabled={outboundJobs.length === 0}>
                      Allocated
                      {outboundJobs.length === 0 ? ' (No outbound jobs available)' : ''}
                    </option>
                  </>
                )}
                {record?.allocationStatus === 'allocated' && (
                  <>
                    <option value="available">Available</option>
                    <option value="allocated">Allocated</option>
                    <option value="picked">Picked</option>
                  </>
                )}
                {record?.allocationStatus === 'picked' && (
                  <>
                    <option value="available">Available</option>
                    <option value="allocated">Allocated</option>
                    <option value="picked">Picked</option>
                  </>
                )}
                {!record?.allocationStatus && (
                  <>
                    <option value="available">Available</option>
                    <option value="allocated">Allocated</option>
                    <option value="picked">Picked</option>
                  </>
                )}
              </select>
              {errors.allocationStatus && (
                <p className="text-sm text-destructive">{errors.allocationStatus.message}</p>
              )}
            </div>

            {/* Show outbound job and product line selection when status is allocated or picked */}
            {(allocationStatus === 'allocated' || allocationStatus === 'picked') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="outboundInventoryId">Outbound Job *</Label>
                  {loadingJobs ? (
                    <div className="text-sm text-muted-foreground">Loading jobs...</div>
                  ) : (
                    <>
                      <Controller
                        name="outboundInventoryId"
                        control={control}
                        render={({ field }) => (
                          <Select
                            id="outboundInventoryId"
                            {...field}
                            disabled={loading || loadingJobs}
                            value={field.value?.toString() || ''}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : undefined
                              field.onChange(value)
                            }}
                          >
                            <option value="">Select an outbound job...</option>
                            {outboundJobs.map((job) => (
                              <option key={job.id} value={job.id}>
                                {job.jobCode || `Job #${job.id}`}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                      {outboundJobs.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          {record?.skuId
                            ? 'No outbound jobs with product lines matching this LPN&apos;s SKU'
                            : 'No outbound jobs available for this warehouse'}
                        </p>
                      )}
                    </>
                  )}
                  {errors.outboundInventoryId && (
                    <p className="text-sm text-destructive">{errors.outboundInventoryId.message}</p>
                  )}
                </div>

                {selectedJobId && (
                  <div className="space-y-2">
                    <Label htmlFor="outboundProductLineId">Outbound Product Line *</Label>
                    {loadingProductLines ? (
                      <div className="text-sm text-muted-foreground">Loading product lines...</div>
                    ) : (
                      <Controller
                        name="outboundProductLineId"
                        control={control}
                        rules={{
                          required:
                            allocationStatus === 'allocated' || allocationStatus === 'picked',
                        }}
                        render={({ field }) => (
                          <Select
                            id="outboundProductLineId"
                            {...field}
                            disabled={loading || loadingProductLines || !selectedJobId}
                            value={field.value?.toString() || ''}
                            onChange={(e) => {
                              const value = e.target.value ? Number(e.target.value) : undefined
                              field.onChange(value)
                            }}
                          >
                            <option value="">Select a product line...</option>
                            {productLines.map((line) => (
                              <option key={line.id} value={line.id}>
                                {line.skuDescription || `Product Line #${line.id}`}
                                {line.batchNumber ? ` (Batch: ${line.batchNumber})` : ''}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                    )}
                    {errors.outboundProductLineId && (
                      <p className="text-sm text-destructive">
                        {errors.outboundProductLineId.message}
                      </p>
                    )}
                    {productLines.length === 0 && !loadingProductLines && selectedJobId && (
                      <p className="text-xs text-muted-foreground">
                        No product lines available for this job
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
