'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CardDecorator } from '@/components/ui/card-decorator'
import { Label } from '@/components/ui/label'
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Users, 
  ArrowLeft,
  CheckCircle,
  XCircle,
  Calendar,
  Globe,
  Send,
  AlertCircle,
  X
} from 'lucide-react'

type Tenant = {
  id: number
  companyName: string
  fullName?: string
  email: string
  phone?: string
  fax?: string
  website?: string
  approved?: boolean
  verified?: boolean
  subdomain?: string
  createdAt: string
  address?: {
    street?: string
    city?: string
    state?: string
    postalCode?: string
    countryCode?: string
  }
  emails?: {
    account?: string
    bookings?: string
    management?: string
    operations?: string
    replyTo?: string
  }
}

type TenantUser = {
  id: number
  fullName: string
  email: string
  userGroup?: string
  position?: string
  phoneMobile?: string
  phoneFixed?: string
  status?: string
}

export default function TenantDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const tenantId = params.id as string
  const [loading, setLoading] = useState(true)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [resendingEmail, setResendingEmail] = useState(false)
  const [emailMessage, setEmailMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showRevertModal, setShowRevertModal] = useState(false)
  const [revertReason, setRevertReason] = useState('')
  const [reverting, setReverting] = useState(false)

  useEffect(() => {
    if (tenantId) {
      loadTenantDetails()
    }
  }, [tenantId])

  const loadTenantDetails = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/tenants/${tenantId}`)
      const data = await res.json()
      if (data.success) {
        setTenant(data.tenant)
        setTenantUsers(data.tenant.users || [])
      }
    } catch (error) {
      console.error('Error loading tenant details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResendEmail = async (type: 'approval' | 'credentials') => {
    if (!tenant) return

    setResendingEmail(true)
    setEmailMessage(null)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/resend-email?type=${type}`, {
        method: 'POST',
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setEmailMessage({
          type: 'success',
          text: `Email sent successfully. ${data.credentials ? `New password: ${data.credentials.password}` : ''}`,
        })
      } else {
        setEmailMessage({
          type: 'error',
          text: data.message || 'Failed to send email',
        })
      }
    } catch (error) {
      console.error('Error resending email:', error)
      setEmailMessage({
        type: 'error',
        text: 'An error occurred while sending the email',
      })
    } finally {
      setResendingEmail(false)
      // Clear message after 5 seconds
      setTimeout(() => setEmailMessage(null), 5000)
    }
  }

  const handleRequestCorrections = async () => {
    if (!tenant) return

    setReverting(true)
    setEmailMessage(null)

    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/revert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: revertReason }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setEmailMessage({
          type: 'success',
          text: 'Correction request sent successfully. The tenant has been notified via email.',
        })
        setShowRevertModal(false)
        setRevertReason('')
        await loadTenantDetails() // Reload to update status
      } else {
        setEmailMessage({
          type: 'error',
          text: data.message || 'Failed to send correction request',
        })
      }
    } catch (error) {
      console.error('Error requesting corrections:', error)
      setEmailMessage({
        type: 'error',
        text: 'An error occurred while sending the correction request',
      })
    } finally {
      setReverting(false)
      // Clear message after 5 seconds
      setTimeout(() => setEmailMessage(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <Card className="relative rounded-none shadow-zinc-950/5">
          <CardDecorator />
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Tenant Not Found</CardTitle>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => router.push('/super-admin/tenants')}
          className="w-full sm:w-auto min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Back to All Tenants</span>
          <span className="sm:hidden">Back</span>
        </Button>
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight truncate">{tenant.companyName}</h1>
          {tenant.approved ? (
            <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-green-500 flex-shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500 flex-shrink-0" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Tenant Information */}
        <Card className="relative rounded-none shadow-zinc-950/5">
          <CardDecorator />
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Company Information</CardTitle>
            <CardDescription>Basic company details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Company Name</label>
              <p className="font-medium text-sm sm:text-base break-words">{tenant.companyName}</p>
            </div>
            {tenant.fullName && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Full Legal Name</label>
                <p className="font-medium text-sm sm:text-base break-words">{tenant.fullName}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Email</label>
              <p className="font-medium text-sm sm:text-base break-words">{tenant.email}</p>
            </div>
            {tenant.phone && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Phone</label>
                <p className="font-medium text-sm sm:text-base">{tenant.phone}</p>
              </div>
            )}
            {tenant.fax && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Fax</label>
                <p className="font-medium text-sm sm:text-base">{tenant.fax}</p>
              </div>
            )}
            {tenant.website && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Website</label>
                <p className="font-medium text-sm sm:text-base flex items-center gap-2 flex-wrap">
                  <Globe className="h-4 w-4 flex-shrink-0" />
                  <a href={tenant.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                    {tenant.website}
                  </a>
                </p>
              </div>
            )}
            {tenant.subdomain && (
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-1">Subdomain</label>
                <p className="font-medium text-sm sm:text-base">{tenant.subdomain}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Status</label>
              <p className="font-medium text-sm sm:text-base">
                {(tenant as { status?: string }).status === 'needs_correction' ? (
                  <span className="text-orange-600">Needs Correction</span>
                ) : tenant.approved ? (
                  <span className="text-green-600">Approved</span>
                ) : (tenant as { status?: string }).status === 'rejected' ? (
                  <span className="text-red-600">Rejected</span>
                ) : (
                  <span className="text-yellow-600">Pending Approval</span>
                )}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-1">Created</label>
              <p className="font-medium text-sm sm:text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0" />
                {new Date(tenant.createdAt).toLocaleDateString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        {tenant.address && (
          <Card className="relative rounded-none shadow-zinc-950/5">
            <CardDecorator />
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Address</CardTitle>
              <CardDescription>Business address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              {tenant.address.street && (
                <p className="font-medium text-sm sm:text-base break-words">{tenant.address.street}</p>
              )}
              <p className="text-muted-foreground text-sm sm:text-base break-words">
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
          <Card className="relative rounded-none shadow-zinc-950/5 lg:col-span-2">
            <CardDecorator />
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Department Emails</CardTitle>
              <CardDescription>Contact emails by department</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {tenant.emails.account && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Account</label>
                    <p className="text-sm sm:text-base break-words">{tenant.emails.account}</p>
                  </div>
                )}
                {tenant.emails.bookings && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Bookings</label>
                    <p className="text-sm sm:text-base break-words">{tenant.emails.bookings}</p>
                  </div>
                )}
                {tenant.emails.management && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Management</label>
                    <p className="text-sm sm:text-base break-words">{tenant.emails.management}</p>
                  </div>
                )}
                {tenant.emails.operations && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Operations</label>
                    <p className="text-sm sm:text-base break-words">{tenant.emails.operations}</p>
                  </div>
                )}
                {tenant.emails.replyTo && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground block mb-1">Reply-To</label>
                    <p className="text-sm sm:text-base break-words">{tenant.emails.replyTo}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Approve/Reject Section - Only show for pending tenants */}
      {!tenant.approved && (tenant as { status?: string }).status !== 'rejected' && (
        <Card className="relative rounded-none shadow-zinc-950/5">
          <CardDecorator />
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Approve or Reject Tenant</CardTitle>
            <CardDescription>Review and approve or reject this tenant registration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={async () => {
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
                      await loadTenantDetails()
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
                }}
                className="bg-green-600 hover:bg-green-700 min-h-[44px]"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve Tenant
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm('Are you sure you want to reject this tenant?')) return

                  try {
                    const res = await fetch(`/api/admin/tenants/${tenantId}/reject`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({}),
                    })

                    if (res.ok) {
                      await loadTenantDetails()
                      alert('Tenant rejected')
                    } else {
                      alert('Failed to reject tenant')
                    }
                  } catch (error) {
                    console.error('Error rejecting tenant:', error)
                    alert('Failed to reject tenant')
                  }
                }}
                className="min-h-[44px]"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject Tenant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Request Corrections Section - Only show for non-approved tenants */}
      {!tenant.approved && (
        <Card className="relative rounded-none shadow-zinc-950/5">
          <CardDecorator />
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Request Corrections</CardTitle>
            <CardDescription>Request the tenant to correct their registration details</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => setShowRevertModal(true)}
              className="min-h-[44px]"
            >
              <AlertCircle className="h-4 w-4 mr-2" />
              Request Corrections
            </Button>
            <p className="text-sm text-muted-foreground mt-3">
              This will send an email to the tenant with a link to edit their registration details.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Resend Email Section - Only show for approved tenants */}
      {tenant.approved && tenant.subdomain && (
        <Card className="relative rounded-none shadow-zinc-950/5">
          <CardDecorator />
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Resend Email</CardTitle>
            <CardDescription>Resend approval or credentials email to the tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailMessage && (
              <div
                className={`p-4 rounded-lg ${
                  emailMessage.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {emailMessage.text}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => handleResendEmail('approval')}
                disabled={resendingEmail}
                className="min-h-[44px]"
              >
                <Send className="h-4 w-4 mr-2" />
                {resendingEmail ? 'Sending...' : 'Resend Approval Email'}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleResendEmail('credentials')}
                disabled={resendingEmail}
                className="min-h-[44px]"
              >
                <Send className="h-4 w-4 mr-2" />
                {resendingEmail ? 'Sending...' : 'Resend Credentials'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Resending credentials will generate a new temporary password for the tenant admin user.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tenant Users */}
      <Card className="relative rounded-none shadow-zinc-950/5">
        <CardDecorator />
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Users className="h-5 w-5" />
            Tenant Users ({tenantUsers.length})
          </CardTitle>
          <CardDescription>Users associated with this tenant</CardDescription>
        </CardHeader>
        <CardContent>
          {tenantUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found for this tenant</p>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {tenantUsers.map((user) => (
                <div
                  key={user.id}
                  className="p-4 sm:p-6 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-base sm:text-lg">{user.fullName}</h3>
                      {user.userGroup && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {user.userGroup}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </div>
                      {user.position && (
                        <p className="break-words">Position: {user.position}</p>
                      )}
                      {user.phoneMobile && (
                        <p>Mobile: {user.phoneMobile}</p>
                      )}
                      {user.phoneFixed && (
                        <p>Fixed: {user.phoneFixed}</p>
                      )}
                      {user.status && (
                        <p>
                          Status:{' '}
                          <span className={user.status === 'active' ? 'text-green-600' : 'text-red-600'}>
                            {user.status}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revert Modal */}
      {showRevertModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 sm:p-6">
          <Card className="relative rounded-none shadow-zinc-950/5 w-full max-w-2xl">
            <CardDecorator />
            <CardHeader>
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-xl sm:text-2xl">Request Corrections</CardTitle>
                  <CardDescription>Send a correction request to the tenant</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowRevertModal(false)
                    setRevertReason('')
                  }}
                  className="flex-shrink-0 min-h-[44px] min-w-[44px]"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="revertReason">Reason for Correction (Optional)</Label>
                <textarea
                  id="revertReason"
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-md min-h-[100px] resize-y"
                  placeholder="Please specify what needs to be corrected..."
                />
                <p className="text-sm text-muted-foreground mt-1">
                  This message will be included in the email sent to the tenant.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRevertModal(false)
                    setRevertReason('')
                  }}
                  disabled={reverting}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRequestCorrections}
                  disabled={reverting}
                  className="min-h-[44px]"
                >
                  {reverting ? 'Sending...' : 'Send Correction Request'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}


