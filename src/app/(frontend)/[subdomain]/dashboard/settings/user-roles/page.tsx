'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FormInput } from '@/components/ui/form-field'
import { Label } from '@/components/ui/label'
import { Shield, Plus, Edit, Trash2, X, Save, ArrowLeft, Lock, AlertCircle } from 'lucide-react'
import { canManageRoles } from '@/lib/permissions'

type Role = {
  id: number
  name: string
  description?: string
  isSystemRole?: boolean
  isActive?: boolean
  permissions?: Record<string, boolean>
}

const PERMISSION_SECTIONS = [
  {
    section: 'Dashboard',
    permissions: [
      { key: 'dashboard_view', label: 'View Dashboard' },
      { key: 'dashboard_edit', label: 'Edit Dashboard' },
    ],
  },
  {
    section: 'Containers',
    permissions: [
      { key: 'containers_view', label: 'View Containers' },
      { key: 'containers_create', label: 'Create Containers' },
      { key: 'containers_edit', label: 'Edit Containers' },
      { key: 'containers_delete', label: 'Delete Containers' },
    ],
  },
  {
    section: 'Inventory',
    permissions: [
      { key: 'inventory_view', label: 'View Inventory' },
      { key: 'inventory_create', label: 'Create Inventory' },
      { key: 'inventory_edit', label: 'Edit Inventory' },
      { key: 'inventory_delete', label: 'Delete Inventory' },
    ],
  },
  {
    section: 'Transportation',
    permissions: [
      { key: 'transportation_view', label: 'View Transportation' },
      { key: 'transportation_create', label: 'Create Transportation' },
      { key: 'transportation_edit', label: 'Edit Transportation' },
      { key: 'transportation_delete', label: 'Delete Transportation' },
    ],
  },
  {
    section: 'Freight',
    permissions: [
      { key: 'freight_view', label: 'View Freight' },
      { key: 'freight_create', label: 'Create Freight' },
      { key: 'freight_edit', label: 'Edit Freight' },
      { key: 'freight_delete', label: 'Delete Freight' },
    ],
  },
  {
    section: 'Live Map',
    permissions: [
      { key: 'map_view', label: 'View Live Map' },
      { key: 'map_edit', label: 'Edit Live Map' },
    ],
  },
  {
    section: 'Reports',
    permissions: [
      { key: 'reports_view', label: 'View Reports' },
      { key: 'reports_create', label: 'Create Reports' },
      { key: 'reports_delete', label: 'Delete Reports' },
    ],
  },
  {
    section: 'Settings',
    permissions: [
      { key: 'settings_view', label: 'View Settings' },
      { key: 'settings_manage_users', label: 'Manage Tenant Users' },
      { key: 'settings_manage_roles', label: 'Manage Roles' },
      { key: 'settings_entity_settings', label: 'Entity Settings' },
      { key: 'settings_user_settings', label: 'User Settings' },
      { key: 'settings_personalization', label: 'Personalization' },
    ],
  },
]

