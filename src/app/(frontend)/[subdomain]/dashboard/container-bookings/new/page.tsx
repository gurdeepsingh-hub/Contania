'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Package, Truck, ArrowLeft } from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import Link from 'next/link'

export default function ContainerBookingTypeSelectionPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
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

  if (loading || !authChecked) {
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/container-bookings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Create Container Booking</h1>
          <p className="text-muted-foreground">Select the type of container booking to create</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <Link href="/dashboard/import-container-bookings/new" className="block">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-100 p-6 rounded-full">
                  <Package className="h-12 w-12 text-blue-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Import Booking</CardTitle>
              <CardDescription className="mt-2">
                Create a new import container booking for incoming containers
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Track containers arriving at port, manage receiving, and coordinate put-away operations
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/export-container-bookings/new" className="block">
          <Card className="h-full hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="bg-green-100 p-6 rounded-full">
                  <Truck className="h-12 w-12 text-green-600" />
                </div>
              </div>
              <CardTitle className="text-2xl">Export Booking</CardTitle>
              <CardDescription className="mt-2">
                Create a new export container booking for outgoing containers
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Manage container loading, allocation, picking, and dispatch operations
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}

