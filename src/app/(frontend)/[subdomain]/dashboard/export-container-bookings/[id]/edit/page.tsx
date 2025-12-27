'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { hasViewPermission } from '@/lib/permissions'
import { MultistepExportContainerBookingForm } from '@/components/container-bookings/multistep-export-container-booking-form'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export default function EditExportContainerBookingPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const bookingId = params.id as string
  const [booking, setBooking] = useState<any>(null)
  const [loadingBooking, setLoadingBooking] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
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
      const res = await fetch(`/api/export-container-bookings/${bookingId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.exportContainerBooking) {
          const booking = data.exportContainerBooking
          console.log('[EDIT PAGE] Step 3 - Raw API response:', {
            fromId: booking.fromId,
            fromIdType: typeof booking.fromId,
            fromCollection: booking.fromCollection,
            toId: booking.toId,
            toIdType: typeof booking.toId,
            toCollection: booking.toCollection,
            fromIdIsObject: typeof booking.fromId === 'object' && booking.fromId !== null,
            toIdIsObject: typeof booking.toId === 'object' && booking.toId !== null,
            fromIdHasId: booking.fromId?.id,
            toIdHasId: booking.toId?.id,
          })
          // Transform API data to form format
          const formData = {
            id: data.exportContainerBooking.id,
            bookingCode: data.exportContainerBooking.bookingCode,
            status: data.exportContainerBooking.status,
            customerReference: data.exportContainerBooking.customerReference,
            bookingReference: data.exportContainerBooking.bookingReference,
            chargeToId: typeof data.exportContainerBooking.chargeToId === 'object'
              ? data.exportContainerBooking.chargeToId.id
              : data.exportContainerBooking.chargeToId,
            consignorId: typeof data.exportContainerBooking.consignorId === 'object'
              ? data.exportContainerBooking.consignorId.id
              : data.exportContainerBooking.consignorId,
            vesselId: typeof data.exportContainerBooking.vesselId === 'object'
              ? data.exportContainerBooking.vesselId.id
              : data.exportContainerBooking.vesselId,
            etd: data.exportContainerBooking.etd,
            receivalStart: data.exportContainerBooking.receivalStart,
            cutoff: data.exportContainerBooking.cutoff,
            fromId: (() => {
              const fromId = booking.fromId
              const fromCollection = booking.fromCollection
              console.log('[EDIT PAGE] Step 3 - Formatting fromId:', { fromId, fromCollection, fromIdType: typeof fromId })
              
              if (!fromId) {
                console.log('[EDIT PAGE] Step 3 - fromId is empty/undefined')
                return undefined
              }
              
              if (typeof fromId === 'object' && fromId !== null && fromId.id) {
                const collection = fromCollection || 'customers'
                const formatted = `${collection}:${fromId.id}`
                console.log('[EDIT PAGE] Step 3 - Formatted fromId (object):', formatted, 'from:', { fromId, fromCollection, fromIdId: fromId.id })
                return formatted
              } else if (typeof fromId === 'number') {
                const collection = fromCollection || 'customers'
                const formatted = `${collection}:${fromId}`
                console.log('[EDIT PAGE] Step 3 - Formatted fromId (number):', formatted, 'from:', { fromId, fromCollection })
                return formatted
              }
              
              console.warn('[EDIT PAGE] Step 3 - fromId format not recognized:', typeof fromId, fromId)
              return undefined
            })(),
            toId: (() => {
              const toId = booking.toId
              const toCollection = booking.toCollection
              console.log('[EDIT PAGE] Step 3 - Formatting toId:', { toId, toCollection, toIdType: typeof toId })
              
              if (!toId) {
                console.log('[EDIT PAGE] Step 3 - toId is empty/undefined')
                return undefined
              }
              
              if (typeof toId === 'object' && toId !== null && toId.id) {
                const collection = toCollection || 'customers'
                const formatted = `${collection}:${toId.id}`
                console.log('[EDIT PAGE] Step 3 - Formatted toId (object):', formatted, 'from:', { toId, toCollection, toIdId: toId.id })
                return formatted
              } else if (typeof toId === 'number') {
                const collection = toCollection || 'customers'
                const formatted = `${collection}:${toId}`
                console.log('[EDIT PAGE] Step 3 - Formatted toId (number):', formatted, 'from:', { toId, toCollection })
                return formatted
              }
              
              console.warn('[EDIT PAGE] Step 3 - toId format not recognized:', typeof toId, toId)
              return undefined
            })(),
            fromAddress: data.exportContainerBooking.fromAddress,
            fromCity: data.exportContainerBooking.fromCity,
            fromState: data.exportContainerBooking.fromState,
            fromPostcode: data.exportContainerBooking.fromPostcode,
            toAddress: data.exportContainerBooking.toAddress,
            toCity: data.exportContainerBooking.toCity,
            toState: data.exportContainerBooking.toState,
            toPostcode: data.exportContainerBooking.toPostcode,
            containerSizeIds: Array.isArray(data.exportContainerBooking.containerSizeIds)
              ? data.exportContainerBooking.containerSizeIds.map((size: any) =>
                  typeof size === 'object' ? size.id : size,
                )
              : [],
            containerQuantities: data.exportContainerBooking.containerQuantities || {},
            emptyRouting: data.exportContainerBooking.emptyRouting,
            fullRouting: data.exportContainerBooking.fullRouting,
            instructions: data.exportContainerBooking.instructions,
            jobNotes: data.exportContainerBooking.jobNotes,
            releaseNumber: data.exportContainerBooking.releaseNumber,
            weight: data.exportContainerBooking.weight,
            driverAllocation: data.exportContainerBooking.driverAllocation,
          }
          console.log('[EDIT PAGE] Step 3 - Final formData:', {
            fromId: formData.fromId,
            toId: formData.toId,
            fromAddress: formData.fromAddress,
            toAddress: formData.toAddress,
          })
          setBooking(formData)
        }
      } else if (res.status === 404) {
        router.push('/dashboard/export-container-bookings')
      }
    } catch (error) {
      console.error('Error loading booking:', error)
    } finally {
      setLoadingBooking(false)
    }
  }

  const handleSave = async (data: any) => {
    router.push(`/dashboard/export-container-bookings/${data.id}`)
  }

  const handleCancel = () => {
    router.push(`/dashboard/export-container-bookings/${bookingId}`)
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

  if (!booking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Booking not found</div>
      </div>
    )
  }

  const isEditable = booking.status === 'draft' || booking.status === 'confirmed' || booking.status === 'in_progress'
  const isReadOnly = booking.status === 'completed' || booking.status === 'cancelled'

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Export Container Booking</h1>
          <p className="text-muted-foreground">
            {booking.bookingCode || `EXP-${booking.id}`}
          </p>
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
                  This booking is {booking.status} and cannot be edited. You can view the details in read-only mode.
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
        <MultistepExportContainerBookingForm
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
              <Link href={`/dashboard/export-container-bookings/${bookingId}`}>
                <Button>View Booking</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

