'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { FormInput, FormCombobox } from '@/components/ui/form-field'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CustomerForm } from '@/components/entity-forms/customer-form'
import { PayingCustomerForm } from '@/components/entity-forms/paying-customer-form'

type Customer = {
  id: number
  customer_name: string
  contact_name?: string
  contact_phone?: string
}

type PayingCustomer = {
  id: number
  customer_name: string
  contact_name?: string
  contact_phone?: string
}

type UnifiedCustomerOption = {
  value: string // Format: "collection:id"
  label: string
  collection: 'customers' | 'paying-customers'
  id: number
}

interface Step1BasicInfoExportProps {
  formData: {
    customerReference?: string
    bookingReference?: string
    chargeToId?: number | string
    consignorId?: number
    chargeToContactName?: string
    chargeToContactNumber?: string
  }
  onUpdate: (data: Partial<Step1BasicInfoExportProps['formData']>) => void
  errors?: Record<string, string>
}

export function Step1BasicInfoExport({
  formData,
  onUpdate,
  errors,
}: Step1BasicInfoExportProps) {
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [payingCustomers, setPayingCustomers] = useState<PayingCustomer[]>([])
  const [consignors, setConsignors] = useState<Customer[]>([])
  const [unifiedCustomers, setUnifiedCustomers] = useState<UnifiedCustomerOption[]>([])
  const [showCustomerTypeModal, setShowCustomerTypeModal] = useState(false)
  const [showCustomerModal, setShowCustomerModal] = useState(false)
  const [showPayingCustomerModal, setShowPayingCustomerModal] = useState(false)
  const lastFetchedChargeToIdRef = useRef<string | number | undefined>(undefined)

  const loadOptions = useCallback(async () => {
    setLoading(true)
    try {
      const [customersRes, payingCustomersRes] = await Promise.all([
        fetch('/api/customers?limit=100'),
        fetch('/api/paying-customers?limit=100'),
      ])

      let customersData: Customer[] = []
      let payingCustomersData: PayingCustomer[] = []

      if (customersRes.ok) {
        const data = await customersRes.json()
        customersData = data.customers || []
        setCustomers(customersData)
        setConsignors(customersData) // Consignors are only from customers collection
      }
      if (payingCustomersRes.ok) {
        const data = await payingCustomersRes.json()
        payingCustomersData = data.payingCustomers || []
        setPayingCustomers(payingCustomersData)
      }

      // Create unified customer list for chargeTo using the fetched data directly
      const unified: UnifiedCustomerOption[] = [
        ...customersData.map((cust) => ({
          value: `customers:${cust.id}`,
          label: `${cust.customer_name} [Customer]`,
          collection: 'customers' as const,
          id: cust.id,
        })),
        ...payingCustomersData.map((cust) => ({
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
  }, [])

  useEffect(() => {
    loadOptions()
  }, [loadOptions])

  // Fetch customer contact details when chargeToId changes
  const fetchCustomerContactDetails = useCallback(
    async (chargeToId: number | string | undefined, skipRefCheck = false) => {
      if (!chargeToId) {
        lastFetchedChargeToIdRef.current = undefined
        return
      }

      // Prevent duplicate calls for the same chargeToId
      if (!skipRefCheck && lastFetchedChargeToIdRef.current === chargeToId) {
        return
      }

      const valueStr = typeof chargeToId === 'string' ? chargeToId : String(chargeToId)

      // Parse collection and ID
      const [collection, idStr] = valueStr.split(':')
      const customerId = parseInt(idStr, 10)

      if (
        !collection ||
        !customerId ||
        isNaN(customerId) ||
        (collection !== 'customers' && collection !== 'paying-customers')
      ) {
        console.warn('Invalid chargeToId format:', chargeToId)
        return
      }

      // Mark as fetched before making the API call
      lastFetchedChargeToIdRef.current = chargeToId

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
            if (collection === 'customers' && data.customer) {
              const cust = data.customer as Customer
              onUpdate({
                chargeToContactName: cust.contact_name || '',
                chargeToContactNumber: cust.contact_phone || '',
              })
            } else if (collection === 'paying-customers' && data.payingCustomer) {
              const cust = data.payingCustomer as PayingCustomer
              onUpdate({
                chargeToContactName: cust.contact_name || '',
                chargeToContactNumber: cust.contact_phone || '',
              })
            }
          } else {
            console.warn('API response not successful:', data)
          }
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Failed to fetch customer:', errorData)
          // Reset ref on error so we can retry
          lastFetchedChargeToIdRef.current = undefined
        }
      } catch (error) {
        console.error('Error fetching customer:', error)
        // Reset ref on error so we can retry
        lastFetchedChargeToIdRef.current = undefined
      }
    },
    [onUpdate],
  )

  // Populate contact fields when chargeToId is set (for editing existing bookings)
  useEffect(() => {
    if (
      formData.chargeToId &&
      !formData.chargeToContactName &&
      !formData.chargeToContactNumber &&
      lastFetchedChargeToIdRef.current !== formData.chargeToId
    ) {
      fetchCustomerContactDetails(formData.chargeToId)
    }
  }, [formData.chargeToId, formData.chargeToContactName, formData.chargeToContactNumber, fetchCustomerContactDetails])

  const handleChargeToChange = async (customerValue: string | number | undefined) => {
    if (!customerValue || customerValue === '') {
      lastFetchedChargeToIdRef.current = undefined
      onUpdate({
        chargeToId: undefined,
        chargeToContactName: undefined,
        chargeToContactNumber: undefined,
      })
      return
    }

    const valueStr = typeof customerValue === 'string' ? customerValue : String(customerValue)
    
    // Parse collection and ID to fetch contact details immediately
    const [collection, idStr] = valueStr.split(':')
    const customerId = parseInt(idStr, 10)

    if (
      !collection ||
      !customerId ||
      isNaN(customerId) ||
      (collection !== 'customers' && collection !== 'paying-customers')
    ) {
      // Invalid format, just update chargeToId
      onUpdate({ chargeToId: valueStr })
      return
    }

    // Mark as fetched
    lastFetchedChargeToIdRef.current = valueStr

    // Fetch contact details immediately and update all fields together
    try {
      const apiPath =
        collection === 'customers'
          ? `/api/customers/${customerId}`
          : `/api/paying-customers/${customerId}`
      const res = await fetch(apiPath)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          let contactName = ''
          let contactNumber = ''
          
          if (collection === 'customers' && data.customer) {
            const cust = data.customer as Customer
            contactName = cust.contact_name || ''
            contactNumber = cust.contact_phone || ''
          } else if (collection === 'paying-customers' && data.payingCustomer) {
            const cust = data.payingCustomer as PayingCustomer
            contactName = cust.contact_name || ''
            contactNumber = cust.contact_phone || ''
          }

          // Update all fields together in a single call
          onUpdate({
            chargeToId: valueStr,
            chargeToContactName: contactName,
            chargeToContactNumber: contactNumber,
          })
        } else {
          // API call failed, still update chargeToId
          onUpdate({ chargeToId: valueStr })
        }
      } else {
        // API call failed, still update chargeToId
        onUpdate({ chargeToId: valueStr })
        const errorData = await res.json().catch(() => ({}))
        console.error('Failed to fetch customer:', errorData)
        lastFetchedChargeToIdRef.current = undefined
      }
    } catch (error) {
      // Error fetching, still update chargeToId
      console.error('Error fetching customer:', error)
      onUpdate({ chargeToId: valueStr })
      lastFetchedChargeToIdRef.current = undefined
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
      setConsignors((prev) => [...prev, customer as Customer])
    } else {
      setPayingCustomers((prev) => [...prev, customer as PayingCustomer])
    }

    // Reload options to get the updated unified list
    loadOptions().then(() => {
      // Auto-select the newly created customer for chargeTo
      const valueStr = `${collection}:${customer.id}`
      handleChargeToChange(valueStr)
      setShowCustomerTypeModal(false)
      setShowCustomerModal(false)
      setShowPayingCustomerModal(false)
    })
  }

  return (
    <div className="space-y-6">
      <FormInput
        label="Customer Reference"
        required
        value={formData.customerReference || ''}
        onChange={(e) => onUpdate({ customerReference: e.target.value })}
        placeholder="Enter customer reference"
        error={errors?.customerReference}
      />

      <FormInput
        label="Booking Reference"
        required
        value={formData.bookingReference || ''}
        onChange={(e) => onUpdate({ bookingReference: e.target.value })}
        placeholder="Enter booking reference"
        error={errors?.bookingReference}
      />

      <div className="flex gap-2">
        <div className="flex-1">
          <FormCombobox
            label="Charge To"
            required
            placeholder="Select customer or paying customer..."
            options={unifiedCustomers.map((cust) => ({
              value: cust.value,
              label: cust.label,
            }))}
            value={
              typeof formData.chargeToId === 'string'
                ? formData.chargeToId
                : formData.chargeToId
                  ? `customers:${formData.chargeToId}`
                  : undefined
            }
            onValueChange={(value) => handleChargeToChange(value)}
            error={errors?.chargeToId}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="mt-8"
          onClick={() => setShowCustomerTypeModal(true)}
          title="Quick create customer"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormInput
          label="Contact Name"
          value={formData.chargeToContactName || ''}
          readOnly
          className="bg-muted"
        />
        <FormInput
          label="Contact Number"
          value={formData.chargeToContactNumber || ''}
          readOnly
          className="bg-muted"
        />
      </div>

      <FormCombobox
        label="Consignor"
        required
        placeholder="Select consignor (customer)..."
        options={consignors.map((cust) => ({
          value: cust.id,
          label: cust.customer_name,
        }))}
        value={formData.consignorId}
        onValueChange={(value) =>
          onUpdate({ consignorId: typeof value === 'number' ? value : undefined })
        }
        error={errors?.consignorId}
      />

      {/* Customer Type Selection Modal */}
      <Dialog open={showCustomerTypeModal} onOpenChange={setShowCustomerTypeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Customer</DialogTitle>
            <DialogDescription>Select customer type to create</DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <Button
              onClick={() => {
                setShowCustomerTypeModal(false)
                setShowCustomerModal(true)
              }}
              className="flex-1"
            >
              Create Customer
            </Button>
            <Button
              onClick={() => {
                setShowCustomerTypeModal(false)
                setShowPayingCustomerModal(true)
              }}
              variant="outline"
              className="flex-1"
            >
              Create Paying Customer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer Form Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            onSave={async (customer) => {
              handleCustomerCreated(customer, 'customers')
            }}
            onCancel={() => setShowCustomerModal(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Paying Customer Form Modal */}
      <Dialog open={showPayingCustomerModal} onOpenChange={setShowPayingCustomerModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Paying Customer</DialogTitle>
          </DialogHeader>
          <PayingCustomerForm
            onSave={async (customer) => {
              handleCustomerCreated(customer, 'paying-customers')
            }}
            onCancel={() => setShowPayingCustomerModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

