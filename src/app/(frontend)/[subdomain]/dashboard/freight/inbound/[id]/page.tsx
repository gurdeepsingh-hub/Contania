'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Edit, PackageCheck, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'
import { ProductLineForm } from '@/components/freight/product-line-form'
import { PutAwayDialog } from '@/components/freight/put-away-dialog'
import { toast } from 'sonner'

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  lpnQty?: string
  sqmPerSU?: number
  expectedQty?: number
  recievedQty?: number
  expectedWeight?: number
  recievedWeight?: number
  palletSpaces?: number
  weightPerHU?: number
  expectedCubicPerHU?: number
  recievedCubicPerHU?: number
  expiryDate?: string
  attribute1?: string
  attribute2?: string
}

type InboundJob = {
  id: number
  jobCode?: string
  expectedDate?: string
  completedDate?: string
  deliveryCustomerReferenceNumber?: string
  orderingCustomerReferenceNumber?: string
  deliveryCustomerId?: string
  customerName?: string
  customerAddress?: string
  customerContactName?: string
  supplierId?: string
  supplierName?: string
  supplierAddress?: string
  supplierContactName?: string
  warehouseId?: number | { id: number; name?: string }
  transportMode?: string
  transportCompanyId?: number | { id: number; name?: string }
  transportContact?: string
  transportMobile?: string
  chep?: number
  loscam?: number
  plain?: number
  palletTransferDocket?: string
  notes?: string
  productLines?: ProductLine[]
}

