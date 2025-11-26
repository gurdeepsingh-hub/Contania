'use client'

import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { MultistepInboundForm } from '@/components/freight/multistep-inbound-form'
import { useEffect, useState } from 'react'
import { hasViewPermission } from '@/lib/permissions'

export default function NewInboundJobPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)

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
          const fullUserRes = await fetch(`/api/tenant-users/${data.user.id}?depth=1`)
          if (fullUserRes.ok) {
            const fullUserData = await fullUserRes.json()
            if (fullUserData.success && fullUserData.user) {
              if (!hasViewPermission(fullUserData.user, 'freight')) {
                router.push('/dashboard')
                return
              }
            }
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

  const handleSave = async (data: any, action: 'save' | 'receive') => {
    try {
      const url = data.id ? `/api/inbound-inventory/${data.id}` : '/api/inbound-inventory'
      const method = data.id ? 'PUT' : 'POST'

      // Convert datetime-local string to ISO date string if present
      const dataToSave = {
        ...data,
        expectedDate: data.expectedDate
          ? new Date(data.expectedDate).toISOString()
          : data.expectedDate,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          if (action === 'receive') {
            // Save and redirect to receive page
            router.push(`/dashboard/freight/inbound/${result.job.id}/receive`)
          } else {
            // Save and redirect to detail page
            router.push(`/dashboard/freight/inbound/${result.job.id}`)
          }
        }
      } else {
        throw new Error('Failed to save')
      }
    } catch (error) {
      console.error('Error saving:', error)
      throw error
    }
  }

  const handleCancel = () => {
    router.push('/dashboard/freight/inbound')
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
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">New Inbound Job</h1>
      <MultistepInboundForm onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}






