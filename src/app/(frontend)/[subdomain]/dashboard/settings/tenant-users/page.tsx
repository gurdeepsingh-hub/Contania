'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Users,
  Plus,
  Edit,
  Trash2,
  X,
  Save,
  Mail,
  Phone,
  Briefcase,
  UserX,
  UserCheck,
  ArrowLeft,
} from 'lucide-react'
import { canManageUsers } from '@/lib/permissions'

type TenantUser = {
  id: number
  email: string
  fullName: string
  role?: number | string | { id: number; name?: string }
  roleName?: string
  status?: string
  position?: string
  phoneMobile?: string
  phoneFixed?: string
  ddi?: string
  createdAt?: string
}

type Role = {
  id: number
  name: string
  description?: string
  isSystemRole?: boolean
  isActive?: boolean
}

export default function TenantUsersPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)
  const [tenantUsers, setTenantUsers] = useState<TenantUser[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    email: '',
    fullName: '',
    role: '',
    password: '',
    position: '',
    phoneMobile: '',
    phoneFixed: '',
    ddi: '',
  })

  // Check tenant-user authentication and permissions
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
          // Fetch full user with role populated to check permissions
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              setCurrentUser(fullUserData.user)
              // Check if user can manage users
              if (!canManageUsers(fullUserData.user)) {
                router.push('/dashboard/settings')
                return
              }
              setAuthChecked(true)
              return
            }
          }
          // Fallback: set basic user
          setCurrentUser(data.user)
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
    if (authChecked) {
      loadTenantUsers()
      loadRoles()
    }
  }, [authChecked])

  const loadRoles = async () => {
    try {
      setLoadingRoles(true)
      const res = await fetch('/api/tenant-roles')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.roles) {
          setRoles(data.roles.filter((r: Role) => r.isActive !== false))
        }
      }
    } catch (error) {
      console.error('Error loading roles:', error)
    } finally {
      setLoadingRoles(false)
    }
  }

  const loadTenantUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await fetch('/api/tenant-users?depth=1')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.users) {
          // Map users and extract role name
          const usersWithRoleNames = data.users.map((user: TenantUser) => {
            const role = typeof user.role === 'object' ? user.role : null
            return {
              ...user,
              roleName: role && typeof role === 'object' && 'name' in role ? role.name : 'No role',
            }
          })
          setTenantUsers(usersWithRoleNames)
        }
      }
    } catch (error) {
      console.error('Error loading tenant users:', error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const resetForm = () => {
    setFormData({
      email: '',
      fullName: '',
      role: roles.length > 0 ? String(roles[0].id) : '',
      password: '',
      position: '',
      phoneMobile: '',
      phoneFixed: '',
      ddi: '',
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddUser = () => {
    resetForm()
    setShowAddForm(true)
    setEditingUser(null)
  }

  const handleEditUser = (user: TenantUser) => {
    const roleId =
      typeof user.role === 'object' && user.role && 'id' in user.role
        ? String(user.role.id)
        : typeof user.role === 'number' || typeof user.role === 'string'
          ? String(user.role)
          : ''

    setFormData({
      email: user.email,
      fullName: user.fullName,
      role: roleId,
      password: '',
      position: user.position || '',
      phoneMobile: user.phoneMobile || '',
      phoneFixed: user.phoneFixed || '',
      ddi: user.ddi || '',
    })
    setEditingUser(user)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingUser(null)
    resetForm()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.email || !formData.fullName || !formData.role) {
      setError('Email, full name, and role are required')
      return
    }

    try {
      if (editingUser) {
        // Update user
        const updateData: Record<string, unknown> = {
          email: formData.email,
          fullName: formData.fullName,
          role: Number(formData.role),
          position: formData.position || undefined,
          phoneMobile: formData.phoneMobile || undefined,
          phoneFixed: formData.phoneFixed || undefined,
          ddi: formData.ddi || undefined,
        }
        if (formData.password) {
          updateData.password = formData.password
        }

        const res = await fetch(`/api/tenant-users/${editingUser.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        })

        if (res.ok) {
          setSuccess('User updated successfully')
          await loadTenantUsers()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to update user')
        }
      } else {
        // Create user
        const res = await fetch('/api/tenant-users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            fullName: formData.fullName,
            role: Number(formData.role),
            password: formData.password || undefined,
            position: formData.position || undefined,
            phoneMobile: formData.phoneMobile || undefined,
            phoneFixed: formData.phoneFixed || undefined,
            ddi: formData.ddi || undefined,
          }),
        })

        if (res.ok) {
          const data = await res.json()
          setSuccess(
            `User created successfully${data.password ? `. Temporary password: ${data.password}` : ''}`,
          )
          await loadTenantUsers()
          setTimeout(() => {
            handleCancel()
          }, 2000)
        } else {
          const data = await res.json()
          setError(data.message || 'Failed to create user')
        }
      }
    } catch (error) {
      console.error('Error saving user:', error)
      setError('An error occurred while saving the user')
    }
  }

  const handleDeleteUser = async (user: TenantUser) => {
    if (
      !confirm(`Are you sure you want to delete ${user.fullName}? This action cannot be undone.`)
    ) {
      return
    }

    try {
      const res = await fetch(`/api/tenant-users/${user.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('User deleted successfully')
        await loadTenantUsers()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete user')
      }
    } catch (error) {
      console.error('Error deleting user:', error)
      setError('An error occurred while deleting the user')
    }
  }

  const handleQuickRoleChange = async (user: TenantUser, newRoleId: string) => {
    const currentRoleId =
      typeof user.role === 'object' && user.role && 'id' in user.role
        ? String(user.role.id)
        : typeof user.role === 'number' || typeof user.role === 'string'
          ? String(user.role)
          : ''

    if (currentRoleId === newRoleId) return

    try {
      const res = await fetch(`/api/tenant-users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: Number(newRoleId) }),
      })

      if (res.ok) {
        const role = roles.find((r) => r.id === Number(newRoleId))
        setSuccess(`User role updated to ${role?.name || 'new role'}`)
        await loadTenantUsers()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to update user role')
      }
    } catch (error) {
      console.error('Error updating user role:', error)
      setError('An error occurred while updating user role')
    }
  }

  const handleSuspendToggle = async (user: TenantUser) => {
    const newStatus = user.status === 'suspended' ? 'active' : 'suspended'
    const action = newStatus === 'suspended' ? 'suspend' : 'unsuspend'

    if (!confirm(`Are you sure you want to ${action} ${user.fullName}?`)) {
      return
    }

    try {
      const res = await fetch(`/api/tenant-users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (res.ok) {
        setSuccess(`User ${action}ed successfully`)
        await loadTenantUsers()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || `Failed to ${action} user`)
      }
    } catch (error) {
      console.error(`Error ${action}ing user:`, error)
      setError(`An error occurred while ${action}ing the user`)
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">Manage users for {tenant.companyName}</p>
        </div>
        {!showAddForm && (
          <Button onClick={handleAddUser} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        )}
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      )}

      {/* Add/Edit User Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingUser ? 'Edit User' : 'Add New User'}</CardTitle>
            <CardDescription>
              {editingUser ? 'Update user information' : 'Create a new user for this tenant'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    required
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role *</Label>
                  {loadingRoles ? (
                    <div className="text-sm text-muted-foreground py-2">Loading roles...</div>
                  ) : (
                    <select
                      id="role"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                      required
                    >
                      <option value="">Select a role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="Job title"
                  />
                </div>
                <div>
                  <Label htmlFor="password">
                    {editingUser
                      ? 'New Password (leave blank to keep current)'
                      : 'Password (leave blank to auto-generate)'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder={editingUser ? 'New password' : 'Auto-generated if blank'}
                  />
                </div>
                <div>
                  <Label htmlFor="phoneMobile">Mobile Phone</Label>
                  <Input
                    id="phoneMobile"
                    type="tel"
                    value={formData.phoneMobile}
                    onChange={(e) => setFormData({ ...formData, phoneMobile: e.target.value })}
                    placeholder="+61 4XX XXX XXX"
                  />
                </div>
                <div>
                  <Label htmlFor="phoneFixed">Fixed Phone</Label>
                  <Input
                    id="phoneFixed"
                    type="tel"
                    value={formData.phoneFixed}
                    onChange={(e) => setFormData({ ...formData, phoneFixed: e.target.value })}
                    placeholder="+61 2 XXXX XXXX"
                  />
                </div>
                <div>
                  <Label htmlFor="ddi">DDI</Label>
                  <Input
                    id="ddi"
                    value={formData.ddi}
                    onChange={(e) => setFormData({ ...formData, ddi: e.target.value })}
                    placeholder="Extension"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button type="submit">
                  <Save className="h-4 w-4 mr-2" />
                  {editingUser ? 'Update User' : 'Create User'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users ({tenantUsers.length})
          </CardTitle>
          <CardDescription>Manage users and their roles</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingUsers ? (
            <div className="text-center py-8 text-muted-foreground">Loading users...</div>
          ) : tenantUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No users found</div>
          ) : (
            <div className="space-y-4">
              {tenantUsers.map((user) => {
                const currentRoleId =
                  typeof user.role === 'object' && user.role && 'id' in user.role
                    ? String(user.role.id)
                    : typeof user.role === 'number' || typeof user.role === 'string'
                      ? String(user.role)
                      : ''

                return (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className={`flex justify-center items-center rounded-full w-10 h-10 flex-shrink-0 ${
                            user.status === 'suspended' ? 'bg-gray-300' : 'bg-primary'
                          }`}
                        >
                          <Users
                            className={`w-5 h-5 ${
                              user.status === 'suspended'
                                ? 'text-gray-600'
                                : 'text-primary-foreground'
                            }`}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3
                              className={`font-semibold text-lg truncate ${
                                user.status === 'suspended'
                                  ? 'text-muted-foreground line-through'
                                  : ''
                              }`}
                            >
                              {user.fullName}
                            </h3>
                            {user.status === 'suspended' && (
                              <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800 font-medium">
                                Suspended
                              </span>
                            )}
                            {user.status !== 'suspended' && (
                              <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 font-medium">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-800">
                              {user.roleName || 'No role'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5 text-sm text-muted-foreground ml-13">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </div>
                        {user.position && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="h-4 w-4 flex-shrink-0" />
                            <span>{user.position}</span>
                          </div>
                        )}
                        {(user.phoneMobile || user.phoneFixed) && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 flex-shrink-0" />
                            <span>{user.phoneMobile || user.phoneFixed}</span>
                            {user.ddi && <span className="text-xs">(DDI: {user.ddi})</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      {/* Quick Role Change */}
                      <div className="relative">
                        {loadingRoles ? (
                          <div className="text-sm text-muted-foreground py-2">Loading...</div>
                        ) : (
                          <select
                            value={currentRoleId}
                            onChange={(e) => handleQuickRoleChange(user, e.target.value)}
                            disabled={currentUser?.id === user.id}
                            className="flex h-9 w-full sm:w-auto rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]"
                          >
                            <option value="">Select role</option>
                            {roles.map((role) => (
                              <option key={role.id} value={role.id}>
                                {role.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(user)}
                          className="min-h-[44px] flex-1 sm:flex-initial"
                        >
                          <Edit className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>

                        {/* Suspend/Unsuspend Button */}
                        {currentUser?.id !== user.id && (
                          <Button
                            variant={user.status === 'suspended' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleSuspendToggle(user)}
                            className={`min-h-[44px] ${
                              user.status === 'suspended' ? 'bg-green-600 hover:bg-green-700' : ''
                            }`}
                          >
                            {user.status === 'suspended' ? (
                              <>
                                <UserCheck className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Unsuspend</span>
                              </>
                            ) : (
                              <>
                                <UserX className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Deactivate</span>
                              </>
                            )}
                          </Button>
                        )}

                        {/* Delete Button */}
                        {currentUser?.id !== user.id && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteUser(user)}
                            className="min-h-[44px] flex-1 sm:flex-initial"
                          >
                            <Trash2 className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Delete</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
