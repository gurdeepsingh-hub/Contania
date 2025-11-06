'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { cn } from '@/lib/utils'
import {
  Building2,
  Clock,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Eye,
  Check,
  X,
} from 'lucide-react'

type Tenant = {
  id: number
  companyName: string
  email: string
  phone?: string
  approved?: boolean
  verified?: boolean
  createdAt: string
  address?: {
    city?: string
    state?: string
    countryCode?: string
  }
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })
  const [pendingTenants, setPendingTenants] = useState<Tenant[]>([])
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)

      // Fetch all tenants
      const allRes = await fetch('/api/tenants')
      const allData = await allRes.json()

      // Fetch pending tenants
      const pendingRes = await fetch('/api/tenants?approved=false')
      const pendingData = await pendingRes.json()

      const total = allData.totalDocs || 0
      const pending = pendingData.totalDocs || 0
      const approved = total - pending

      setStats({
        total,
        pending,
        approved,
        rejected: 0, // Could be calculated if we track rejections
      })

      setPendingTenants(pendingData.tenants || [])
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewTenant = async (tenantId: number) => {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`)
      const data = await res.json()
      if (data.success) {
        setSelectedTenant(data.tenant)
      }
    } catch (error) {
      console.error('Error fetching tenant details:', error)
    }
  }

  const handleApprove = async (tenantId: number) => {
    if (
      !confirm(
        'Are you sure you want to approve this tenant? A subdomain and login credentials will be created.',
      )
    )
      return

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        const data = await res.json()
        await loadData()
        setSelectedTenant(null)
        alert(
          `Tenant approved successfully!\n\nSubdomain: ${data.credentials?.subdomain}\nEmail: ${data.credentials?.email}\nPassword: ${data.credentials?.password}\n\nThese credentials have been sent to the tenant via email.`,
        )
      } else {
        const error = await res.json().catch(() => ({ message: 'Failed to approve tenant' }))
        alert(error.message || 'Failed to approve tenant')
      }
    } catch (error) {
      console.error('Error approving tenant:', error)
      alert('Failed to approve tenant')
    }
  }

  const handleReject = async (tenantId: number) => {
    if (!confirm('Are you sure you want to reject this tenant?')) return

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (res.ok) {
        await loadData()
        setSelectedTenant(null)
        alert('Tenant rejected')
      } else {
        alert('Failed to reject tenant')
      }
    } catch (error) {
      console.error('Error rejecting tenant:', error)
      alert('Failed to reject tenant')
    }
  }

  // Load data when component mounts (auth is checked in layout)
  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Super Admin Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex-1 sm:flex-initial" onClick={() => router.push('/super-admin/tenants')}>
            <span className="hidden sm:inline">View All Tenants</span>
            <span className="sm:hidden">All Tenants</span>
          </Button>
          <Button size="sm" className="flex-1 sm:flex-initial" onClick={() => router.push('/')}>
            Back to Home
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card className="relative rounded-none shadow-zinc-950/5 hover:shadow-lg transition-all duration-300">
          <CardDecorator />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
            <Building2 className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card className="relative rounded-none shadow-zinc-950/5 hover:shadow-lg transition-all duration-300">
          <CardDecorator />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card className="relative rounded-none shadow-zinc-950/5 hover:shadow-lg transition-all duration-300">
          <CardDecorator />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card className="relative rounded-none shadow-zinc-950/5 hover:shadow-lg transition-all duration-300">
          <CardDecorator />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold">{pendingTenants.length}</div>
            <p className="text-xs text-muted-foreground mt-1">New requests</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      <Card className="relative rounded-none shadow-zinc-950/5">
        <CardDecorator />
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Pending Tenant Requests</CardTitle>
          <CardDescription>Review and approve or reject tenant registrations</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingTenants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No pending requests</p>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {pendingTenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold text-base sm:text-lg truncate">{tenant.companyName}</h3>
                    </div>
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{tenant.email}</span>
                      </div>
                      {tenant.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{tenant.phone}</span>
                        </div>
                      )}
                      {tenant.address && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">
                            {[tenant.address.city, tenant.address.state, tenant.address.countryCode]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 flex-shrink-0" />
                        <span>{new Date(tenant.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleViewTenant(tenant.id)}
                      className="w-full sm:w-auto min-h-[44px]"
                    >
                      <Eye className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">View</span>
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(tenant.id)}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto min-h-[44px]"
                    >
                      <Check className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Approve</span>
                      <span className="sm:hidden">Approve</span>
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handleReject(tenant.id)}
                      className="w-full sm:w-auto min-h-[44px]"
                    >
                      <X className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Reject</span>
                      <span className="sm:hidden">Reject</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tenant Details Modal */}
      {selectedTenant && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6">
          <Card className="relative rounded-none shadow-zinc-950/5 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardDecorator />
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl truncate">{selectedTenant.companyName}</CardTitle>
                  <CardDescription>Tenant Details</CardDescription>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSelectedTenant(null)}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
                  <p className="text-sm sm:text-base break-words">{selectedTenant.email}</p>
                </div>
                {selectedTenant.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Phone</label>
                    <p className="text-sm sm:text-base">{selectedTenant.phone}</p>
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-4 border-t">
                <Button
                  onClick={() => {
                    handleApprove(selectedTenant.id)
                  }}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto min-h-[44px]"
                >
                  <Check className="h-4 w-4 sm:mr-2" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleReject(selectedTenant.id)
                  }}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  <X className="h-4 w-4 sm:mr-2" />
                  Reject
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedTenant(null)}
                  className="w-full sm:w-auto min-h-[44px]"
                >
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
