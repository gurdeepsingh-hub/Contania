'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { ArrowLeft, Edit, Trash2, Package, PackageCheck, Truck, ChevronDown, ChevronUp } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'
import { toast } from 'sonner'
import { AllocateStockDialog } from '@/components/freight/allocate-stock-dialog'
import { ProductLineAllocateDialog } from '@/components/freight/product-line-allocate-dialog'
import { PickupStockDialog } from '@/components/freight/pickup-stock-dialog'
import { DispatchDialog } from '@/components/freight/dispatch-dialog'

type AllocatedLPN = {
  serialNumber: number
  lpnNumber: string
  location: string
  huQty: number
  id: number
}

type ProductLine = {
  id?: number
  skuId?: number | { id: number; skuCode?: string; description?: string }
  skuDescription?: string
  batchNumber?: string
  requiredQty?: number
  allocatedQty?: number
  requiredWeight?: number
  allocatedWeight?: number
  location?: string
  allocatedLPNs?: AllocatedLPN[]
}

type OutboundJob = {
  id: number
  jobCode?: string
  status?: string
  customerRefNumber?: string
  consigneeRefNumber?: string
  containerNumber?: string
  inspectionNumber?: string
  inboundJobNumber?: string
  customerName?: string
  customerLocation?: string
  customerState?: string
  customerContact?: string
  customerToName?: string
  customerToLocation?: string
  customerToState?: string
  customerToContact?: string
  customerFromName?: string
  customerFromLocation?: string
  customerFromState?: string
  customerFromContact?: string
  warehouseId?: number | { id: number; name?: string }
  requiredDateTime?: string
  orderNotes?: string
  palletCount?: number
  productLines?: ProductLine[]
  vehicleId?: number | { id: number; fleetNumber?: string; rego?: string }
  driverId?: number | { id: number; name?: string; phoneNumber?: string }
  dispatchedAt?: string
}