export default function UserRolesPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [checkingUsage, setCheckingUsage] = useState<number | null>(null)
  const [isDevelopmentMode, setIsDevelopmentMode] = useState(false)

  const roleSchema = z.object({
    name: z
      .string()
      .min(1, 'Role name is required')
      .max(100, 'Role name must be less than 100 characters'),
    description: z
      .string()
      .max(500, 'Description must be less than 500 characters')
      .optional()
      .or(z.literal('')),
    permissions: z.record(z.string(), z.boolean()),
  })

  type RoleFormData = z.infer<typeof roleSchema>

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      name: '',
      description: '',
      permissions: {} as Record<string, boolean>,
    },
  })

  const watchedPermissions = watch('permissions')

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
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              if (!canManageRoles(fullUserData.user)) {
                router.push('/dashboard/settings')
                return
              }
              setAuthChecked(true)
              return
            }
          }
          setAuthChecked(true)
        }
      } catch {
        router.push('/dashboard')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

  useEffect(() => {
    if (authChecked) {
      loadRoles()
      // Check if we're in development mode
      setIsDevelopmentMode(
        process.env.NODE_ENV === 'development' ||
          (typeof window !== 'undefined' && window.location.hostname === 'localhost'),
      )
    }
  }, [authChecked])

  const loadRoles = async () => {
    try {
      setLoadingRoles(true)
      const res = await fetch('/api/tenant-roles')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.roles) {
          setRoles(data.roles)
        }
      }
    } catch (error) {
      console.error('Error loading roles:', error)
    } finally {
      setLoadingRoles(false)
    }
  }

  const resetForm = () => {
    reset({
      name: '',
      description: '',
      permissions: {},
    })
    setError(null)
    setSuccess(null)
  }

  const handleAddRole = () => {
    resetForm()
    setShowAddForm(true)
    setEditingRole(null)
  }

  const handleEditRole = (role: Role) => {
    reset({
      name: role.name,
      description: role.description || '',
      permissions: role.permissions || {},
    })
    setEditingRole(role)
    setShowAddForm(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingRole(null)
    resetForm()
  }

  const togglePermission = (permissionKey: string) => {
    const currentValue = watchedPermissions[permissionKey] || false
    setValue(`permissions.${permissionKey}`, !currentValue, { shouldValidate: true })
  }

  const checkRoleUsage = async (roleId: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/tenant-users?depth=0')
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.users) {
          const usersWithRole = data.users.filter(
            (user: { role?: number | string | { id: number } }) => {
              const role = user.role
              const roleIdValue =
                typeof role === 'object' && role && 'id' in role
                  ? role.id
                  : typeof role === 'number' || typeof role === 'string'
                    ? Number(role)
                    : null
              return roleIdValue === roleId
            },
          )
          return usersWithRole.length > 0
        }
      }
      return false
    } catch (error) {
      console.error('Error checking role usage:', error)
      return true // Assume in use to prevent deletion
    }
  }

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystemRole && !isDevelopmentMode) {
      setError('System roles cannot be deleted')
      return
    }

    setCheckingUsage(role.id)
    const inUse = await checkRoleUsage(role.id)
    setCheckingUsage(null)

    if (inUse) {
      setError('Cannot delete role that is assigned to users')
      return
    }

    if (
      !confirm(
        `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`,
      )
    ) {
      return
    }

    try {
      const res = await fetch(`/api/tenant-roles/${role.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setSuccess('Role deleted successfully')
        await loadRoles()
        setTimeout(() => setSuccess(null), 2000)
      } else {
        const data = await res.json()
        setError(data.message || 'Failed to delete role')
      }
    } catch (error) {
      console.error('Error deleting role:', error)
      setError('An error occurred while deleting the role')
    }
  }

  const onSubmit = async (data: RoleFormData) => {
    setError(null)
    setSuccess(null)

    try {
      if (editingRole) {
        // Update role
        const res = await fetch(`/api/tenant-roles/${editingRole.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            permissions: data.permissions,
          }),
        })

        if (res.ok) {
          setSuccess('Role updated successfully')
          await loadRoles()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to update role')
        }
      } else {
        // Create role
        const res = await fetch('/api/tenant-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            permissions: data.permissions,
          }),
        })

        if (res.ok) {
          setSuccess('Role created successfully')
          await loadRoles()
          setTimeout(() => {
            handleCancel()
          }, 1500)
        } else {
          const responseData = await res.json()
          setError(responseData.message || 'Failed to create role')
        }
      }
    } catch (error) {
      console.error('Error saving role:', error)
      setError('An error occurred while saving the role')
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            User Roles
          </h1>
          <p className="text-muted-foreground">Create and manage roles with custom permissions</p>
        </div>
        {!showAddForm && (
          <Button onClick={handleAddRole} className="min-h-[44px]">
            <Plus className="h-4 w-4 mr-2" />
            Add Role
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
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Add/Edit Role Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingRole ? 'Edit Role' : 'Add New Role'}</CardTitle>
            <CardDescription>
              {editingRole && editingRole.isSystemRole && !isDevelopmentMode && (
                <span className="text-amber-600 flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  This is a system role and cannot be edited
                </span>
              )}
              {editingRole && editingRole.isSystemRole && isDevelopmentMode && (
                <span className="text-blue-600 flex items-center gap-1">
                  <Lock className="h-4 w-4" />
                  Development mode: System role editing enabled
                </span>
              )}
              {editingRole
                ? editingRole.isSystemRole && !isDevelopmentMode
                  ? 'System roles cannot be modified'
                  : 'Update role information and permissions'
                : 'Create a new role for this tenant'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormInput
                  label="Role Name"
                  required
                  error={errors.name?.message}
                  disabled={editingRole?.isSystemRole && !isDevelopmentMode}
                  placeholder="e.g., Manager, Dispatcher"
                  {...register('name')}
                />
                <FormInput
                  label="Description"
                  error={errors.description?.message}
                  disabled={editingRole?.isSystemRole && !isDevelopmentMode}
                  placeholder="Optional role description"
                  {...register('description')}
                />
              </div>

              {/* Permissions Matrix */}
              <div>
                <Label className="text-base font-semibold mb-4 block">Permissions</Label>
                <div className="space-y-6">
                  {PERMISSION_SECTIONS.map((section) => (
                    <Card key={section.section}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg">{section.section}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {section.permissions.map((permission) => (
                            <label
                              key={permission.key}
                              className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(watchedPermissions?.[permission.key])}
                                onChange={() => togglePermission(permission.key)}
                                disabled={editingRole?.isSystemRole && !isDevelopmentMode}
                                className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                              />
                              <span className="text-sm">{permission.label}</span>
                            </label>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                {(!editingRole?.isSystemRole || isDevelopmentMode) && (
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingRole ? 'Update Role' : 'Create Role'}
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Roles List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Roles ({roles.length})
          </CardTitle>
          <CardDescription>Manage roles and their permissions</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRoles ? (
            <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
          ) : roles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles found. Create your first role to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {roles.map((role) => (
                <div
                  key={role.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex justify-center items-center rounded-full w-10 h-10 shrink-0 bg-primary">
                        <Shield className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg truncate">{role.name}</h3>
                          {role.isSystemRole && (
                            <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 font-medium flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              System Role
                            </span>
                          )}
                          {role.isActive === false && (
                            <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800 font-medium">
                              Inactive
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-sm text-muted-foreground mt-1">{role.description}</p>
                        )}
                        <div className="mt-2">
                          <span className="text-xs text-muted-foreground">
                            {Object.values(role.permissions || {}).filter(Boolean).length}{' '}
                            permissions enabled
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRole(role)}
                      className="min-h-[44px]"
                      disabled={role.isSystemRole && !isDevelopmentMode}
                    >
                      <Edit className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">
                        {role.isSystemRole && !isDevelopmentMode ? 'View' : 'Edit'}
                      </span>
                    </Button>
                    {(!role.isSystemRole || isDevelopmentMode) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteRole(role)}
                        disabled={checkingUsage === role.id}
                        className="min-h-[44px]"
                      >
                        {checkingUsage === role.id ? (
                          <>Checking...</>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 sm:mr-2" />
                            <span className="hidden sm:inline">Delete</span>
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
