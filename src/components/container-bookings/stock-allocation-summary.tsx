'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Package, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { ContainerStatusBadge } from './container-status-badge'

type BookingType = 'import' | 'export'

type ImportStage = 'expected' | 'received' | 'put_away'
type ExportStage = 'allocated' | 'picked' | 'dispatched'

interface StockAllocation {
  id: number
  containerDetailId: number | { id: number; containerNumber?: string }
  stage: ImportStage | ExportStage
  productLines?: Array<{
    id?: number
    skuId?: number | { id: number; skuCode?: string }
    batchNumber?: string
    expectedQty?: number
    recievedQty?: number
    pickedQty?: number
    allocatedQty?: number
  }>
}

interface ContainerDetail {
  id: number
  containerNumber: string
  status?: 'expecting' | 'received' | 'put_away' | 'allocated' | 'picked_up' | 'dispatched'
}

interface StockAllocationSummaryProps {
  allocations: StockAllocation[]
  containers?: ContainerDetail[]
  bookingId: number
  bookingType: BookingType
}

export function StockAllocationSummary({
  allocations,
  containers = [],
  bookingId,
  bookingType,
}: StockAllocationSummaryProps) {
  const getStageColor = (stage: string): string => {
    if (bookingType === 'import') {
      switch (stage) {
        case 'expected':
          return 'bg-blue-100 text-blue-800 border-blue-300'
        case 'received':
          return 'bg-yellow-100 text-yellow-800 border-yellow-300'
        case 'put_away':
          return 'bg-green-100 text-green-800 border-green-300'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300'
      }
    } else {
      switch (stage) {
        case 'allocated':
          return 'bg-blue-100 text-blue-800 border-blue-300'
        case 'picked':
          return 'bg-yellow-100 text-yellow-800 border-yellow-300'
        case 'dispatched':
          return 'bg-green-100 text-green-800 border-green-300'
        default:
          return 'bg-gray-100 text-gray-800 border-gray-300'
      }
    }
  }

  const getStageLabel = (stage: string): string => {
    if (bookingType === 'import') {
      switch (stage) {
        case 'expected':
          return 'Expected'
        case 'received':
          return 'Received'
        case 'put_away':
          return 'Put Away'
        default:
          return stage
      }
    } else {
      switch (stage) {
        case 'allocated':
          return 'Allocated'
        case 'picked':
          return 'Picked'
        case 'dispatched':
          return 'Dispatched'
        default:
          return stage
      }
    }
  }

  const stageCounts = allocations.reduce((acc, allocation) => {
    const stage = allocation.stage
    acc[stage] = (acc[stage] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalContainers = containers.length || allocations.length
  const completedContainers = containers.filter(
    (c) =>
      bookingType === 'import'
        ? c.status === 'put_away'
        : c.status === 'dispatched',
  ).length

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Stock Allocation</CardTitle>
            <CardDescription>
              {completedContainers} of {totalContainers} containers{' '}
              {bookingType === 'import' ? 'put away' : 'dispatched'}
            </CardDescription>
          </div>
          <Link
            href={
              bookingType === 'import'
                ? `/dashboard/import-container-bookings/${bookingId}/stock-allocation`
                : `/dashboard/export-container-bookings/${bookingId}/stock-allocation`
            }
          >
            <Button variant="outline" size="sm">
              Manage
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {containers.length > 0 ? (
            // Show container-level status summary
            <>
              {containers.map((container) => (
                <div key={container.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{container.containerNumber}</span>
                  </div>
                  {container.status && (
                    <ContainerStatusBadge status={container.status} type={bookingType} />
                  )}
                </div>
              ))}
            </>
          ) : (
            // Fallback to stage counts if containers not provided
            <>
              {Object.entries(stageCounts).map(([stage, count]) => (
                <div key={stage} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{getStageLabel(stage)}</span>
                  </div>
                  <Badge variant="outline" className={getStageColor(stage)}>
                    {count}
                  </Badge>
                </div>
              ))}
            </>
          )}
          {totalContainers === 0 && (
            <p className="text-muted-foreground text-center py-2">No stock allocations yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

