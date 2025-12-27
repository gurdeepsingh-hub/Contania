'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Package, Truck } from 'lucide-react'
import Link from 'next/link'
import { ContainerStatusBadge } from '@/components/container-bookings/container-status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContainerProductLineFormExport } from '@/components/container-bookings/container-product-line-form-export'
import { toast } from 'sonner'

export default function ExportContainerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const containerId = params.containerId as string
  const [container, setContainer] = useState<any>(null)
  const [allocations, setAllocations] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [showPickupModal, setShowPickupModal] = useState(false)
  const [showDispatchModal, setShowDispatchModal] = useState(false)
  const [pickups, setPickups] = useState<any[]>([])

  useEffect(() => {
    if (containerId) {
      loadData()
    }
  }, [containerId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [containerRes, allocationsRes, pickupsRes] = await Promise.all([
        fetch(`/api/container-details/${containerId}?depth=2`),
        fetch(`/api/container-stock-allocations?containerDetailId=${containerId}&depth=2`),
        fetch(`/api/export-container-bookings/${bookingId}/containers/${containerId}/pickup`),
      ])

      if (containerRes.ok) {
        const data = await containerRes.json()
        if (data.success) {
          setContainer(data.containerDetail)
        }
      }

      if (allocationsRes.ok) {
        const data = await allocationsRes.json()
        if (data.success) {
          setAllocations(data.stockAllocations || data.containerStockAllocations || [])
        }
      }

      if (pickupsRes.ok) {
        const data = await pickupsRes.json()
        if (data.success) {
          setPickups(data.records || [])
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!container) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Container not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Booking
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Container {container.containerNumber}</h1>
              {container.status && <ContainerStatusBadge status={container.status} type="export" />}
            </div>
            <p className="text-muted-foreground">Container Details</p>
          </div>
        </div>
        {container.status === 'allocated' && (
          <Button onClick={() => setShowPickupModal(true)}>
            <Package className="h-4 w-4 mr-2" />
            Create Pickup
          </Button>
        )}
        {container.status === 'picked_up' && (
          <Button onClick={() => setShowDispatchModal(true)}>
            <Truck className="h-4 w-4 mr-2" />
            Dispatch
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Container Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Container Number</label>
              <p className="font-medium">{container.containerNumber}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">ISO Code</label>
              <p className="font-medium">{container.isoCode || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Gross</label>
              <p className="font-medium">{container.gross || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tare</label>
              <p className="font-medium">{container.tare || '-'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Net</label>
              <p className="font-medium">{container.net || '-'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {allocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Product Lines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {allocations.map((allocation) => (
                <div key={allocation.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium capitalize">
                      Stage: {allocation.stage.replace('_', ' ')}
                    </span>
                  </div>
                  {allocation.productLines && allocation.productLines.length > 0 && (
                    <div className="space-y-4">
                      {allocation.productLines.map((line: any, idx: number) => (
                        <div
                          key={idx}
                          className="border-l-4 border-l-purple-500 pl-4 py-2 bg-muted/30 rounded"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground">SKU</label>
                              <p className="font-medium">
                                {typeof line.skuId === 'object'
                                  ? line.skuId?.skuCode ||
                                    line.skuId?.description ||
                                    line.skuDescription
                                  : line.skuDescription || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Batch</label>
                              <p className="font-medium">{line.batchNumber || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Allocated Qty</label>
                              <p className="font-medium">{line.allocatedQty || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Picked Qty</label>
                              <p className="font-medium">{line.pickedQty || '-'}</p>
                            </div>
                            {line.allocatedWeight && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Allocated Weight
                                </label>
                                <p className="font-medium">{line.allocatedWeight} kg</p>
                              </div>
                            )}
                            {line.pickedWeight && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Picked Weight
                                </label>
                                <p className="font-medium">{line.pickedWeight} kg</p>
                              </div>
                            )}
                            {line.LPN && Array.isArray(line.LPN) && line.LPN.length > 0 && (
                              <div className="col-span-2 md:col-span-4">
                                <label className="text-xs text-muted-foreground">LPNs</label>
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
                                <label className="text-xs text-muted-foreground">Location</label>
                                <p className="font-medium">{line.location}</p>
                              </div>
                            )}
                            {line.pltQty && (
                              <div>
                                <label className="text-xs text-muted-foreground">Pallet Qty</label>
                                <p className="font-medium">{line.pltQty}</p>
                              </div>
                            )}
                            {line.allocatedCubicPerHU && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Cubic/HU (m³)
                                </label>
                                <p className="font-medium">{line.allocatedCubicPerHU}</p>
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
          </CardContent>
        </Card>
      )}

      {pickups.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pickup Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pickups.map((pickup) => (
                <div key={pickup.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        Pickup #{pickup.id} - Status: {pickup.pickupStatus}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Qty: {pickup.finalPickedUpQty || pickup.pickedUpQty}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
