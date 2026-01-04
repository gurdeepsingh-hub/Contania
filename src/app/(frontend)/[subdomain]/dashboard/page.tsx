'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Users,
  Mail,
  Phone,
  MapPin,
  Container,
  Package,
  Truck,
  Plus,
} from 'lucide-react'
import { hasViewPermission } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { StatusBadge } from '@/components/container-bookings/status-badge'

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
    containerBookings: 0,
    activeBookings: 0,
    pendingBookings: 0,
    completedThisMonth: 0,
  })
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [recentBookings, setRecentBookings] = useState<any[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<{
    id?: number
    role?: number | string | { id: number; permissions?: Record<string, boolean> }
  } | null>(null)

  // Check tenant-user authentication and permissions
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          // Not authenticated, redirect to subdomain homepage
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          // Fetch full user with role populated to check permissions
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
              // Check if user has permission to view dashboard
              if (!hasViewPermission(fullUserData.user, 'dashboard')) {
                router.push('/dashboard/settings')
                return
              }
            }
          } else {
            setCurrentUser(data.user)
          }
          setAuthChecked(true)
        }
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
      loadContainerBookings()
    }
  }, [tenant, authChecked])

  const loadStats = async () => {
    try {
      // Load container bookings stats
      const [importRes, exportRes] = await Promise.all([
        fetch('/api/import-container-bookings?limit=1'),
        fetch('/api/export-container-bookings?limit=1'),
      ])

      if (importRes.ok && exportRes.ok) {
        const importData = await importRes.json()
        const exportData = await exportRes.json()

        const totalBookings = (importData.totalDocs || 0) + (exportData.totalDocs || 0)

        // Get active and pending bookings
        const [activeImportRes, activeExportRes, pendingImportRes, pendingExportRes] =
          await Promise.all([
            fetch('/api/import-container-bookings?status=in_progress&limit=1'),
            fetch('/api/export-container-bookings?status=in_progress&limit=1'),
            fetch('/api/import-container-bookings?status=confirmed&limit=1'),
            fetch('/api/export-container-bookings?status=confirmed&limit=1'),
          ])

        const activeImportData = activeImportRes.ok
          ? await activeImportRes.json()
          : { totalDocs: 0 }
        const activeExportData = activeExportRes.ok
          ? await activeExportRes.json()
          : { totalDocs: 0 }
        const pendingImportData = pendingImportRes.ok
          ? await pendingImportRes.json()
          : { totalDocs: 0 }
        const pendingExportData = pendingExportRes.ok
          ? await pendingExportRes.json()
          : { totalDocs: 0 }

        setStats((prev) => ({
          ...prev,
          containerBookings: totalBookings,
          activeBookings: (activeImportData.totalDocs || 0) + (activeExportData.totalDocs || 0),
          pendingBookings: (pendingImportData.totalDocs || 0) + (pendingExportData.totalDocs || 0),
        }))
      }
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const loadContainerBookings = async () => {
    try {
      setLoadingBookings(true)
      const [importRes, exportRes] = await Promise.all([
        fetch('/api/import-container-bookings?limit=5&sort=-createdAt'),
        fetch('/api/export-container-bookings?limit=5&sort=-createdAt'),
      ])

      if (importRes.ok && exportRes.ok) {
        const importData = await importRes.json()
        const exportData = await exportRes.json()

        const bookings = [
          ...(importData.importContainerBookings || []).map((b: any) => ({ ...b, type: 'import' })),
          ...(exportData.exportContainerBookings || []).map((b: any) => ({ ...b, type: 'export' })),
        ]

        bookings.sort((a, b) => {
          const dateA = new Date(a.createdAt).getTime()
          const dateB = new Date(b.createdAt).getTime()
          return dateB - dateA
        })

        setRecentBookings(bookings.slice(0, 5))
      }
    } catch (error) {
      console.error('Error loading recent bookings:', error)
    } finally {
      setLoadingBookings(false)
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
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Container Bookings</CardTitle>
            <Container className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.containerBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Bookings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeBookings}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bookings</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingBookings}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Create Container Booking */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Container Bookings</CardTitle>
              <CardDescription>Manage your container bookings</CardDescription>
            </div>
            <Link href="/dashboard/container-bookings/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Container Booking
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {loadingBookings ? (
            <div className="text-center py-4 text-muted-foreground">Loading recent bookings...</div>
          ) : recentBookings.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <p className="mb-2">No container bookings yet</p>
              <Link href="/dashboard/container-bookings/new">
                <Button variant="outline" size="sm">
                  Create Your First Booking
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentBookings.map((booking) => (
                <Link
                  key={`${booking.type}-${booking.id}`}
                  href={
                    booking.type === 'import'
                      ? `/dashboard/import-container-bookings/${booking.id}`
                      : `/dashboard/export-container-bookings/${booking.id}`
                  }
                >
                  <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      {booking.type === 'import' ? (
                        <Package className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Truck className="h-5 w-5 text-green-600" />
                      )}
                      <div>
                        <p className="font-medium">
                          {booking.bookingCode || `${booking.type.toUpperCase()}-${booking.id}`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {booking.customerReference || 'No reference'}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={booking.status} type={booking.type} />
                  </div>
                </Link>
              ))}
              <div className="pt-2">
                <Link href="/dashboard/container-bookings">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Bookings
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
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
