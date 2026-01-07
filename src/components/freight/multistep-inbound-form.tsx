'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { FormInput, FormTextarea, FormCombobox } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Save, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { z } from 'zod'
import { ProductLineForm } from './product-line-form'
import { CustomerForm } from '@/components/entity-forms/customer-form'
import { PayingCustomerForm } from '@/components/entity-forms/paying-customer-form'
import { WarehouseForm } from '@/components/entity-forms/warehouse-form'
import { TransportCompanyForm } from '@/components/entity-forms/transport-company-form'
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
  collection: 'customers' | 'paying-customers'
  id: number
}

type Warehouse = {
  id: number
  name: string
}

type TransportCompany = {
  id: number
  name: string
  contact?: string
  mobile?: string
}

type InboundInventoryData = {
  id?: number
  jobCode?: string
  expectedDate?: string
  deliveryCustomerReferenceNumber?: string
  orderingCustomerReferenceNumber?: string
  deliveryCustomerId?: string // Format: "collection:id"
  warehouseId?: number
  transportMode?: 'our' | 'third_party'
  notes?: string
  supplierId?: string // Format: "collection:id"
  transportCompanyId?: number
  chep?: number
  loscam?: number
  plain?: number
  palletTransferDocket?: string
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
  transportContact?: string
  transportMobile?: string
}

// Zod validation schemas for each step
const step1Schema = z
  .object({
    expectedDate: z.string().optional(),
    warehouseId: z.number().optional(),
    deliveryCustomerReferenceNumber: z.string().optional(),
    orderingCustomerReferenceNumber: z.string().optional(),
  })
  .refine(
    (data) => {
      const value = data.expectedDate
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Expected date is required',
      path: ['expectedDate'],
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
      const value = data.deliveryCustomerReferenceNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Delivery customer reference number is required',
      path: ['deliveryCustomerReferenceNumber'],
    },
  )
  .refine(
    (data) => {
      const value = data.orderingCustomerReferenceNumber
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Ordering customer reference number is required',
      path: ['orderingCustomerReferenceNumber'],
    },
  )

const step2Schema = z
  .object({
    deliveryCustomerId: z.string().optional(),
    supplierId: z.string().optional(),
  })
  .refine(
    (data) => {
      const value = data.deliveryCustomerId
      return typeof value === 'string' && value.trim() !== ''
    },
    {
      message: 'Delivery customer is required',
      path: ['deliveryCustomerId'],
    },
  )

const step3Schema = z
  .object({
    transportMode: z.enum(['our', 'third_party']).optional(),
    transportCompanyId: z.number().optional(),
  })
  .refine(
    (data) => {
      // If transport mode is third_party, transportCompanyId is required
      if (data.transportMode === 'third_party') {
        const value = data.transportCompanyId
        return typeof value === 'number' && value > 0
      }
      return true
    },
    {
      message: 'Transport company is required when transport mode is third party',
      path: ['transportCompanyId'],
    },
  )

const step4Schema = z
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

interface MultistepInboundFormProps {
  initialData?: InboundInventoryData
  onSave?: (data: InboundInventoryData, action: 'save' | 'receive') => Promise<void>
  onCancel?: () => void
}

