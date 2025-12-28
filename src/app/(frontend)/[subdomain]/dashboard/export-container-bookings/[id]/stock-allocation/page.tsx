'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PackageCheck, Package } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { AllocateStockDialog } from '@/components/container-bookings/allocate-stock-dialog'
import { PickStockDialog } from '@/components/container-bookings/pick-stock-dialog'
import { LpnDetailsDialog } from '@/components/container-bookings/lpn-details-dialog'

export default function ExportStockAllocationPage() {
  const params = useParams()
  const { loading } = useTenant()
  const bookingId = params.id as string
  const [allocations, setAllocations] = useState<any[]>([])
  const [containersMap, setContainersMap] = useState<Map<number, any>>(new Map())
  const [pickupRecordsMap, setPickupRecordsMap] = useState<Map<string, any[]>>(new Map()) // Key: "containerId-allocationId-skuId"
  const [loadingData, setLoadingData] = useState(false)
  const [showAllocateDialog, setShowAllocateDialog] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null)
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(null)
  const [showPickDialog, setShowPickDialog] = useState(false)
  const [showLpnDialog, setShowLpnDialog] = useState(false)
  const [selectedLpnRecords, setSelectedLpnRecords] = useState<any[]>([])
  const [selectedLpnSkuCode, setSelectedLpnSkuCode] = useState<string>('')
  const [selectedLpnSkuDescription, setSelectedLpnSkuDescription] = useState<string>('')

  useEffect(() => {
    if (bookingId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [allocationsRes, containersRes] = await Promise.all([
        fetch(`/api/export-container-bookings/${bookingId}/stock-allocations?depth=2`),
        fetch(`/api/export-container-bookings/${bookingId}/container-details?depth=1`),
      ])

      let containerIds: number[] = []

      if (allocationsRes.ok) {
        const data = await allocationsRes.json()
        if (data.success) {
          setAllocations(data.stockAllocations || [])
          // Extract container IDs from allocations
          const ids = new Set<number>()
          data.stockAllocations?.forEach((alloc: any) => {
            const containerId =
              typeof alloc.containerDetailId === 'object'
                ? alloc.containerDetailId.id
                : alloc.containerDetailId
            if (containerId) ids.add(containerId)
          })
          containerIds = Array.from(ids)
        }
      }

      if (containersRes.ok) {
        const data = await containersRes.json()
        if (data.success && data.containerDetails) {
          const containers = new Map<number, any>()
          data.containerDetails.forEach((container: any) => {
            containers.set(container.id, container)
          })
          setContainersMap(containers)
        }
      }

      // Fetch pickup records for all containers
      if (containerIds.length > 0) {
        const pickupPromises = containerIds.map((containerId) =>
          fetch(`/api/export-container-bookings/${bookingId}/containers/${containerId}/pickup`),
        )
        const pickupResponses = await Promise.all(pickupPromises)

        const pickupMap = new Map<string, any[]>()
        for (const res of pickupResponses) {
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.records) {
              // Group pickup records by containerId-allocationId-skuId
              data.records.forEach((record: any) => {
                const containerId =
                  typeof record.containerDetailId === 'object'
                    ? record.containerDetailId.id
                    : record.containerDetailId
                const allocationId =
                  typeof record.containerStockAllocationId === 'object'
                    ? record.containerStockAllocationId.id
                    : record.containerStockAllocationId
                // Extract SKU ID from pickedUpLPNs if available
                const firstLpn = record.pickedUpLPNs?.[0]
                const skuId = firstLpn?.skuId
                  ? typeof firstLpn.skuId === 'object'
                    ? firstLpn.skuId.id
                    : firstLpn.skuId
                  : null
                if (containerId && allocationId && skuId) {
                  const key = `${containerId}-${allocationId}-${skuId}`
                  if (!pickupMap.has(key)) {
                    pickupMap.set(key, [])
                  }
                  pickupMap.get(key)!.push({
                    ...record,
                    containerDetailId: containerId,
                    containerStockAllocationId: allocationId,
                  })
                }
              })
            }
          }
        }
        setPickupRecordsMap(pickupMap)
      }
    } catch (error) {
      console.error('Error loading allocations:', error)
    } finally {
      setLoadingData(false)
    }
  }

  // Group allocations by container
  const groupedContainersMap = new Map<
    number,
    {
      containerDetail: any
      allocations: any[]
      allProductLines: Array<{
        line: any
        allocationId: number
        allocationStage: string
      }>
    }
  >()

  allocations.forEach((allocation) => {
    const containerDetailId =
      typeof allocation.containerDetailId === 'object'
        ? allocation.containerDetailId.id
        : allocation.containerDetailId

    if (!containerDetailId) return

    if (!groupedContainersMap.has(containerDetailId)) {
      // Get container detail from the fetched containers map or from allocation
      const containerDetail =
        containersMap.get(containerDetailId) ||
        (typeof allocation.containerDetailId === 'object' ? allocation.containerDetailId : null)

      groupedContainersMap.set(containerDetailId, {
        containerDetail,
        allocations: [],
        allProductLines: [],
      })
    }

    const containerData = groupedContainersMap.get(containerDetailId)!
    containerData.allocations.push(allocation)

    // Collect all product lines from all allocations for this container with allocation context
    if (allocation.productLines && allocation.productLines.length > 0) {
      allocation.productLines.forEach((line: any) => {
        containerData.allProductLines.push({
          line,
          allocationId: allocation.id,
          allocationStage: allocation.stage,
        })
      })
    }
  })

  const containers = Array.from(groupedContainersMap.values())

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'allocated':
        return 'bg-blue-100 text-blue-800'
      case 'picked':
        return 'bg-yellow-100 text-yellow-800'
      case 'dispatched':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Stock Allocation</h1>
          <p className="text-muted-foreground">Manage stock allocations for this export booking</p>
        </div>
      </div>

      {containers.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">No stock allocations yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {containers.map((containerData) => {
            const containerDetailId =
              typeof containerData.containerDetail === 'object'
                ? containerData.containerDetail.id
                : containerData.containerDetail

            // Check if any allocation has allocated quantities
            const hasAllocatedQuantities = containerData.allProductLines.some(
              ({ line }: any) => line.allocatedQty && line.allocatedQty > 0,
            )

            // Check if any allocation has picked quantities
            const hasPickedQuantities = containerData.allProductLines.some(
              ({ line }: any) => line.pickedQty && line.pickedQty > 0,
            )

            // Check if all allocations are picked or dispatched
            const allPicked = containerData.allocations.every(
              (alloc) => alloc.stage === 'picked' || alloc.stage === 'dispatched',
            )

            // Check if there are any allocations that are allocated but not yet picked
            const hasAllocatedButNotPicked = containerData.allocations.some(
              (alloc) => alloc.stage === 'allocated',
            )

            // Get container status from container detail
            const containerStatus = containerData.containerDetail?.status || 'allocated'

            return (
              <Card key={containerDetailId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>
                        Container:{' '}
                        {containerData.containerDetail?.containerNumber || containerDetailId}
                      </CardTitle>
                      <Badge className={getStageColor(containerStatus)}>{containerStatus}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      {(!hasAllocatedQuantities || hasAllocatedButNotPicked) && (
                        <Button
                          size="sm"
                          onClick={() => {
                            // Open allocate dialog for this container
                            setSelectedContainerId(containerDetailId)
                            // Use existing allocation if available, otherwise null for new allocation
                            const existingAllocation = containerData.allocations.find(
                              (alloc) => alloc.stage === 'allocated',
                            )
                            setSelectedAllocationId(existingAllocation?.id || null)
                            setShowAllocateDialog(true)
                          }}
                        >
                          <PackageCheck className="h-4 w-4 mr-1" />
                          {hasAllocatedQuantities ? 'Allocate More' : 'Allocate Stock'}
                        </Button>
                      )}

                      {hasAllocatedQuantities && hasAllocatedButNotPicked && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedContainerId(containerDetailId)
                            setSelectedAllocationId(null) // Bulk pick for all allocations
                            setShowPickDialog(true)
                          }}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Pick All
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {containerData.allProductLines.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-sm font-semibold text-muted-foreground mb-2">
                        Product Lines ({containerData.allProductLines.length})
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {containerData.allProductLines.map(
                          ({ line, allocationId, allocationStage }, idx: number) => {
                            const skuCode =
                              typeof line.skuId === 'object' ? line.skuId.skuCode : 'N/A'
                            const skuDescription =
                              typeof line.skuId === 'object' ? line.skuId.description : ''
                            const expectedQty = line.expectedQty || 0
                            const allocatedQty = line.allocatedQty || 0
                            const pickedQty = line.pickedQty || 0
                            const skuId =
                              typeof line.skuId === 'object' ? line.skuId.id : line.skuId

                            // Get pickup records for this product line
                            const pickupKey = `${containerDetailId}-${allocationId}-${skuId}`
                            const pickupRecords = pickupRecordsMap.get(pickupKey) || []
                            const lpnCount = pickupRecords.reduce(
                              (sum, record) => sum + (record.pickedUpLPNs?.length || 0),
                              0,
                            )

                            return (
                              <div key={idx} className="border rounded-lg p-3 bg-muted/50">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="font-medium text-sm">{skuCode}</div>
                                  <Badge
                                    className={getStageColor(allocationStage)}
                                    variant="outline"
                                  >
                                    {allocationStage}
                                  </Badge>
                                </div>
                                {skuDescription && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {skuDescription}
                                  </div>
                                )}
                                {line.batchNumber && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Batch: {line.batchNumber}
                                  </div>
                                )}
                                <div className="flex gap-4 mt-2 text-xs">
                                  <div>
                                    <span className="text-muted-foreground">Expected:</span>{' '}
                                    <span className="font-medium">{expectedQty}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Allocated:</span>{' '}
                                    <span
                                      className={`font-medium ${allocatedQty > 0 ? 'text-blue-600' : ''}`}
                                    >
                                      {allocatedQty}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Picked:</span>{' '}
                                    <span
                                      className={`font-medium ${pickedQty > 0 ? 'text-green-600' : ''}`}
                                    >
                                      {pickedQty}
                                    </span>
                                  </div>
                                </div>
                                {lpnCount > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <Button
                                      variant="link"
                                      className="text-xs p-0 h-auto text-blue-600 hover:text-blue-800"
                                      onClick={() => {
                                        setSelectedLpnRecords(pickupRecords)
                                        setSelectedLpnSkuCode(skuCode)
                                        setSelectedLpnSkuDescription(skuDescription || '')
                                        setShowLpnDialog(true)
                                      }}
                                    >
                                      {lpnCount} LPN{lpnCount !== 1 ? 's' : ''} picked
                                    </Button>
                                  </div>
                                )}
                                <div className="flex gap-2 mt-3 pt-2 border-t">
                                  {allocationStage === 'allocated' && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="flex-1 text-xs"
                                        onClick={() => {
                                          setSelectedContainerId(containerDetailId)
                                          setSelectedAllocationId(allocationId)
                                          setShowAllocateDialog(true)
                                        }}
                                      >
                                        <PackageCheck className="h-3 w-3 mr-1" />
                                        Allocate
                                      </Button>
                                      {allocatedQty > 0 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="flex-1 text-xs"
                                          onClick={() => {
                                            setSelectedContainerId(containerDetailId)
                                            setSelectedAllocationId(allocationId)
                                            setShowPickDialog(true)
                                          }}
                                        >
                                          <Package className="h-3 w-3 mr-1" />
                                          Pick
                                        </Button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            )
                          },
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No product lines found</p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Allocate Stock Dialog */}
      {selectedContainerId !== null && (
        <AllocateStockDialog
          open={showAllocateDialog}
          onOpenChange={(open) => {
            setShowAllocateDialog(open)
            if (!open) {
              setSelectedContainerId(null)
              setSelectedAllocationId(null)
            }
          }}
          bookingId={parseInt(bookingId)}
          containerId={selectedContainerId}
          allocationId={selectedAllocationId || undefined}
          onComplete={() => {
            loadData()
          }}
        />
      )}

      {/* Pick Stock Dialog */}
      {selectedContainerId !== null && (
        <PickStockDialog
          open={showPickDialog}
          onOpenChange={(open) => {
            setShowPickDialog(open)
            if (!open) {
              setSelectedContainerId(null)
              setSelectedAllocationId(null)
            }
          }}
          bookingId={parseInt(bookingId)}
          containerId={selectedContainerId}
          allocationId={selectedAllocationId || undefined}
          onComplete={() => {
            loadData()
          }}
        />
      )}

      {/* LPN Details Dialog */}
      <LpnDetailsDialog
        open={showLpnDialog}
        onOpenChange={setShowLpnDialog}
        records={selectedLpnRecords}
        skuCode={selectedLpnSkuCode}
        skuDescription={selectedLpnSkuDescription}
      />
    </div>
  )
}
