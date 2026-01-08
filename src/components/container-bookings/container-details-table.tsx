'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, Plus, Edit } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ContainerStatusBadge } from './container-status-badge'

type BookingType = 'import' | 'export'

interface ContainerDetail {
  id: number
  containerNumber?: string
  containerSizeId?:
    | number
    | { id: number; size?: number | string; attribute?: string; code?: string }
  shippingLineId?: number | { id: number; name?: string }
  gross?: string
  tare?: string
  net?: string
  isoCode?: string
  status?: 'expecting' | 'received' | 'put_away' | 'allocated' | 'picked_up' | 'dispatched'
}

interface ContainerDetailsTableProps {
  containers: ContainerDetail[]
  bookingId: number
  bookingType: BookingType
  onContainerClick?: (containerId: number) => void
}

export function ContainerDetailsTable({
  containers,
  bookingId,
  bookingType,
  onContainerClick,
}: ContainerDetailsTableProps) {
  const router = useRouter()

  const handleContainerClick = (containerId: number) => {
    if (onContainerClick) {
      onContainerClick(containerId)
    } else {
      const path =
        bookingType === 'import'
          ? `/dashboard/import-container-bookings/${bookingId}/containers/${containerId}`
          : `/dashboard/export-container-bookings/${bookingId}/containers/${containerId}`
      router.push(path)
    }
  }

  if (containers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Container Details</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No containers added yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Container Details ({containers.length})</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const path =
                bookingType === 'import'
                  ? `/dashboard/import-container-bookings/${bookingId}/edit?step=4`
                  : `/dashboard/export-container-bookings/${bookingId}/edit?step=4`
              router.push(path)
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Manage Containers
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Container Number</th>
                <th className="text-left p-2 font-medium">Size</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Shipping Line</th>
                <th className="text-left p-2 font-medium">ISO Code</th>
                <th className="text-left p-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => {
                let sizeDisplay = '-'
                if (typeof container.containerSizeId === 'object' && container.containerSizeId) {
                  const size = container.containerSizeId.size
                  const attribute = container.containerSizeId.attribute
                  if (size !== undefined && size !== null) {
                    const sizeStr = typeof size === 'string' ? size : String(size)
                    sizeDisplay = attribute ? `${sizeStr} ${attribute}` : sizeStr
                  }
                }
                const shippingLine =
                  typeof container.shippingLineId === 'object'
                    ? container.shippingLineId?.name
                    : null

                return (
                  <tr key={container.id} className="border-b hover:bg-muted/50">
                    <td className="p-2">{container.containerNumber || '-'}</td>
                    <td className="p-2">{sizeDisplay}</td>
                    <td className="p-2">
                      {container.status ? (
                        <ContainerStatusBadge status={container.status} type={bookingType} />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2">{shippingLine || '-'}</td>
                    <td className="p-2">{container.isoCode || '-'}</td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleContainerClick(container.id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const path =
                              bookingType === 'import'
                                ? `/dashboard/import-container-bookings/${bookingId}/edit?step=4&container=${container.id}`
                                : `/dashboard/export-container-bookings/${bookingId}/edit?step=4&container=${container.id}`
                            router.push(path)
                          }}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
