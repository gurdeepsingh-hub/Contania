'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading } = useAuth()
  const hasRedirected = useRef(false)

  useEffect(() => {
    // Wait for auth to finish loading
    if (isLoading) return

    // Prevent multiple redirects
    if (hasRedirected.current) return

    // Check if user is authenticated and is super admin
    if (!isAuthenticated || !user || (user as { role?: string }).role !== 'superadmin') {
      // Redirect to signin if not authenticated or not super admin
      hasRedirected.current = true
      router.replace('/signin')
      return
    }
  }, [isLoading, isAuthenticated, user, router])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  // Don't render children if not authenticated (will redirect)
  if (!isAuthenticated || !user || (user as { role?: string }).role !== 'superadmin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Redirecting...</div>
      </div>
    )
  }

  return <>{children}</>
}
