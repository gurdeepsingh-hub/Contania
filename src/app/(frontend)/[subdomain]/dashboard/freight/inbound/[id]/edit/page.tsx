'use client'

import { useRouter, useParams } from 'next/navigation'
import { useTenant } from '@/lib/tenant-context'
import { MultistepInboundForm } from '@/components/freight/multistep-inbound-form'
import { useEffect, useState } from 'react'
import { hasViewPermission } from '@/lib/permissions'
import { toast } from 'sonner'

type InboundInventoryData = {
  id?: number
  jobCode?: string
  expectedDate?: string
  deliveryCustomerReferenceNumber?: string
  orderingCustomerReferenceNumber?: string
  deliveryCustomerId?: string
  warehouseId?: number
  transportMode?: 'our' | 'third_party'
  notes?: string
  supplierId?: string
  transportCompanyId?: number
  chep?: number
  loscam?: number
  plain?: number
  palletTransferDocket?: string
  customerName?: string
  customerAddress?: string
  customerLocation?: string
  customerContactName?: string
  supplierName?: string
  supplierAddress?: string
  supplierLocation?: string
  supplierContactName?: string
  transportContact?: string
  transportMobile?: string
}

export default function EditInboundJobPage() {
  const router = useRouter()
  const params = useParams()
  const { tenant, loading } = useTenant()
  const [authChecked, setAuthChecked] = useState(false)
  const [loadingJob, setLoadingJob] = useState(true)
  const [initialData, setInitialData] = useState<InboundInventoryData | null>(null)
  const jobId = params.id as string

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

  useEffect(() => {
    if (authChecked && jobId) {
      loadJob()
    }
  }, [authChecked, jobId])

  const loadJob = async () => {
    try {
      setLoadingJob(true)
      const res = await fetch(`/api/inbound-inventory/${jobId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job) {
          const job = data.job
          // Check if job is already completed
          if (job.completedDate) {
            toast.error('Cannot edit a completed job')
            router.push(`/dashboard/freight/inbound/${jobId}`)
            return
          }
          // Transform job data to match form structure
          const warehouseIdValue =
            job.warehouseId && typeof job.warehouseId === 'object' && 'id' in job.warehouseId
              ? job.warehouseId.id
              : typeof job.warehouseId === 'number'
                ? job.warehouseId
                : undefined

          const transportCompanyIdValue =
            job.transportCompanyId &&
            typeof job.transportCompanyId === 'object' &&
            'id' in job.transportCompanyId
              ? job.transportCompanyId.id
              : typeof job.transportCompanyId === 'number'
                ? job.transportCompanyId
                : undefined

          setInitialData({
            id: job.id,
            jobCode: job.jobCode,
            expectedDate: job.expectedDate,
            deliveryCustomerReferenceNumber: job.deliveryCustomerReferenceNumber,
            orderingCustomerReferenceNumber: job.orderingCustomerReferenceNumber,
            deliveryCustomerId: job.deliveryCustomerId,
            warehouseId: warehouseIdValue,
            transportMode: job.transportMode as 'our' | 'third_party' | undefined,
            notes: job.notes,
            supplierId: job.supplierId,
            transportCompanyId: transportCompanyIdValue,
            chep: job.chep,
            loscam: job.loscam,
            plain: job.plain,
            palletTransferDocket: job.palletTransferDocket,
            customerName: job.customerName,
            customerAddress: job.customerAddress,
            customerLocation: job.customerLocation,
            customerContactName: job.customerContactName,
            supplierName: job.supplierName,
            supplierAddress: job.supplierAddress,
            supplierLocation: job.supplierLocation,
            supplierContactName: job.supplierContactName,
            transportContact: job.transportContact,
            transportMobile: job.transportMobile,
          })
        }
      } else {
        toast.error('Failed to load job')
        router.push('/dashboard/freight/inbound')
      }
    } catch (error) {
      console.error('Error loading job:', error)
      toast.error('Failed to load job')
      router.push('/dashboard/freight/inbound')
    } finally {
      setLoadingJob(false)
    }
  }

  const handleSave = async (data: InboundInventoryData, action: 'save' | 'receive') => {
    try {
      const url = `/api/inbound-inventory/${jobId}`
      const method = 'PUT'

      // Convert datetime-local string to ISO date string if present
      const dataToSend = {
        ...data,
        expectedDate: data.expectedDate
          ? new Date(data.expectedDate).toISOString()
          : data.expectedDate,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Job updated successfully')
          if (action === 'receive') {
            // Save and redirect to receive page
            router.push(`/dashboard/freight/inbound/${jobId}/receive`)
          } else {
            // Save and redirect to detail page
            router.push(`/dashboard/freight/inbound/${jobId}`)
          }
        }
      } else {
        const errorData = await res.json()
        throw new Error(errorData.message || 'Failed to save')
      }
    } catch (error) {
      console.error('Error saving:', error)
      throw error
    }
  }

  const handleCancel = () => {
    router.push(`/dashboard/freight/inbound/${jobId}`)
  }

  if (loading || !authChecked || loadingJob) {
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

  if (!initialData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Job not found</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Edit Inbound Job</h1>
      <MultistepInboundForm initialData={initialData} onSave={handleSave} onCancel={handleCancel} />
    </div>
  )
}

