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
            <p className="text-muted-foreground">Configure your personal account settings</p>
          </div>
        </div>
      </div>

      {/* User Account Information */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your personal account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
            <p className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {(currentUser?.email as string) || 'N/A'}
            </p>
          </div>
          {currentUser && (currentUser as { fullName?: string }).fullName && (
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">
                Full Name
              </label>
              <p className="font-medium">{(currentUser as { fullName?: string }).fullName}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
