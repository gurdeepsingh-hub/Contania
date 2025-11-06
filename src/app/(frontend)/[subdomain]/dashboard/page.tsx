'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, Users, Mail, Phone, MapPin } from 'lucide-react'

type TenantUser = {
  id: number
  email: string
  fullName: string
  userGroup: string
  createdAt: string
}

export default function TenantDashboard() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [stats, setStats] = useState({
    users: 0,
    orders: 0,
    vehicles: 0,
  })
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)

  // Check tenant-user authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          // Not authenticated, redirect to subdomain homepage
          router.push('/')
          return
        }
        setAuthChecked(true)
      } catch (error) {
        // Not authenticated, redirect to subdomain homepage
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (tenant && authChecked) {
      loadStats()
      loadTenantUsers()
    }
  }, [tenant, authChecked])

  const loadStats = async () => {
    try {
      // Placeholder for actual stats fetching
      // const res = await fetch(`/api/tenant/stats`)
      // const data = await res.json()
      // setStats(data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadTenantUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch('/api/tenant-users')
      if (res.ok) {
        const data = await res.json()
        setTenantUsers(data.users || [])
        setStats((prev) => ({ ...prev, users: data.total || 0 }))
      }
    } catch (error) {
      console.error('Error loading tenant users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

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
      <div>
        <h1 className="text-3xl font-bold">Welcome, {tenant.companyName}</h1>
        <p className="text-muted-foreground">Your tenant dashboard</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Orders</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.orders}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vehicles</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vehicles}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tenant Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Users</CardTitle>
          <CardDescription>Users associated with this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : tenantUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="space-y-2">
              {tenantUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex justify-center items-center bg-primary rounded-full w-10 h-10">
                      <Users className="w-5 h-5 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">{user.fullName || 'No name'}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {user.userGroup && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded text-secondary-foreground">
                        {user.userGroup}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Info */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
          <CardDescription>Your company details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Company Name</label>
              <p className="font-medium">{tenant.companyName}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Email</label>
              <p className="font-medium">{tenant.email}</p>
            </div>
            {tenant.phone && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <p className="font-medium">{tenant.phone}</p>
              </div>
            )}
            {tenant.address && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <p className="font-medium">
                  {[
                    tenant.address.street,
                    tenant.address.city,
                    tenant.address.state,
                    tenant.address.postalCode,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
