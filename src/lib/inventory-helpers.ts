/**
 * Utility functions for inventory calculations and data transformation
 */

export type InventoryRecord = {
  id: number
  lpnNumber: string
  huQty: number
  location: string
  allocationStatus: 'available' | 'reserved' | 'allocated' | 'picked' | 'dispatched'
  skuId?: number | { id: number; skuCode?: string; description?: string }
  inboundProductLineId?:
    | number
    | {
        id: number
        batchNumber?: string
        expiryDate?: string
        attribute1?: string
        attribute2?: string
        recievedQty?: number
      }
  inboundInventoryId?:
    | number
    | {
        id: number
        jobCode?: string
        deliveryCustomerReferenceNumber?: string
        containerNumber?: string // May not exist in schema but included for type safety
        deliveryCustomerId?: string | { id: number; customer_name?: string }
      }
  warehouseId?: number | { id: number; name?: string }
  outboundInventoryId?: number | { id: number }
  outboundProductLineId?: number | { id: number }
}

export type OutboundJob = {
  jobCode: string
  id?: number
  customerRefNumber?: string
  consigneeRefNumber?: string
  customerName?: string
  customerToName?: string
  requiredDateTime?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  allocatedQty?: number
  expectedQty?: number
  pickedQty?: number
  containerNumber?: string
  inspectionNumber?: string
  inboundJobNumber?: string
  orderNotes?: string
  palletCount?: number
}

export type InboundJob = {
  jobCode: string
  id?: number
  deliveryCustomerReferenceNumber?: string
  orderingCustomerReferenceNumber?: string
  customerName?: string
  supplierName?: string
  expectedDate?: string
  completedDate?: string
  status?: string
  createdAt?: string
  updatedAt?: string
  receivedQty?: number
  notes?: string
}

export type AggregatedInventoryItem = {
  skuId: string
  skuDescription: string
  qtyAvailable: number
  qtyReceived: number
  qtyAllocated: number
  qtyPicked: number
  qtyDispatched: number
  qtyHold: number
  status: string[]
  batches: string[]
  expiry: string | null
  attribute1: string | null
  attribute2: string | null
  lpns: string[]
  weightAvailable: number
  cubicAvailable: number
  sqmPerSU: number | null
  locations: string[]
  zone: string | null
  inboundOrderNumbers: string[]
  customerReferences: string[]
  containerNumbers: string[]
  customerName: string | null
  records?: InventoryRecord[] // Individual records for this SKU/Batch combination
  outboundJobs?: OutboundJob[] // Outbound jobs for this SKU
  inboundJobs?: InboundJob[] // Inbound jobs for this SKU
}

/**
 * Aggregate inventory records by SKU and Batch
 */
