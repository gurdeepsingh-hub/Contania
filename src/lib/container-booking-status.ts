/**
 * Status management utilities for container bookings
 */

export type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type BookingType = 'import' | 'export'

export interface ContainerBooking {
  id?: number
  status: BookingStatus
  customerReference?: string
  bookingReference?: string
  chargeToId?: number | string
  vesselId?: number
  fromId?: number | string
  toId?: number | string
  containerSizeIds?: number[]
  containerQuantities?: Record<string, number>
  emptyRouting?: {
    shippingLineId?: number
    pickupLocationId?: number | string
    pickupDate?: string
    viaLocations?: (number | string)[]
    dropoffLocationId?: number | string
    dropoffDate?: string
    requestedDeliveryDate?: string
  }
  fullRouting?: {
    pickupLocationId?: number | string
    pickupDate?: string
    viaLocations?: (number | string)[]
    dropoffLocationId?: number | string
    dropoffDate?: string
  }
  containerDetails?: Array<{ id?: number; containerNumber?: string }>
  stockAllocations?: Array<{ id?: number; containerDetailId?: number; stage?: string }>
}

/**
 * Check if a status transition is allowed
 */
export function canTransitionTo(
  booking: ContainerBooking,
  newStatus: BookingStatus,
  bookingType: BookingType,
): { allowed: boolean; reason?: string } {
  const currentStatus = booking.status

  // Cancelled can be set from any status
  if (newStatus === 'cancelled') {
    return { allowed: true }
  }

  // Cannot transition from cancelled
  if (currentStatus === 'cancelled') {
    return { allowed: false, reason: 'Cannot transition from cancelled status' }
  }

  // Status transition rules
  switch (currentStatus) {
    case 'draft':
      if (newStatus === 'confirmed') {
        const validation = validateForConfirmation(booking, bookingType)
        return validation
      }
      return { allowed: false, reason: 'Can only transition to confirmed from draft' }

    case 'confirmed':
      if (newStatus === 'in_progress') {
        const validation = validateForInProgress(booking, bookingType)
        return validation
      }
      return { allowed: false, reason: 'Can only transition to in_progress from confirmed' }

    case 'in_progress':
      if (newStatus === 'completed') {
        const validation = validateForCompleted(booking, bookingType)
        return validation
      }
      return { allowed: false, reason: 'Can only transition to completed from in_progress' }

    case 'completed':
      return { allowed: false, reason: 'Cannot transition from completed status' }

    default:
      return { allowed: false, reason: 'Unknown current status' }
  }
}

/**
 * Validate that all required steps are completed for confirmation
 */
export function validateForConfirmation(
  booking: ContainerBooking,
  bookingType: BookingType,
): { allowed: boolean; reason?: string } {
  // Step 1: Basic Info
  if (!booking.customerReference || !booking.bookingReference || !booking.chargeToId) {
    return { allowed: false, reason: 'Step 1 (Basic Info) is incomplete' }
  }

  if (bookingType === 'import' && !(booking as any).consigneeId) {
    return { allowed: false, reason: 'Consignee is required for import bookings' }
  }

  if (bookingType === 'export' && !(booking as any).consignorId) {
    return { allowed: false, reason: 'Consignor is required for export bookings' }
  }

  // Step 2: Vessel Info
  if (!booking.vesselId) {
    return { allowed: false, reason: 'Step 2 (Vessel Info) is incomplete' }
  }

  // Step 3: Locations
  if (!booking.fromId || !booking.toId || !booking.containerSizeIds || booking.containerSizeIds.length === 0) {
    return { allowed: false, reason: 'Step 3 (Locations) is incomplete' }
  }

  if (!booking.containerQuantities || Object.keys(booking.containerQuantities).length === 0) {
    return { allowed: false, reason: 'Container quantities are required' }
  }

  // Step 4: Routing
  if (!booking.emptyRouting || !booking.fullRouting) {
    return { allowed: false, reason: 'Step 4 (Routing) is incomplete' }
  }

  if (!booking.emptyRouting.shippingLineId || !booking.emptyRouting.pickupLocationId || !booking.emptyRouting.dropoffLocationId) {
    return { allowed: false, reason: 'Empty routing is incomplete' }
  }

  if (!booking.fullRouting.pickupLocationId || !booking.fullRouting.dropoffLocationId) {
    return { allowed: false, reason: 'Full routing is incomplete' }
  }

  // Step 5: Container Details
  if (!booking.containerDetails || booking.containerDetails.length === 0) {
    return { allowed: false, reason: 'Step 5 (Container Details) is incomplete' }
  }

  // All containers must have container numbers
  const invalidContainers = booking.containerDetails.filter(
    (c) => !c.containerNumber || !c.id,
  )
  if (invalidContainers.length > 0) {
    return { allowed: false, reason: 'All containers must have container numbers and be saved' }
  }

  return { allowed: true }
}

