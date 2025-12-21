'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
// Note: Install sonner for toast notifications: pnpm add sonner
// For now using alert as fallback
const toast = {
  success: (message: string) => alert(message),
  error: (message: string) => alert(message),
}

type OutboundJob = {
  id: number
  jobCode: string
}

type OutboundProductLine = {
  id: number
  skuId: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
}

type LPNBulkEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  recordIds: number[]
  onSuccess: () => void
}

export function LPNBulkEditDialog({
  open,
  onOpenChange,
  recordIds,
  onSuccess,
}: LPNBulkEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [outboundJobs, setOutboundJobs] = useState<OutboundJob[]>([])
  const [productLines, setProductLines] = useState<OutboundProductLine[]>([])
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null)
  const [lpnSkus, setLpnSkus] = useState<Set<number>>(new Set())
  const [lpnWarehouses, setLpnWarehouses] = useState<Set<number>>(new Set())
  const { register, handleSubmit, reset, watch, setValue } = useForm()

  const allocationStatus = watch('allocationStatus')

  // Fetch LPN records to get SKU IDs and warehouse IDs
  useEffect(() => {
    if (open && recordIds.length > 0) {
      fetchLPNDetails()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recordIds])

  // Fetch outbound jobs when status is allocated and LPN details are loaded
  useEffect(() => {
    if (open && allocationStatus === 'allocated' && lpnSkus.size > 0) {
      fetchOutboundJobs()
    } else {
      setOutboundJobs([])
      setProductLines([])
      setSelectedJobId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, allocationStatus, lpnSkus, lpnWarehouses])

  // Fetch product lines when job is selected
  useEffect(() => {
    if (selectedJobId && lpnSkus.size > 0) {
      fetchProductLines(selectedJobId)
    } else {
      setProductLines([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedJobId, lpnSkus])

  const fetchLPNDetails = async () => {
    try {
      setFetching(true)
      const skuIds = new Set<number>()
      const warehouseIds = new Set<number>()

      // Use batch API to fetch all LPN records in a single request
      const res = await fetch('/api/inventory/records/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: recordIds }),
      })

      if (!res.ok) {
        throw new Error('Failed to fetch LPN details')
      }

      const data = await res.json()
      if (data.success && data.records) {
        // Extract SKU IDs and warehouse IDs from batch response
        for (const record of data.records) {
          if (record.skuId) {
            skuIds.add(record.skuId)
          }
          if (record.warehouseId) {
            warehouseIds.add(record.warehouseId)
          }
        }
      }

      setLpnSkus(skuIds)
      setLpnWarehouses(warehouseIds)
    } catch (error) {
      console.error('Error fetching LPN details:', error)
      toast.error('Failed to load LPN details')
    } finally {
      setFetching(false)
    }
  }

  const fetchOutboundJobs = async () => {
    try {
      setFetching(true)
      // Fetch jobs with depth=2 to include product lines in a single request
      const res = await fetch('/api/outbound-inventory?limit=1000&depth=2')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.jobs) {
          // Filter jobs by warehouse (if all LPNs are from same warehouse, filter by that)
          let warehouseFilteredJobs = data.jobs

          // If all LPNs are from the same warehouse, filter by warehouse
          if (lpnWarehouses.size === 1) {
            const warehouseId = Array.from(lpnWarehouses)[0]
            warehouseFilteredJobs = data.jobs.filter((job: any) => {
              const jobWarehouseId =
                typeof job.warehouseId === 'object' ? job.warehouseId?.id : job.warehouseId
              return jobWarehouseId === warehouseId
            })
          }

          // If we have SKU IDs, filter jobs that have product lines matching any of the LPNs' SKU IDs
          // Note: productLines might not be populated in list response, so we need to fetch them
          if (lpnSkus.size > 0) {
            const jobsWithMatchingSKU: any[] = []

            // Check each job for matching product lines
            for (const job of warehouseFilteredJobs) {
              try {
                // Fetch product lines for this job
                const jobRes = await fetch(`/api/outbound-inventory/${job.id}?depth=2`)
                if (jobRes.ok) {
                  const jobData = await jobRes.json()
                  if (jobData.success && jobData.job) {
                    const productLines = jobData.job.productLines || []
                    // Check if any product line has a SKU matching any of the LPNs' SKUs
                    const hasMatchingSKU = productLines.some((line: any) => {
                      const lineSkuId = typeof line.skuId === 'object' ? line.skuId?.id : line.skuId
                      return lpnSkus.has(lineSkuId)
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

            setOutboundJobs(jobsWithMatchingSKU)
          } else {
            // No SKU filtering needed, show all warehouse-filtered jobs
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
      toast.error('Failed to load outbound jobs')
      setOutboundJobs([])
    } finally {
      setFetching(false)
    }
  }

  const fetchProductLines = async (jobId: number) => {
    try {
      setFetching(true)
      const res = await fetch(`/api/outbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job && data.job.productLines) {
          // Filter product lines to only show those matching any of the LPNs' SKU IDs
          const filteredLines = data.job.productLines.filter((line: any) => {
            const lineSkuId = typeof line.skuId === 'object' ? line.skuId?.id : line.skuId
            return lpnSkus.has(lineSkuId)
          })
          setProductLines(filteredLines)
        }
      }
    } catch (error) {
      console.error('Error fetching product lines:', error)
      toast.error('Failed to load product lines')
    } finally {
      setFetching(false)
    }
  }

  const onSubmit = async (data: {
    location?: string
    allocationStatus?: string
    outboundInventoryId?: number
    outboundProductLineId?: number
  }) => {
    if (recordIds.length === 0) {
      toast.error('No records selected')
      return
    }

    // If status is allocated, require outbound product line
    if (data.allocationStatus === 'allocated' && !data.outboundProductLineId) {
      toast.error('Outbound product line is required when status is allocated')
      return
    }

    try {
      setLoading(true)

      // Get current user for allocatedBy
      const userRes = await fetch('/api/tenant-users/me')
      let userId: number | undefined
      if (userRes.ok) {
        const userData = await userRes.json()
        userId = userData.user?.id
      }

      // Use batch API to update all records in a single request
      const updates = recordIds.map((recordId) => ({
        id: recordId,
        location: data.location || undefined,
        allocationStatus: data.allocationStatus || undefined,
        outboundInventoryId: data.outboundInventoryId || undefined,
        outboundProductLineId: data.outboundProductLineId || undefined,
        ...(data.allocationStatus === 'allocated' && {
          allocatedAt: new Date().toISOString(),
          ...(userId && { allocatedBy: userId }),
        }),
      }))

      const res = await fetch('/api/inventory/records/batch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        toast.error(errorData.message || 'Failed to update records')
        return
      }

      const result = await res.json()
      if (result.success) {
        const { successful, failed } = result.summary
        if (failed > 0) {
          toast.error(`Failed to update ${failed} record(s)`)
        } else {
          toast.success(`Successfully updated ${successful} record(s)`)
        }
        onOpenChange(false)
        reset()
        setSelectedJobId(null)
        onSuccess()
      } else {
        toast.error('Failed to update records')
      }
    } catch (error) {
      console.error('Error updating records:', error)
      toast.error('Failed to update records')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit LPNs</DialogTitle>
          <DialogDescription>
            Update {recordIds.length} LPN record(s). Leave fields empty to keep existing values.
          </DialogDescription>
        </DialogHeader>

        {fetching && !lpnSkus.size ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="allocationStatus">Allocation Status</Label>
              <select
                id="allocationStatus"
                {...register('allocationStatus')}
                disabled={loading}
                onChange={(e) => {
                  const value = e.target.value
                  setValue('allocationStatus', value)
                  if (value !== 'allocated') {
                    setValue('outboundInventoryId', undefined)
                    setValue('outboundProductLineId', undefined)
                    setSelectedJobId(null)
                  }
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Keep existing</option>
                <option value="available">Available</option>
                <option
                  value="allocated"
                  disabled={outboundJobs.length === 0 && allocationStatus !== 'allocated'}
                >
                  Allocated
                  {outboundJobs.length === 0 && allocationStatus !== 'allocated'
                    ? ' (No matching jobs)'
                    : ''}
                </option>
                <option value="picked">Picked</option>
              </select>
              <p className="text-xs text-muted-foreground">
                Available LPNs can only be set to Allocated. Allocated LPNs can be set to Picked or
                Available. Picked LPNs can be set to Available or Allocated.
              </p>
            </div>

            {/* Show outbound job and product line selection when status is allocated or picked */}
            {(allocationStatus === 'allocated' || allocationStatus === 'picked') && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="outboundInventoryId">Outbound Job *</Label>
                  {fetching ? (
                    <div className="text-sm text-muted-foreground">Loading jobs...</div>
                  ) : (
                    <select
                      id="outboundInventoryId"
                      {...register('outboundInventoryId', {
                        required: allocationStatus === 'allocated',
                        valueAsNumber: true,
                      })}
                      disabled={loading || fetching}
                      onChange={(e) => {
                        const jobId = e.target.value ? parseInt(e.target.value, 10) : null
                        setSelectedJobId(jobId)
                        setValue('outboundInventoryId', jobId || undefined)
                        setValue('outboundProductLineId', undefined)
                      }}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select an outbound job...</option>
                      {outboundJobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.jobCode || `Job #${job.id}`}
                        </option>
                      ))}
                    </select>
                  )}
                  {!fetching && outboundJobs.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      No outbound jobs available with product lines matching the selected LPNs&apos;
                      SKUs
                    </p>
                  )}
                </div>

                {selectedJobId && (
                  <div className="space-y-2">
                    <Label htmlFor="outboundProductLineId">Outbound Product Line *</Label>
                    {fetching ? (
                      <div className="text-sm text-muted-foreground">Loading product lines...</div>
                    ) : (
                      <select
                        id="outboundProductLineId"
                        {...register('outboundProductLineId', {
                          required: allocationStatus === 'allocated',
                          valueAsNumber: true,
                        })}
                        disabled={loading || fetching || !selectedJobId}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Select a product line...</option>
                        {productLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.skuDescription || `Product Line #${line.id}`}
                            {line.batchNumber ? ` (Batch: ${line.batchNumber})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                    {productLines.length === 0 && !fetching && selectedJobId && (
                      <p className="text-xs text-muted-foreground">
                        No product lines available matching the selected LPNs&apos; SKUs
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register('location')}
                placeholder="Leave empty to keep existing"
                disabled={loading}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false)
                  reset()
                }}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Updating...' : `Update ${recordIds.length} Record(s)`}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