export function aggregateInventoryRecords(
  records: InventoryRecord[],
): Map<string, AggregatedInventoryItem> {
  const aggregated = new Map<string, AggregatedInventoryItem>()
  // Track which product lines we've already counted for received quantity
  const countedProductLines = new Set<number>()

  for (const record of records) {
    // Skip deleted records
    if ((record as any).isDeleted === true) {
      continue
    }

    // Get SKU info
    const skuId = typeof record.skuId === 'object' ? record.skuId.id : record.skuId
    const skuCode = typeof record.skuId === 'object' ? record.skuId.skuCode : undefined
    const skuDescription = typeof record.skuId === 'object' ? record.skuId.description : undefined

    if (!skuId) continue

    // Get batch number
    const batchNumber =
      typeof record.inboundProductLineId === 'object'
        ? record.inboundProductLineId.batchNumber
        : undefined

    // Create unique key: SKU + Batch (or just SKU if no batch)
    const key = batchNumber ? `${skuId}_${batchNumber}` : `${skuId}_null`

    // Get or create aggregated item
    let item = aggregated.get(key)
    if (!item) {
      item = {
        skuId: skuCode || skuId.toString(),
        skuDescription: skuDescription || '',
        qtyAvailable: 0,
        qtyReceived: 0,
        qtyAllocated: 0,
        qtyPicked: 0,
        qtyDispatched: 0,
        qtyHold: 0,
        status: [],
        batches: [],
        expiry: null,
        attribute1: null,
        attribute2: null,
        lpns: [],
        weightAvailable: 0,
        cubicAvailable: 0,
        sqmPerSU: null,
        locations: [],
        zone: null,
        inboundOrderNumbers: [],
        customerReferences: [],
        containerNumbers: [],
        customerName: null,
      }
      aggregated.set(key, item)
    }

    // Add batch if exists
    if (batchNumber && !item.batches.includes(batchNumber)) {
      item.batches.push(batchNumber)
    }

    // Add LPN if not already present
    if (record.lpnNumber && !item.lpns.includes(record.lpnNumber)) {
      item.lpns.push(record.lpnNumber)
    }

    // Add location if not already present
    if (record.location && !item.locations.includes(record.location)) {
      item.locations.push(record.location)
    }

    // Add status if not already present
    if (record.allocationStatus && !item.status.includes(record.allocationStatus)) {
      item.status.push(record.allocationStatus)
    }

    // Aggregate quantities based on allocation status
    const huQty = record.huQty || 0

    switch (record.allocationStatus) {
      case 'available':
        item.qtyAvailable += huQty
        break
      case 'allocated':
        item.qtyAllocated += huQty
        break
      case 'picked':
        item.qtyPicked += huQty
        break
      case 'dispatched':
        item.qtyDispatched += huQty
        break
      case 'reserved':
        item.qtyHold += huQty
        break
    }

    // Get product line info
    if (typeof record.inboundProductLineId === 'object') {
      const productLine = record.inboundProductLineId
      const productLineId = productLine.id

      // Set expiry (use first non-null value)
      if (productLine.expiryDate && !item.expiry) {
        item.expiry = productLine.expiryDate
      }

      // Set attributes (use first non-null value)
      if (productLine.attribute1 && !item.attribute1) {
        item.attribute1 = productLine.attribute1
      }
      if (productLine.attribute2 && !item.attribute2) {
        item.attribute2 = productLine.attribute2
      }

      // Add received quantity (only count each product line once)
      // Multiple PutAwayStock records can reference the same product line
      if (productLineId && productLine.recievedQty && !countedProductLines.has(productLineId)) {
        item.qtyReceived += productLine.recievedQty
        countedProductLines.add(productLineId)
      }
    }

    // Get inbound inventory info
    if (typeof record.inboundInventoryId === 'object') {
      const inboundInventory = record.inboundInventoryId

      // Add inbound order number
      if (
        inboundInventory.jobCode &&
        !item.inboundOrderNumbers.includes(inboundInventory.jobCode)
      ) {
        item.inboundOrderNumbers.push(inboundInventory.jobCode)
      }

      // Add customer reference
      if (
        inboundInventory.deliveryCustomerReferenceNumber &&
        !item.customerReferences.includes(inboundInventory.deliveryCustomerReferenceNumber)
      ) {
        item.customerReferences.push(inboundInventory.deliveryCustomerReferenceNumber)
      }

      // Add container number (may not exist in schema)
      const containerNumber = (inboundInventory as any).containerNumber
      if (containerNumber && !item.containerNumbers.includes(containerNumber)) {
        item.containerNumbers.push(containerNumber)
      }

      // Get customer name
      if (typeof inboundInventory.deliveryCustomerId === 'object') {
        if (inboundInventory.deliveryCustomerId.customer_name && !item.customerName) {
          item.customerName = inboundInventory.deliveryCustomerId.customer_name
        }
      }
    }

    // Calculate weight and cubic (if available)
    // Note: These would need to come from SKU or product line data
    // For now, we'll leave them as 0 and populate from API
  }

  return aggregated
}

/**
 * Format location range for display
 */
export function formatLocationRange(from: string, to: string): string {
  if (!from && !to) return ''
  if (!from) return `Up to ${to}`
  if (!to) return `${from} and above`
  return `${from} - ${to}`
}

/**
 * Check if location is within range
 */
export function isLocationInRange(location: string, from?: string, to?: string): boolean {
  if (!from && !to) return true
  if (!from) return location <= to!
  if (!to) return location >= from
  return location >= from && location <= to
}
