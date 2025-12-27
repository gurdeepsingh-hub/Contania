'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Package } from 'lucide-react'
import Link from 'next/link'
import { ContainerStatusBadge } from '@/components/container-bookings/container-status-badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ContainerProductLineFormImport } from '@/components/container-bookings/container-product-line-form-import'
import { toast } from 'sonner'

export default function ImportContainerDetailPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const containerId = params.containerId as string
  const [container, setContainer] = useState<any>(null)
  const [allocations, setAllocations] = useState<any[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [showReceivedModal, setShowReceivedModal] = useState(false)
  const [showPutAwayModal, setShowPutAwayModal] = useState(false)
  const [selectedProductLine, setSelectedProductLine] = useState<any>(null)

  useEffect(() => {
    if (containerId) {
      loadData()
    }
  }, [containerId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [containerRes, allocationsRes] = await Promise.all([
        fetch(`/api/container-details/${containerId}?depth=2`),
        fetch(`/api/container-stock-allocations?containerDetailId=${containerId}&depth=2`),
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
          <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Booking
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Container {container.containerNumber}</h1>
              {container.status && (
                <ContainerStatusBadge status={container.status} type="import" />
              )}
            </div>
            <p className="text-muted-foreground">Container Details</p>
          </div>
        </div>
        {container.status === 'expecting' && (
          <Button onClick={() => setShowReceivedModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Received Values
          </Button>
        )}
        {container.status === 'received' && (
          <Button onClick={() => setShowPutAwayModal(true)}>
            <Package className="h-4 w-4 mr-2" />
            Put Away Stock
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
                          className="border-l-4 border-l-blue-500 pl-4 py-2 bg-muted/30 rounded"
                        >
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-xs text-muted-foreground">SKU</label>
                              <p className="font-medium">
                                {typeof line.skuId === 'object'
                                  ? line.skuId?.skuCode || line.skuId?.description || line.skuDescription
                                  : line.skuDescription || 'N/A'}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Batch</label>
                              <p className="font-medium">{line.batchNumber || '-'}</p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">
                                Expected Qty
                              </label>
                              <p className="font-medium">
                                {line.expectedQtyImport || line.expectedQty || '-'}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">
                                Received Qty
                              </label>
                              <p className="font-medium">{line.recievedQty || '-'}</p>
                            </div>
                            {line.expectedWeightImport && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Expected Weight
                                </label>
                                <p className="font-medium">{line.expectedWeightImport} kg</p>
                              </div>
                            )}
                            {line.recievedWeight && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Received Weight
                                </label>
                                <p className="font-medium">{line.recievedWeight} kg</p>
                              </div>
                            )}
                            {line.palletSpaces && (
                              <div>
                                <label className="text-xs text-muted-foreground">
                                  Pallet Spaces
                                </label>
                                <p className="font-medium">{line.palletSpaces}</p>
                              </div>
                            )}
                            {line.expiryDate && (
                              <div>
                                <label className="text-xs text-muted-foreground">Expiry Date</label>
                                <p className="font-medium">
                                  {new Date(line.expiryDate).toLocaleDateString()}
                                </p>
                              </div>
                            )}
                            {line.attribute1 && (
                              <div>
                                <label className="text-xs text-muted-foreground">Attribute 1</label>
                                <p className="font-medium">{line.attribute1}</p>
                              </div>
                            )}
                            {line.attribute2 && (
                              <div>
                                <label className="text-xs text-muted-foreground">Attribute 2</label>
                                <p className="font-medium">{line.attribute2}</p>
                              </div>
                            )}
                          </div>
                          {container.status === 'expecting' && !line.recievedQty && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-2"
                              onClick={() => {
                                setSelectedProductLine(line)
                                setShowReceivedModal(true)
                              }}
                            >
                              Add Received Values
                            </Button>
                          )}
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

      <Dialog open={showReceivedModal} onOpenChange={setShowReceivedModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProductLine ? 'Update Received Values' : 'Add Received Values'}
            </DialogTitle>
          </DialogHeader>
          {container && (
            <ContainerProductLineFormImport
              containerDetailId={parseInt(containerId)}
              containerBookingId={parseInt(bookingId)}
              stage="received"
              initialData={selectedProductLine}
              onSave={async (productLine) => {
                try {
                  // Find the allocation that contains this product line
                  const allocation = allocations.find((a) =>
                    a.productLines?.some((pl: any) => pl === selectedProductLine),
                  )
                  if (!allocation) {
                    toast.error('Allocation not found')
                    return
                  }

                  const res = await fetch(
                    `/api/import-container-bookings/${bookingId}/stock-allocations/${allocation.id}`,
                    {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        productLines: allocation.productLines.map((pl: any) =>
                          pl === selectedProductLine ? { ...pl, ...productLine } : pl,
                        ),
                      }),
                    },
                  )

                  if (res.ok) {
                    toast.success('Received values updated')
                    setShowReceivedModal(false)
                    setSelectedProductLine(null)
                    loadData()
                  } else {
                    const error = await res.json()
                    toast.error(error.message || 'Failed to update received values')
                  }
                } catch (error) {
                  console.error('Error updating received values:', error)
                  toast.error('Failed to update received values')
                }
              }}
              onCancel={() => {
                setShowReceivedModal(false)
                setSelectedProductLine(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

