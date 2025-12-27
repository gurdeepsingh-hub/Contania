import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type ContainerStatus = 'expecting' | 'received' | 'put_away' | 'allocated' | 'picked_up' | 'dispatched'
type ContainerType = 'import' | 'export'

interface ContainerStatusBadgeProps {
  status: ContainerStatus
  type?: ContainerType
  className?: string
}

export function ContainerStatusBadge({ status, type, className }: ContainerStatusBadgeProps) {
  const getStatusColor = (status: ContainerStatus): string => {
    switch (status) {
      case 'expecting':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'received':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'put_away':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'allocated':
        return 'bg-purple-100 text-purple-800 border-purple-300'
      case 'picked_up':
        return 'bg-orange-100 text-orange-800 border-orange-300'
      case 'dispatched':
        return 'bg-green-100 text-green-800 border-green-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getStatusLabel = (status: ContainerStatus): string => {
    switch (status) {
      case 'expecting':
        return 'Expecting'
      case 'received':
        return 'Received'
      case 'put_away':
        return 'Put Away'
      case 'allocated':
        return 'Allocated'
      case 'picked_up':
        return 'Picked Up'
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

