'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { UserCog, ArrowLeft, Mail, Phone, Lock, Save, Edit, X } from 'lucide-react'
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
  const [isEditing, setIsEditing] = useState(false)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state for account information
  const [fullName, setFullName] = useState('')
  const [phoneMobile, setPhoneMobile] = useState('')
  const [phoneFixed, setPhoneFixed] = useState('')
  const [ddi, setDdi] = useState('')

  // Form state for password change
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

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
          setCurrentUser(data.user)
          // Initialize form fields
          setFullName((data.user.fullName as string) || '')
          setPhoneMobile((data.user.phoneMobile as string) || '')
          setPhoneFixed((data.user.phoneFixed as string) || '')
          setDdi((data.user.ddi as string) || '')
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
    if (authChecked && currentUser && !isUpdating) {
      if (
        !hasViewPermission(currentUser, 'settings') ||
        (!hasPermission(currentUser, 'settings_user_settings') && !canManageRoles(currentUser))
      ) {
        router.push('/dashboard/settings')
      }
    }
  }, [authChecked, currentUser, router, isUpdating])

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

  const handleEditClick = () => {
    setIsEditing(true)
    // Reset form fields to current user data
    if (currentUser) {
      setFullName((currentUser.fullName as string) || '')
      setPhoneMobile((currentUser.phoneMobile as string) || '')
      setPhoneFixed((currentUser.phoneFixed as string) || '')
      setDdi((currentUser.ddi as string) || '')
    }
    setError(null)
    setSuccess(null)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setError(null)
    setSuccess(null)
  }

  const handleAccountInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setIsUpdating(true)
    setError(null)
    setSuccess(null)

    try {
      if (!currentUser?.id) {
        setError('User ID not found')
        setIsUpdating(false)
        return
      }

      const res = await fetch('/api/tenant-users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          phoneMobile: phoneMobile || undefined,
          phoneFixed: phoneFixed || undefined,
          ddi: ddi || undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          // Fetch full user data with permissions to avoid redirect
          const fullUserRes = await fetch('/api/tenant-users/me')
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
            } else {
              setCurrentUser(data.user)
            }
          } else {
            setCurrentUser(data.user)
          }
          setSuccess('Account information updated successfully')
          setIsEditing(false)
          setTimeout(() => {
            setSuccess(null)
            setIsUpdating(false)
          }, 3000)
        } else {
          setError(data.message || 'Failed to update account information')
          setIsUpdating(false)
        }
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to update account information')
        setIsUpdating(false)
      }
    } catch (error) {
      setError('An error occurred while updating account information')
      setIsUpdating(false)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordFormToggle = () => {
    setShowPasswordForm(!showPasswordForm)
    if (showPasswordForm) {
      // Reset form when hiding
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError(null)
      setPasswordSuccess(null)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setChangingPassword(true)
    setPasswordError(null)
    setPasswordSuccess(null)

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match')
      setChangingPassword(false)
      return
    }

    // Validate password length
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters long')
      setChangingPassword(false)
      return
    }

    try {
      const res = await fetch('/api/tenant-users/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setPasswordSuccess('Password changed successfully')
          // Clear password fields and hide form
          setOldPassword('')
          setNewPassword('')
          setConfirmPassword('')
          setTimeout(() => {
            setPasswordSuccess(null)
            setShowPasswordForm(false)
          }, 2000)
        } else {
          setPasswordError(data.message || 'Failed to change password')
        }
      } else {
        const data = await res.json()
        setPasswordError(data.message || 'Failed to change password')
      }
    } catch (error) {
      setPasswordError('An error occurred while changing password')
    } finally {
      setChangingPassword(false)
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
    <div className="container mx-auto p-6 space-y-6 max-w-4xl">
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

      {/* Account Information Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your personal account details</CardDescription>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={handleEditClick}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!isEditing ? (
            // View Mode
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email - Read Only */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Email</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {(currentUser?.email as string) || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Full Name</Label>
                  <div className="p-3 rounded-md border bg-background">
                    <span className="text-sm font-medium">
                      {(currentUser?.fullName as string) || 'Not set'}
                    </span>
                  </div>
                </div>

                {/* Phone Mobile */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Phone (Mobile)</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-background">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {(currentUser?.phoneMobile as string) || 'Not set'}
                    </span>
                  </div>
                </div>

                {/* Phone Fixed */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Phone (Fixed)</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-background">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {(currentUser?.phoneFixed as string) || 'Not set'}
                    </span>
                  </div>
                </div>

                {/* DDI */}
                <div className="space-y-2">
                  <Label className="text-muted-foreground">DDI</Label>
                  <div className="p-3 rounded-md border bg-background">
                    <span className="text-sm font-medium">
                      {(currentUser?.ddi as string) || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleAccountInfoSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Email - Read Only */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">
                      {(currentUser?.email as string) || 'N/A'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" required>Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                {/* Phone Mobile */}
                <div className="space-y-2">
                  <Label htmlFor="phoneMobile">Phone (Mobile)</Label>
                  <Input
                    id="phoneMobile"
                    type="tel"
                    value={phoneMobile}
                    onChange={(e) => setPhoneMobile(e.target.value)}
                    placeholder="+61 4XX XXX XXX"
                  />
                </div>

                {/* Phone Fixed */}
                <div className="space-y-2">
                  <Label htmlFor="phoneFixed">Phone (Fixed)</Label>
                  <Input
                    id="phoneFixed"
                    type="tel"
                    value={phoneFixed}
                    onChange={(e) => setPhoneFixed(e.target.value)}
                    placeholder="+61 2 XXXX XXXX"
                  />
                </div>

                {/* DDI */}
                <div className="space-y-2">
                  <Label htmlFor="ddi">DDI</Label>
                  <Input
                    id="ddi"
                    value={ddi}
                    onChange={(e) => setDdi(e.target.value)}
                    placeholder="Extension"
                  />
                </div>
              </div>

              {/* Error/Success Messages */}
              {error && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                  {success}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Password Change Card */}
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent>
          {!showPasswordForm ? (
            // Initial View - Show Button
            <div className="flex justify-start">
              <Button variant="outline" onClick={handlePasswordFormToggle}>
                <Lock className="h-4 w-4 mr-2" />
                Change Password
              </Button>
            </div>
          ) : (
            // Password Form
            <form onSubmit={handlePasswordChange} className="space-y-6">
              {/* Old Password - Single field */}
              <div className="space-y-2">
                <Label htmlFor="oldPassword" required>Old Password</Label>
                <Input
                  id="oldPassword"
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  required
                  placeholder="Enter your current password"
                />
              </div>

              {/* New Password and Confirm Password - Pair */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Password */}
                <div className="space-y-2">
                  <Label htmlFor="newPassword" required>New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Enter your new password"
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>

                {/* Confirm Password */}
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" required>Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Confirm your new password"
                    minLength={8}
                  />
                </div>
              </div>

              {/* Error/Success Messages */}
              {passwordError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                  {passwordSuccess}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePasswordFormToggle}
                  disabled={changingPassword}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit" disabled={changingPassword}>
                  <Lock className="h-4 w-4 mr-2" />
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
