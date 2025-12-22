'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCog, ArrowLeft, Loader2 } from 'lucide-react'
import { hasViewPermission, hasPermission, canManageRoles } from '@/lib/permissions'

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

type Address = {
  street?: string
  city?: string
  state?: string
  postalCode?: string
  countryCode?: string
}

type Emails = {
  account?: string
  bookings?: string
  management?: string
  operations?: string
  replyTo?: string
}

export default function EditCompanyInfoPage() {
  const router = useRouter()
  const { tenant, loading: tenantLoading, setTenant } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [fax, setFax] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState<Address>({})
  const [emails, setEmails] = useState<Emails>({})

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

    if (!tenantLoading && tenant) {
      checkAuth()
    }
  }, [tenantLoading, tenant, router])

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

  useEffect(() => {
    if (tenant) {
      setCompanyName(tenant.companyName || '')
      setFullName(tenant.fullName || '')
      setEmail(tenant.email || '')
      setPhone(tenant.phone || '')
      setFax(tenant.fax || '')
      setWebsite(tenant.website || '')
      setAddress(tenant.address || {})
      setEmails(tenant.emails || {})
    }
  }, [tenant])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)

    if (!companyName || !email) {
      setError('Company name and email are required')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/tenant/current', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          fullName: fullName || undefined,
          email,
          phone: phone || undefined,
          fax: fax || undefined,
          website: website || undefined,
          address: Object.keys(address).length > 0 ? address : undefined,
          emails: Object.keys(emails).length > 0 ? emails : undefined,
        }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // Update tenant context immediately
        if (data.tenant) {
          setTenant(data.tenant)
        }
        setSuccess(true)
        setTimeout(() => {
          router.push('/dashboard/settings/user-settings')
        }, 2000)
      } else {
        setError(data.message || 'Failed to update company information')
      }
    } catch (err) {
      console.error('Error updating company information:', err)
      setError('An error occurred while updating company information')
    } finally {
      setSaving(false)
    }
  }

  if (tenantLoading || !authChecked) {
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
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/settings/user-settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <UserCog className="h-8 w-8" />
            Edit Company Information
          </h1>
          <p className="text-muted-foreground">Update your company details and contact information</p>
        </div>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {success && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-green-800">Company information updated successfully!</p>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
            <CardDescription>Basic company details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name *</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="fullName">Full Legal Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="fax">Fax</Label>
                <Input
                  id="fax"
                  type="tel"
                  value={fax}
                  onChange={(e) => setFax(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Address</CardTitle>
            <CardDescription>Business address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={address.street || ''}
                onChange={(e) => setAddress({ ...address, street: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={address.city || ''}
                  onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  value={address.state || ''}
                  onChange={(e) => setAddress({ ...address, state: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  value={address.postalCode || ''}
                  onChange={(e) => setAddress({ ...address, postalCode: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="countryCode">Country Code</Label>
                <Input
                  id="countryCode"
                  value={address.countryCode || ''}
                  onChange={(e) => setAddress({ ...address, countryCode: e.target.value })}
                  className="mt-1"
                  maxLength={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Department Emails</CardTitle>
            <CardDescription>Contact emails by department (optional)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="emailAccount">Account/Finance</Label>
              <Input
                id="emailAccount"
                type="email"
                value={emails.account || ''}
                onChange={(e) => setEmails({ ...emails, account: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emailBookings">Bookings</Label>
              <Input
                id="emailBookings"
                type="email"
                value={emails.bookings || ''}
                onChange={(e) => setEmails({ ...emails, bookings: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emailManagement">Management</Label>
              <Input
                id="emailManagement"
                type="email"
                value={emails.management || ''}
                onChange={(e) => setEmails({ ...emails, management: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emailOperations">Operations</Label>
              <Input
                id="emailOperations"
                type="email"
                value={emails.operations || ''}
                onChange={(e) => setEmails({ ...emails, operations: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="emailReplyTo">Reply-To</Label>
              <Input
                id="emailReplyTo"
                type="email"
                value={emails.replyTo || ''}
                onChange={(e) => setEmails({ ...emails, replyTo: e.target.value })}
                className="mt-1"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/dashboard/settings/user-settings')}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

