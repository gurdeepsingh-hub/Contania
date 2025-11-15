'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Cog, 
  Building2, 
  UserCog, 
  Users, 
  Palette, 
  Shield, 
  ArrowRight,
  Settings as SettingsIcon
} from 'lucide-react'
import { hasViewPermission, canManageUsers, canManageRoles } from '@/lib/permissions'

type TenantUser = {
  id?: number | string
  role?: number | string | { id: number; permissions?: Record<string, boolean> }
  [key: string]: unknown
}

export default function SettingsPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [currentUser, setCurrentUser] = useState<TenantUser | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/tenant-users/me')
        if (!res.ok) {
          router.push('/')
          return
        }
        const data = await res.json()
        if (data.success && data.user) {
          // Fetch full user with role populated
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
        router.push('/')
      }
    }

    if (!loading && tenant) {
      checkAuth()
    }
  }, [loading, tenant, router])

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

  const settingsSections = [
    {
      id: 'entity-settings',
      title: 'Entity Settings',
      description: 'Manage company information and entity details',
      icon: Building2,
      href: '/dashboard/settings/entity-settings',
      enabled: hasViewPermission(currentUser, 'settings') && 
               (hasViewPermission(currentUser, 'settings_entity_settings') || canManageRoles(currentUser)),
    },
    {
      id: 'user-settings',
      title: 'User Settings',
      description: 'Configure user preferences and account settings',
      icon: UserCog,
      href: '/dashboard/settings/user-settings',
      enabled: hasViewPermission(currentUser, 'settings') && 
               (hasViewPermission(currentUser, 'settings_user_settings') || canManageRoles(currentUser)),
    },
    {
      id: 'tenant-users',
      title: 'Tenant Users',
      description: 'Manage users and their access to the platform',
      icon: Users,
      href: '/dashboard/settings/tenant-users',
      enabled: hasViewPermission(currentUser, 'settings') && canManageUsers(currentUser),
    },
    {
      id: 'personalization',
      title: 'Personalization',
      description: 'Customize your dashboard and preferences',
      icon: Palette,
      href: '/dashboard/settings/personalization',
      enabled: hasViewPermission(currentUser, 'settings') && 
               (hasViewPermission(currentUser, 'settings_personalization') || canManageRoles(currentUser)),
    },
    {
      id: 'user-roles',
      title: 'User Roles',
      description: 'Create and manage roles with custom permissions',
      icon: Shield,
      href: '/dashboard/settings/user-roles',
      enabled: hasViewPermission(currentUser, 'settings') && canManageRoles(currentUser),
    },
  ].filter((section) => section.enabled)

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your tenant settings and preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {settingsSections.map((section) => {
          const Icon = section.icon
          return (
            <Card 
              key={section.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => router.push(section.href)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground" />
                </div>
                <CardTitle className="mt-4">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(section.href)
                  }}
                >
                  Manage
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {settingsSections.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>You don't have access to any settings sections.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

