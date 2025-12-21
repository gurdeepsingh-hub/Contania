'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { FormCombobox } from '@/components/ui/form-field'
// Note: Install sonner for toast notifications: pnpm add sonner
// For now using alert as fallback
const toast = {
  success: (message: string) => alert(message),
  error: (message: string) => alert(message),
}

type Customer = {
  id: number
  customer_name: string
  street?: string
  city?: string
  state?: string
  postcode?: string
  contact_name?: string
}

type PayingCustomer = {
  id: number
  customer_name: string
  delivery_street?: string
  delivery_city?: string
  delivery_state?: string
  delivery_postcode?: string
  billing_street?: string
  billing_city?: string
  billing_state?: string
  billing_postcode?: string
  delivery_same_as_billing?: boolean
  contact_name?: string
}

type UnifiedCustomerOption = {
  value: string // Format: "collection:id"
  label: string
  collection: 'customers' | 'paying-customers' | 'warehouses'
  id: number
}

type InboundJobData = {
  jobCode?: string
  deliveryCustomerReferenceNumber?: string
  orderingCustomerReferenceNumber?: string
  deliveryCustomerId?: string
  supplierId?: string
  expectedDate?: string
  completedDate?: string
  notes?: string
  customerName?: string
  customerAddress?: string
  customerLocation?: string
  customerState?: string
  customerContactName?: string
  supplierName?: string
  supplierAddress?: string
  supplierLocation?: string
  supplierState?: string
  supplierContactName?: string
}

type OutboundJobData = {
  jobCode?: string
  customerRefNumber?: string
  consigneeRefNumber?: string
  containerNumber?: string
  inspectionNumber?: string
  inboundJobNumber?: string
  customerId?: string // Format: "collection:id"
  customerToId?: string // Format: "collection:id"
  customerFromId?: string // Format: "collection:id"
  requiredDateTime?: string
  orderNotes?: string
  palletCount?: number
  customerName?: string
  customerLocation?: string
  customerState?: string
  customerContact?: string
  customerToName?: string
  customerToLocation?: string
  customerToState?: string
  customerToContact?: string
  customerFromName?: string
  customerFromLocation?: string
  customerFromState?: string
  customerFromContact?: string
}

type JobEditDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobType: 'inbound' | 'outbound'
  jobId: number
  initialData?: InboundJobData | OutboundJobData
  onSuccess: () => void
}

