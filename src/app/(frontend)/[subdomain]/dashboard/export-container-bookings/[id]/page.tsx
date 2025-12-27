'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { hasViewPermission } from '@/lib/permissions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Edit, X } from 'lucide-react'
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

export default function ExportContainerBookingViewPage() {
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
      } catch (error) {
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked && bookingId) {
      loadData()
    }
  }, [authChecked, bookingId])

  // Helper to fetch entity name from API
  const fetchEntityName = async (collection: string, id: number): Promise<string | null> => {
    try {
      const res = await fetch(`/api/${collection}/${id}`)
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

    // Charge To
    if (
      bookingData.chargeToId &&
      typeof bookingData.chargeToId === 'number' &&
      bookingData.chargeToCollection
    ) {
      const key = `chargeTo_${bookingData.chargeToId}`
      promises.push(
        fetchEntityName(bookingData.chargeToCollection, bookingData.chargeToId).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // From/To locations
    if (
      bookingData.fromId &&
      typeof bookingData.fromId === 'number' &&
      bookingData.fromCollection
    ) {
      const key = `from_${bookingData.fromId}`
      promises.push(
        fetchEntityName(bookingData.fromCollection, bookingData.fromId).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    if (bookingData.toId && typeof bookingData.toId === 'number' && bookingData.toCollection) {
      const key = `to_${bookingData.toId}`
      promises.push(
        fetchEntityName(bookingData.toCollection, bookingData.toId).then((name) => {
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

    // Consignor
    if (bookingData.consignorId && typeof bookingData.consignorId === 'number') {
      const key = `consignor_${bookingData.consignorId}`
      promises.push(
        fetchEntityName('customers', bookingData.consignorId).then((name) => {
          if (name) names[key] = name
        }),
      )
    }

    // Routing locations
    if (bookingData.emptyRouting) {
      if (
        bookingData.emptyRouting.pickupLocationId &&
        typeof bookingData.emptyRouting.pickupLocationId === 'number'
      ) {
        const key = `emptyPickup_${bookingData.emptyRouting.pickupLocationId}`
        promises.push(
          fetchEntityName('empty-parks', bookingData.emptyRouting.pickupLocationId).then((name) => {
            if (name) names[key] = name
          }),
        )
      }
      if (
        bookingData.emptyRouting.dropoffLocationId &&
        typeof bookingData.emptyRouting.dropoffLocationId === 'number' &&
        bookingData.emptyRouting.dropoffLocationCollection
      ) {
        const key = `emptyDropoff_${bookingData.emptyRouting.dropoffLocationId}`
        promises.push(
          fetchEntityName(
            bookingData.emptyRouting.dropoffLocationCollection,
            bookingData.emptyRouting.dropoffLocationId,
          ).then((name) => {
            if (name) names[key] = name
          }),
        )
      }
      // Via locations for empty routing
      if (
        bookingData.emptyRouting.viaLocations &&
        Array.isArray(bookingData.emptyRouting.viaLocations)
      ) {
        bookingData.emptyRouting.viaLocations.forEach((viaId: number, idx: number) => {
          if (
            typeof viaId === 'number' &&
            bookingData.emptyRouting.viaLocationsCollections?.[idx]
          ) {
            const key = `emptyVia_${viaId}`
            promises.push(
              fetchEntityName(bookingData.emptyRouting.viaLocationsCollections[idx], viaId).then(
                (name) => {
                  if (name) names[key] = name
                },
              ),
            )
          }
        })
      }
    }

    if (bookingData.fullRouting) {
      if (
        bookingData.fullRouting.pickupLocationId &&
        typeof bookingData.fullRouting.pickupLocationId === 'number' &&
        bookingData.fullRouting.pickupLocationCollection
      ) {
        const key = `fullPickup_${bookingData.fullRouting.pickupLocationId}`
        promises.push(
          fetchEntityName(
            bookingData.fullRouting.pickupLocationCollection,
            bookingData.fullRouting.pickupLocationId,
          ).then((name) => {
            if (name) names[key] = name
          }),
        )
      }
      if (
        bookingData.fullRouting.dropoffLocationId &&
        typeof bookingData.fullRouting.dropoffLocationId === 'number' &&
        bookingData.fullRouting.dropoffLocationCollection
      ) {
        const key = `fullDropoff_${bookingData.fullRouting.dropoffLocationId}`
        promises.push(
          fetchEntityName(
            bookingData.fullRouting.dropoffLocationCollection,
            bookingData.fullRouting.dropoffLocationId,
          ).then((name) => {
            if (name) names[key] = name
          }),
        )
      }
      // Via locations for full routing
      if (
        bookingData.fullRouting.viaLocations &&
        Array.isArray(bookingData.fullRouting.viaLocations)
      ) {
        bookingData.fullRouting.viaLocations.forEach((viaId: number, idx: number) => {
          if (typeof viaId === 'number' && bookingData.fullRouting.viaLocationsCollections?.[idx]) {
            const key = `fullVia_${viaId}`
            promises.push(
              fetchEntityName(bookingData.fullRouting.viaLocationsCollections[idx], viaId).then(
                (name) => {
                  if (name) names[key] = name
                },
              ),
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

  const loadData = async () => {
    try {
      setLoadingData(true)
      const [bookingRes, containersRes, allocationsRes, driverRes] = await Promise.all([
        fetch(`/api/export-container-bookings/${bookingId}?depth=3`),
        fetch(`/api/export-container-bookings/${bookingId}/container-details?depth=2`),
        fetch(`/api/export-container-bookings/${bookingId}/stock-allocations?depth=2`),
        fetch(`/api/export-container-bookings/${bookingId}/driver-allocation`),
      ])

      if (bookingRes.ok) {
        const bookingData = await bookingRes.json()
        if (bookingData.success) {
          const booking = bookingData.exportContainerBooking
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
  }

  const handleCancel = async () => {
    if (!confirm(`Are you sure you want to cancel booking ${booking?.bookingCode || bookingId}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/export-container-bookings/${bookingId}`, {
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

  // Helper to get routing location name (handles polymorphic relationship)
  const getRoutingLocationName = (
    locationId: any,
    collection?: string,
    prefix?: string,
  ): string => {
    if (!locationId) return '-'

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/export-container-bookings">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{booking.bookingCode || `EXP-${booking.id}`}</h1>
              <StatusBadge status={booking.status} type="export" />
            </div>
            <p className="text-muted-foreground">Export Container Booking Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditable && (
            <Link href={`/dashboard/export-container-bookings/${bookingId}/edit`}>
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
                <p className="font-medium">
                  {(() => {
                    if (!booking?.chargeToId) return '-'
                    if (typeof booking.chargeToId === 'object' && booking.chargeToId !== null) {
                      return getEntityName(booking.chargeToId)
                    }
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
                    return getEntityName(booking.chargeToId)
                  })()}
                </p>
                {booking.chargeToContactName && (
                  <p className="text-sm text-muted-foreground">
                    Contact: {booking.chargeToContactName}
                    {booking.chargeToContactNumber && ` - ${booking.chargeToContactNumber}`}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Consignor</label>
                <p className="font-medium">
                  {getEntityName(booking.consignorId, 'customers', 'consignor') || '-'}
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
                <label className="text-sm font-medium text-muted-foreground">ETD</label>
                <p className="font-medium">
                  {booking.etd ? new Date(booking.etd).toLocaleDateString() : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Receival Start</label>
                <p className="font-medium">
                  {booking.receivalStart
                    ? new Date(booking.receivalStart).toLocaleDateString()
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cutoff</label>
                <p className="font-medium">{booking.cutoff ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Step 3-7 similar to import but with export-specific data */}
        <AccordionItem value="step3" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 3: Locations</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">From</label>
                {(() => {
                  const entityName = getEntityName(booking.fromId, booking.fromCollection, 'from')
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
                  const entityName = getEntityName(booking.toId, booking.toCollection, 'to')
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
                    <div>
                      <span className="text-muted-foreground">Pickup:</span>{' '}
                      {getRoutingLocationName(
                        booking.emptyRouting.pickupLocationId,
                        booking.emptyRouting.pickupLocationCollection,
                        'emptyPickup',
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dropoff:</span>{' '}
                      {getRoutingLocationName(
                        booking.emptyRouting.dropoffLocationId,
                        booking.emptyRouting.dropoffLocationCollection,
                        'emptyDropoff',
                      )}
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
                          {booking.emptyRouting.viaLocations.map((via: any, idx: number) => (
                            <span key={idx} className="mr-2">
                              {getRoutingLocationName(
                                via,
                                booking.emptyRouting.viaLocationsCollections?.[idx],
                                `emptyVia_${via}`,
                              )}
                              {idx < booking.emptyRouting.viaLocations.length - 1 ? ',' : ''}
                            </span>
                          ))}
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
                      {getRoutingLocationName(
                        booking.fullRouting.pickupLocationId,
                        booking.fullRouting.pickupLocationCollection,
                        'fullPickup',
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Dropoff:</span>{' '}
                      {getRoutingLocationName(
                        booking.fullRouting.dropoffLocationId,
                        booking.fullRouting.dropoffLocationCollection,
                        'fullDropoff',
                      )}
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
                          {booking.fullRouting.viaLocations.map((via: any, idx: number) => (
                            <span key={idx} className="mr-2">
                              {getRoutingLocationName(
                                via,
                                booking.fullRouting.viaLocationsCollections?.[idx],
                                `fullVia_${via}`,
                              )}
                              {idx < booking.fullRouting.viaLocations.length - 1 ? ',' : ''}
                            </span>
                          ))}
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
              {booking.releaseNumber && (
                <div>
                  <h4 className="font-medium mb-2">Release Number</h4>
                  <p className="text-sm text-muted-foreground">{booking.releaseNumber}</p>
                </div>
              )}
              {booking.weight && (
                <div>
                  <h4 className="font-medium mb-2">Weight</h4>
                  <p className="text-sm text-muted-foreground">{booking.weight}</p>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step5" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 5: Container Details</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <ContainerDetailsTable
                containers={containerDetails}
                bookingId={Number(bookingId)}
                bookingType="export"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step6" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 6: Stock Allocation</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <StockAllocationSummary
                allocations={stockAllocations}
                bookingId={Number(bookingId)}
                bookingType="export"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="step7" className="border rounded-lg px-4">
          <AccordionTrigger>
            <CardTitle>Step 7: Driver Allocation</CardTitle>
          </AccordionTrigger>
          <AccordionContent>
            <div className="pt-4">
              <DriverAllocationSummary
                allocation={driverAllocation}
                bookingId={Number(bookingId)}
                bookingType="export"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
