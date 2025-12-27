import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
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