export function JobEditDialog({
  open,
  onOpenChange,
  jobType,
  jobId,
  initialData,
  onSuccess,
}: JobEditDialogProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomerOption[]>([])
  const [unifiedDestinations, setUnifiedDestinations] = useState<UnifiedCustomerOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const { register, handleSubmit, reset, watch, setValue } = useForm()

  // Watch customer fields for outbound jobs
  const customerId = watch('customerId')
  const customerToId = watch('customerToId')
  const customerFromId = watch('customerFromId')
  const deliveryCustomerId = watch('deliveryCustomerId')
  const supplierId = watch('supplierId')

  useEffect(() => {
    if (open && jobId) {
      loadOptions()
      // Always fetch full job data to get customer IDs and all fields
      fetchJob()
    } else {
      reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId, jobType])

  const handleCustomerChange = useCallback(async (
    field: 'customerId' | 'customerToId' | 'customerFromId',
    customerValue: string,
  ) => {
    const [collection, idStr] = customerValue.split(':')
    const customerId = parseInt(idStr, 10)

    if (!collection || !customerId) return

    try {
      if (collection === 'warehouses') {
        const res = await fetch(`/api/warehouses/${customerId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.warehouse) {
            const wh = data.warehouse as { name?: string; city?: string; state?: string }
            if (field === 'customerToId') {
              setValue('customerToName', wh.name || '')
              setValue('customerToLocation', wh.city || '')
              setValue('customerToState', wh.state || '')
            } else if (field === 'customerFromId') {
              setValue('customerFromName', wh.name || '')
              setValue('customerFromLocation', wh.city || '')
              setValue('customerFromState', wh.state || '')
            }
          }
        }
      } else if (collection === 'customers' || collection === 'paying-customers') {
        const apiPath =
          collection === 'customers'
            ? `/api/customers/${customerId}`
            : `/api/paying-customers/${customerId}`
        const res = await fetch(apiPath)
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            if (field === 'customerId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setValue('customerName', cust.customer_name)
                setValue('customerLocation', [cust.city, cust.state].filter(Boolean).join(', '))
                setValue('customerState', cust.state || '')
                setValue('customerContact', cust.contact_name || '')
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setValue('customerName', cust.customer_name)
                setValue('customerLocation', [city, state].filter(Boolean).join(', '))
                setValue('customerState', state || '')
                setValue('customerContact', cust.contact_name || '')
              }
            } else if (field === 'customerToId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setValue('customerToName', cust.customer_name)
                setValue('customerToLocation', [cust.city, cust.state].filter(Boolean).join(', '))
                setValue('customerToState', cust.state || '')
                setValue('customerToContact', cust.contact_name || '')
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setValue('customerToName', cust.customer_name)
                setValue('customerToLocation', [city, state].filter(Boolean).join(', '))
                setValue('customerToState', state || '')
                setValue('customerToContact', cust.contact_name || '')
              }
            } else if (field === 'customerFromId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setValue('customerFromName', cust.customer_name)
                setValue('customerFromLocation', [cust.city, cust.state].filter(Boolean).join(', '))
                setValue('customerFromState', cust.state || '')
                setValue('customerFromContact', cust.contact_name || '')
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setValue('customerFromName', cust.customer_name)
                setValue('customerFromLocation', [city, state].filter(Boolean).join(', '))
                setValue('customerFromState', state || '')
                setValue('customerFromContact', cust.contact_name || '')
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer details:', error)
    }
  }, [setValue])

  const handleInboundCustomerChange = useCallback(async (
    field: 'deliveryCustomerId' | 'supplierId',
    customerValue: string,
  ) => {
    const [collection, idStr] = customerValue.split(':')
    const customerId = parseInt(idStr, 10)

    if (!collection || !customerId) return

    try {
      if (collection === 'customers' || collection === 'paying-customers') {
        const apiPath =
          collection === 'customers'
            ? `/api/customers/${customerId}`
            : `/api/paying-customers/${customerId}`
        const res = await fetch(apiPath)
        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            if (field === 'deliveryCustomerId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setValue('customerName', cust.customer_name)
                setValue('customerAddress', [cust.street, cust.city, cust.state, cust.postcode].filter(Boolean).join(', '))
                setValue('customerLocation', [cust.city, cust.state].filter(Boolean).join(', '))
                setValue('customerState', cust.state || '')
                setValue('customerContactName', cust.contact_name || '')
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const street =
                  cust.delivery_street ||
                  (cust.delivery_same_as_billing ? cust.billing_street : undefined)
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                const postcode =
                  cust.delivery_postcode ||
                  (cust.delivery_same_as_billing ? cust.billing_postcode : undefined)
                setValue('customerName', cust.customer_name)
                setValue('customerAddress', [street, city, state, postcode].filter(Boolean).join(', '))
                setValue('customerLocation', [city, state].filter(Boolean).join(', '))
                setValue('customerState', state || '')
                setValue('customerContactName', cust.contact_name || '')
              }
            } else if (field === 'supplierId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setValue('supplierName', cust.customer_name)
                setValue('supplierAddress', [cust.street, cust.city, cust.state, cust.postcode].filter(Boolean).join(', '))
                setValue('supplierLocation', [cust.city, cust.state].filter(Boolean).join(', '))
                setValue('supplierState', cust.state || '')
                setValue('supplierContactName', cust.contact_name || '')
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const street =
                  cust.delivery_street ||
                  (cust.delivery_same_as_billing ? cust.billing_street : undefined)
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                const postcode =
                  cust.delivery_postcode ||
                  (cust.delivery_same_as_billing ? cust.billing_postcode : undefined)
                setValue('supplierName', cust.customer_name)
                setValue('supplierAddress', [street, city, state, postcode].filter(Boolean).join(', '))
                setValue('supplierLocation', [city, state].filter(Boolean).join(', '))
                setValue('supplierState', state || '')
                setValue('supplierContactName', cust.contact_name || '')
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer details:', error)
    }
  }, [setValue])

  // Handle customer changes for outbound jobs
  useEffect(() => {
    if (jobType === 'outbound' && customerId) {
      handleCustomerChange('customerId', customerId)
    }
  }, [customerId, jobType, handleCustomerChange])

  useEffect(() => {
    if (jobType === 'outbound' && customerToId) {
      handleCustomerChange('customerToId', customerToId)
    }
  }, [customerToId, jobType, handleCustomerChange])

  useEffect(() => {
    if (jobType === 'outbound' && customerFromId) {
      handleCustomerChange('customerFromId', customerFromId)
    }
  }, [customerFromId, jobType, handleCustomerChange])

  // Handle customer changes for inbound jobs
  useEffect(() => {
    if (jobType === 'inbound' && deliveryCustomerId) {
      handleInboundCustomerChange('deliveryCustomerId', deliveryCustomerId)
    }
  }, [deliveryCustomerId, jobType, handleInboundCustomerChange])

  useEffect(() => {
    if (jobType === 'inbound' && supplierId) {
      handleInboundCustomerChange('supplierId', supplierId)
    }
  }, [supplierId, jobType, handleInboundCustomerChange])

  const loadOptions = async () => {
    try {
      setLoadingOptions(true)
      const [customersRes, payingCustomersRes, warehousesRes] = await Promise.all([
        fetch('/api/customers'),
        fetch('/api/paying-customers'),
        fetch('/api/warehouses'),
      ])

      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []
      let warehousesData: { id: number; name: string }[] = []

      if (customersRes.ok) {
        const data = await customersRes.json()
        customersData = data.customers || []
      }
      if (payingCustomersRes.ok) {
        const data = await payingCustomersRes.json()
        payingCustomersData = data.payingCustomers || []
      }
      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        warehousesData = data.warehouses || []
      }

      // Create unified customer list
      const unified: UnifiedCustomerOption[] = [
        ...customersData.map((cust: Customer) => ({
          value: `customers:${cust.id}`,
          label: `${cust.customer_name} [Customer]`,
          collection: 'customers' as const,
          id: cust.id,
        })),
        ...payingCustomersData.map((cust: PayingCustomer) => ({
          value: `paying-customers:${cust.id}`,
          label: `${cust.customer_name} [Paying Customer]`,
          collection: 'paying-customers' as const,
          id: cust.id,
        })),
      ]
      setUnifiedCustomers(unified)

      // Create unified destination list (customers + paying customers + warehouses)
      const unifiedDest: UnifiedCustomerOption[] = [
        ...unified,
        ...warehousesData.map((wh) => ({
          value: `warehouses:${wh.id}`,
          label: `${wh.name} [Warehouse]`,
          collection: 'warehouses' as const,
          id: wh.id,
        })),
      ]
      setUnifiedDestinations(unifiedDest)
    } catch (error) {
      console.error('Error loading options:', error)
    } finally {
      setLoadingOptions(false)
    }
  }

  const fetchJob = async () => {
    if (!jobId) return

    try {
      setFetching(true)
      const endpoint =
        jobType === 'inbound'
          ? `/api/inbound-inventory/${jobId}`
          : `/api/outbound-inventory/${jobId}`

      const res = await fetch(endpoint)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job) {
          // Format dates for datetime-local inputs and ensure customer IDs are in correct format
          const formattedJob = { ...data.job }
          
          // Helper function to format customer ID
          const formatCustomerId = (customerId: any, defaultCollection: 'customers' | 'paying-customers' = 'customers'): string | undefined => {
            if (!customerId) return undefined
            if (typeof customerId === 'string' && customerId.includes(':')) {
              return customerId // Already in correct format
            }
            if (typeof customerId === 'object' && customerId !== null) {
              // Could be { id: number, collection?: string } or just { id: number }
              const id = customerId.id
              const collection = customerId.collection || defaultCollection
              return `${collection}:${id}`
            }
            if (typeof customerId === 'string' || typeof customerId === 'number') {
              return `${defaultCollection}:${customerId}`
            }
            return undefined
          }

          // Ensure customer IDs are in "collection:id" format for outbound jobs
          if (jobType === 'outbound') {
            formattedJob.customerId = formatCustomerId(formattedJob.customerId)
            formattedJob.customerToId = formatCustomerId(formattedJob.customerToId)
            formattedJob.customerFromId = formatCustomerId(formattedJob.customerFromId)
            if (formattedJob.requiredDateTime) {
              const date = new Date(formattedJob.requiredDateTime)
              formattedJob.requiredDateTime = date.toISOString().slice(0, 16)
            }
          } else {
            // Ensure customer IDs are in "collection:id" format for inbound jobs
            formattedJob.deliveryCustomerId = formatCustomerId(formattedJob.deliveryCustomerId)
            formattedJob.supplierId = formatCustomerId(formattedJob.supplierId)
            if (formattedJob.expectedDate) {
              const date = new Date(formattedJob.expectedDate)
              formattedJob.expectedDate = date.toISOString().slice(0, 16)
            }
            if (formattedJob.completedDate) {
              const date = new Date(formattedJob.completedDate)
              formattedJob.completedDate = date.toISOString().slice(0, 16)
            }
          }
          reset(formattedJob)
        } else {
          toast.error('Failed to load job')
          onOpenChange(false)
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to load job')
        onOpenChange(false)
      }
    } catch (error) {
      console.error('Error fetching job:', error)
      toast.error('Failed to load job')
      onOpenChange(false)
    } finally {
      setFetching(false)
    }
  }

  const onSubmit = async (data: InboundJobData | OutboundJobData) => {
    try {
      setLoading(true)
      const endpoint =
        jobType === 'inbound'
          ? `/api/inbound-inventory/${jobId}`
          : `/api/outbound-inventory/${jobId}`

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (res.ok) {
        const result = await res.json()
        if (result.success) {
          toast.success('Job updated successfully')
          onOpenChange(false)
          onSuccess()
        } else {
          toast.error(result.message || 'Failed to update job')
        }
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to update job')
      }
    } catch (error) {
      console.error('Error updating job:', error)
      toast.error('Failed to update job')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit {jobType === 'inbound' ? 'Inbound' : 'Outbound'} Job Details
          </DialogTitle>
          <DialogDescription>
            Update job details to correct staff mistakes or human errors. Changes will be saved
            immediately.
          </DialogDescription>
        </DialogHeader>

        {fetching ? (
          <div className="py-8 text-center text-muted-foreground">Loading job details...</div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {jobType === 'inbound' ? (
              <>
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobCode">Job Code</Label>
                      <Input
                        id="jobCode"
                        {...register('jobCode')}
                        placeholder="Job code"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="deliveryCustomerReferenceNumber">Delivery Customer Ref</Label>
                      <Input
                        id="deliveryCustomerReferenceNumber"
                        {...register('deliveryCustomerReferenceNumber')}
                        placeholder="Delivery customer reference"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="orderingCustomerReferenceNumber">Ordering Customer Ref</Label>
                      <Input
                        id="orderingCustomerReferenceNumber"
                        {...register('orderingCustomerReferenceNumber')}
                        placeholder="Ordering customer reference"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="expectedDate">Expected Date</Label>
                      <Input
                        id="expectedDate"
                        type="datetime-local"
                        {...register('expectedDate')}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="completedDate">Completed Date</Label>
                      <Input
                        id="completedDate"
                        type="datetime-local"
                        {...register('completedDate')}
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Customer Information</h3>
                  <div className="space-y-2">
                    <FormCombobox
                      label="Delivery Customer"
                      placeholder="Select customer..."
                      searchPlaceholder="Search customers..."
                      options={unifiedCustomers.map((cust) => ({
                        value: cust.value,
                        label: cust.label,
                      }))}
                      value={watch('deliveryCustomerId')}
                      onValueChange={(value) => setValue('deliveryCustomerId', value.toString())}
                      disabled={loading || loadingOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        {...register('customerName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerLocation">Location</Label>
                      <Input
                        id="customerLocation"
                        {...register('customerLocation')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerState">State</Label>
                      <Input
                        id="customerState"
                        {...register('customerState')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerContactName">Contact</Label>
                      <Input
                        id="customerContactName"
                        {...register('customerContactName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Supplier Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Supplier Information</h3>
                  <div className="space-y-2">
                    <FormCombobox
                      label="Supplier"
                      placeholder="Select supplier..."
                      searchPlaceholder="Search suppliers..."
                      options={unifiedCustomers.map((cust) => ({
                        value: cust.value,
                        label: cust.label,
                      }))}
                      value={watch('supplierId')}
                      onValueChange={(value) => setValue('supplierId', value.toString())}
                      disabled={loading || loadingOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="supplierName">Supplier Name</Label>
                      <Input
                        id="supplierName"
                        {...register('supplierName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplierLocation">Location</Label>
                      <Input
                        id="supplierLocation"
                        {...register('supplierLocation')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplierState">State</Label>
                      <Input
                        id="supplierState"
                        {...register('supplierState')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="supplierContactName">Contact</Label>
                      <Input
                        id="supplierContactName"
                        {...register('supplierContactName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    {...register('notes')}
                    placeholder="Additional notes"
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobCode">Job Code</Label>
                      <Input
                        id="jobCode"
                        {...register('jobCode')}
                        placeholder="Job code"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerRefNumber">Customer Ref Number</Label>
                      <Input
                        id="customerRefNumber"
                        {...register('customerRefNumber')}
                        placeholder="Customer reference"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="consigneeRefNumber">Consignee Ref Number</Label>
                      <Input
                        id="consigneeRefNumber"
                        {...register('consigneeRefNumber')}
                        placeholder="Consignee reference"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="containerNumber">Container Number</Label>
                      <Input
                        id="containerNumber"
                        {...register('containerNumber')}
                        placeholder="Container number"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inspectionNumber">Inspection Number</Label>
                      <Input
                        id="inspectionNumber"
                        {...register('inspectionNumber')}
                        placeholder="Inspection number"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inboundJobNumber">Inbound Job Number</Label>
                      <Input
                        id="inboundJobNumber"
                        {...register('inboundJobNumber')}
                        placeholder="Inbound job number"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="requiredDateTime">Required Date/Time</Label>
                      <Input
                        id="requiredDateTime"
                        type="datetime-local"
                        {...register('requiredDateTime')}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="palletCount">Pallet Count</Label>
                      <Input
                        id="palletCount"
                        type="number"
                        {...register('palletCount', { valueAsNumber: true })}
                        placeholder="Pallet count"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Customer</h3>
                  <div className="space-y-2">
                    <FormCombobox
                      label="Customer"
                      placeholder="Select customer..."
                      searchPlaceholder="Search customers..."
                      options={unifiedCustomers.map((cust) => ({
                        value: cust.value,
                        label: cust.label,
                      }))}
                      value={watch('customerId')}
                      onValueChange={(value) => setValue('customerId', value.toString())}
                      disabled={loading || loadingOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Name</Label>
                      <Input
                        id="customerName"
                        {...register('customerName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerLocation">Location</Label>
                      <Input
                        id="customerLocation"
                        {...register('customerLocation')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerState">State</Label>
                      <Input
                        id="customerState"
                        {...register('customerState')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerContact">Contact</Label>
                      <Input
                        id="customerContact"
                        {...register('customerContact')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery To */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Delivery To (Optional)</h3>
                  <div className="space-y-2">
                    <FormCombobox
                      label="Delivery Destination"
                      placeholder="Select destination..."
                      searchPlaceholder="Search destinations..."
                      options={unifiedDestinations.map((dest) => ({
                        value: dest.value,
                        label: dest.label,
                      }))}
                      value={watch('customerToId')}
                      onValueChange={(value) => setValue('customerToId', value.toString())}
                      disabled={loading || loadingOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerToName">Name</Label>
                      <Input
                        id="customerToName"
                        {...register('customerToName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerToLocation">Location</Label>
                      <Input
                        id="customerToLocation"
                        {...register('customerToLocation')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerToState">State</Label>
                      <Input
                        id="customerToState"
                        {...register('customerToState')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerToContact">Contact</Label>
                      <Input
                        id="customerToContact"
                        {...register('customerToContact')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                {/* Pickup From */}
                <div className="space-y-4 border-t pt-4">
                  <h3 className="font-semibold text-lg">Pickup From (Optional)</h3>
                  <div className="space-y-2">
                    <FormCombobox
                      label="Pickup Location"
                      placeholder="Select pickup location..."
                      searchPlaceholder="Search locations..."
                      options={unifiedDestinations.map((dest) => ({
                        value: dest.value,
                        label: dest.label,
                      }))}
                      value={watch('customerFromId')}
                      onValueChange={(value) => setValue('customerFromId', value.toString())}
                      disabled={loading || loadingOptions}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerFromName">Name</Label>
                      <Input
                        id="customerFromName"
                        {...register('customerFromName')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerFromLocation">Location</Label>
                      <Input
                        id="customerFromLocation"
                        {...register('customerFromLocation')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerFromState">State</Label>
                      <Input
                        id="customerFromState"
                        {...register('customerFromState')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="customerFromContact">Contact</Label>
                      <Input
                        id="customerFromContact"
                        {...register('customerFromContact')}
                        readOnly
                        className="bg-muted"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <Label htmlFor="orderNotes">Order Notes</Label>
                  <Textarea
                    id="orderNotes"
                    {...register('orderNotes')}
                    placeholder="Order notes"
                    rows={3}
                    disabled={loading}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
