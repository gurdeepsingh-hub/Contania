'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Edit, Trash2 } from 'lucide-react'
import { InventoryEditDialog } from './inventory-edit-dialog'
import { QuantityEditDialog } from './quantity-edit-dialog'
import { BatchEditDialog } from './batch-edit-dialog'
import { JobEditDialog } from './job-edit-dialog'
import { LPNBulkEditDialog } from './lpn-bulk-edit-dialog'
import { LPNAllocationDialog } from './lpn-allocation-dialog'
import { Checkbox } from '@/components/ui/checkbox'
// Note: Install sonner for toast notifications: pnpm add sonner
// For now using alert as fallback
const toast = {
  success: (message: string) => alert(message),
  error: (message: string) => alert(message),
}
import { hasEditPermission, hasDeletePermission } from '@/lib/permissions'
import type {
  AggregatedInventoryItem,
  InventoryRecord,
  OutboundJob,
  InboundJob,
  ContainerJob,
} from '@/lib/inventory-helpers'

type InventoryResultsDisplayProps = {
  results: (AggregatedInventoryItem & { records?: InventoryRecord[] })[]
  loading?: boolean
  currentUser?: any
  onRefresh?: () => void
}

export function InventoryResultsDisplay({
  results,
  loading = false,
  currentUser,
  onRefresh,
}: InventoryResultsDisplayProps) {
  const router = useRouter()
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null)
  const [editingQuantity, setEditingQuantity] = useState<{
    skuId: string
    currentQty: number
  } | null>(null)
  const [editingBatch, setEditingBatch] = useState<{ skuId: string; batchNumber: string } | null>(
    null,
  )
  const [editingJob, setEditingJob] = useState<{
    type: 'inbound' | 'outbound'
    id: number
    data?: any
  } | null>(null)
  const [bulkEditingLPNs, setBulkEditingLPNs] = useState<number[] | null>(null)
  const [selectedLPNs, setSelectedLPNs] = useState<Set<number>>(new Set())
  const [allocatingLPNs, setAllocatingLPNs] = useState<number[] | null>(null)

  const canEdit = currentUser ? hasEditPermission(currentUser, 'inventory') : false
  const canDelete = currentUser ? hasDeletePermission(currentUser, 'inventory') : false

  const handleMultiValueClick = (filterType: string, value: string) => {
    router.push(`/dashboard/inventory/${filterType}/${encodeURIComponent(value)}`)
  }

  const handleEdit = (recordId: number) => {
    setEditingRecordId(recordId)
  }

  const handleDelete = async (recordId: number) => {
    if (!confirm('Are you sure you want to delete this inventory record?')) {
      return
    }

    try {
      const res = await fetch(`/api/inventory/records/${recordId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          toast.success('Record deleted successfully')
          onRefresh?.()
        } else {
          toast.error(data.message || 'Failed to delete record')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to delete record')
      }
    } catch (error) {
      console.error('Error deleting record:', error)
      toast.error('Failed to delete record')
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined || isNaN(num)) {
      return '0'
    }
    return num.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading results...</div>
        </CardContent>
      </Card>
    )
  }

  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            No inventory found matching your search criteria.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Inventory Results ({results.length})</CardTitle>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {results.map((item, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-lg">{item.skuId}</CardTitle>
                {item.skuDescription && (
                  <p className="text-sm text-muted-foreground">{item.skuDescription}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quantity Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">QTY Available</p>
                    <p className="text-lg font-semibold">{formatNumber(item.qtyAvailable)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">QTY Received</p>
                      <p className="text-lg font-semibold">{formatNumber(item.qtyReceived)}</p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setEditingQuantity({ skuId: item.skuId, currentQty: item.qtyReceived })
                        }
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">QTY Allocated</p>
                    <p className="text-lg font-semibold">{formatNumber(item.qtyAllocated)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">QTY Picked</p>
                    <p className="text-lg font-semibold">{formatNumber(item.qtyPicked)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">QTY Dispatched</p>
                    <p className="text-lg font-semibold">{formatNumber(item.qtyDispatched)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">QTY Hold</p>
                    <p className="text-lg font-semibold">{formatNumber(item.qtyHold)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Weight Available</p>
                    <p className="text-lg font-semibold">{formatNumber(item.weightAvailable)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cubic Available</p>
                    <p className="text-lg font-semibold">{formatNumber(item.cubicAvailable)}</p>
                  </div>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {item.expiry && (
                    <div>
                      <span className="text-muted-foreground">Expiry: </span>
                      <span>{formatDate(item.expiry)}</span>
                    </div>
                  )}
                  {item.attribute1 && (
                    <div>
                      <span className="text-muted-foreground">Attribute 1: </span>
                      <span>{item.attribute1}</span>
                    </div>
                  )}
                  {item.attribute2 && (
                    <div>
                      <span className="text-muted-foreground">Attribute 2: </span>
                      <span>{item.attribute2}</span>
                    </div>
                  )}
                  {item.sqmPerSU && (
                    <div>
                      <span className="text-muted-foreground">SQM/SU: </span>
                      <span>{formatNumber(item.sqmPerSU)}</span>
                    </div>
                  )}
                  {item.zone && (
                    <div>
                      <span className="text-muted-foreground">Zone: </span>
                      <span>{item.zone}</span>
                    </div>
                  )}
                  {item.customerName && (
                    <div>
                      <span className="text-muted-foreground">Customer: </span>
                      <span>{item.customerName}</span>
                    </div>
                  )}
                </div>

                {/* Multi-value Fields with Accordions */}
                <Accordion type="multiple" className="w-full">
                  {/* Status */}
                  {item.status.length > 0 && (
                    <AccordionItem value="status">
                      <AccordionTrigger>Status ({item.status.length})</AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2">
                          {item.status.map((status, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => handleMultiValueClick('status', status)}
                            >
                              {status}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Batches */}
                  {item.batches.length > 0 && (
                    <AccordionItem value="batches">
                      <AccordionTrigger>Batches ({item.batches.length})</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-2">
                          {item.batches.map((batch, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 border rounded-md hover:bg-muted/50"
                            >
                              <Badge
                                variant="outline"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => handleMultiValueClick('batch', batch)}
                              >
                                {batch}
                              </Badge>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setEditingBatch({ skuId: item.skuId, batchNumber: batch })
                                  }
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* LPNs with Individual Records - Grouped by Status */}
                  {item.lpns.length > 0 && (
                    <AccordionItem value="lpns">
                      <AccordionTrigger>
                        <div className="flex items-center gap-2">
                          <span>LPNs ({item.lpns.length})</span>
                          {selectedLPNs.size > 0 && (
                            <Badge variant="secondary" className="ml-2">
                              {selectedLPNs.size} selected
                            </Badge>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {item.records && item.records.length > 0 ? (
                          <div className="space-y-2">
                            {/* Selection controls */}
                            {canEdit && (
                              <div className="flex items-center justify-between p-2 border rounded-md bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Checkbox
                                    checked={
                                      selectedLPNs.size === item.records?.length &&
                                      (item.records?.length || 0) > 0
                                    }
                                    onCheckedChange={(checked) => {
                                      if (checked && item.records) {
                                        setSelectedLPNs(new Set(item.records.map((r) => r.id)))
                                      } else {
                                        setSelectedLPNs(new Set())
                                      }
                                    }}
                                  />
                                  <span className="text-sm text-muted-foreground">
                                    Select all ({item.records.length})
                                  </span>
                                </div>
                                <div className="flex gap-2">
                                  {selectedLPNs.size > 0 && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setBulkEditingLPNs(Array.from(selectedLPNs))
                                        }}
                                      >
                                        <Edit className="h-4 w-4 mr-2" />
                                        Bulk Edit ({selectedLPNs.size})
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setAllocatingLPNs(Array.from(selectedLPNs))
                                        }}
                                      >
                                        Allocate ({selectedLPNs.size})
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* Group records by status in nested accordions */}
                            <Accordion type="multiple" className="w-full">
                              {(() => {
                                const groupedByStatus = item.records.reduce(
                                  (acc, record) => {
                                    const status = record.allocationStatus || 'unknown'
                                    if (!acc[status]) {
                                      acc[status] = []
                                    }
                                    acc[status].push(record)
                                    return acc
                                  },
                                  {} as Record<string, InventoryRecord[]>,
                                )

                                const statusOrder = [
                                  'available',
                                  'reserved',
                                  'allocated',
                                  'picked',
                                  'dispatched',
                                  'unknown',
                                ]
                                const sortedStatuses = Object.keys(groupedByStatus).sort((a, b) => {
                                  const aIndex = statusOrder.indexOf(a)
                                  const bIndex = statusOrder.indexOf(b)
                                  return (
                                    (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex)
                                  )
                                })

                                return sortedStatuses.map((status) => {
                                  const records = groupedByStatus[status]
                                  const statusLabel =
                                    status.charAt(0).toUpperCase() + status.slice(1)
                                  const statusColors: Record<
                                    string,
                                    { bg: string; text: string; border: string }
                                  > = {
                                    available: {
                                      bg: 'bg-green-50',
                                      text: 'text-green-700',
                                      border: 'border-green-200',
                                    },
                                    reserved: {
                                      bg: 'bg-yellow-50',
                                      text: 'text-yellow-700',
                                      border: 'border-yellow-200',
                                    },
                                    allocated: {
                                      bg: 'bg-blue-50',
                                      text: 'text-blue-700',
                                      border: 'border-blue-200',
                                    },
                                    picked: {
                                      bg: 'bg-orange-50',
                                      text: 'text-orange-700',
                                      border: 'border-orange-200',
                                    },
                                    dispatched: {
                                      bg: 'bg-purple-50',
                                      text: 'text-purple-700',
                                      border: 'border-purple-200',
                                    },
                                    unknown: {
                                      bg: 'bg-gray-50',
                                      text: 'text-gray-700',
                                      border: 'border-gray-200',
                                    },
                                  }
                                  const colors = statusColors[status] || statusColors.unknown
                                  const statusSelectedCount = records.filter((r) =>
                                    selectedLPNs.has(r.id),
                                  ).length
                                  return (
                                    <AccordionItem
                                      key={status}
                                      value={`lpn-status-${status}`}
                                      className={`border ${colors.border} rounded-lg`}
                                    >
                                      <AccordionTrigger
                                        className={`${colors.bg} ${colors.text} hover:no-underline px-4 py-2 rounded-t-lg`}
                                      >
                                        <div className="flex items-center justify-between w-full pr-4">
                                          <span className="font-semibold">
                                            {statusLabel} ({records.length})
                                          </span>
                                          {statusSelectedCount > 0 && (
                                            <Badge variant="secondary" className="ml-2">
                                              {statusSelectedCount} selected
                                            </Badge>
                                          )}
                                        </div>
                                      </AccordionTrigger>
                                      <AccordionContent className={`${colors.bg} p-3 rounded-b-lg`}>
                                        <div className="space-y-2">
                                          {canEdit && records.length > 1 && (
                                            <div className="flex justify-end mb-2">
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                  // Select all LPNs in this status category instead of opening bulk edit dialog
                                                  const allRecordIds = records.map((r) => r.id)
                                                  setSelectedLPNs(new Set(allRecordIds))
                                                }}
                                              >
                                                <Edit className="h-4 w-4 mr-2" />
                                                Select All ({records.length})
                                              </Button>
                                            </div>
                                          )}
                                          {/* Display LPNs in responsive grid */}
                                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                            {records.map((record) => (
                                              <div
                                                key={record.id}
                                                className={`flex flex-col p-2 border rounded-md hover:bg-background/50 gap-1 ${
                                                  selectedLPNs.has(record.id)
                                                    ? 'ring-2 ring-primary'
                                                    : ''
                                                }`}
                                              >
                                                <div className="flex items-center justify-between">
                                                  <div className="flex items-center gap-2 flex-1">
                                                    {canEdit && (
                                                      <Checkbox
                                                        checked={selectedLPNs.has(record.id)}
                                                        onCheckedChange={(checked) => {
                                                          const newSelected = new Set(selectedLPNs)
                                                          if (checked) {
                                                            newSelected.add(record.id)
                                                          } else {
                                                            newSelected.delete(record.id)
                                                          }
                                                          setSelectedLPNs(newSelected)
                                                        }}
                                                      />
                                                    )}
                                                    <Badge
                                                      variant="outline"
                                                      className="cursor-pointer hover:bg-primary hover:text-primary-foreground font-mono text-xs"
                                                      onClick={() =>
                                                        handleMultiValueClick(
                                                          'lpn',
                                                          record.lpnNumber,
                                                        )
                                                      }
                                                    >
                                                      {record.lpnNumber}
                                                    </Badge>
                                                  </div>
                                                  {(canEdit || canDelete) && (
                                                    <div className="flex gap-1">
                                                      {canEdit && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 w-6 p-0"
                                                          onClick={() => handleEdit(record.id)}
                                                        >
                                                          <Edit className="h-3 w-3" />
                                                        </Button>
                                                      )}
                                                      {canDelete && (
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          className="h-6 w-6 p-0"
                                                          onClick={() => handleDelete(record.id)}
                                                        >
                                                          <Trash2 className="h-3 w-3 text-destructive" />
                                                        </Button>
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                                <div className="text-xs text-muted-foreground space-y-0.5">
                                                  <div>Location: {record.location}</div>
                                                  <div>Qty: {record.huQty}</div>
                                                  {record.outboundProductLineId && (
                                                    <div className="text-blue-600">
                                                      Allocated to Product Line
                                                    </div>
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </AccordionContent>
                                    </AccordionItem>
                                  )
                                })
                              })()}
                            </Accordion>
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {item.lpns.map((lpn, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                onClick={() => handleMultiValueClick('lpn', lpn)}
                              >
                                {lpn}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Locations */}
                  {item.locations.length > 0 && (
                    <AccordionItem value="locations">
                      <AccordionTrigger>Locations ({item.locations.length})</AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2">
                          {item.locations.map((location, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => handleMultiValueClick('location', location)}
                            >
                              {location}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Container Numbers */}
                  {item.containerNumbers.length > 0 && (
                    <AccordionItem value="containers">
                      <AccordionTrigger>
                        Container Numbers ({item.containerNumbers.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="flex flex-wrap gap-2">
                          {item.containerNumbers.map((container, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                              onClick={() => handleMultiValueClick('container', container)}
                            >
                              {container}
                            </Badge>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Outbound Jobs */}
                  {item.outboundJobs && item.outboundJobs.length > 0 && (
                    <AccordionItem value="outbound-jobs">
                      <AccordionTrigger>
                        Outbound Jobs ({item.outboundJobs.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {item.outboundJobs.map((job: OutboundJob, idx: number) => (
                            <div key={idx} className="p-3 border rounded-md space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="font-mono">
                                  {job.jobCode}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  {job.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {job.status.replace(/_/g, ' ')}
                                    </Badge>
                                  )}
                                  {canEdit && job.id !== undefined && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditingJob({
                                          type: 'outbound',
                                          id: job.id!,
                                          data: {
                                            jobCode: job.jobCode,
                                            customerRefNumber: job.customerRefNumber,
                                            consigneeRefNumber: job.consigneeRefNumber,
                                            containerNumber: job.containerNumber,
                                            inspectionNumber: job.inspectionNumber,
                                            inboundJobNumber: job.inboundJobNumber,
                                            requiredDateTime: job.requiredDateTime,
                                            orderNotes: job.orderNotes,
                                            palletCount: job.palletCount,
                                          },
                                        })
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {job.customerRefNumber && (
                                  <div>
                                    <span className="text-muted-foreground">Customer Ref: </span>
                                    <span>{job.customerRefNumber}</span>
                                  </div>
                                )}
                                {job.consigneeRefNumber && (
                                  <div>
                                    <span className="text-muted-foreground">Consignee Ref: </span>
                                    <span>{job.consigneeRefNumber}</span>
                                  </div>
                                )}
                                {job.customerName && (
                                  <div>
                                    <span className="text-muted-foreground">Customer: </span>
                                    <span>{job.customerName}</span>
                                  </div>
                                )}
                                {job.customerToName && (
                                  <div>
                                    <span className="text-muted-foreground">Delivery To: </span>
                                    <span>{job.customerToName}</span>
                                  </div>
                                )}
                                {job.requiredDateTime && (
                                  <div>
                                    <span className="text-muted-foreground">Required Date: </span>
                                    <span>{formatDate(job.requiredDateTime)}</span>
                                  </div>
                                )}
                                {job.allocatedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Allocated Qty: </span>
                                    <span>{formatNumber(job.allocatedQty)}</span>
                                  </div>
                                )}
                                {job.expectedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Expected Qty: </span>
                                    <span>{formatNumber(job.expectedQty)}</span>
                                  </div>
                                )}
                                {job.pickedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Picked Qty: </span>
                                    <span>{formatNumber(job.pickedQty)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Inbound Jobs */}
                  {item.inboundJobs && item.inboundJobs.length > 0 && (
                    <AccordionItem value="inbound-jobs">
                      <AccordionTrigger>Inbound Jobs ({item.inboundJobs.length})</AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {item.inboundJobs.map((job: InboundJob, idx: number) => (
                            <div key={idx} className="p-3 border rounded-md space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="font-mono">
                                  {job.jobCode}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  {job.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {job.status.replace(/_/g, ' ')}
                                    </Badge>
                                  )}
                                  {canEdit && job.id !== undefined && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        setEditingJob({
                                          type: 'inbound',
                                          id: job.id!,
                                          data: {
                                            jobCode: job.jobCode,
                                            deliveryCustomerReferenceNumber:
                                              job.deliveryCustomerReferenceNumber,
                                            orderingCustomerReferenceNumber:
                                              job.orderingCustomerReferenceNumber,
                                            expectedDate: job.expectedDate,
                                            completedDate: job.completedDate,
                                            notes: job.notes,
                                          },
                                        })
                                      }
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {job.deliveryCustomerReferenceNumber && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Delivery Customer Ref:{' '}
                                    </span>
                                    <span>{job.deliveryCustomerReferenceNumber}</span>
                                  </div>
                                )}
                                {job.orderingCustomerReferenceNumber && (
                                  <div>
                                    <span className="text-muted-foreground">
                                      Ordering Customer Ref:{' '}
                                    </span>
                                    <span>{job.orderingCustomerReferenceNumber}</span>
                                  </div>
                                )}
                                {job.customerName && (
                                  <div>
                                    <span className="text-muted-foreground">Customer: </span>
                                    <span>{job.customerName}</span>
                                  </div>
                                )}
                                {job.supplierName && (
                                  <div>
                                    <span className="text-muted-foreground">Supplier: </span>
                                    <span>{job.supplierName}</span>
                                  </div>
                                )}
                                {job.expectedDate && (
                                  <div>
                                    <span className="text-muted-foreground">Expected Date: </span>
                                    <span>{formatDate(job.expectedDate)}</span>
                                  </div>
                                )}
                                {job.completedDate && (
                                  <div>
                                    <span className="text-muted-foreground">Completed Date: </span>
                                    <span>{formatDate(job.completedDate)}</span>
                                  </div>
                                )}
                                {job.receivedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Received Qty: </span>
                                    <span>{formatNumber(job.receivedQty)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Container Jobs */}
                  {item.containerJobs && item.containerJobs.length > 0 && (
                    <AccordionItem value="container-jobs">
                      <AccordionTrigger>
                        Container Jobs ({item.containerJobs.length})
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-3">
                          {item.containerJobs.map((job: ContainerJob, idx: number) => (
                            <div key={idx} className="p-3 border rounded-md space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={job.type === 'import' ? 'default' : 'secondary'}
                                    className="font-mono"
                                  >
                                    {job.bookingCode}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {job.type === 'import' ? 'Import' : 'Export'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  {job.status && (
                                    <Badge variant="outline" className="text-xs">
                                      {job.status.replace(/_/g, ' ')}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-sm">
                                {job.customerReference && (
                                  <div>
                                    <span className="text-muted-foreground">Customer Ref: </span>
                                    <span>{job.customerReference}</span>
                                  </div>
                                )}
                                {job.bookingReference && (
                                  <div>
                                    <span className="text-muted-foreground">Booking Ref: </span>
                                    <span>{job.bookingReference}</span>
                                  </div>
                                )}
                                {job.containerNumber && (
                                  <div>
                                    <span className="text-muted-foreground">Container: </span>
                                    <span>{job.containerNumber}</span>
                                  </div>
                                )}
                                {job.type === 'import' && job.eta && (
                                  <div>
                                    <span className="text-muted-foreground">ETA: </span>
                                    <span>{formatDate(job.eta)}</span>
                                  </div>
                                )}
                                {job.type === 'export' && job.etd && (
                                  <div>
                                    <span className="text-muted-foreground">ETD: </span>
                                    <span>{formatDate(job.etd)}</span>
                                  </div>
                                )}
                                {job.type === 'import' && job.expectedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Expected Qty: </span>
                                    <span>{formatNumber(job.expectedQty)}</span>
                                  </div>
                                )}
                                {job.type === 'import' && job.receivedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Received Qty: </span>
                                    <span>{formatNumber(job.receivedQty)}</span>
                                  </div>
                                )}
                                {job.type === 'export' && job.expectedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Expected Qty: </span>
                                    <span>{formatNumber(job.expectedQty)}</span>
                                  </div>
                                )}
                                {job.type === 'export' && job.allocatedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Allocated Qty: </span>
                                    <span>{formatNumber(job.allocatedQty)}</span>
                                  </div>
                                )}
                                {job.type === 'export' && job.pickedQty !== undefined && (
                                  <div>
                                    <span className="text-muted-foreground">Picked Qty: </span>
                                    <span>{formatNumber(job.pickedQty)}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* LPN Edit Dialog */}
      {editingRecordId && (
        <InventoryEditDialog
          open={!!editingRecordId}
          onOpenChange={(open) => {
            if (!open) setEditingRecordId(null)
          }}
          recordId={editingRecordId}
          onSuccess={() => {
            setEditingRecordId(null)
            onRefresh?.()
          }}
        />
      )}

      {/* Quantity Edit Dialog */}
      {editingQuantity && (
        <QuantityEditDialog
          open={!!editingQuantity}
          onOpenChange={(open) => {
            if (!open) setEditingQuantity(null)
          }}
          skuId={editingQuantity.skuId}
          currentReceivedQty={editingQuantity.currentQty}
          onSuccess={() => {
            setEditingQuantity(null)
            onRefresh?.()
          }}
        />
      )}

      {/* Batch Edit Dialog */}
      {editingBatch && (
        <BatchEditDialog
          open={!!editingBatch}
          onOpenChange={(open) => {
            if (!open) setEditingBatch(null)
          }}
          skuId={editingBatch.skuId}
          currentBatchNumber={editingBatch.batchNumber}
          onSuccess={() => {
            setEditingBatch(null)
            onRefresh?.()
          }}
        />
      )}

      {/* Job Edit Dialog */}
      {editingJob && (
        <JobEditDialog
          open={!!editingJob}
          onOpenChange={(open) => {
            if (!open) setEditingJob(null)
          }}
          jobType={editingJob.type}
          jobId={editingJob.id}
          initialData={editingJob.data}
          onSuccess={() => {
            setEditingJob(null)
            onRefresh?.()
          }}
        />
      )}

      {/* LPN Bulk Edit Dialog */}
      {bulkEditingLPNs && (
        <LPNBulkEditDialog
          open={!!bulkEditingLPNs}
          onOpenChange={(open) => {
            if (!open) {
              setBulkEditingLPNs(null)
              setSelectedLPNs(new Set())
            }
          }}
          recordIds={bulkEditingLPNs}
          onSuccess={() => {
            setBulkEditingLPNs(null)
            setSelectedLPNs(new Set())
            onRefresh?.()
          }}
        />
      )}

      {/* LPN Allocation Dialog */}
      {allocatingLPNs && (
        <LPNAllocationDialog
          open={!!allocatingLPNs}
          onOpenChange={(open) => {
            if (!open) {
              setAllocatingLPNs(null)
              setSelectedLPNs(new Set())
            }
          }}
          recordIds={allocatingLPNs}
          onSuccess={() => {
            setAllocatingLPNs(null)
            setSelectedLPNs(new Set())
            onRefresh?.()
          }}
        />
      )}
    </>
  )
}
