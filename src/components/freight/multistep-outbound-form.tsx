'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FormInput, FormTextarea, FormCombobox } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Save, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { OutboundProductLineForm } from './outbound-product-line-form'
import { CustomerForm } from '@/components/entity-forms/customer-form'
import { PayingCustomerForm } from '@/components/entity-forms/paying-customer-form'
import { WarehouseForm } from '@/components/entity-forms/warehouse-form'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

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

type Warehouse = {
  id: number
  name: string
}

type OutboundInventoryData = {
  id?: number
  jobCode?: string
  status?: string
  customerRefNumber?: string
  consigneeRefNumber?: string
  containerNumber?: string
  inspectionNumber?: string
  inboundJobNumber?: string
  warehouseId?: number
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

// Zod validation schemas for each step
const step1Schema = z
  .object({
    jobCode: z.string().optional(),
    customerRefNumber: z.string().optional(),
    consigneeRefNumber: z.string().optional(),
    containerNumber: z.string().optional(),
    inspectionNumber: z.string().optional(),
    inboundJobNumber: z.string().optional(),
    warehouseId: z.number().optional(),
    requiredDateTime: z.string().optional(),
  })
  .refine(
    (data) => {
      const value = data.jobCode
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Job number is required',
      path: ['jobCode'],
    },
  )
  .refine(
    (data) => {
      const value = data.warehouseId
      return typeof value === 'number' && value > 0
    },
    {
      message: 'Warehouse is required',
      path: ['warehouseId'],
    },
  )
  .refine(
    (data) => {
      const value = data.requiredDateTime
      // Check if value exists and is a non-empty string
      if (!value || typeof value !== 'string') return false
      const trimmed = value.trim()
      // datetime-local format should be at least "YYYY-MM-DDTHH:mm" (16 chars)
      return trimmed.length >= 16 && trimmed.includes('T')
    },
    {
      message: 'Required date/time is required',
      path: ['requiredDateTime'],
    },
  )
  .refine(
    (data) => {
      const value = data.customerRefNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Customer reference number is required',
      path: ['customerRefNumber'],
    },
  )
  .refine(
    (data) => {
      const value = data.consigneeRefNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Consignee reference number is required',
      path: ['consigneeRefNumber'],
    },
  )
  .refine(
    (data) => {
      const value = data.containerNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Container number is required',
      path: ['containerNumber'],
    },
  )
  .refine(
    (data) => {
      const value = data.inspectionNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Inspection number is required',
      path: ['inspectionNumber'],
    },
  )
  .refine(
    (data) => {
      const value = data.inboundJobNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Inbound job number is required',
      path: ['inboundJobNumber'],
    },
  )

const step2Schema = z
  .object({
    customerId: z.string().optional(),
  })
  .refine(
    (data) => {
      const value = data.customerId
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Customer is required',
      path: ['customerId'],
    },
  )

const step3Schema = z
  .object({
    productLines: z.array(z.any()).optional(),
  })
  .refine(
    (data) => {
      const value = data.productLines
      return Array.isArray(value) && value.length > 0
    },
    {
      message: 'At least one product line is required',
      path: ['productLines'],
    },
  )

/**
 * Generate a random alphanumeric code (client-side fallback)
 */
function generateJobCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

interface MultistepOutboundFormProps {
  initialData?: OutboundInventoryData
  onSave?: (data: OutboundInventoryData) => Promise<void>
  onCancel?: () => void
}

export function MultistepOutboundForm({
  initialData,
  onSave,
  onCancel,
}: MultistepOutboundFormProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [_customers, setCustomers] = useState<Customer[]>([])
  const [_payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomerOption[]>([])
  const [unifiedDestinations, setUnifiedDestinations] = useState<UnifiedCustomerOption[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [_loading, setLoading] = useState(false)
  const [showCustomerTypeModal, setShowCustomerTypeModal] = useState(false)
  const [customerTypeModalField, setCustomerTypeModalField] = useState<
    'customerId' | 'customerToId' | 'customerFromId' | null
  >(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPayingCustomerModal, setShowPayingCustomerModal] = useState(false)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showProductLineDialog, setShowProductLineDialog] = useState(false)
  type ProductLineDisplay = {
    id?: number
    skuId?: number | { id: number; skuCode?: string; description?: string }
    skuDescription?: string
    batchNumber?: string
    requiredQty?: number
    allocatedQty?: number
    requiredWeight?: number
    allocatedWeight?: number
    requiredCubicPerHU?: number
    location?: string
    [key: string]: unknown
  }

  const [editingProductLine, setEditingProductLine] = useState<ProductLineDisplay | null>(null)
  const [productLines, setProductLines] = useState<ProductLineDisplay[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<string, string>>>(
    {},
  )
  const customerDataLoadedRef = useRef(false)

  const [formData, setFormData] = useState<OutboundInventoryData>(() => {
    // Initialize with job code if not present
    const data = initialData || {}
    if (!data.jobCode) {
      // Generate a temporary job code (will be replaced by server on save)
      data.jobCode = generateJobCode(8)
    }
    // Normalize warehouseId - extract ID if it's a relationship object
    if (data.warehouseId) {
      if (typeof data.warehouseId === 'object' && 'id' in data.warehouseId) {
        data.warehouseId = (data.warehouseId as { id: number }).id
      }
    }
    return data
  })

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    if (initialData) {
      const data = { ...initialData }
      // Ensure job code is set
      if (!data.jobCode) {
        data.jobCode = generateJobCode(8)
      }
      // Normalize warehouseId - extract ID if it's a relationship object
      if (data.warehouseId) {
        if (typeof data.warehouseId === 'object' && 'id' in data.warehouseId) {
          data.warehouseId = (data.warehouseId as { id: number }).id
        }
      }
      setFormData(data)
    }
  }, [initialData])

  // Load customer details when options are loaded and initialData has customer IDs
  useEffect(() => {
    // Only proceed if we have initialData and options are loaded
    if (!initialData || (unifiedCustomers.length === 0 && unifiedDestinations.length === 0)) {
      return
    }

    // Prevent loading multiple times
    if (customerDataLoadedRef.current) {
      return
    }

    // Use initialData directly to avoid stale closure issues
    const customerId = initialData.customerId
    const customerToId = initialData.customerToId
    const customerFromId = initialData.customerFromId

    // Load customer details if IDs exist
    // handleCustomerChange will update formData and fetch customer details
    if (customerId || customerToId || customerFromId) {
      customerDataLoadedRef.current = true

      if (customerId) {
        handleCustomerChange('customerId', customerId)
      }
      if (customerToId) {
        handleCustomerChange('customerToId', customerToId)
      }
      if (customerFromId) {
        handleCustomerChange('customerFromId', customerFromId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    initialData?.customerId,
    initialData?.customerToId,
    initialData?.customerFromId,
    unifiedCustomers.length,
    unifiedDestinations.length,
  ])

  // Reset the ref when initialData changes (new job loaded)
  useEffect(() => {
    customerDataLoadedRef.current = false
  }, [initialData?.id])

  useEffect(() => {
    if (formData.id) {
      loadProductLines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.id])

  const loadProductLines = async () => {
    if (!formData.id) return
    try {
      const res = await fetch(
        `/api/outbound-product-lines?outboundInventoryId=${formData.id}&depth=2`,
      )
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.productLines) {
          // Map backend "expected" fields to frontend "required" fields
          const mappedLines = (data.productLines || []).map((line: any) => ({
            ...line,
            requiredQty: line.expectedQty,
            requiredWeight: line.expectedWeight,
            requiredCubicPerHU: line.expectedCubicPerHU,
          }))
          setProductLines(mappedLines)
        }
      }
    } catch (error) {
      console.error('Error loading product lines:', error)
    }
  }

  const handleSaveProductLine = async (data: { [key: string]: unknown }) => {
    if (!formData.id) {
      toast.error('Please save the job first')
      return
    }
    try {
      const url = editingProductLine?.id
        ? `/api/outbound-product-lines/${editingProductLine.id}`
        : '/api/outbound-product-lines'
      const method = editingProductLine?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outboundInventoryId: formData.id,
          ...data,
        }),
      })

      if (res.ok) {
        toast.success('Product line saved successfully')
        setShowProductLineDialog(false)
        setEditingProductLine(null)
        loadProductLines()
      } else {
        const error = await res.json()
        toast.error(error.message || 'Failed to save product line')
      }
    } catch (error) {
      console.error('Error saving product line:', error)
      toast.error('Failed to save product line')
    }
  }

  const loadOptions = async () => {
    setLoading(true)
    try {
      const [customersRes, payingCustomersRes, warehousesRes] = await Promise.all([
        fetch('/api/customers?limit=100'),
        fetch('/api/paying-customers?limit=100'),
        fetch('/api/warehouses?limit=100'),
      ])

      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []
      let warehousesData: Warehouse[] = []

      if (customersRes.ok) {
        const data = await customersRes.json()
        customersData = data.customers || []
        setCustomers(customersData)
      }
      if (payingCustomersRes.ok) {
        const data = await payingCustomersRes.json()
        payingCustomersData = data.payingCustomers || []
        setPayingCustomers(payingCustomersData)
      }
      if (warehousesRes.ok) {
        const data = await warehousesRes.json()
        warehousesData = data.warehouses || []
        setWarehouses(warehousesData)
      }

      // Create unified customer list (customers + paying customers)
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
        ...warehousesData.map((wh: Warehouse) => ({
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
      setLoading(false)
    }
  }

  const handleCustomerCreated = (
    customer: Customer | PayingCustomer,
    collection: 'customers' | 'paying-customers',
  ) => {
    if (!customer.id) return

    // Update the appropriate list
    if (collection === 'customers') {
      setCustomers((prev) => [...prev, customer as Customer])
    } else {
      setPayingCustomers((prev) => [...prev, customer as PayingCustomer])
    }

    // Reload options to get the updated unified list
    loadOptions().then(() => {
      // Auto-select the newly created customer
      const field = customerTypeModalField || 'customerId'
      setFormData((prev) => ({ ...prev, [field]: `${collection}:${customer.id}` }))
      handleCustomerChange(field, `${collection}:${customer.id}`)
      setCustomerTypeModalField(null)
    })
  }

  const handleWarehouseCreated = (warehouse: Warehouse) => {
    if (!warehouse.id) return
    setWarehouses((prev) => [...prev, warehouse])
    setFormData((prev) => ({ ...prev, warehouseId: warehouse.id }))
  }

  const handleCustomerChange = async (
    field: 'customerId' | 'customerToId' | 'customerFromId',
    customerValue: string, // Format: "collection:id"
  ) => {
    // Update form data first
    const newFormData = { ...formData, [field]: customerValue }
    setFormData(newFormData)

    // Check if Delivery To and Pickup From are the same (only if both are set)
    const isSame =
      newFormData.customerToId &&
      newFormData.customerFromId &&
      newFormData.customerToId === newFormData.customerFromId

    if (isSame) {
      // Set validation errors for both fields
      setValidationErrors((prev) => ({
        ...prev,
        [1]: {
          ...prev[1],
          customerToId: 'Delivery To and Pickup From cannot be the same',
          customerFromId: 'Delivery To and Pickup From cannot be the same',
        },
      }))
    } else {
      // Clear the error if they're different or if either is empty
      setValidationErrors((prev) => {
        const step1Errors = { ...prev[1] }
        // Only clear these specific errors, keep other validation errors
        if (step1Errors.customerToId === 'Delivery To and Pickup From cannot be the same') {
          delete step1Errors.customerToId
        }
        if (step1Errors.customerFromId === 'Delivery To and Pickup From cannot be the same') {
          delete step1Errors.customerFromId
        }
        return { ...prev, [1]: step1Errors }
      })
    }

    // Parse collection and ID
    const [collection, idStr] = customerValue.split(':')
    const customerId = parseInt(idStr, 10)

    if (!collection || !customerId) {
      return
    }

    // Auto-fetch customer/warehouse data
    try {
      if (collection === 'warehouses') {
        const res = await fetch(`/api/warehouses/${customerId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.warehouse) {
            const wh = data.warehouse as { name?: string; city?: string; state?: string }
            if (field === 'customerToId') {
              setFormData((prev) => ({
                ...prev,
                customerToName: wh.name || '',
                customerToLocation: wh.city || '',
                customerToState: wh.state || '',
              }))
            } else if (field === 'customerFromId') {
              setFormData((prev) => ({
                ...prev,
                customerFromName: wh.name || '',
                customerFromLocation: wh.city || '',
                customerFromState: wh.state || '',
              }))
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
                setFormData((prev) => ({
                  ...prev,
                  customerName: cust.customer_name,
                  customerLocation: [cust.city, cust.state].filter(Boolean).join(', '),
                  customerState: cust.state || '',
                  customerContact: cust.contact_name || '',
                }))
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setFormData((prev) => ({
                  ...prev,
                  customerName: cust.customer_name,
                  customerLocation: [city, state].filter(Boolean).join(', '),
                  customerState: state || '',
                  customerContact: cust.contact_name || '',
                }))
              }
            } else if (field === 'customerToId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setFormData((prev) => ({
                  ...prev,
                  customerToName: cust.customer_name,
                  customerToLocation: [cust.city, cust.state].filter(Boolean).join(', '),
                  customerToState: cust.state || '',
                  customerToContact: cust.contact_name || '',
                }))
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setFormData((prev) => ({
                  ...prev,
                  customerToName: cust.customer_name,
                  customerToLocation: [city, state].filter(Boolean).join(', '),
                  customerToState: state || '',
                  customerToContact: cust.contact_name || '',
                }))
              }
            } else if (field === 'customerFromId') {
              if (collection === 'customers' && data.customer) {
                const cust = data.customer as Customer
                setFormData((prev) => ({
                  ...prev,
                  customerFromName: cust.customer_name,
                  customerFromLocation: [cust.city, cust.state].filter(Boolean).join(', '),
                  customerFromState: cust.state || '',
                  customerFromContact: cust.contact_name || '',
                }))
              } else if (collection === 'paying-customers' && data.payingCustomer) {
                const cust = data.payingCustomer as PayingCustomer
                const city =
                  cust.delivery_city ||
                  (cust.delivery_same_as_billing ? cust.billing_city : undefined)
                const state =
                  cust.delivery_state ||
                  (cust.delivery_same_as_billing ? cust.billing_state : undefined)
                setFormData((prev) => ({
                  ...prev,
                  customerFromName: cust.customer_name,
                  customerFromLocation: [city, state].filter(Boolean).join(', '),
                  customerFromState: state || '',
                  customerFromContact: cust.contact_name || '',
                }))
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer/warehouse:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert datetime-local string to ISO date string if present
      const dataToSave = {
        ...formData,
        requiredDateTime: formData.requiredDateTime
          ? new Date(formData.requiredDateTime).toISOString()
          : formData.requiredDateTime,
      }

      // If job already exists, update it instead of creating a new one
      if (formData.id) {
        const res = await fetch(`/api/outbound-inventory/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success) {
            toast.success('Job updated successfully')
            // Don't call onSave here - it would create a duplicate job
            // The job is already saved, so we're done
          } else {
            toast.error('Failed to update job')
          }
        } else {
          toast.error('Failed to update job')
        }
      } else {
        // Job doesn't exist yet, create it via onSave callback
        if (!onSave) {
          // Fallback to handleStepSave if onSave is not provided
          await handleStepSave()
          return
        }
        await onSave(dataToSave)
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  const handleStepSave = async () => {
    setSaving(true)
    try {
      const url = formData.id ? `/api/outbound-inventory/${formData.id}` : '/api/outbound-inventory'
      const method = formData.id ? 'PUT' : 'POST'

      // Convert datetime-local string to ISO date string if present
      const dataToSave = {
        ...formData,
        requiredDateTime: formData.requiredDateTime
          ? new Date(formData.requiredDateTime).toISOString()
          : formData.requiredDateTime,
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          setFormData((prev) => ({ ...prev, id: data.job.id }))
          toast.success('Job saved successfully')
        }
      } else {
        toast.error('Failed to save job')
      }
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  // Validate current step
  const validateStep = (stepIndex: number): boolean => {
    let schema: z.ZodSchema
    let dataToValidate: Record<string, unknown>

    switch (stepIndex) {
      case 0:
        schema = step1Schema
        dataToValidate = {
          jobCode: formData.jobCode || '',
          customerRefNumber: formData.customerRefNumber || '',
          consigneeRefNumber: formData.consigneeRefNumber || '',
          containerNumber: formData.containerNumber || '',
          inspectionNumber: formData.inspectionNumber || '',
          inboundJobNumber: formData.inboundJobNumber || '',
          warehouseId: formData.warehouseId || undefined,
          requiredDateTime: formData.requiredDateTime
            ? String(formData.requiredDateTime).trim()
            : '',
        }
        break
      case 1:
        schema = step2Schema
        dataToValidate = {
          customerId: formData.customerId || '',
        }
        // Check if Delivery To and Pickup From are the same
        if (
          formData.customerToId &&
          formData.customerFromId &&
          formData.customerToId === formData.customerFromId
        ) {
          setValidationErrors((prev) => ({
            ...prev,
            [stepIndex]: {
              ...prev[stepIndex],
              customerToId: 'Delivery To and Pickup From cannot be the same',
              customerFromId: 'Delivery To and Pickup From cannot be the same',
            },
          }))
          return false
        }
        break
      case 2:
        schema = step3Schema
        dataToValidate = {
          productLines: productLines || [],
        }
        break
      default:
        return true
    }

    const result = schema.safeParse(dataToValidate)
    if (!result.success) {
      const errors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        const path = err.path.join('.')
        errors[path] = err.message
      })
      // Debug: log validation errors
      if (stepIndex === 0) {
        console.log('Step 1 validation failed:', {
          errors,
          dataToValidate,
          formData,
        })
      }
      setValidationErrors((prev) => ({ ...prev, [stepIndex]: errors }))
      return false
    } else {
      // Clear errors for this step
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[stepIndex]
        return newErrors
      })
      return true
    }
  }

  const next = () => {
    // Validate current step before moving to next
    if (!validateStep(step)) {
      const errors = validationErrors[step]
      if (errors) {
        const errorFields = Object.keys(errors).join(', ')
        toast.error(`Please complete all required fields: ${errorFields}`)
      } else {
        toast.error('Please complete all required fields before proceeding')
      }
      return
    }

    if (step < 2) {
      setStep(step + 1)
      handleStepSave() // Auto-save on step change
    }
  }

  const prev = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const steps = ['Basic Info', 'Customer Details', 'Product Lines']

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i <= step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {i + 1}
            </div>
            <div className="hidden sm:block text-sm">{label}</div>
            {i < steps.length - 1 && (
              <div
                className={`hidden sm:block w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-gray-200'}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{steps[step]}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 0 && (
            <div className="space-y-4 md:space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <FormInput
                      label="Job Number"
                      value={formData.jobCode || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, jobCode: e.target.value }))
                      }
                      placeholder="Auto-generated job number"
                      className={validationErrors[0]?.jobCode ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.jobCode && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors[0].jobCode}</p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Required Date/Time"
                      type="datetime-local"
                      value={
                        formData.requiredDateTime
                          ? (() => {
                              // datetime-local input expects format: YYYY-MM-DDTHH:mm
                              const dt = formData.requiredDateTime
                              // If it's already in datetime-local format (has T and is 16 chars), use as-is
                              if (dt.includes('T') && dt.length >= 16) {
                                return dt.slice(0, 16)
                              }
                              // Otherwise, try to convert from ISO string
                              try {
                                const date = new Date(dt)
                                if (!isNaN(date.getTime())) {
                                  return date.toISOString().slice(0, 16)
                                }
                              } catch {
                                // If conversion fails, return empty
                              }
                              return ''
                            })()
                          : ''
                      }
                      onChange={(e) => {
                        // Store the datetime-local value directly (format: YYYY-MM-DDTHH:mm)
                        setFormData((prev) => ({ ...prev, requiredDateTime: e.target.value }))
                      }}
                      className={validationErrors[0]?.requiredDateTime ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.requiredDateTime && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].requiredDateTime}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <FormCombobox
                        label="Warehouse"
                        placeholder="Select warehouse..."
                        options={warehouses.map((wh) => ({
                          value: wh.id,
                          label: wh.name,
                        }))}
                        value={formData.warehouseId}
                        onValueChange={(value) => {
                          if (value === undefined) {
                            setFormData((prev) => ({
                              ...prev,
                              warehouseId: undefined,
                            }))
                            return
                          }
                          setFormData((prev) => ({
                            ...prev,
                            warehouseId:
                              typeof value === 'number'
                                ? value
                                : parseInt(value.toString()) || undefined,
                          }))
                        }}
                        containerClassName="flex-1"
                        className={validationErrors[0]?.warehouseId ? 'border-red-500' : ''}
                      />
                      {validationErrors[0]?.warehouseId && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors[0].warehouseId}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mt-8"
                      onClick={() => setShowWarehouseModal(true)}
                      title="Quick create warehouse"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* References Section */}
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-lg">References</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormInput
                      label="Customer Reference Number"
                      value={formData.customerRefNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, customerRefNumber: e.target.value }))
                      }
                      placeholder="Enter customer reference number"
                      className={validationErrors[0]?.customerRefNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.customerRefNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].customerRefNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Consignee Reference Number"
                      value={formData.consigneeRefNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, consigneeRefNumber: e.target.value }))
                      }
                      placeholder="Enter consignee reference number"
                      className={validationErrors[0]?.consigneeRefNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.consigneeRefNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].consigneeRefNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Container Number"
                      value={formData.containerNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, containerNumber: e.target.value }))
                      }
                      placeholder="Enter container number"
                      className={validationErrors[0]?.containerNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.containerNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].containerNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Inspection Number"
                      value={formData.inspectionNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, inspectionNumber: e.target.value }))
                      }
                      placeholder="Enter inspection number"
                      className={validationErrors[0]?.inspectionNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.inspectionNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].inspectionNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Inbound Job Number"
                      value={formData.inboundJobNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, inboundJobNumber: e.target.value }))
                      }
                      placeholder="Enter inbound job number"
                      className={validationErrors[0]?.inboundJobNumber ? 'border-red-500' : ''}
                    />
                    {validationErrors[0]?.inboundJobNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].inboundJobNumber}
                      </p>
                    )}
                  </div>
                  <div className="sm:col-span-2">
                    <FormTextarea
                      label="Order Notes"
                      value={formData.orderNotes || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, orderNotes: e.target.value }))
                      }
                      placeholder="Enter any additional notes..."
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 md:space-y-6">
              {/* Three sections side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {/* Section 1: Customer */}
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">Customer</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <FormCombobox
                        label="Customer"
                        placeholder="Select customer..."
                        options={unifiedCustomers.map((cust) => ({
                          value: cust.value,
                          label: cust.label,
                        }))}
                        value={formData.customerId}
                        onValueChange={(value) => {
                          if (value === undefined) {
                            handleCustomerChange('customerId', '')
                            return
                          }
                          handleCustomerChange('customerId', value.toString())
                        }}
                        containerClassName="flex-1"
                        className={validationErrors[1]?.customerId ? 'border-red-500' : ''}
                      />
                      {validationErrors[1]?.customerId && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors[1].customerId}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mt-8"
                      onClick={() => {
                        setCustomerTypeModalField('customerId')
                        setShowCustomerTypeModal(true)
                      }}
                      title="Quick create customer"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <FormInput
                      label="Name"
                      value={formData.customerName || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Location"
                      value={formData.customerLocation || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="State"
                      value={formData.customerState || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Contact"
                      value={formData.customerContact || ''}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>

                {/* Section 2: Delivery To (Optional) */}
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">Delivery To (Optional)</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <FormCombobox
                        label="Delivery Destination"
                        placeholder="Select destination..."
                        options={unifiedDestinations.map((dest) => ({
                          value: dest.value,
                          label: dest.label,
                        }))}
                        value={formData.customerToId}
                        onValueChange={(value) => {
                          if (value === undefined) {
                            handleCustomerChange('customerToId', '')
                            return
                          }
                          handleCustomerChange('customerToId', value.toString())
                        }}
                        containerClassName="flex-1"
                        className={validationErrors[1]?.customerToId ? 'border-red-500' : ''}
                      />
                      {validationErrors[1]?.customerToId && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors[1].customerToId}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mt-8"
                      onClick={() => {
                        setCustomerTypeModalField('customerToId')
                        setShowCustomerTypeModal(true)
                      }}
                      title="Quick create customer"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <FormInput
                      label="Name"
                      value={formData.customerToName || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Location"
                      value={formData.customerToLocation || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="State"
                      value={formData.customerToState || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Contact"
                      value={formData.customerToContact || ''}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>

                {/* Section 3: Pickup From (Optional) */}
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-semibold text-lg">Pickup From (Optional)</h3>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <FormCombobox
                        label="Pickup Location"
                        placeholder="Select pickup location..."
                        options={unifiedDestinations.map((dest) => ({
                          value: dest.value,
                          label: dest.label,
                        }))}
                        value={formData.customerFromId}
                        onValueChange={(value) => {
                          if (value === undefined) {
                            handleCustomerChange('customerFromId', '')
                            return
                          }
                          handleCustomerChange('customerFromId', value.toString())
                        }}
                        containerClassName="flex-1"
                        className={validationErrors[1]?.customerFromId ? 'border-red-500' : ''}
                      />
                      {validationErrors[1]?.customerFromId && (
                        <p className="text-sm text-red-500 mt-1">
                          {validationErrors[1].customerFromId}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="mt-8"
                      onClick={() => {
                        setCustomerTypeModalField('customerFromId')
                        setShowCustomerTypeModal(true)
                      }}
                      title="Quick create customer"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <FormInput
                      label="Name"
                      value={formData.customerFromName || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Location"
                      value={formData.customerFromLocation || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="State"
                      value={formData.customerFromState || ''}
                      readOnly
                      className="bg-muted"
                    />
                    <FormInput
                      label="Contact"
                      value={formData.customerFromContact || ''}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Product Lines</h3>
                  <p className="text-sm text-muted-foreground">
                    {productLines.length} product line(s) added
                  </p>
                  {validationErrors[2]?.productLines && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors[2].productLines}</p>
                  )}
                </div>
                {formData.id && (
                  <Button
                    type="button"
                    onClick={() => {
                      setEditingProductLine(null)
                      setShowProductLineDialog(true)
                    }}
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product Line
                  </Button>
                )}
              </div>
              {productLines.length > 0 ? (
                <div className="space-y-2">
                  {productLines.map((line, index) => (
                    <div key={line.id || index} className="border rounded-lg p-4 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Batch Number:
                          </span>
                          <p className="font-semibold">{line.batchNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">SKU:</span>
                          <p className="font-semibold">
                            {typeof line.skuId === 'object' && line.skuId?.skuCode
                              ? line.skuId.skuCode
                              : 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Description:
                          </span>
                          <p className="text-sm">{line.skuDescription || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Container Number:
                          </span>
                          <p>{(line as { containerNumber?: string }).containerNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Qty Required:
                          </span>
                          <p>{line.requiredQty || 0}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Weight Required (kg):
                          </span>
                          <p>{line.requiredWeight || 0}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Cubic Required (m³):
                          </span>
                          <p>{line.requiredCubicPerHU?.toFixed(6) || 'N/A'}</p>
                        </div>
                        {(line as { expiry?: string }).expiry && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Expiry Date:
                            </span>
                            <p>{(line as { expiry?: string }).expiry || 'N/A'}</p>
                          </div>
                        )}
                        {(line as { attribute1?: string }).attribute1 && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Attribute 1:
                            </span>
                            <p>{(line as { attribute1?: string }).attribute1 || 'N/A'}</p>
                          </div>
                        )}
                        {(line as { attribute2?: string }).attribute2 && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Attribute 2:
                            </span>
                            <p>{(line as { attribute2?: string }).attribute2 || 'N/A'}</p>
                          </div>
                        )}
                        {line.location && (
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Location:
                            </span>
                            <p>{line.location}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Allocated Qty:
                          </span>
                          <p className="font-medium">{line.allocatedQty || 0}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border rounded-lg">
                  <p className="text-muted-foreground mb-4">
                    {formData.id
                      ? 'No product lines added yet. Click "Add Product Line" to add one.'
                      : 'Save the job first to add product lines.'}
                  </p>
                  {!formData.id && (
                    <Button onClick={() => handleStepSave()} disabled={saving} variant="outline">
                      <Save className="h-4 w-4 mr-2" />
                      Save Job First
                    </Button>
                  )}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
                <Button onClick={() => handleSave()} disabled={saving} className="w-full sm:w-auto">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Job'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          {onCancel && (
            <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto">
              Cancel
            </Button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          {step > 0 && (
            <Button variant="outline" onClick={prev} className="w-full sm:w-auto">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
          )}
          {step < 2 && (
            <Button onClick={next} className="w-full sm:w-auto">
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {step < 2 && (
            <Button
              variant="outline"
              onClick={handleStepSave}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Customer Type Selection Modal */}
      <Dialog open={showCustomerTypeModal} onOpenChange={setShowCustomerTypeModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Customer Type</DialogTitle>
            <DialogDescription>Choose the type of customer you want to create</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 pt-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setShowCustomerTypeModal(false)
                setShowCustomerModal(true)
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Customer</div>
                <div className="text-sm text-muted-foreground">Regular customer</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setShowCustomerTypeModal(false)
                setShowPayingCustomerModal(true)
              }}
            >
              <div className="text-left">
                <div className="font-semibold">Paying Customer</div>
                <div className="text-sm text-muted-foreground">
                  Customer with billing and delivery addresses
                </div>
              </div>
            </Button>
          </div>
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCustomerTypeModal(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Create Modals */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create Customer</DialogTitle>
            <DialogDescription>Create a new customer quickly</DialogDescription>
          </DialogHeader>
          <CustomerForm
            onSuccess={(customer) => {
              if (customer.id) {
                handleCustomerCreated(customer as Customer, 'customers')
                setShowCustomerModal(false)
              }
            }}
            onCancel={() => setShowCustomerModal(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showPayingCustomerModal} onOpenChange={setShowPayingCustomerModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create Paying Customer</DialogTitle>
            <DialogDescription>Create a new paying customer quickly</DialogDescription>
          </DialogHeader>
          <PayingCustomerForm
            onSuccess={(customer) => {
              if (customer.id) {
                handleCustomerCreated(customer as PayingCustomer, 'paying-customers')
                setShowPayingCustomerModal(false)
              }
            }}
            onCancel={() => setShowPayingCustomerModal(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={showWarehouseModal} onOpenChange={setShowWarehouseModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create Warehouse</DialogTitle>
            <DialogDescription>Create a new warehouse quickly</DialogDescription>
          </DialogHeader>
          <WarehouseForm
            onSuccess={(warehouse) => {
              if (warehouse.id) {
                handleWarehouseCreated(warehouse as Warehouse)
                setShowWarehouseModal(false)
              }
            }}
            onCancel={() => setShowWarehouseModal(false)}
            mode="create"
          />
        </DialogContent>
      </Dialog>

      {/* Product Line Dialog */}
      {formData.id && (
        <Dialog open={showProductLineDialog} onOpenChange={setShowProductLineDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProductLine ? 'Edit Product Line' : 'Add Product Line'}
              </DialogTitle>
              <DialogDescription>
                {editingProductLine
                  ? 'Update the product line details'
                  : 'Add a new product line to this outbound job'}
              </DialogDescription>
            </DialogHeader>
            {showProductLineDialog && formData.id && (
              <OutboundProductLineForm
                outboundInventoryId={formData.id}
                warehouseId={
                  formData.warehouseId
                    ? typeof formData.warehouseId === 'object' && 'id' in formData.warehouseId
                      ? (formData.warehouseId as { id: number }).id
                      : (formData.warehouseId as number)
                    : undefined
                }
                initialData={
                  editingProductLine
                    ? {
                        id: editingProductLine.id,
                        skuId:
                          typeof editingProductLine.skuId === 'object'
                            ? editingProductLine.skuId.id
                            : editingProductLine.skuId,
                        skuDescription: editingProductLine.skuDescription,
                        batchNumber: editingProductLine.batchNumber,
                        requiredQty: editingProductLine.requiredQty,
                        requiredWeight: editingProductLine.requiredWeight as number | undefined,
                        requiredCubicPerHU: editingProductLine.requiredCubicPerHU,
                      }
                    : undefined
                }
                onSave={handleSaveProductLine}
                onCancel={() => {
                  setShowProductLineDialog(false)
                  setEditingProductLine(null)
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
