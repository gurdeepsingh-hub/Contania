'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Building2, Mail, Phone, MapPin, Eye, CheckCircle, XCircle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

type Tenant = {
  id: number
  companyName: string
  email: string
  phone?: string
  approved?: boolean
  verified?: boolean
  subdomain?: string
  createdAt: string
  address?: {
    city?: string
    state?: string
    countryCode?: string
  }
}

export default function AllTenantsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [filter, setFilter] = useState<'all' | 'approved' | 'pending'>('all')

  useEffect(() => {
    loadTenants()
  }, [filter])

  const loadTenants = async () => {
    try {
      setLoading(true)
      let url = '/api/tenants'
      if (filter === 'approved') {
        url += '?approved=true'
      } else if (filter === 'pending') {
        url += '?approved=false'
      }

      const res = await fetch(url)
      const data = await res.json()
      setTenants(data.tenants || [])
    } catch (error) {
      console.error('Error loading tenants:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:gap-6">
        <div className="flex sm:flex-row sm:justify-start sm:items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push('/super-admin')}
            className="w-8 h-8 !bg-blue-500 text-white hover:bg-blue-600 !rounded-full !sm:rounded-xl"
          >
            <ArrowLeft className="h-4 w-4 " />
          </Button>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">All Tenants</h1>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            All
          </Button>
          <Button
            variant={filter === 'approved' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('approved')}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            Approved
          </Button>
          <Button
            variant={filter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('pending')}
            className="flex-1 sm:flex-initial min-h-[44px]"
          >
            Pending
          </Button>
        </div>
      </div>

      <Card className="relative rounded-none shadow-zinc-950/5">
        <CardDecorator />
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Tenants ({tenants.length})</CardTitle>
          <CardDescription>View and manage all tenant accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No tenants found</p>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {tenants.map((tenant) => (
                <div
                  key={tenant.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 sm:p-6 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <h3 className="font-semibold text-base sm:text-lg truncate">
                        {tenant.companyName}
                      </h3>
                      {tenant.approved ? (
                        <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 flex-shrink-0" />
                      )}
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
                      {tenant.subdomain && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {tenant.subdomain}
                          </span>
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
                    </div>
                  </div>
                  <Link href={`/super-admin/tenants/${tenant.id}`} className="w-full sm:w-auto">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto min-h-[44px]">
                      <Eye className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">View</span>
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