export function MultistepInboundForm({ initialData, onSave, onCancel }: MultistepInboundFormProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomerOption[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [transportCompanies, setTransportCompanies] = useState<TransportCompany[]>([])
  const [loading, setLoading] = useState(false)
  const [showCustomerTypeModal, setShowCustomerTypeModal] = useState(false)
  const [customerTypeModalField, setCustomerTypeModalField] = useState<
    'deliveryCustomerId' | 'supplierId' | null
  >(null)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPayingCustomerModal, setShowPayingCustomerModal] = useState(false)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showTransportModal, setShowTransportModal] = useState(false)
  const [showProductLineDialog, setShowProductLineDialog] = useState(false)
  type ProductLineDisplay = {
    id?: number
    skuId?: number | { id: number; skuCode?: string; description?: string }
    skuDescription?: string
    expectedQty?: number
    batchNumber?: string
    expectedWeight?: number
    expiryDate?: string
    attribute1?: string
    attribute2?: string
    [key: string]: unknown
  }

  const [editingProductLine, setEditingProductLine] = useState<ProductLineDisplay | null>(null)
  const [productLines, setProductLines] = useState<ProductLineDisplay[]>([])
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<string, string>>>(
    {},
  )

  const [formData, setFormData] = useState<InboundInventoryData>(() => {
    // Initialize with job code if not present
    const data = initialData || {}
    if (!data.jobCode) {
      // Generate a temporary job code (will be replaced by server on save)
      data.jobCode = generateJobCode(8)
    }
    return data
  })

  useEffect(() => {
    loadOptions()
  }, [])

  // Auto-select warehouse if only one option
  useEffect(() => {
    if (warehouses.length === 1 && !formData.warehouseId) {
      setFormData((prev) => ({ ...prev, warehouseId: warehouses[0].id }))
    }
  }, [warehouses, formData.warehouseId])

  useEffect(() => {
    if (initialData) {
      const data = { ...initialData }
      // Ensure job code is set
      if (!data.jobCode) {
        data.jobCode = generateJobCode(8)
      }
      setFormData(data)
    }
  }, [initialData])

  useEffect(() => {
    if (formData.id) {
      loadProductLines()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.id])

  const loadProductLines = async () => {
    if (!formData.id) return
    try {
      const res = await fetch(`/api/inbound-inventory/${formData.id}?depth=2`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.job?.productLines) {
          setProductLines(data.job.productLines || [])
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
        ? `/api/inbound-product-lines/${editingProductLine.id}`
        : '/api/inbound-product-lines'
      const method = editingProductLine?.id ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inboundInventoryId: formData.id,
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
      const [customersRes, payingCustomersRes, warehousesRes, transportRes] = await Promise.all([
        fetch('/api/customers?limit=100'),
        fetch('/api/paying-customers?limit=100'),
        fetch('/api/warehouses?limit=100'),
        fetch('/api/transport-companies?limit=100'),
      ])

      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []

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
        const warehousesData = data.warehouses || []
        setWarehouses(warehousesData)
        // Auto-select warehouse if only one option
        if (warehousesData.length === 1 && !formData.warehouseId) {
          setFormData((prev) => ({ ...prev, warehouseId: warehousesData[0].id }))
        }
      }
      if (transportRes.ok) {
        const data = await transportRes.json()
        setTransportCompanies(data.transportCompanies || [])
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
      const field = customerTypeModalField || 'deliveryCustomerId'
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

  const handleTransportCreated = (transportCompany: TransportCompany) => {
    if (!transportCompany.id) return
    setTransportCompanies((prev) => [...prev, transportCompany])
    setFormData((prev) => ({ ...prev, transportCompanyId: transportCompany.id }))
    handleTransportCompanyChange(transportCompany.id)
  }

  const handleCustomerChange = async (
    field: 'deliveryCustomerId' | 'supplierId',
    customerValue: string, // Format: "collection:id"
  ) => {
    // If customer value is empty, clear all auto-filled fields for this field
    if (!customerValue || customerValue.trim() === '') {
      if (field === 'deliveryCustomerId') {
        setFormData((prev) => ({
          ...prev,
          deliveryCustomerId: '',
          customerName: '',
          customerAddress: '',
          customerLocation: '',
          customerState: '',
          customerContactName: '',
        }))
      } else if (field === 'supplierId') {
        setFormData((prev) => ({
          ...prev,
          supplierId: '',
          supplierName: '',
          supplierAddress: '',
          supplierLocation: '',
          supplierState: '',
          supplierContactName: '',
        }))
      }
      return
    }

    setFormData((prev) => ({ ...prev, [field]: customerValue }))

    // Parse collection and ID
    const [collection, idStr] = customerValue.split(':')
    const customerId = parseInt(idStr, 10)

    if (
      !collection ||
      !customerId ||
      (collection !== 'customers' && collection !== 'paying-customers')
    ) {
      return
    }

    // Auto-fetch customer data
    try {
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
              setFormData((prev) => ({
                ...prev,
                customerName: cust.customer_name,
                customerAddress: [cust.street, cust.city, cust.state, cust.postcode]
                  .filter(Boolean)
                  .join(', '),
                customerLocation: [cust.city, cust.state].filter(Boolean).join(', '),
                customerState: cust.state || '',
                customerContactName: cust.contact_name || '',
              }))
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
              setFormData((prev) => ({
                ...prev,
                customerName: cust.customer_name,
                customerAddress: [street, city, state, postcode].filter(Boolean).join(', '),
                customerLocation: [city, state].filter(Boolean).join(', '),
                customerState: state || '',
                customerContactName: cust.contact_name || '',
              }))
            }
          } else if (field === 'supplierId') {
            if (collection === 'customers' && data.customer) {
              const cust = data.customer as Customer
              setFormData((prev) => ({
                ...prev,
                supplierName: cust.customer_name,
                supplierAddress: [cust.street, cust.city, cust.state, cust.postcode]
                  .filter(Boolean)
                  .join(', '),
                supplierLocation: [cust.city, cust.state].filter(Boolean).join(', '),
                supplierState: cust.state || '',
                supplierContactName: cust.contact_name || '',
              }))
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
              setFormData((prev) => ({
                ...prev,
                supplierName: cust.customer_name,
                supplierAddress: [street, city, state, postcode].filter(Boolean).join(', '),
                supplierLocation: [city, state].filter(Boolean).join(', '),
                supplierState: state || '',
                supplierContactName: cust.contact_name || '',
              }))
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    }
  }

  const handleTransportCompanyChange = async (companyId: number) => {
    setFormData((prev) => ({ ...prev, transportCompanyId: companyId }))

    try {
      const res = await fetch(`/api/transport-companies/${companyId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.transportCompany) {
          const tc = data.transportCompany as TransportCompany
          setFormData((prev) => ({
            ...prev,
            transportContact: tc.contact || '',
            transportMobile: tc.mobile || '',
          }))
        }
      }
    } catch (error) {
      console.error('Error fetching transport company:', error)
    }
  }

  const handleSave = async (action: 'save' | 'receive' = 'save') => {
    if (!onSave) return

    // If trying to receive, validate all steps
    if (action === 'receive') {
      if (!isFormValidForReceive()) {
        toast.error('Please complete all required fields before receiving stock')
        return
      }
    }

    // If trying to save, validate step 1 (basic info) to prevent saving empty jobs
    if (action === 'save') {
      if (!validateStep(0)) {
        toast.error('Please complete all required fields in step 1 before saving')
        return
      }
    }

    setSaving(true)
    try {
      // Convert datetime-local string to ISO date string if present
      const dataToSave = {
        ...formData,
        expectedDate: formData.expectedDate
          ? new Date(formData.expectedDate).toISOString()
          : formData.expectedDate,
      }
      await onSave(dataToSave, action)
    } catch (error) {
      console.error('Error saving:', error)
      toast.error('Failed to save job')
    } finally {
      setSaving(false)
    }
  }

  const handleStepSave = async () => {
    // Validate step 1 if on step 0 to prevent saving empty jobs
    if (step === 0 && !validateStep(0)) {
      toast.error('Please complete all required fields in step 1 before saving')
      return
    }

    setSaving(true)
    try {
      const url = formData.id ? `/api/inbound-inventory/${formData.id}` : '/api/inbound-inventory'
      const method = formData.id ? 'PUT' : 'POST'

      // Convert datetime-local string to ISO date string if present
      const dataToSave = {
        ...formData,
        expectedDate: formData.expectedDate
          ? new Date(formData.expectedDate).toISOString()
          : formData.expectedDate,
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
          expectedDate: formData.expectedDate || '',
          warehouseId: formData.warehouseId || undefined,
          deliveryCustomerReferenceNumber: formData.deliveryCustomerReferenceNumber || '',
          orderingCustomerReferenceNumber: formData.orderingCustomerReferenceNumber || '',
        }
        break
      case 1:
        schema = step2Schema
        dataToValidate = {
          deliveryCustomerId: formData.deliveryCustomerId || '',
          supplierId: formData.supplierId || '',
        }
        break
      case 2:
        schema = step3Schema
        dataToValidate = {
          transportMode: formData.transportMode || undefined,
          transportCompanyId: formData.transportCompanyId || undefined,
        }
        break
      case 3:
        schema = step4Schema
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

  // Check if all required steps are valid
  const isFormValidForReceive = (): boolean => {
    // Check all steps except the current one (user might be on step 4)
    for (let i = 0; i < 4; i++) {
      let schema: z.ZodSchema
      let dataToValidate: Record<string, unknown>

      switch (i) {
        case 0:
          schema = step1Schema
          dataToValidate = {
            expectedDate: formData.expectedDate || '',
            warehouseId: formData.warehouseId || undefined,
            deliveryCustomerReferenceNumber: formData.deliveryCustomerReferenceNumber || '',
            orderingCustomerReferenceNumber: formData.orderingCustomerReferenceNumber || '',
          }
          break
        case 1:
          schema = step2Schema
          dataToValidate = {
            deliveryCustomerId: formData.deliveryCustomerId || '',
            supplierId: formData.supplierId || '',
          }
          break
        case 2:
          schema = step3Schema
          dataToValidate = {
            transportMode: formData.transportMode || undefined,
            transportCompanyId: formData.transportCompanyId || undefined,
          }
          break
        case 3:
          schema = step4Schema
          dataToValidate = {
            productLines: productLines || [],
          }
          break
        default:
          continue
      }

      const result = schema.safeParse(dataToValidate)
      if (!result.success) {
        return false
      }
    }
    return true
  }

  const next = () => {
    // Validate current step before moving to next
    if (!validateStep(step)) {
      toast.error('Please complete all required fields before proceeding')
      return
    }

    if (step < 3) {
      setStep(step + 1)
      handleStepSave() // Auto-save on step change
    }
  }

  const prev = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const steps = ['Basic Info', 'Customer/Supplier', 'Transport & Pallets', 'Product Lines']

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
              {/* Row 1: Job Code, Expected Date and Warehouse */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="Job Number"
                  value={formData.jobCode || ''}
                  readOnly
                  placeholder="Auto-generated job number"
                  className={`bg-muted ${validationErrors[0]?.jobCode ? 'border-red-500' : ''}`}
                />
                <FormInput
                  label="Expected Date"
                  type="datetime-local"
                  value={
                    formData.expectedDate
                      ? new Date(formData.expectedDate).toISOString().slice(0, 16)
                      : ''
                  }
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, expectedDate: e.target.value }))
                  }
                  className={validationErrors[0]?.expectedDate ? 'border-red-500' : ''}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex gap-2">
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
                  />
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
                <div>
                  {validationErrors[0]?.expectedDate && (
                    <p className="text-sm text-red-500 mt-8">{validationErrors[0].expectedDate}</p>
                  )}
                  {validationErrors[0]?.warehouseId && (
                    <p className="text-sm text-red-500 mt-8">{validationErrors[0].warehouseId}</p>
                  )}
                </div>
              </div>

              {/* Row 2: Customer Reference Section */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Customer Reference</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormInput
                      label="Delivery Customer Reference"
                      value={formData.deliveryCustomerReferenceNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          deliveryCustomerReferenceNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter delivery customer reference number"
                      className={
                        validationErrors[0]?.deliveryCustomerReferenceNumber ? 'border-red-500' : ''
                      }
                    />
                    {validationErrors[0]?.deliveryCustomerReferenceNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].deliveryCustomerReferenceNumber}
                      </p>
                    )}
                  </div>
                  <div>
                    <FormInput
                      label="Ordering Customer Reference"
                      value={formData.orderingCustomerReferenceNumber || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          orderingCustomerReferenceNumber: e.target.value,
                        }))
                      }
                      placeholder="Enter ordering customer reference number"
                      className={
                        validationErrors[0]?.orderingCustomerReferenceNumber ? 'border-red-500' : ''
                      }
                    />
                    {validationErrors[0]?.orderingCustomerReferenceNumber && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[0].orderingCustomerReferenceNumber}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Notes */}
              <FormTextarea
                label="Notes"
                value={formData.notes || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Enter any additional notes..."
                rows={4}
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 md:space-y-6">
              {/* Section 1: Customer */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Customer</h3>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <FormCombobox
                      label="Customer"
                      placeholder="Select customer..."
                      options={unifiedCustomers.map((cust) => ({
                        value: cust.value,
                        label: cust.label,
                      }))}
                      value={formData.deliveryCustomerId}
                      onValueChange={(value) => {
                        if (value === undefined) {
                          handleCustomerChange('deliveryCustomerId', '')
                          return
                        }
                        handleCustomerChange('deliveryCustomerId', value.toString())
                      }}
                      containerClassName="flex-1"
                    />
                    {validationErrors[1]?.deliveryCustomerId && (
                      <p className="text-sm text-red-500 mt-1">
                        {validationErrors[1].deliveryCustomerId}
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8"
                    onClick={() => {
                      setCustomerTypeModalField('deliveryCustomerId')
                      setShowCustomerTypeModal(true)
                    }}
                    title="Quick create customer"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="Contact"
                    value={formData.customerContactName || ''}
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
                    label="Location"
                    value={formData.customerLocation || ''}
                    readOnly
                    className="bg-muted"
                  />
                  <FormInput
                    label="Address"
                    value={formData.customerAddress || ''}
                    readOnly
                    className="bg-muted sm:col-span-2"
                  />
                </div>
              </div>

              {/* Section 2: Supplier */}
              <div className="border-t pt-4 md:pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Supplier</h3>
                <div className="flex gap-2 mb-4">
                  <div className="flex-1">
                    <FormCombobox
                      label="Supplier"
                      placeholder="Select supplier..."
                      options={unifiedCustomers.map((cust) => ({
                        value: cust.value,
                        label: cust.label,
                      }))}
                      value={formData.supplierId}
                      onValueChange={(value) => {
                        if (value === undefined) {
                          handleCustomerChange('supplierId', '')
                          return
                        }
                        handleCustomerChange('supplierId', value.toString())
                      }}
                      containerClassName="flex-1"
                    />
                    {validationErrors[1]?.supplierId && (
                      <p className="text-sm text-red-500 mt-1">{validationErrors[1].supplierId}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8"
                    onClick={() => {
                      setCustomerTypeModalField('supplierId')
                      setShowCustomerTypeModal(true)
                    }}
                    title="Quick create customer"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="Contact"
                    value={formData.supplierContactName || ''}
                    readOnly
                    className="bg-muted"
                  />
                  <FormInput
                    label="State"
                    value={formData.supplierState || ''}
                    readOnly
                    className="bg-muted"
                  />
                  <FormInput
                    label="Location"
                    value={formData.supplierLocation || ''}
                    readOnly
                    className="bg-muted"
                  />
                  <FormInput
                    label="Address"
                    value={formData.supplierAddress || ''}
                    readOnly
                    className="bg-muted sm:col-span-2"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 md:space-y-6">
              {/* Section 1: Transport Mode */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Transport</h3>
                <FormCombobox
                  label="Transport Mode"
                  placeholder="Select mode..."
                  options={[
                    { value: 'our', label: 'Our Transport' },
                    { value: 'third_party', label: 'Third Party' },
                  ]}
                  value={formData.transportMode}
                  onValueChange={(value) => {
                    if (value === undefined) {
                      setFormData((prev) => ({
                        ...prev,
                        transportMode: undefined,
                      }))
                      return
                    }
                    setFormData((prev) => ({
                      ...prev,
                      transportMode: value as 'our' | 'third_party',
                    }))
                  }}
                  containerClassName="mb-4"
                />
                {formData.transportMode === 'third_party' && (
                  <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                      <div className="flex-1">
                        <FormCombobox
                          label="Transport Company"
                          placeholder="Select transport company..."
                          options={transportCompanies.map((tc) => ({
                            value: tc.id,
                            label: tc.name,
                          }))}
                          value={formData.transportCompanyId}
                          onValueChange={(value) => {
                            if (value === undefined) {
                              setFormData((prev) => ({ ...prev, transportCompanyId: undefined }))
                              return
                            }
                            handleTransportCompanyChange(
                              typeof value === 'number' ? value : parseInt(value.toString()),
                            )
                          }}
                          containerClassName="flex-1"
                        />
                        {validationErrors[2]?.transportCompanyId && (
                          <p className="text-sm text-red-500 mt-1">
                            {validationErrors[2].transportCompanyId}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="mt-8"
                        onClick={() => setShowTransportModal(true)}
                        title="Quick create transport company"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormInput
                        label="Contact"
                        value={formData.transportContact || ''}
                        readOnly
                        className="bg-muted"
                      />
                      <FormInput
                        label="Mobile"
                        value={formData.transportMobile || ''}
                        readOnly
                        className="bg-muted"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section 2: Pallet Information */}
              <div className="border-t pt-4 md:pt-6 space-y-4">
                <h3 className="font-semibold text-lg">Pallet Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormInput
                    label="CHEP"
                    type="number"
                    min="0"
                    value={formData.chep || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        chep: parseInt(e.target.value) || undefined,
                      }))
                    }
                    placeholder="Enter CHEP count"
                  />
                  <FormInput
                    label="LOSCAM"
                    type="number"
                    min="0"
                    value={formData.loscam || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        loscam: parseInt(e.target.value) || undefined,
                      }))
                    }
                    placeholder="Enter LOSCAM count"
                  />
                  <FormInput
                    label="Plain"
                    type="number"
                    min="0"
                    value={formData.plain || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        plain: parseInt(e.target.value) || undefined,
                      }))
                    }
                    placeholder="Enter plain count"
                  />
                  <FormInput
                    label="Pallet Transfer Docket"
                    value={formData.palletTransferDocket || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, palletTransferDocket: e.target.value }))
                    }
                    placeholder="Enter pallet transfer docket"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">Product Lines</h3>
                  <p className="text-sm text-muted-foreground">
                    {productLines.length} product line(s) added
                  </p>
                  {validationErrors[3]?.productLines && (
                    <p className="text-sm text-red-500 mt-1">{validationErrors[3].productLines}</p>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">SKU:</span>
                          <p className="font-semibold">
                            {typeof line.skuId === 'object' && line.skuId?.skuCode
                              ? line.skuId.skuCode
                              : 'N/A'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {line.skuDescription || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">
                            Expected Qty:
                          </span>
                          <p>{line.expectedQty || 0}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Batch:</span>
                          <p>{line.batchNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <span className="text-sm font-medium text-muted-foreground">Weight:</span>
                          <p>{line.expectedWeight || 0} kg</p>
                        </div>
                      </div>
                      {/* Expiry and Attributes */}
                      {(line.expiryDate || line.attribute1 || line.attribute2) && (
                        <div className="flex flex-wrap gap-4 pt-2 border-t text-sm">
                          {line.expiryDate && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Expiry:</span>{' '}
                              {new Date(line.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                          {line.attribute1 && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Attribute 1:</span> {line.attribute1}
                            </div>
                          )}
                          {line.attribute2 && (
                            <div className="text-muted-foreground">
                              <span className="font-medium">Attribute 2:</span> {line.attribute2}
                            </div>
                          )}
                        </div>
                      )}
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
              <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t justify-end">
                <Button
                  onClick={() => handleSave('save')}
                  disabled={saving}
                  className="w-full sm:w-auto"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Job'}
                </Button>
                <Button
                  onClick={() => handleSave('receive')}
                  variant="outline"
                  disabled={saving || !isFormValidForReceive()}
                  className="w-full sm:w-auto"
                  title={
                    !isFormValidForReceive()
                      ? 'Please complete all required fields before receiving stock'
                      : ''
                  }
                >
                  Receive Stock
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
          {step < 3 && (
            <Button onClick={next} className="w-full sm:w-auto">
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          {step < 3 && (
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

      <Dialog open={showTransportModal} onOpenChange={setShowTransportModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Create Transport Company</DialogTitle>
            <DialogDescription>Create a new transport company quickly</DialogDescription>
          </DialogHeader>
          <TransportCompanyForm
            onSuccess={(transportCompany) => {
              if (transportCompany.id) {
                handleTransportCreated(transportCompany as TransportCompany)
                setShowTransportModal(false)
              }
            }}
            onCancel={() => setShowTransportModal(false)}
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
                  : 'Add a new product line to this inbound job'}
              </DialogDescription>
            </DialogHeader>
            {showProductLineDialog && formData.id && (
              <ProductLineForm
                inboundInventoryId={formData.id}
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
                        expectedQty: editingProductLine.expectedQty,
                        expectedWeight: editingProductLine.expectedWeight,
                        expiryDate: editingProductLine.expiryDate,
                        attribute1: editingProductLine.attribute1,
                        attribute2: editingProductLine.attribute2,
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
