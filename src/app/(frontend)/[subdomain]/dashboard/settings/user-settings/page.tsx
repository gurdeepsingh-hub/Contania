'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { UserCog, ArrowLeft, Mail, Phone, Globe, MapPin, Edit } from 'lucide-react'
import { hasViewPermission, hasPermission, canManageRoles } from '@/lib/permissions'

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function UserSettingsPage() {
  const router = useRouter()
  const { tenant, loading, setTenant } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/dashboard')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
            }
          } else {
            setCurrentUser(data.user)
          }
          setAuthChecked(true)
        }
      } catch (error) {
        router.push('/dashboard')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked && currentUser) {
      if (
        !hasViewPermission(currentUser, 'settings') ||
        (!hasPermission(currentUser, 'settings_user_settings') && !canManageRoles(currentUser))
      ) {
        router.push('/dashboard/settings')
      }
    }
  }, [authChecked, currentUser, router])

  // Refresh tenant data when component mounts to ensure latest data
  useEffect(() => {
    const refreshTenant = async () => {
      try {
        const res = await fetch('/api/tenant/current')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.tenant) {
            setTenant(data.tenant)
          }
        }
      } catch (error) {
        console.error('Error refreshing tenant data:', error)
      }
    }

    if (!loading && authChecked) {
      refreshTenant()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked])

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/settings')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UserCog className="h-8 w-8" />
              Account Settings
            </h1>
            <p className="text-muted-foreground">Configure account settings and company information</p>
          </div>
        </div>
        <Button onClick={() => router.push('/dashboard/settings/user-settings/edit')}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Company Information
        </Button>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Your company details and contact information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">
              Company Name
            </label>
            <p className="font-medium">{tenant.companyName}</p>
          </div>
          {tenant.fullName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Full Legal Name
              </label>
              <p className="font-medium">{tenant.fullName}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
            <p className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {tenant.email}
            </p>
          </div>
          {tenant.phone && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Phone</label>
              <p className="font-medium flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {tenant.phone}
              </p>
            </div>
          )}
          {tenant.fax && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Fax</label>
              <p className="font-medium">{tenant.fax}</p>
            </div>
          )}
          {tenant.website && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Website</label>
              <p className="font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <a
                  href={tenant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {tenant.website}
                </a>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Address Information */}
      {tenant.address && (
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Business address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenant.address.street && (
              <p className="font-medium">{tenant.address.street}</p>
            )}
            <p className="text-muted-foreground">
              {[
                tenant.address.city,
                tenant.address.state,
                tenant.address.postalCode,
                tenant.address.countryCode,
              ]
                .filter(Boolean)
                .join(', ')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Department Emails */}
      {tenant.emails && (
        <Card>
          <CardHeader>
            <CardTitle>Department Emails</CardTitle>
            <CardDescription>Contact emails by department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tenant.emails.account && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Account
                  </label>
                  <p className="text-sm">{tenant.emails.account}</p>
                </div>
              )}
              {tenant.emails.bookings && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Bookings
                  </label>
                  <p className="text-sm">{tenant.emails.bookings}</p>
                </div>
              )}
              {tenant.emails.management && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Management
                  </label>
                  <p className="text-sm">{tenant.emails.management}</p>
                </div>
              )}
              {tenant.emails.operations && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Operations
                  </label>
                  <p className="text-sm">{tenant.emails.operations}</p>
                </div>
              )}
              {tenant.emails.replyTo && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">
                    Reply-To
                  </label>
                  <p className="text-sm">{tenant.emails.replyTo}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
