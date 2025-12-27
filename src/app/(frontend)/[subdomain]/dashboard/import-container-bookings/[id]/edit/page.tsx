'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { hasViewPermission } from '@/lib/permissions'
import { MultistepImportContainerBookingForm } from '@/components/container-bookings/multistep-import-container-booking-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

type BookingStatus = 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'

export default function EditImportContainerBookingPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [booking, setBooking] = useState<any>(null)
  const [loadingBooking, setLoadingBooking] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{
    id?: number
    role?: number | string | { id: number; permissions?: Record<string, boolean> }
  } | null>(null)

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
              setCurrentUser(fullUserData.user)
              if (!hasViewPermission(fullUserData.user, 'containers')) {
                router.push('/dashboard')
                return
              }
            }
          } else {
            setCurrentUser(data.user)
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
      loadBooking()
    }
  }, [authChecked, bookingId])

  const loadBooking = async () => {
    try {
      setLoadingBooking(true)
      const res = await fetch(`/api/import-container-bookings/${bookingId}?depth=2`)
      const data = await res.json()

      if (res.ok) {
        // Use normalizedImportContainerBooking for form prefill (has numeric IDs + collection fields)
        // Fallback to importContainerBooking if normalized version not available
        const booking = data.normalizedImportContainerBooking || data.importContainerBooking

        if (data.success && booking) {
          // Fetch container details for this booking
          let containerDetails: any[] = []
          try {
            const containerDetailsRes = await fetch(
              `/api/import-container-bookings/${bookingId}/container-details?depth=2`,
            )
            if (containerDetailsRes.ok) {
              const containerDetailsData = await containerDetailsRes.json()
              if (containerDetailsData.success && Array.isArray(containerDetailsData.containerDetails)) {
                // Transform container details to form format
                containerDetails = containerDetailsData.containerDetails.map((detail: any) => ({
                  id: detail.id,
                  containerNumber: detail.containerNumber || '',
                  containerSizeId:
                    typeof detail.containerSizeId === 'object' && detail.containerSizeId?.id
                      ? detail.containerSizeId.id
                      : detail.containerSizeId,
                  warehouseId:
                    typeof detail.warehouseId === 'object' && detail.warehouseId?.id
                      ? detail.warehouseId.id
                      : detail.warehouseId,
                  gross: detail.gross || '',
                  tare: detail.tare || '',
                  net: detail.net || '',
                  pin: detail.pin || '',
                  whManifest: detail.whManifest || '',
                  isoCode: detail.isoCode || '',
                  timeSlot: detail.timeSlot || '',
                  emptyTimeSlot: detail.emptyTimeSlot || '',
                  dehireDate: detail.dehireDate || '',
                  shippingLineId:
                    typeof detail.shippingLineId === 'object' && detail.shippingLineId?.id
                      ? detail.shippingLineId.id
                      : detail.shippingLineId,
                  countryOfOrigin: detail.countryOfOrigin || '',
                  orderRef: detail.orderRef || '',
                  jobAvailability: detail.jobAvailability || '',
                  sealNumber: detail.sealNumber || '',
                  customerRequestDate: detail.customerRequestDate || '',
                  dock: detail.dock || '',
                  confirmedUnpackDate: detail.confirmedUnpackDate || '',
                  yardLocation: detail.yardLocation || '',
                  secureSealsIntact: detail.secureSealsIntact || '',
                  inspectUnpack: detail.inspectUnpack || '',
                  directionType: detail.directionType || '',
                  houseBillNumber: detail.houseBillNumber || '',
                  oceanBillNumber: detail.oceanBillNumber || '',
                  ventAirflow: detail.ventAirflow || '',
                }))
              }
            }
          } catch (containerDetailsError) {
            console.error('Error fetching container details:', containerDetailsError)
            // Continue without container details - they can be loaded later
          }

          // Transform API data to form format
          // normalizedImportContainerBooking already has numeric IDs + collection fields, so we just need to format for comboboxes
          const formData = {
            id: booking.id,
            bookingCode: booking.bookingCode,
            status: booking.status,
            customerReference: booking.customerReference,
            bookingReference: booking.bookingReference,
            chargeToId:
              booking.chargeToId && booking.chargeToCollection
                ? `${booking.chargeToCollection}:${booking.chargeToId}`
                : booking.chargeToId,
            chargeToContactName: booking.chargeToContactName,
            chargeToContactNumber: booking.chargeToContactNumber,
            consigneeId: booking.consigneeId,
            vesselId: booking.vesselId,
            eta: booking.eta,
            availability: booking.availability,
            storageStart: booking.storageStart,
            firstFreeImportDate: booking.firstFreeImportDate,
            fromId:
              booking.fromId && booking.fromCollection
                ? `${booking.fromCollection}:${booking.fromId}`
                : booking.fromId,
            toId:
              booking.toId && booking.toCollection
                ? `${booking.toCollection}:${booking.toId}`
                : booking.toId,
            fromAddress: booking.fromAddress,
            fromCity: booking.fromCity,
            fromState: booking.fromState,
            fromPostcode: booking.fromPostcode,
            toAddress: booking.toAddress,
            toCity: booking.toCity,
            toState: booking.toState,
            toPostcode: booking.toPostcode,
            containerSizeIds: Array.isArray(booking.containerSizeIds)
              ? booking.containerSizeIds.map((size: any) =>
                  typeof size === 'number' ? size : typeof size === 'object' && size?.id ? size.id : Number(size),
                ).filter((id: any) => !isNaN(id) && id > 0)
              : [],
            containerQuantities: booking.containerQuantities || {},
            containerDetails: containerDetails, // Include container details in initial data
            emptyRouting: booking.emptyRouting
              ? (() => {
                  const er = booking.emptyRouting
                  const transformed: any = { ...er }

                  // Preserve collection fields
                  if (er.pickupLocationCollection) {
                    transformed.pickupLocationCollection = er.pickupLocationCollection
                  }
                  if (er.dropoffLocationCollection) {
                    transformed.dropoffLocationCollection = er.dropoffLocationCollection
                  }
                  if (er.viaLocationsCollections) {
                    transformed.viaLocationsCollections = er.viaLocationsCollections
                  }

                  // Transform to "collection:id" format for combobox display
                  if (er.pickupLocationId && er.pickupLocationCollection) {
                    transformed.pickupLocationId = `${er.pickupLocationCollection}:${er.pickupLocationId}`
                  }

                  if (er.dropoffLocationId && er.dropoffLocationCollection) {
                    transformed.dropoffLocationId = `${er.dropoffLocationCollection}:${er.dropoffLocationId}`
                  }

                  // Transform viaLocations array
                  if (
                    Array.isArray(er.viaLocations) &&
                    er.viaLocations.length > 0 &&
                    er.viaLocationsCollections
                  ) {
                    transformed.viaLocations = er.viaLocations.map((via: any, index: number) => {
                      const id = typeof via === 'number' ? via : via
                      const collection = er.viaLocationsCollections?.[index]
                      if (collection) {
                        return `${collection}:${id}`
                      }
                      return id
                    })
                  }

                  return transformed
                })()
              : undefined,
            fullRouting: booking.fullRouting
              ? (() => {
                  const fr = booking.fullRouting
                  const transformed: any = { ...fr }

                  // Preserve collection fields
                  if (fr.pickupLocationCollection) {
                    transformed.pickupLocationCollection = fr.pickupLocationCollection
                  }
                  if (fr.dropoffLocationCollection) {
                    transformed.dropoffLocationCollection = fr.dropoffLocationCollection
                  }
                  if (fr.viaLocationsCollections) {
                    transformed.viaLocationsCollections = fr.viaLocationsCollections
                  }

                  // Transform to "collection:id" format for combobox display
                  if (fr.pickupLocationId && fr.pickupLocationCollection) {
                    transformed.pickupLocationId = `${fr.pickupLocationCollection}:${fr.pickupLocationId}`
                  }

                  if (fr.dropoffLocationId && fr.dropoffLocationCollection) {
                    transformed.dropoffLocationId = `${fr.dropoffLocationCollection}:${fr.dropoffLocationId}`
                  }

                  // Transform viaLocations array
                  if (
                    Array.isArray(fr.viaLocations) &&
                    fr.viaLocations.length > 0 &&
                    fr.viaLocationsCollections
                  ) {
                    transformed.viaLocations = fr.viaLocations.map((via: any, index: number) => {
                      const id = typeof via === 'number' ? via : via
                      const collection = fr.viaLocationsCollections?.[index]
                      if (collection) {
                        return `${collection}:${id}`
                      }
                      return id
                    })
                  }

                  return transformed
                })()
              : undefined,
            instructions: booking.instructions,
            jobNotes: booking.jobNotes,
            driverAllocation: booking.driverAllocation,
          }
          setBooking(formData)
        } else {
          console.error('Invalid response format:', data)
          setError('Invalid response format from server')
        }
      } else if (res.status === 404) {
        console.error('Booking not found:', data.message || 'Booking not found')
        setError(data.message || 'Booking not found')
      } else if (res.status === 403) {
        console.error(
          'Access forbidden:',
          data.message || 'You do not have permission to view this booking',
        )
        setError(data.message || 'You do not have permission to view this booking')
      } else {
        console.error(
          'Error loading booking:',
          data.message || 'Failed to load booking',
          'Status:',
          res.status,
        )
        setError(data.message || 'Failed to load booking')
      }
    } catch (error: any) {
      console.error('Error loading booking:', error)
      setError(error?.message || 'An error occurred while loading the booking')
    } finally {
      setLoadingBooking(false)
    }
  }

  const handleSave = async (data: any) => {
    router.push(`/dashboard/import-container-bookings/${data.id}`)
  }

  const handleCancel = () => {
    router.push(`/dashboard/import-container-bookings/${bookingId}`)
  }

  if (loading || !authChecked || loadingBooking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Tenant not found</div>
      </div>
    )
  }

  if (!booking && !loadingBooking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="text-lg font-semibold">{error || 'Booking not found'}</div>
          <div className="text-sm text-muted-foreground">
            {error
              ? 'Please check the booking ID and try again.'
              : 'The booking you&apos;re trying to edit doesn&apos;t exist or you don&apos;t have permission to view it.'}
          </div>
          <Button onClick={() => router.push('/dashboard/import-container-bookings')}>
            Back to List
          </Button>
        </div>
      </div>
    )
  }

  const isEditable =
    booking.status === 'draft' || booking.status === 'confirmed' || booking.status === 'in_progress'
  const isReadOnly = booking.status === 'completed' || booking.status === 'cancelled'

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Import Container Booking</h1>
          <p className="text-muted-foreground">{booking.bookingCode || `IMP-${booking.id}`}</p>
        </div>
      </div>

      {isReadOnly && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-900">Read-Only Mode</p>
                <p className="text-sm text-yellow-800 mt-1">
                  This booking is {booking.status} and cannot be edited. You can view the details in
                  read-only mode.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {booking.status === 'confirmed' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">Warning</p>
                <p className="text-sm text-blue-800 mt-1">
                  This booking is confirmed. Editing may affect operations in progress.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isEditable && (
        <MultistepImportContainerBookingForm
          initialData={booking}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}

      {isReadOnly && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground">
              This booking cannot be edited. Please view the booking details instead.
            </p>
            <div className="flex justify-center mt-4">
              <Link href={`/dashboard/import-container-bookings/${bookingId}`}>
                <Button>View Booking</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
