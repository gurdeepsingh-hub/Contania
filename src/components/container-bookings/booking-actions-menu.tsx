'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Eye, Edit, Copy, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'

type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
type BookingType = 'import' | 'export'

interface BookingActionsMenuProps {
  booking: {
    id: number
    status: BookingStatus
    bookingCode?: string
  }
  bookingType: BookingType
  onAction?: (action: string, bookingId: number) => void
}

export function BookingActionsMenu({ booking, bookingType, onAction }: BookingActionsMenuProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const isEditable = booking.status === 'draft' || booking.status === 'confirmed' || booking.status === 'in_progress'
  const isCancellable = booking.status !== 'cancelled' && booking.status !== 'completed'

  const handleDuplicate = async () => {
    if (onAction) {
      onAction('duplicate', booking.id)
    } else {
      toast.info('Duplicate functionality coming soon')
    }
  }

  const handleCancel = async () => {
    if (!isCancellable) {
      toast.error('This booking cannot be cancelled')
      return
    }

    if (!confirm(`Are you sure you want to cancel booking ${booking.bookingCode || booking.id}?`)) {
      return
    }

    setLoading(true)
    try {
      const endpoint = bookingType === 'import'
        ? `/api/import-container-bookings/${booking.id}`
        : `/api/export-container-bookings/${booking.id}`

      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      if (res.ok) {
        toast.success('Booking cancelled successfully')
        if (onAction) {
          onAction('cancel', booking.id)
        } else {
          router.refresh()
        }
      } else {
        const data = await res.json()
        toast.error(data.message || 'Failed to cancel booking')
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
      toast.error('Failed to cancel booking')
    } finally {
      setLoading(false)
    }
  }

  const viewPath = bookingType === 'import' 
    ? `/dashboard/import-container-bookings/${booking.id}`
    : `/dashboard/export-container-bookings/${booking.id}`
  
  const editPath = bookingType === 'import'
    ? `/dashboard/import-container-bookings/${booking.id}/edit`
    : `/dashboard/export-container-bookings/${booking.id}/edit`

  return (
    <div className="flex gap-2">
      <Link href={viewPath}>
        <Button variant="outline" size="sm">
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
      </Link>
      {isEditable && (
        <Link href={editPath}>
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </Link>
      )}
      <Button variant="outline" size="sm" onClick={handleDuplicate}>
        <Copy className="h-4 w-4 mr-1" />
        Duplicate
      </Button>
      {isCancellable && (
        <Button variant="outline" size="sm" onClick={handleCancel} disabled={loading}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
      )}
    </div>
  )
}

