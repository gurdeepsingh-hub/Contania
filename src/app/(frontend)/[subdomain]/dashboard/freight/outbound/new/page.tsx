'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { MultistepOutboundForm } from '@/components/freight/multistep-outbound-form'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

type OutboundJob = {
  id?: number
  jobCode?: string
  status?: string
  customerRefNumber?: string
  consigneeRefNumber?: string
  containerNumber?: string
  inspectionNumber?: string
  warehouseId?: number
  customerId?: string
  customerToId?: string
  customerFromId?: string
  requiredDateTime?: string
  orderNotes?: string
  palletCount?: number
}

export default function NewOutboundJobPage() {
  const router = useRouter()
  const { tenant, loading } = useTenant()

  const handleSave = async (data: OutboundJob) => {
    try {
      const res = await fetch('/api/outbound-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success && result.job?.id) {
          toast.success('Job created successfully')
          router.push(`/dashboard/freight/outbound/${result.job.id}`)
        }
      } else {
        toast.error('Failed to create job')
      }
    } catch (error) {
      console.error('Error creating job:', error)
      toast.error('Failed to create job')
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Tenant not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push('/dashboard/freight/outbound')}
          className="w-8 h-8 !bg-blue-500 text-white hover:bg-blue-600 !rounded-full !sm:rounded-xl"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">New Outbound Job</h1>
          <p className="text-muted-foreground">Create a new outbound inventory job</p>
        </div>
      </div>

      <MultistepOutboundForm onSave={handleSave} />
    </div>
  )
}

