'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, PackageCheck, Package } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { ReceiveStockDialog } from '@/components/container-bookings/receive-stock-dialog'
import { ContainerPutAwayDialog } from '@/components/container-bookings/container-put-away-dialog'
import { LpnDetailsDialog } from '@/components/container-bookings/lpn-details-dialog'

export default function ImportStockAllocationPage() {
  const params = useParams()
  const { loading } = useTenant()
  const bookingId = params.id as string
  const [allocations, setAllocations] = useState<any[]>([])
  const [containersMap, setContainersMap] = useState<Map<number, any>>(new Map())
  const [putAwayRecordsMap, setPutAwayRecordsMap] = useState<Map<string, any[]>>(new Map()) // Key: "allocationId-skuId"
  const [loadingData, setLoadingData] = useState(false)
  const [showReceiveDialog, setShowReceiveDialog] = useState(false)
  const [selectedAllocationId, setSelectedAllocationId] = useState<number | null>(null)
  const [showPutAwayDialog, setShowPutAwayDialog] = useState(false)
  const [selectedContainerId, setSelectedContainerId] = useState<number | null>(null)
  const [selectedPutAwayAllocationId, setSelectedPutAwayAllocationId] = useState<number | null>(
    null,
  )
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
        fetch(`/api/import-container-bookings/${bookingId}/stock-allocations?depth=2`),
        fetch(`/api/import-container-bookings/${bookingId}/container-details?depth=1`),
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

      // Fetch put-away records for all containers
      if (containerIds.length > 0) {
        const putAwayPromises = containerIds.map((containerId) =>
          fetch(`/api/import-container-bookings/${bookingId}/containers/${containerId}/put-away`),
        )
        const putAwayResponses = await Promise.all(putAwayPromises)

        const putAwayMap = new Map<string, any[]>()
        for (const res of putAwayResponses) {
          if (res.ok) {
            const data = await res.json()
            if (data.success && data.records) {
              // Group put-away records by containerId-allocationId-skuId for more specific grouping
              // Include containerDetailId and containerStockAllocationId in the records
              data.records.forEach((record: any) => {
                const containerId =
                  typeof record.containerDetailId === 'object'
                    ? record.containerDetailId.id
                    : record.containerDetailId
                const allocationId =
                  typeof record.containerStockAllocationId === 'object'
                    ? record.containerStockAllocationId.id
                    : record.containerStockAllocationId
                const skuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
                if (containerId && allocationId && skuId) {
                  const key = `${containerId}-${allocationId}-${skuId}`
                  if (!putAwayMap.has(key)) {
                    putAwayMap.set(key, [])
                  }
                  // Ensure containerDetailId and containerStockAllocationId are included in the record
                  putAwayMap.get(key)!.push({
                    ...record,
                    containerDetailId: containerId,
                    containerStockAllocationId: allocationId,
                  })
                }
              })
            }
          }
        }
        setPutAwayRecordsMap(putAwayMap)
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
      case 'expected':
        return 'bg-blue-100 text-blue-800'
      case 'received':
        return 'bg-yellow-100 text-yellow-800'
      case 'put_away':
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
        <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Stock Allocation</h1>
          <p className="text-muted-foreground">Manage stock allocations for this booking</p>
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

            // Check if any allocation has received quantities
            const hasReceivedQuantities = containerData.allProductLines.some(
              ({ line }: any) => line.recievedQty && line.recievedQty > 0,
            )

            // Check if all allocations are received or put_away (not expected)
            const allReceived = containerData.allocations.every(
              (alloc) => alloc.stage === 'received' || alloc.stage === 'put_away',
            )

            // Check if there are any allocations that are received but not yet put away
            const hasReceivedButNotPutAway = containerData.allocations.some(
              (alloc) => alloc.stage === 'received',
            )

            // Get container status from container detail
            const containerStatus = containerData.containerDetail?.status || 'expecting'

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
                      {containerData.allocations.some((alloc) => alloc.stage === 'expected') && (
                        <Button
                          size="sm"
                          onClick={() => {
                            // Open receive dialog for the first allocation with expected stage
                            const expectedAllocation = containerData.allocations.find(
                              (alloc) => alloc.stage === 'expected',
                            )
                            if (expectedAllocation) {
                              setSelectedAllocationId(expectedAllocation.id)
                              setShowReceiveDialog(true)
                            }
                          }}
                        >
                          <PackageCheck className="h-4 w-4 mr-1" />
                          Receive
                        </Button>
                      )}

                      {hasReceivedQuantities && allReceived && hasReceivedButNotPutAway && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedContainerId(containerDetailId)
                            setSelectedPutAwayAllocationId(null) // Bulk put-away for all allocations
                            setShowPutAwayDialog(true)
                          }}
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Put Away All
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
                            const expectedQty = line.expectedQtyImport || line.expectedQty || 0
                            const receivedQty = line.recievedQty || 0
                            const skuId =
                              typeof line.skuId === 'object' ? line.skuId.id : line.skuId

                            // Get put-away records for this product line
                            // Use a more specific key that includes containerId to avoid conflicts
                            const putAwayKey = `${containerDetailId}-${allocationId}-${skuId}`
                            const putAwayRecords = putAwayRecordsMap.get(putAwayKey) || []
                            const lpnCount = putAwayRecords.length

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
                                    <span className="text-muted-foreground">Received:</span>{' '}
                                    <span
                                      className={`font-medium ${receivedQty > 0 ? 'text-green-600' : ''}`}
                                    >
                                      {receivedQty}
                                    </span>
                                  </div>
                                </div>
                                {lpnCount > 0 && (
                                  <div className="mt-2 pt-2 border-t">
                                    <Button
                                      variant="link"
                                      className="text-xs p-0 h-auto text-blue-600 hover:text-blue-800"
                                      onClick={() => {
                                        setSelectedLpnRecords(putAwayRecords)
                                        setSelectedLpnSkuCode(skuCode)
                                        setSelectedLpnSkuDescription(skuDescription || '')
                                        setShowLpnDialog(true)
                                      }}
                                    >
                                      {lpnCount} LPN{lpnCount !== 1 ? 's' : ''} put away
                                    </Button>
                                  </div>
                                )}
                                <div className="flex gap-2 mt-3 pt-2 border-t">
                                  {allocationStage === 'expected' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs"
                                      onClick={() => {
                                        setSelectedAllocationId(allocationId)
                                        setShowReceiveDialog(true)
                                      }}
                                    >
                                      <PackageCheck className="h-3 w-3 mr-1" />
                                      Receive
                                    </Button>
                                  )}
                                  {allocationStage === 'received' && receivedQty > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="flex-1 text-xs"
                                      onClick={() => {
                                        setSelectedContainerId(containerDetailId)
                                        setSelectedPutAwayAllocationId(allocationId) // Put-away for this specific allocation
                                        setShowPutAwayDialog(true)
                                      }}
                                    >
                                      <Package className="h-3 w-3 mr-1" />
                                      Put Away
                                    </Button>
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

      {/* Receive Stock Dialog */}
      {selectedAllocationId && (
        <ReceiveStockDialog
          open={showReceiveDialog}
          onOpenChange={(open) => {
            setShowReceiveDialog(open)
            if (!open) {
              setSelectedAllocationId(null)
            }
          }}
          bookingId={parseInt(bookingId)}
          allocationId={selectedAllocationId}
          onComplete={() => {
            loadData()
          }}
        />
      )}

      {/* Put Away Dialog */}
      {selectedContainerId && (
        <ContainerPutAwayDialog
          open={showPutAwayDialog}
          onOpenChange={(open) => {
            setShowPutAwayDialog(open)
            if (!open) {
              setSelectedContainerId(null)
              setSelectedPutAwayAllocationId(null)
            }
          }}
          bookingId={parseInt(bookingId)}
          containerId={selectedContainerId}
          allocationId={selectedPutAwayAllocationId || undefined}
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
