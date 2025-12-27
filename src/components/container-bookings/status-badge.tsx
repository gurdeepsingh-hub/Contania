import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type BookingStatus =
  | 'draft'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expecting'
  | 'partially_received'
  | 'received'
  | 'partially_put_away'
  | 'put_away'
  | 'allocated'
  | 'partially_picked'
  | 'picked'
  | 'ready_to_dispatch'
  | 'dispatched'
type BookingType = 'import' | 'export'

interface StatusBadgeProps {
  status: BookingStatus
  type?: BookingType
  className?: string
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const getStatusColor = (status: BookingStatus): string => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-300'
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300'
      // Import statuses
      case 'expecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'partially_received':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'received':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'partially_put_away':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'put_away':
        return 'bg-green-100 text-green-800 border-green-300'
      // Export statuses
      case 'allocated':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'partially_picked':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'picked':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'ready_to_dispatch':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300'
      case 'dispatched':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusLabel = (status: BookingStatus): string => {
    switch (status) {
      case 'draft':
        return 'Draft'
      case 'confirmed':
        return 'Confirmed'
      case 'in_progress':
        return 'In Progress'
      case 'completed':
        return 'Completed'
      case 'cancelled':
        return 'Cancelled'
      // Import statuses
      case 'expecting':
        return 'Expecting'
      case 'partially_received':
        return 'Partially Received'
      case 'received':
        return 'Received'
      case 'partially_put_away':
        return 'Partially Put Away'
      case 'put_away':
        return 'Put Away'
      // Export statuses
      case 'allocated':
        return 'Allocated'
      case 'partially_picked':
        return 'Partially Picked'
      case 'picked':
        return 'Picked'
      case 'ready_to_dispatch':
        return 'Ready to Dispatch'
      case 'dispatched':
        return 'Dispatched'
      default:
        return status
    }
  }

  return (
    <Badge variant="outline" className={cn(getStatusColor(status), className)}>
      {getStatusLabel(status)}
    </Badge>
  )
}