/**
 * Validate that container details exist for in_progress status
 */
export function validateForInProgress(
  booking: ContainerBooking,
  _bookingType: BookingType,
): { allowed: boolean; reason?: string } {
  if (!booking.containerDetails || booking.containerDetails.length === 0) {
    return { allowed: false, reason: 'Container details are required' }
  }

  // All containers must have IDs (saved)
  const unsavedContainers = booking.containerDetails.filter((c) => !c.id)
  if (unsavedContainers.length > 0) {
    return { allowed: false, reason: 'All containers must be saved before starting' }
  }

  return { allowed: true }
}

/**
 * Validate that all stock allocations are completed
 */
export function validateForCompleted(
  booking: ContainerBooking,
  bookingType: BookingType,
): { allowed: boolean; reason?: string } {
  if (!booking.containerDetails || booking.containerDetails.length === 0) {
    return { allowed: false, reason: 'Container details are required' }
  }

  if (!booking.stockAllocations || booking.stockAllocations.length === 0) {
    return { allowed: false, reason: 'Stock allocations are required' }
  }

  // Check that all containers have stock allocations
  const containerIds = booking.containerDetails.map((c) => c.id).filter(Boolean) as number[]
  const allocatedContainerIds = new Set(
    booking.stockAllocations.map((a) => a.containerDetailId).filter(Boolean),
  )

  const missingAllocations = containerIds.filter((id) => !allocatedContainerIds.has(id))
  if (missingAllocations.length > 0) {
    return {
      allowed: false,
      reason: `Stock allocations missing for ${missingAllocations.length} container(s)`,
    }
  }

  // Check that all allocations have required stages completed
  if (bookingType === 'import') {
    // Import: expected → received → put_away
    const requiredStages = ['expected', 'received', 'put_away']
    const incompleteAllocations = booking.stockAllocations.filter(
      (a) => !a.stage || !requiredStages.includes(a.stage),
    )
    if (incompleteAllocations.length > 0) {
      return { allowed: false, reason: 'Some stock allocations are incomplete' }
    }
  } else {
    // Export: allocated → picked → dispatched
    const requiredStages = ['allocated', 'picked', 'dispatched']
    const incompleteAllocations = booking.stockAllocations.filter(
      (a) => !a.stage || !requiredStages.includes(a.stage),
    )
    if (incompleteAllocations.length > 0) {
      return { allowed: false, reason: 'Some stock allocations are incomplete' }
    }
  }

  return { allowed: true }
}

/**
 * Get the next valid status for a booking
 */
export function getNextValidStatus(
  booking: ContainerBooking,
  bookingType: BookingType,
): BookingStatus[] {
  const validStatuses: BookingStatus[] = []

  switch (booking.status) {
    case 'draft':
      if (validateForConfirmation(booking, bookingType).allowed) {
        validStatuses.push('confirmed')
      }
      break
    case 'confirmed':
      if (validateForInProgress(booking, bookingType).allowed) {
        validStatuses.push('in_progress')
      }
      break
    case 'in_progress':
      if (validateForCompleted(booking, bookingType).allowed) {
        validStatuses.push('completed')
      }
      break
  }

  // Cancelled is always available (except from cancelled)
  if (booking.status !== 'cancelled') {
    validStatuses.push('cancelled')
  }

  return validStatuses
}

