'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
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
  inboundJobNumber?: string
  warehouseId?: number
  customerId?: string
  customerToId?: string
  customerFromId?: string
  requiredDateTime?: string
  orderNotes?: string
  palletCount?: number
}

export default function EditOutboundJobPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [job, setJob] = useState<OutboundJob | null>(null)
  const [loadingJob, setLoadingJob] = useState(false)
  const jobId = params.id as string

  useEffect(() => {
    if (jobId && !loading && tenant) {
      loadJob()
    }
  }, [jobId, loading, tenant])

  const loadJob = async () => {
    try {
      setLoadingJob(true)
      const res = await fetch(`/api/outbound-inventory/${jobId}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          const jobData = data.job as OutboundJob & {
            warehouseId?: number | { id: number }
          }
          // Normalize warehouseId - extract ID if it's a relationship object
          if (jobData.warehouseId) {
            if (typeof jobData.warehouseId === 'object' && 'id' in jobData.warehouseId) {
              jobData.warehouseId = jobData.warehouseId.id
            }
          }
          setJob(jobData)
        }
      }
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setLoadingJob(false)
    }
  }

  const handleSave = async (data: OutboundJob) => {
    try {
      const res = await fetch(`/api/outbound-inventory/${jobId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Job updated successfully')
          router.push(`/dashboard/freight/outbound/${jobId}`)
        }
      } else {
        toast.error('Failed to update job')
      }
    } catch (error) {
      console.error('Error updating job:', error)
      toast.error('Failed to update job')
    }
  }

  if (loading || loadingJob) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!tenant || !job) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Job not found</div>
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
          <h1 className="text-3xl font-bold">Edit Outbound Job</h1>
          <p className="text-muted-foreground">Update outbound inventory job details</p>
        </div>
      </div>

      <MultistepOutboundForm initialData={job} onSave={handleSave} />
    </div>
  )
}


