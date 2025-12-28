'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { hasViewPermission } from '@/lib/permissions'
import { CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit, X, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { StatusBadge } from '@/components/container-bookings/status-badge'
import { ContainerDetailsTable } from '@/components/container-bookings/container-details-table'
import { StockAllocationSummary } from '@/components/container-bookings/stock-allocation-summary'
import { DriverAllocationSummary } from '@/components/container-bookings/driver-allocation-summary'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function ImportContainerBookingViewPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [booking, setBooking] = useState<any>(null)
  const [containerDetails, setContainerDetails] = useState<any[]>([])
  const [stockAllocations, setStockAllocations] = useState<any[]>([])
  const [driverAllocation, setDriverAllocation] = useState<any>(null)
  const [loadingData, setLoadingData] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [entityNames, setEntityNames] = useState<Record<string, string>>({})

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              if (!hasViewPermission(fullUserData.user, 'containers')) {
                router.push('/dashboard')
                return
              }
            }
          }
          setAuthChecked(true)
        }
      } catch {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  // Helper to fetch entity name from API
  const fetchEntityName = async (collection: string, id: number): Promise<string | null> => {
    try {
      console.log('id', id)
      console.log('collection', collection)
      const res = await fetch(`/api/${collection}/${id}`)
      console.log('res', res)

      if (res.ok) {
        const data = await res.json()
        // Handle different response formats - check for success wrapper
        let entity = null
        if (data.success) {
          // Response wrapped in success object
          entity =
            data.customer ||
            data.payingCustomer ||
            data.emptyPark ||
            data.wharf ||
            data.warehouse ||
            data.vessel ||
            data.shippingLine ||
            data.containerSize ||
            data.containerDetail ||
            data[collection.slice(0, -1)] ||
            data[collection] ||
            data.item
        } else {
          // Direct entity response
          entity =
            data.customer ||
            data.payingCustomer ||
            data.emptyPark ||
            data.wharf ||
            data.warehouse ||
            data.vessel ||
            data.shippingLine ||
            data.containerSize ||
            data.containerDetail ||
            data[collection.slice(0, -1)] ||
            data[collection] ||
            data.item ||
            data
        }
        if (entity) {
          return (
            entity.customer_name ||
            entity.name ||
            entity.companyName ||
            entity.vesselName ||
            entity.size ||
            entity.code ||
            null
          )
        }
      }
    } catch (error) {
      console.error(`Error fetching ${collection} ${id}:`, error)
    }
    return null
  }

  // Fetch entity names for IDs that aren't populated
  const populateEntityNames = async (bookingData: any) => {
    const names: Record<string, string> = {}
    const promises: Promise<void>[] = []

    // Helper to extract ID and collection from polymorphic or direct format
    const extractIdAndCollection = (field: any, defaultCollection?: string) => {
      // Handle polymorphic format: {relationTo: "collection", value: {...}}
      if (field && typeof field === 'object' && 'relationTo' in field && 'value' in field) {
        const value = field.value
        // If value is populated, return null (no need to fetch)
        if (
          value &&
          typeof value === 'object' &&
          'id' in value &&
          (value.name || value.customer_name || value.vesselName)
        ) {
          return null
        }
        // If value is just an ID
        if (typeof value === 'number') {
          return { id: value, collection: field.relationTo }
        }
        // If value is an object with id
        if (value && typeof value === 'object' && 'id' in value) {
          return { id: value.id, collection: field.relationTo }
        }
        return null
      }
      // Handle direct number ID
      if (typeof field === 'number') {
        return { id: field, collection: defaultCollection }
      }
      // Handle populated object (has name fields)
      if (field && typeof field === 'object' && 'id' in field) {
        if (field.customer_name || field.name || field.vesselName || field.companyName) {
          return null // Already populated
        }
        return { id: field.id, collection: defaultCollection }
      }
      return null
    }

    // Charge To
    const chargeToInfo = extractIdAndCollection(
      bookingData.chargeToId,
      bookingData.chargeToCollection,
    )
    if (chargeToInfo) {
      const key = `chargeTo_${chargeToInfo.id}`
      promises.push(
        fetchEntityName(chargeToInfo.collection, chargeToInfo.id).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // From/To locations
    const fromInfo = extractIdAndCollection(bookingData.fromId, bookingData.fromCollection)
    if (fromInfo) {
      const key = `from_${fromInfo.id}`
      promises.push(
        fetchEntityName(fromInfo.collection, fromInfo.id).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    const toInfo = extractIdAndCollection(bookingData.toId, bookingData.toCollection)
    if (toInfo) {
      const key = `to_${toInfo.id}`
      promises.push(
        fetchEntityName(toInfo.collection, toInfo.id).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // Vessel
    if (bookingData.vesselId && typeof bookingData.vesselId === 'number') {
      const key = `vessel_${bookingData.vesselId}`
      promises.push(
        fetchEntityName('vessels', bookingData.vesselId).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // Consignee
    if (bookingData.consigneeId && typeof bookingData.consigneeId === 'number') {
      const key = `consignee_${bookingData.consigneeId}`
      promises.push(
        fetchEntityName('customers', bookingData.consigneeId).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // Routing locations
    if (bookingData.emptyRouting) {
      const emptyPickupInfo = extractIdAndCollection(
        bookingData.emptyRouting.pickupLocationId,
        bookingData.emptyRouting.pickupLocationCollection || 'empty-parks',
      )
      if (emptyPickupInfo) {
        const key = `emptyPickup_${emptyPickupInfo.id}`
        promises.push(
          fetchEntityName(emptyPickupInfo.collection, emptyPickupInfo.id).then((name) => {
            if (name) names[key] = name
          }),
        )
      }

      const emptyDropoffInfo = extractIdAndCollection(
        bookingData.emptyRouting.dropoffLocationId,
        bookingData.emptyRouting.dropoffLocationCollection,
      )
      if (emptyDropoffInfo) {
        const key = `emptyDropoff_${emptyDropoffInfo.id}`
        promises.push(
          fetchEntityName(emptyDropoffInfo.collection, emptyDropoffInfo.id).then((name) => {
            if (name) names[key] = name
          }),
        )
      }

      // Via locations for empty routing
      if (
        bookingData.emptyRouting.viaLocations &&
        Array.isArray(bookingData.emptyRouting.viaLocations)
      ) {
        bookingData.emptyRouting.viaLocations.forEach((via: any, idx: number) => {
          const viaInfo = extractIdAndCollection(
            via,
            bookingData.emptyRouting.viaLocationsCollections?.[idx],
          )
          if (viaInfo) {
            const key = `emptyVia_${viaInfo.id}`
            promises.push(
              fetchEntityName(viaInfo.collection, viaInfo.id).then((name) => {
                if (name) names[key] = name
              }),
            )
          }
        })
      }
    }

    if (bookingData.fullRouting) {
      const fullPickupInfo = extractIdAndCollection(
        bookingData.fullRouting.pickupLocationId,
        bookingData.fullRouting.pickupLocationCollection,
      )
      if (fullPickupInfo) {
        const key = `fullPickup_${fullPickupInfo.id}`
        promises.push(
          fetchEntityName(fullPickupInfo.collection, fullPickupInfo.id).then((name) => {
            if (name) names[key] = name
          }),
        )
      }

      const fullDropoffInfo = extractIdAndCollection(
        bookingData.fullRouting.dropoffLocationId,
        bookingData.fullRouting.dropoffLocationCollection,
      )
      if (fullDropoffInfo) {
        const key = `fullDropoff_${fullDropoffInfo.id}`
        promises.push(
          fetchEntityName(fullDropoffInfo.collection, fullDropoffInfo.id).then((name) => {
            if (name) names[key] = name
          }),
        )
      }

      // Via locations for full routing
      if (
        bookingData.fullRouting.viaLocations &&
        Array.isArray(bookingData.fullRouting.viaLocations)
      ) {
        bookingData.fullRouting.viaLocations.forEach((via: any, idx: number) => {
          const viaInfo = extractIdAndCollection(
            via,
            bookingData.fullRouting.viaLocationsCollections?.[idx],
          )
          if (viaInfo) {
            const key = `fullVia_${viaInfo.id}`
            promises.push(
              fetchEntityName(viaInfo.collection, viaInfo.id).then((name) => {
                if (name) names[key] = name
              }),
            )
          }
        })
      }
    }

    await Promise.all(promises)
    if (Object.keys(names).length > 0) {
      setEntityNames((prev) => ({ ...prev, ...names }))
    }
  }

  const loadData = useCallback(async () => {
    try {
      setLoadingData(true)
      const [bookingRes, containersRes, allocationsRes, driverRes] = await Promise.all([
        fetch(`/api/import-container-bookings/${bookingId}?depth=3`),
        fetch(`/api/import-container-bookings/${bookingId}/container-details?depth=2`),
        fetch(`/api/import-container-bookings/${bookingId}/stock-allocations?depth=2`),
        fetch(`/api/import-container-bookings/${bookingId}/driver-allocation`),
      ])

      if (bookingRes.ok) {
        const bookingData = await bookingRes.json()
        if (bookingData.success) {
          const booking = bookingData.importContainerBooking
          setBooking(booking)
          // Fetch entity names for unpopulated relationships
          await populateEntityNames(booking)
        }
      }

      if (containersRes.ok) {
        const containersData = await containersRes.json()
        if (containersData.success) {
          setContainerDetails(containersData.containerDetails || [])
        }
      }

      if (allocationsRes.ok) {
        const allocationsData = await allocationsRes.json()
        if (allocationsData.success) {
          setStockAllocations(allocationsData.stockAllocations || [])
        }
      }

      if (driverRes.ok) {
        const driverData = await driverRes.json()
        if (driverData.success) {
          setDriverAllocation(driverData.driverAllocation)
        }
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoadingData(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId])

  useEffect(() => {
    if (authChecked && bookingId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, bookingId])

  // Refresh data when page becomes visible (user navigates back from other pages)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && authChecked && bookingId) {
        loadData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [authChecked, bookingId, loadData])

  const handleCancel = async () => {
    if (!confirm(`Are you sure you want to cancel booking ${booking?.bookingCode || bookingId}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/import-container-bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })

      if (res.ok) {
        router.refresh()
      }
    } catch (error) {
      console.error('Error cancelling booking:', error)
    }
  }

  if (loading || !authChecked || loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant || !booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Booking not found</div>
      </div>
    )
  }

  const isEditable =
    booking.status === 'draft' || booking.status === 'confirmed' || booking.status === 'in_progress'
  const isCancellable = booking.status !== 'cancelled' && booking.status !== 'completed'

  const getEntityName = (entityId: any, collection?: string, prefix?: string): string => {
    if (!entityId) return '-'

    // Handle polymorphic format: {relationTo: "collection", value: {...}}
    if (
      typeof entityId === 'object' &&
      entityId !== null &&
      'relationTo' in entityId &&
      'value' in entityId
    ) {
      // Recursively call with the value, using relationTo as the collection
      return getEntityName(entityId.value, entityId.relationTo, prefix)
    }

    if (typeof entityId === 'object' && entityId !== null) {
      // Handle customers and paying-customers (they use customer_name)
      if (entityId.customer_name) {
        return entityId.customer_name
      }
      // Handle other entity types
      if (entityId.name) {
        return entityId.name
      }
      if (entityId.companyName) {
        return entityId.companyName
      }
      // Handle vessels (they might have vesselName or name)
      if (entityId.vesselName) {
        return entityId.vesselName
      }
      // If it has an id, try to look it up in entityNames
      if (entityId.id && prefix) {
        const key = `${prefix}_${entityId.id}`
        if (entityNames[key]) {
          return entityNames[key]
        }
      }
      // Fallback to ID if no name found
      return entityId.id ? `Entity ${entityId.id}` : '-'
    }
    // If it's just a number/ID, try to look it up in entityNames
    if (typeof entityId === 'number' && prefix) {
      const key = `${prefix}_${entityId}`
      if (entityNames[key]) {
        return entityNames[key]
      }
      // If collection is provided, show collection:ID format
      if (collection) {
        return `${collection}:${entityId}`
      }
      return `ID: ${entityId}`
    }
    if (typeof entityId === 'string') {
      return entityId
    }
    return '-'
  }

  // Helper to get chargeTo name (handles polymorphic relationship)
  const getChargeToName = (): string => {
    if (!booking?.chargeToId) {
      return '-'
    }

    // Handle polymorphic format: {relationTo: "collection", value: {...}}
    if (
      typeof booking.chargeToId === 'object' &&
      booking.chargeToId !== null &&
      'relationTo' in booking.chargeToId &&
      'value' in booking.chargeToId
    ) {
      return getEntityName(booking.chargeToId.value, booking.chargeToId.relationTo, 'chargeTo')
    }

    // Check if it's an object (populated relationship)
    if (typeof booking.chargeToId === 'object' && booking.chargeToId !== null) {
      return getEntityName(booking.chargeToId, booking.chargeToCollection, 'chargeTo')
    }

    // If it's just a number, try to use entityNames or chargeToCollection
    if (typeof booking.chargeToId === 'number') {
      const key = `chargeTo_${booking.chargeToId}`
      if (entityNames[key]) {
        return entityNames[key]
      }
      if (booking.chargeToCollection) {
        return `${booking.chargeToCollection}:${booking.chargeToId}`
      }
      return `ID: ${booking.chargeToId}`
    }

    return getEntityName(booking.chargeToId, booking.chargeToCollection, 'chargeTo')
  }

  // Helper to get routing location name (handles polymorphic relationship)
  const getRoutingLocationName = (
    locationId: any,
    collection?: string,
    prefix?: string,
  ): string => {
    if (!locationId) return '-'

    // Handle polymorphic format: {relationTo: "collection", value: {...}}
    if (
      typeof locationId === 'object' &&
      locationId !== null &&
      'relationTo' in locationId &&
      'value' in locationId
    ) {
      return getEntityName(locationId.value, locationId.relationTo, prefix)
    }

    // Check if it's an object (populated relationship)
    if (typeof locationId === 'object' && locationId !== null) {
      // Handle different entity types
      if (locationId.customer_name) {
        return locationId.customer_name
      }
      if (locationId.name) {
        return locationId.name
      }
      if (locationId.companyName) {
        return locationId.companyName
      }
      // Try entityNames lookup
      if (locationId.id && prefix) {
        const key = `${prefix}_${locationId.id}`
        if (entityNames[key]) {
          return entityNames[key]
        }
      }
      if (locationId.id) {
        return `ID: ${locationId.id}`
      }
      return '-'
    }

    // If it's just a number, try entityNames lookup first
    if (typeof locationId === 'number') {
      if (prefix) {
        const key = `${prefix}_${locationId}`
        if (entityNames[key]) {
          return entityNames[key]
        }
      }
      if (collection) {
        return `${collection}:${locationId}`
      }
      return `ID: ${locationId}`
    }

    return String(locationId)
  }

  console.log(booking)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/import-container-bookings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{booking.bookingCode || `IMP-${booking.id}`}</h1>
              <StatusBadge status={booking.status} type="import" />
            </div>
            <p className="text-muted-foreground">Import Container Booking Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loadingData}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loadingData ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {isEditable && (
            <Link href={`/dashboard/import-container-bookings/${bookingId}/edit`}>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-1" />
                Edit
              </Button>
            </Link>
          )}
          {isCancellable && (
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={['step1', 'step2', 'step3']} className="space-y-4">
        {/* Step 1: Basic Info */}
        <AccordionItem value="step1" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 1: Basic Information</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Customer Reference
                </label>
                <p className="font-medium">{booking.customerReference || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Booking Reference
                </label>
                <p className="font-medium">{booking.bookingReference || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Charge To</label>
                <p className="font-medium">{getChargeToName()}</p>
                {booking.chargeToContactName && (
                  <p className="text-sm text-muted-foreground">
                    Contact: {booking.chargeToContactName}
                    {booking.chargeToContactNumber && ` - ${booking.chargeToContactNumber}`}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Consignee</label>
                <p className="font-medium">
                  {getEntityName(booking.consigneeId, 'customers', 'consignee')}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 2: Vessel Info */}
        <AccordionItem value="step2" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 2: Vessel Information</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Vessel</label>
                <p className="font-medium">
                  {getEntityName(booking.vesselId, 'vessels', 'vessel') || '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">ETA</label>
                <p className="font-medium">
                  {booking.eta ? new Date(booking.eta).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Availability</label>
                <p className="font-medium">{booking.availability ? 'Yes' : 'No'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Storage Start</label>
                <p className="font-medium">
                  {booking.storageStart ? new Date(booking.storageStart).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  First Free Import Date
                </label>
                <p className="font-medium">
                  {booking.firstFreeImportDate
                    ? new Date(booking.firstFreeImportDate).toLocaleDateString()
                    : '-'}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3: Locations */}
        <AccordionItem value="step3" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 3: Locations</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">From</label>
                {(() => {
                  // Handle polymorphic format for fromId
                  let fromCollection = booking.fromCollection
                  if (
                    booking.fromId &&
                    typeof booking.fromId === 'object' &&
                    'relationTo' in booking.fromId
                  ) {
                    fromCollection = booking.fromId.relationTo
                  }
                  const entityName = getEntityName(booking.fromId, fromCollection, 'from')
                  return (
                    <>
                      <p className="font-medium">{entityName || '-'}</p>
                      {booking.fromAddress && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {[
                            booking.fromAddress,
                            booking.fromCity,
                            booking.fromState,
                            booking.fromPostcode,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">To</label>
                {(() => {
                  // Handle polymorphic format for toId
                  let toCollection = booking.toCollection
                  if (
                    booking.toId &&
                    typeof booking.toId === 'object' &&
                    'relationTo' in booking.toId
                  ) {
                    toCollection = booking.toId.relationTo
                  }
                  const entityName = getEntityName(booking.toId, toCollection, 'to')
                  return (
                    <>
                      <p className="font-medium">{entityName || '-'}</p>
                      {booking.toAddress && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {[booking.toAddress, booking.toCity, booking.toState, booking.toPostcode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Container Sizes</label>
                <p className="font-medium">
                  {booking.containerSizeIds?.length || 0} size
                  {booking.containerSizeIds?.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 4: Routing */}
        <AccordionItem value="step4" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 4: Routing</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pt-4">
              {booking.emptyRouting && (
                <div>
                  <h4 className="font-medium mb-2">Empty Container Routing</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {booking.emptyRouting.shippingLineId && (
                      <div>
                        <span className="text-muted-foreground">Shipping Line:</span>{' '}
                        {getEntityName(
                          booking.emptyRouting.shippingLineId,
                          'shipping-lines',
                          'shippingLine',
                        )}
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Pickup:</span>{' '}
                      {(() => {
                        const pickup = booking.emptyRouting.pickupLocationId
                        let collection = booking.emptyRouting.pickupLocationCollection
                        // Extract collection from polymorphic format if needed
                        if (pickup && typeof pickup === 'object' && 'relationTo' in pickup) {
                          collection = pickup.relationTo
                        } else if (!collection) {
                          collection = 'empty-parks' // Default for empty routing pickup
                        }
                        return getRoutingLocationName(pickup, collection, 'emptyPickup')
                      })()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dropoff:</span>{' '}
                      {(() => {
                        const dropoff = booking.emptyRouting.dropoffLocationId
                        let collection = booking.emptyRouting.dropoffLocationCollection
                        // Extract collection from polymorphic format if needed
                        if (dropoff && typeof dropoff === 'object' && 'relationTo' in dropoff) {
                          collection = dropoff.relationTo
                        }
                        return getRoutingLocationName(dropoff, collection, 'emptyDropoff')
                      })()}
                    </div>
                    {booking.emptyRouting.pickupDate && (
                      <div>
                        <span className="text-muted-foreground">Pickup Date:</span>{' '}
                        {new Date(booking.emptyRouting.pickupDate).toLocaleDateString()}
                      </div>
                    )}
                    {booking.emptyRouting.dropoffDate && (
                      <div>
                        <span className="text-muted-foreground">Dropoff Date:</span>{' '}
                        {new Date(booking.emptyRouting.dropoffDate).toLocaleDateString()}
                      </div>
                    )}
                    {booking.emptyRouting.viaLocations &&
                      booking.emptyRouting.viaLocations.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Via Locations:</span>{' '}
                          {booking.emptyRouting.viaLocations.map((via: any, idx: number) => {
                            let collection = booking.emptyRouting.viaLocationsCollections?.[idx]
                            // Extract collection from polymorphic format if needed
                            if (via && typeof via === 'object' && 'relationTo' in via) {
                              collection = via.relationTo
                            }
                            const viaId =
                              typeof via === 'object' && 'value' in via ? via.value : via
                            const viaIdForKey =
                              typeof viaId === 'object' && 'id' in viaId ? viaId.id : viaId
                            return (
                              <span key={idx} className="mr-2">
                                {getRoutingLocationName(via, collection, `emptyVia_${viaIdForKey}`)}
                                {idx < booking.emptyRouting.viaLocations.length - 1 ? ',' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                  </div>
                </div>
              )}
              {booking.fullRouting && (
                <div>
                  <h4 className="font-medium mb-2">Full Container Routing</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Pickup:</span>{' '}
                      {(() => {
                        const pickup = booking.fullRouting.pickupLocationId
                        let collection = booking.fullRouting.pickupLocationCollection
                        // Extract collection from polymorphic format if needed
                        if (pickup && typeof pickup === 'object' && 'relationTo' in pickup) {
                          collection = pickup.relationTo
                        }
                        return getRoutingLocationName(pickup, collection, 'fullPickup')
                      })()}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dropoff:</span>{' '}
                      {(() => {
                        const dropoff = booking.fullRouting.dropoffLocationId
                        let collection = booking.fullRouting.dropoffLocationCollection
                        // Extract collection from polymorphic format if needed
                        if (dropoff && typeof dropoff === 'object' && 'relationTo' in dropoff) {
                          collection = dropoff.relationTo
                        }
                        return getRoutingLocationName(dropoff, collection, 'fullDropoff')
                      })()}
                    </div>
                    {booking.fullRouting.pickupDate && (
                      <div>
                        <span className="text-muted-foreground">Pickup Date:</span>{' '}
                        {new Date(booking.fullRouting.pickupDate).toLocaleDateString()}
                      </div>
                    )}
                    {booking.fullRouting.dropoffDate && (
                      <div>
                        <span className="text-muted-foreground">Dropoff Date:</span>{' '}
                        {new Date(booking.fullRouting.dropoffDate).toLocaleDateString()}
                      </div>
                    )}
                    {booking.fullRouting.viaLocations &&
                      booking.fullRouting.viaLocations.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Via Locations:</span>{' '}
                          {booking.fullRouting.viaLocations.map((via: any, idx: number) => {
                            let collection = booking.fullRouting.viaLocationsCollections?.[idx]
                            // Extract collection from polymorphic format if needed
                            if (via && typeof via === 'object' && 'relationTo' in via) {
                              collection = via.relationTo
                            }
                            const viaId =
                              typeof via === 'object' && 'value' in via ? via.value : via
                            const viaIdForKey =
                              typeof viaId === 'object' && 'id' in viaId ? viaId.id : viaId
                            return (
                              <span key={idx} className="mr-2">
                                {getRoutingLocationName(via, collection, `fullVia_${viaIdForKey}`)}
                                {idx < booking.fullRouting.viaLocations.length - 1 ? ',' : ''}
                              </span>
                            )
                          })}
                        </div>
                      )}
                  </div>
                </div>
              )}
              {booking.instructions && (
                <div>
                  <h4 className="font-medium mb-2">Instructions</h4>
                  <p className="text-sm text-muted-foreground">{booking.instructions}</p>
                </div>
              )}
              {booking.jobNotes && (
                <div>
                  <h4 className="font-medium mb-2">Job Notes</h4>
                  <p className="text-sm text-muted-foreground">{booking.jobNotes}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 5: Container Details */}
        <AccordionItem value="step5" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 5: Container Details</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <ContainerDetailsTable
                containers={containerDetails}
                bookingId={Number(bookingId)}
                bookingType="import"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 6: Stock Allocation */}
        <AccordionItem value="step6" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 6: Stock Allocation</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <StockAllocationSummary
                allocations={stockAllocations}
                bookingId={Number(bookingId)}
                bookingType="import"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 7: Driver Allocation */}
        <AccordionItem value="step7" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 7: Driver Allocation</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <DriverAllocationSummary
                allocation={driverAllocation}
                bookingId={Number(bookingId)}
                bookingType="import"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