export default function OutboundJobDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [job, setJob] = useState<OutboundJob | null>(null)
  const [loadingJob, setLoadingJob] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showAllocateStockDialog, setShowAllocateStockDialog] = useState(false)
  const [showPickupStockDialog, setShowPickupStockDialog] = useState(false)
  const [showDispatchDialog, setShowDispatchDialog] = useState(false)
  const [allocatingProductLineId, setAllocatingProductLineId] = useState<number | null>(null)
  const [expandedLPNs, setExpandedLPNs] = useState<Record<number, boolean>>({})
  const [pickupRecords, setPickupRecords] = useState<Record<number, any[]>>({})

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
      } catch {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  const loadJob = useCallback(async () => {
    try {
      setLoadingJob(true)
      const res = await fetch(`/api/outbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const jobData = data.job
          // Ensure vehicle and driver are loaded with depth if they exist
          if (jobData.vehicleId && typeof jobData.vehicleId === 'number') {
            try {
              const vehicleRes = await fetch(`/api/vehicles/${jobData.vehicleId}`)
              if (vehicleRes.ok) {
                const vehicleData = await vehicleRes.json()
                if (vehicleData.success) {
                  jobData.vehicleId = vehicleData.vehicle
                }
              }
            } catch (error) {
              console.error('Error loading vehicle:', error)
            }
          }
          if (jobData.driverId && typeof jobData.driverId === 'number') {
            try {
              const driverRes = await fetch(`/api/drivers/${jobData.driverId}`)
              if (driverRes.ok) {
                const driverData = await driverRes.json()
                if (driverData.success) {
                  jobData.driverId = driverData.driver
                }
              }
            } catch (error) {
              console.error('Error loading driver:', error)
            }
          }
          // Load allocated LPNs for each product line
          if (jobData.productLines && jobData.productLines.length > 0) {
            const productLinesWithLPNs = await Promise.all(
              jobData.productLines.map(async (line: ProductLine) => {
                if (line.id && line.allocatedQty && line.allocatedQty > 0) {
                  try {
                    const lpnRes = await fetch(
                      `/api/outbound-product-lines/${line.id}/allocated-lpns`
                    )
                    if (lpnRes.ok) {
                      const lpnData = await lpnRes.json()
                      if (lpnData.success && lpnData.allocatedLPNs) {
                        return { ...line, allocatedLPNs: lpnData.allocatedLPNs }
                      }
                    }
                  } catch (error) {
                    console.error(`Error loading LPNs for product line ${line.id}:`, error)
                  }
                }
                return line
              })
            )
            jobData.productLines = productLinesWithLPNs

            // Load pickup records for each product line
            const pickupRecordsMap: Record<number, any[]> = {}
            await Promise.all(
              productLinesWithLPNs.map(async (line: ProductLine) => {
                if (line.id) {
                  try {
                    const pickupRes = await fetch(
                      `/api/outbound-product-lines/${line.id}/pickup-info`
                    )
                    if (pickupRes.ok) {
                      const pickupData = await pickupRes.json()
                      if (pickupData.success && pickupData.existingPickups) {
                        pickupRecordsMap[line.id] = pickupData.existingPickups
                      }
                    }
                  } catch (error) {
                    console.error(`Error loading pickup records for product line ${line.id}:`, error)
                  }
                }
              })
            )
            setPickupRecords(pickupRecordsMap)
          }
          setJob(jobData)
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setLoadingJob(false)
    }
  }, [jobId])

  useEffect(() => {
    if (authChecked && jobId) {
      loadJob()
    }
  }, [authChecked, jobId, loadJob])

  const handleDelete = async () => {
    if (!job) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/outbound-inventory/${job.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        toast.success('Job deleted successfully')
        router.push('/dashboard/freight/outbound')
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to delete job')
      }
    } catch (error) {
      console.error('Error deleting job:', error)
      toast.error('Failed to delete job')
    } finally {
      setDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'partially_allocated':
        return 'text-blue-400'
      case 'allocated':
        return 'text-blue-600'
      case 'ready_to_pick':
        return 'text-yellow-600'
      case 'partially_picked':
        return 'text-orange-400'
      case 'picked':
        return 'text-orange-600'
      case 'ready_to_dispatch':
        return 'text-green-600'
      case 'dispatched':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'draft':
        return 'Draft'
      case 'partially_allocated':
        return 'Partially Allocated'
      case 'allocated':
        return 'Allocated'
      case 'ready_to_pick':
        return 'Ready to Pick'
      case 'partially_picked':
        return 'Partially Picked'
      case 'picked':
        return 'Picked'
      case 'ready_to_dispatch':
        return 'Ready to Dispatch'
      case 'dispatched':
        return 'Dispatched'
      default:
        return 'Draft'
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

  const canDelete = job.status === 'draft'
  const canEdit = job.status !== 'ready_to_dispatch' && job.status !== 'dispatched'
  const canDispatch = job.status === 'ready_to_dispatch'
  
  // Check if all product lines are allocated
  const allProductLinesAllocated =
    job.productLines &&
    job.productLines.length > 0 &&
    job.productLines.every((line) => line.allocatedQty && line.allocatedQty > 0)
  
  // Check if any product lines are allocated (for showing allocate button)
  const hasAnyAllocation =
    job.productLines &&
    job.productLines.length > 0 &&
    job.productLines.some((line) => line.allocatedQty && line.allocatedQty > 0)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/freight/outbound">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">
              {job.jobCode ? `Job ${job.jobCode}` : `Job #${job.id}`}
            </h1>
            <p className="text-muted-foreground">Outbound Inventory Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && !allProductLinesAllocated && (
            <>
              <Link href={`/dashboard/freight/outbound/${job.id}/edit`}>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Job
                </Button>
              </Link>
              {job.productLines && job.productLines.length > 0 && (
                <Button onClick={() => setShowAllocateStockDialog(true)}>
                  <PackageCheck className="h-4 w-4 mr-2" />
                  {hasAnyAllocation ? 'Allocate More Stock' : 'Allocate Stock'}
                </Button>
              )}
            </>
          )}
          {allProductLinesAllocated && job.status !== 'ready_to_dispatch' && job.status !== 'dispatched' && (
            <Button onClick={() => setShowPickupStockDialog(true)}>
              <Truck className="h-4 w-4 mr-2" />
              Pickup Stock
            </Button>
          )}
          {canDispatch && (
            <Button onClick={() => setShowDispatchDialog(true)} className="bg-green-600 hover:bg-green-700">
              <Truck className="h-4 w-4 mr-2" />
              Dispatch
            </Button>
          )}
          {canDelete && (
            <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Job
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Status:</span>
            <span className={`text-sm font-semibold ${getStatusColor(job.status)}`}>
              {getStatusLabel(job.status)}
            </span>
          </div>
        </CardContent>
      </Card>

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
            {job.customerRefNumber && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Customer Ref Number:
                </span>
                <p>{job.customerRefNumber}</p>
              </div>
            )}
            {job.consigneeRefNumber && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Consignee Ref Number:
                </span>
                <p>{job.consigneeRefNumber}</p>
              </div>
            )}
            {job.containerNumber && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Container Number:</span>
                <p>{job.containerNumber}</p>
              </div>
            )}
            {job.inspectionNumber && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Inspection Number:
                </span>
                <p>{job.inspectionNumber}</p>
              </div>
            )}
            {job.inboundJobNumber && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Inbound Job Number:
                </span>
                <p>{job.inboundJobNumber}</p>
              </div>
            )}
            {job.requiredDateTime && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Required Date/Time:
                </span>
                <p>{new Date(job.requiredDateTime).toLocaleString()}</p>
              </div>
            )}
            {job.palletCount && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Pallet Count:</span>
                <p>{job.palletCount}</p>
              </div>
            )}
            {job.orderNotes && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Order Notes:</span>
                <p>{job.orderNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {job.customerName && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Customer:</span>
                <p>{job.customerName}</p>
              </div>
            )}
            {job.customerLocation && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Location:</span>
                <p>
                  {job.customerLocation}
                  {job.customerState && `, ${job.customerState}`}
                </p>
              </div>
            )}
            {job.customerContact && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Contact:</span>
                <p>{job.customerContact}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {job.customerToName && (
          <Card>
            <CardHeader>
              <CardTitle>Delivery To</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Name:</span>
                <p>{job.customerToName}</p>
              </div>
              {job.customerToLocation && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Location:</span>
                  <p>
                    {job.customerToLocation}
                    {job.customerToState && `, ${job.customerToState}`}
                  </p>
                </div>
              )}
              {job.customerToContact && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Contact:</span>
                  <p>{job.customerToContact}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {job.customerFromName && (
          <Card>
            <CardHeader>
              <CardTitle>Pickup From</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Name:</span>
                <p>{job.customerFromName}</p>
              </div>
              {job.customerFromLocation && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Location:</span>
                  <p>
                    {job.customerFromLocation}
                    {job.customerFromState && `, ${job.customerFromState}`}
                  </p>
                </div>
              )}
              {job.customerFromContact && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Contact:</span>
                  <p>{job.customerFromContact}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {job.warehouseId && (
          <Card>
            <CardHeader>
              <CardTitle>Warehouse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <span className="text-sm font-medium text-muted-foreground">Warehouse:</span>
                <p>{typeof job.warehouseId === 'object' ? job.warehouseId.name : 'Not set'}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {job.status === 'dispatched' && (job.vehicleId || job.driverId || job.dispatchedAt) && (
          <Card>
            <CardHeader>
              <CardTitle>Dispatch Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {job.vehicleId && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Vehicle:</span>
                  <p>
                    {typeof job.vehicleId === 'object'
                      ? `${job.vehicleId.fleetNumber || 'N/A'} (${job.vehicleId.rego || 'N/A'})`
                      : 'N/A'}
                  </p>
                </div>
              )}
              {job.driverId && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Driver:</span>
                  <p>
                    {typeof job.driverId === 'object'
                      ? `${job.driverId.name || 'N/A'}${job.driverId.phoneNumber ? ` (${job.driverId.phoneNumber})` : ''}`
                      : 'N/A'}
                  </p>
                </div>
              )}
              {job.dispatchedAt && (
                <div>
                  <span className="text-sm font-medium text-muted-foreground">Dispatched At:</span>
                  <p>{new Date(job.dispatchedAt).toLocaleString()}</p>
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
          </div>
        </CardHeader>
        <CardContent>
          {job.productLines && job.productLines.length > 0 ? (
            <div className="space-y-4">
              {job.productLines.map((line) => {
                const hasAllocation = line.allocatedQty && line.allocatedQty > 0
                const showAllocateButton = !hasAllocation && canEdit
                const isExpanded = line.id ? expandedLPNs[line.id] || false : false
                const toggleExpanded = () => {
                  if (line.id) {
                    setExpandedLPNs((prev) => ({ ...prev, [line.id!]: !prev[line.id!] }))
                  }
                }
                
                return (
                  <div key={line.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between">
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
                          {line.batchNumber && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Batch:
                              </span>
                              <p className="text-sm">{line.batchNumber}</p>
                            </div>
                          )}
                          {line.requiredQty !== undefined && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Required Qty:
                              </span>
                              <p className="text-sm">{line.requiredQty}</p>
                            </div>
                          )}
                          {line.allocatedQty !== undefined && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Allocated Qty:
                              </span>
                              <p className="text-sm font-medium">{line.allocatedQty || 0}</p>
                            </div>
                          )}
                          {line.location && (
                            <div className="min-w-[100px]">
                              <span className="text-xs font-medium text-muted-foreground">
                                Location:
                              </span>
                              <p className="text-sm">{line.location}</p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        {showAllocateButton && (
                          <Button
                            size="sm"
                            onClick={() => line.id && setAllocatingProductLineId(line.id)}
                          >
                            <PackageCheck className="h-4 w-4 mr-2" />
                            Allocate Stock
                          </Button>
                        )}
                        {hasAllocation && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowPickupStockDialog(true)}
                          >
                            <Truck className="h-4 w-4 mr-2" />
                            Pickup Stock
                          </Button>
                        )}
                      </div>
                    </div>
                    {/* Allocated LPNs Accordion */}
                    {hasAllocation && line.allocatedLPNs && line.allocatedLPNs.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <button
                          onClick={toggleExpanded}
                          className="w-full flex items-center justify-between p-2 hover:bg-muted rounded transition-colors"
                        >
                          <h4 className="text-sm font-semibold">
                            Allocated LPN records ({line.allocatedLPNs.length})
                          </h4>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 border rounded-lg overflow-hidden">
                            <div className="max-h-64 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-background border-b">
                                  <tr>
                                    <th className="text-left p-2 font-medium">Sr No</th>
                                    <th className="text-left p-2 font-medium">LPN</th>
                                    <th className="text-left p-2 font-medium">Location</th>
                                    <th className="text-right p-2 font-medium">QTY</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {line.allocatedLPNs.map((lpn) => (
                                    <tr key={lpn.id} className="border-b hover:bg-muted/50">
                                      <td className="p-2">{lpn.serialNumber}</td>
                                      <td className="p-2 font-mono">{lpn.lpnNumber}</td>
                                      <td className="p-2">{lpn.location}</td>
                                      <td className="p-2 text-right">{lpn.huQty}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Pickup Records */}
                    {line.id && pickupRecords[line.id] && pickupRecords[line.id].length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <h4 className="text-sm font-semibold mb-2">
                          Pickup Records ({pickupRecords[line.id].length})
                        </h4>
                        <div className="space-y-2">
                          {pickupRecords[line.id].map((pickup: any) => (
                            <div
                              key={pickup.id}
                              className="p-3 bg-green-50 border border-green-200 rounded-md"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm font-medium text-green-800">
                                  Pickup #{pickup.id}
                                </span>
                                <span className="text-xs text-green-600">
                                  {new Date(pickup.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-sm">
                                <div>
                                  <span className="text-muted-foreground">Picked Up:</span>{' '}
                                  <span className="font-medium">{pickup.pickedUpQty}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Buffer:</span>{' '}
                                  <span className="font-medium">{pickup.bufferQty || 0}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Final:</span>{' '}
                                  <span className="font-medium text-green-600">
                                    {pickup.finalPickedUpQty}
                                  </span>
                                </div>
                              </div>
                              {pickup.notes && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Notes: {pickup.notes}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">No product lines added yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Outbound Job</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this job? This action cannot be undone. All product
              lines and allocations will be removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Allocate Stock Dialog */}
      {job && (
        <>
          <AllocateStockDialog
            open={showAllocateStockDialog}
            onOpenChange={setShowAllocateStockDialog}
            jobId={job.id}
          />
          {allocatingProductLineId && (
            <ProductLineAllocateDialog
              open={!!allocatingProductLineId}
              onOpenChange={(open) => {
                if (!open) {
                  setAllocatingProductLineId(null)
                }
              }}
              jobId={job.id}
              productLineId={allocatingProductLineId}
            />
          )}
          <PickupStockDialog
            open={showPickupStockDialog}
            onOpenChange={setShowPickupStockDialog}
            jobId={job.id}
          />
          <DispatchDialog
            open={showDispatchDialog}
            onOpenChange={setShowDispatchDialog}
            jobId={job.id}
          />
        </>
      )}
    </div>
  )
}