export default function InboundJobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [job, setJob] = useState<InboundJob | null>(null)
  const [loadingJob, setLoadingJob] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [showProductLineDialog, setShowProductLineDialog] = useState(false)
  const [editingProductLine, setEditingProductLine] = useState<ProductLine | null>(null)
  const [savingProductLine, setSavingProductLine] = useState(false)
  const [showPutAwayDialog, setShowPutAwayDialog] = useState(false)
  const [putAwayProductLineId, setPutAwayProductLineId] = useState<number | undefined>(undefined)
  const [putAwayRecords, setPutAwayRecords] = useState<any[]>([])
  const [loadingPutAway, setLoadingPutAway] = useState(false)
  const [expandedPutAwayLines, setExpandedPutAwayLines] = useState<Record<number, boolean>>({})

  const jobId = params.id as string

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              if (!hasViewPermission(fullUserData.user, 'freight')) {
                router.push('/dashboard')
                return
              }
            }
          }
          setAuthChecked(true)
        }
      } catch (error) {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked && jobId) {
      // Load job and put-away records in parallel
      Promise.all([loadJob(), loadPutAwayRecords()])
    }
  }, [authChecked, jobId])

  const loadJob = useCallback(async () => {
    try {
      setLoadingJob(true)
      const res = await fetch(`/api/inbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setJob(data.job)
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setLoadingJob(false)
    }
  }, [jobId])

  const loadPutAwayRecords = useCallback(async () => {
    if (!jobId) return

    setLoadingPutAway(true)
    try {
      const res = await fetch(`/api/put-away-stock?jobId=${jobId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPutAwayRecords(data.records || [])
        }
      }
    } catch (error) {
      console.error('Error loading put-away records:', error)
    } finally {
      setLoadingPutAway(false)
    }
  }, [jobId])

  const handlePutAway = (productLineId?: number) => {
    // Check if stock has been received
    const hasReceivedData =
      !!job?.completedDate ||
      (job?.productLines && job.productLines.some((line) => line.recievedQty))

    if (!hasReceivedData) {
      toast.error('Please receive stock first before putting away')
      return
    }

    setPutAwayProductLineId(productLineId)
    setShowPutAwayDialog(true)
  }

  const handlePutAwayComplete = useCallback(() => {
    setShowPutAwayDialog(false)
    setPutAwayProductLineId(undefined)
    // Reload in parallel
    Promise.all([loadPutAwayRecords(), loadJob()])
  }, [loadPutAwayRecords, loadJob])

  // Memoize put-away records by product line ID for faster lookups
  const putAwayRecordsByProductLine = useMemo(() => {
    const map: Record<number, any[]> = {}
    putAwayRecords.forEach((record) => {
      const recordProductLineId =
        typeof record.inboundProductLineId === 'object'
          ? record.inboundProductLineId.id
          : record.inboundProductLineId
      if (recordProductLineId) {
        if (!map[recordProductLineId]) {
          map[recordProductLineId] = []
        }
        map[recordProductLineId].push(record)
      }
    })
    return map
  }, [putAwayRecords])

  // Check if all product lines are fully put away
  const areAllProductLinesPutAway = useMemo((): boolean => {
    if (!job?.productLines || job.productLines.length === 0) return false

    return job.productLines.every((line) => {
      if (!line.id || !line.recievedQty || !line.lpnQty) return false

      const palletCount = Math.ceil(line.recievedQty / parseFloat(line.lpnQty))
      const linePutAwayRecords = putAwayRecordsByProductLine[line.id] || []

      return linePutAwayRecords.length >= palletCount
    })
  }, [job?.productLines, putAwayRecordsByProductLine])

  // Check if a specific product line is fully put away
  const isProductLinePutAway = useCallback(
    (line: ProductLine): boolean => {
      if (!line.id || !line.recievedQty || !line.lpnQty) return false

      const palletCount = Math.ceil(line.recievedQty / parseFloat(line.lpnQty))
      const linePutAwayRecords = putAwayRecordsByProductLine[line.id] || []

      return linePutAwayRecords.length >= palletCount
    },
    [putAwayRecordsByProductLine],
  )

  // Memoize expensive computation (must be before early returns)
  const hasReceivedData = useMemo(
    () =>
      !!job?.completedDate ||
      (job?.productLines && job.productLines.some((line) => line.recievedQty)),
    [job?.completedDate, job?.productLines],
  )

  const handleAddProductLine = () => {
    setEditingProductLine(null)
    setShowProductLineDialog(true)
  }

  const handleEditProductLine = (line: ProductLine) => {
    // Convert skuId to number if it's an object
    const editLine: ProductLine = {
      ...line,
      skuId: typeof line.skuId === 'object' ? line.skuId.id : line.skuId,
    }
    setEditingProductLine(editLine)
    setShowProductLineDialog(true)
  }

  const handleDeleteProductLine = async (lineId: number) => {
    if (!confirm('Are you sure you want to delete this product line?')) {
      return
    }

    try {
      const res = await fetch(`/api/inbound-product-lines/${lineId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        loadJob()
      } else {
        alert('Failed to delete product line')
      }
    } catch (error) {
      console.error('Error deleting product line:', error)
      alert('Failed to delete product line')
    }
  }

  const handleSaveProductLine = async (data: ProductLine) => {
    setSavingProductLine(true)
    try {
      const url = editingProductLine?.id
        ? `/api/inbound-product-lines/${editingProductLine.id}`
        : '/api/inbound-product-lines'
      const method = editingProductLine?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboundInventoryId: parseInt(jobId),
          ...data,
        }),
      })

      if (res.ok) {
        setShowProductLineDialog(false)
        setEditingProductLine(null)
        loadJob()
      } else {
        alert('Failed to save product line')
      }
    } catch (error) {
      console.error('Error saving product line:', error)
      alert('Failed to save product line')
    } finally {
      setSavingProductLine(false)
    }
  }

  if (loading || !authChecked || loadingJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant || !job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Job not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/freight/inbound">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
            </h1>
            <p className="text-muted-foreground">Inbound Inventory Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {!hasReceivedData && (
            <>
              <Link href={`/dashboard/freight/inbound/${job.id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Job
                </Button>
              </Link>
              {job.productLines && job.productLines.length > 0 && (
                <Link href={`/dashboard/freight/inbound/${job.id}/receive`}>
                  <Button>
                    <PackageCheck className="h-4 w-4 mr-2" />
                    Receive Stock
                  </Button>
                </Link>
              )}
            </>
          )}
          {hasReceivedData && !areAllProductLinesPutAway && job.productLines && job.productLines.length > 0 && (
            <>
              <Button variant="outline" onClick={() => handlePutAway()}>
                Put Away Stock
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Job Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.jobCode && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Job Code:</span>
                <p className="font-mono font-semibold">{job.jobCode}</p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-muted-foreground">Expected Date:</span>
              <p>{job.expectedDate ? new Date(job.expectedDate).toLocaleString() : 'Not set'}</p>
            </div>
            {job.completedDate && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Completed Date:</span>
                <p>{new Date(job.completedDate).toLocaleString()}</p>
              </div>
            )}
            <div>
              <span className="text-sm font-medium text-muted-foreground">Transport Mode:</span>
              <p>
                {job.transportMode === 'our'
                  ? 'Our'
                  : job.transportMode === 'third_party'
                    ? 'Third Party'
                    : 'Not set'}
              </p>
            </div>
            {job.notes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Notes:</span>
                <p>{job.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Customer:</span>
              <p>{job.customerName || 'Not set'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Contact:</span>
              <p>{job.customerContactName || 'Not set'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-muted-foreground">Address:</span>
              <p>{job.customerAddress || 'Not set'}</p>
            </div>
          </CardContent>
        </Card>

        {job.supplierName && (
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Supplier:</span>
                <p>{job.supplierName}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Contact:</span>
                <p>{job.supplierContactName || 'Not set'}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-muted-foreground">Address:</span>
                <p>{job.supplierAddress || 'Not set'}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {(job.chep || job.loscam || job.plain) && (
          <Card>
            <CardHeader>
              <CardTitle>Pallet Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {job.chep && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">CHEP:</span>
                  <p>{job.chep}</p>
                </div>
              )}
              {job.loscam && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">LOSCAM:</span>
                  <p>{job.loscam}</p>
                </div>
              )}
              {job.plain && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Plain:</span>
                  <p>{job.plain}</p>
                </div>
              )}
              {job.palletTransferDocket && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">
                    Transfer Docket:
                  </span>
                  <p>{job.palletTransferDocket}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Product Lines */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Product Lines</CardTitle>
              <CardDescription>{job.productLines?.length || 0} product line(s)</CardDescription>
            </div>
            {!hasReceivedData && (
              <Button onClick={handleAddProductLine} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Product Line
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {job.productLines && job.productLines.length > 0 ? (
            <div className="space-y-4">
              {job.productLines.map((line) => {
                // Use memoized map for faster lookup
                const linePutAwayRecords = line.id ? putAwayRecordsByProductLine[line.id] || [] : []
                const hasPutAwayRecords = linePutAwayRecords.length > 0
                const isPutAwayExpanded = line.id ? (expandedPutAwayLines[line.id] ?? false) : false

                return (
                  <div key={line.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      {/* Compact Product Line Info - Single Row */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-4 flex-wrap">
                          <div className="min-w-[100px]">
                            <span className="text-xs font-medium text-muted-foreground">SKU:</span>
                            <p className="text-sm font-medium truncate">
                              {typeof line.skuId === 'object' ? line.skuId.skuCode : 'N/A'}
                            </p>
                          </div>
                          <div className="flex-1 min-w-0 max-w-[300px]">
                            <span className="text-xs font-medium text-muted-foreground">
                              Description:
                            </span>
                            <p className="text-sm line-clamp-2">{line.skuDescription || 'N/A'}</p>
                          </div>
                          <div className="min-w-[80px]">
                            <span className="text-xs font-medium text-muted-foreground">
                              Expected:
                            </span>
                            <p className="text-sm">{line.expectedQty || 0}</p>
                          </div>
                          <div className="min-w-[80px]">
                            <span className="text-xs font-medium text-muted-foreground">
                              Received:
                            </span>
                            <p className="text-sm font-medium">{line.recievedQty || 0}</p>
                          </div>
                          {line.batchNumber && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Batch:
                              </span>
                              <p className="text-sm">{line.batchNumber}</p>
                            </div>
                          )}
                          {line.palletSpaces && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Pallet Spaces:
                              </span>
                              <p className="text-sm">{line.palletSpaces.toFixed(2)}</p>
                            </div>
                          )}
                          {line.expiryDate && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Expiry Date:
                              </span>
                              <p className="text-sm">
                                {new Date(line.expiryDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                          {line.attribute1 && (
                            <div className="min-w-[100px] max-w-[200px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Attribute 1:
                              </span>
                              <p className="text-sm line-clamp-2">{line.attribute1}</p>
                            </div>
                          )}
                          {line.attribute2 && (
                            <div className="min-w-[100px] max-w-[200px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Attribute 2:
                              </span>
                              <p className="text-sm line-clamp-2">{line.attribute2}</p>
                            </div>
                          )}
                        </div>

                        {/* Put-Away Records Accordion */}
                        {line.id && hasPutAwayRecords && (
                          <div className="mt-3 pt-3 border-t">
                            <button
                              onClick={() =>
                                setExpandedPutAwayLines((prev) => ({
                                  ...prev,
                                  [line.id!]: !prev[line.id!],
                                }))
                              }
                              className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 w-full"
                            >
                              {isPutAwayExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                              <span>Put-Away Records ({linePutAwayRecords.length})</span>
                            </button>
                            {isPutAwayExpanded && (
                              <div className="mt-2 max-h-64 overflow-y-auto">
                                <table className="w-full text-sm border-collapse">
                                  <thead className="sticky top-0 bg-muted">
                                    <tr>
                                      <th className="text-left p-2 font-medium border-b">
                                        Sr. No.
                                      </th>
                                      <th className="text-left p-2 font-medium border-b">LPN</th>
                                      <th className="text-left p-2 font-medium border-b">
                                        Location
                                      </th>
                                      <th className="text-left p-2 font-medium border-b">HU Qty</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {linePutAwayRecords.map((record, index) => (
                                      <tr key={record.id} className="border-b">
                                        <td className="p-2 font-medium">{index + 1}</td>
                                        <td className="p-2 font-mono font-semibold">
                                          {record.lpnNumber}
                                        </td>
                                        <td className="p-2">{record.location}</td>
                                        <td className="p-2">{record.huQty}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Put Away Stock Button for Individual Product Line */}
                        {hasReceivedData && line.id && line.recievedQty && (
                          <div className="mt-3 pt-3 border-t">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePutAway(line.id)}
                              disabled={isProductLinePutAway(line)}
                            >
                              {isProductLinePutAway(line) ? 'All Stock Put Away' : 'Put Away Stock'}
                            </Button>
                          </div>
                        )}
                      </div>

                      {!hasReceivedData && line.id && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProductLine(line)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteProductLine(line.id!)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">No product lines added yet.</p>
              {!hasReceivedData && (
                <Button onClick={handleAddProductLine} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product Line
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Product Line Dialog */}
      <Dialog open={showProductLineDialog} onOpenChange={setShowProductLineDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProductLine ? 'Edit Product Line' : 'Add Product Line'}
            </DialogTitle>
            <DialogDescription>
              {editingProductLine
                ? 'Update the product line details'
                : 'Add a new product line to this inbound job'}
            </DialogDescription>
          </DialogHeader>
          {showProductLineDialog && (
            <ProductLineForm
              inboundInventoryId={parseInt(jobId)}
              initialData={
                editingProductLine
                  ? {
                      ...editingProductLine,
                      skuId:
                        typeof editingProductLine.skuId === 'object'
                          ? editingProductLine.skuId.id
                          : editingProductLine.skuId,
                    }
                  : undefined
              }
              onSave={handleSaveProductLine}
              onCancel={() => {
                setShowProductLineDialog(false)
                setEditingProductLine(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Put Away Dialog */}
      <PutAwayDialog
        open={showPutAwayDialog}
        onOpenChange={(open) => {
          setShowPutAwayDialog(open)
          if (!open) {
            // Reload put-away records when dialog closes
            setPutAwayProductLineId(undefined)
            loadPutAwayRecords()
          }
        }}
        jobId={job?.id}
        productLineId={putAwayProductLineId}
      />
    </div>
  )
}
