'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  step7Schema,
} from '@/lib/validations/export-container-booking-schemas'
import { useTenant } from '@/lib/tenant-context'
import { Step1BasicInfoExport } from './steps/step1-basic-info-export'
import { Step2VesselInfoExport } from './steps/step2-vessel-info-export'
import { Step3Locations } from './steps/step3-locations'
import { Step4RoutingExport } from './steps/step4-routing-export'
import { Step5ContainerDetailsExport } from './steps/step5-container-details-export'
import { Step6StockAllocationExport } from './steps/step6-stock-allocation-export'
import { Step7DriverAllocationExport } from './steps/step7-driver-allocation-export'
import { canTransitionTo, getNextValidStatus } from '@/lib/container-booking-status'

type ExportContainerBookingData = {
  id?: number
  bookingCode?: string
  status?: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  // Step 1
  customerReference?: string
  bookingReference?: string
  chargeToId?: number | string
  consignorId?: number
  chargeToContactName?: string
  chargeToContactNumber?: string
  // Step 2
  vesselId?: number
  etd?: string
  receivalStart?: string
  cutoff?: boolean
  // Step 3
  fromId?: number | string
  toId?: number | string
  containerSizeIds?: number[]
  containerQuantities?: Record<string, number>
  fromAddress?: string
  fromCity?: string
  fromState?: string
  fromPostcode?: string
  toAddress?: string
  toCity?: string
  toState?: string
  toPostcode?: string
  // Step 4
  emptyRouting?: {
    shippingLineId?: number
    pickupLocationId?: number | string
    pickupDate?: string
    viaLocations?: (number | string)[]
    dropoffLocationId?: number | string
    dropoffDate?: string
    requestedDeliveryDate?: string
  }
  fullRouting?: {
    pickupLocationId?: number | string
    pickupDate?: string
    viaLocations?: (number | string)[]
    dropoffLocationId?: number | string
    dropoffDate?: string
  }
  // Step 5
  containerDetails?: any[]
  // Step 6
  stockAllocations?: any[]
  // Step 7
  driverAllocation?: any
  // Additional
  instructions?: string
  jobNotes?: string
  releaseNumber?: string
  weight?: string
}

interface MultistepExportContainerBookingFormProps {
  initialData?: ExportContainerBookingData
  onSave?: (data: ExportContainerBookingData) => Promise<void>
  onCancel?: () => void
}

const TOTAL_STEPS = 7

export function MultistepExportContainerBookingForm({
  initialData,
  onSave,
  onCancel,
}: MultistepExportContainerBookingFormProps) {
  const { tenant } = useTenant()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<string, string>>>(
    {},
  )

  const [formData, setFormData] = useState<ExportContainerBookingData>(() => {
    return (
      initialData || {
        status: 'draft',
        containerSizeIds: [],
        containerQuantities: {},
      }
    )
  })

  useEffect(() => {
    if (initialData) {
      setFormData({ ...initialData })
    }
  }, [initialData])

  // Auto-save on step change
  useEffect(() => {
    // Auto-save when moving to a new step (skip initial mount)
    if (step > 0) {
      // Use a small delay to ensure state updates are complete
      const timeoutId = setTimeout(() => {
        autoSave()
      }, 100)
      return () => clearTimeout(timeoutId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const validateStep = useCallback(
    (stepNumber: number): boolean => {
      let schema
      let stepData: any

      switch (stepNumber) {
        case 0:
          schema = step1Schema
          stepData = {
            customerReference: formData.customerReference,
            bookingReference: formData.bookingReference,
            chargeToId: formData.chargeToId,
            consignorId: formData.consignorId,
          }
          break
        case 1:
          schema = step2Schema
          stepData = {
            vesselId: formData.vesselId,
            etd: formData.etd,
            receivalStart: formData.receivalStart,
            cutoff: formData.cutoff,
          }
          break
        case 2:
          schema = step3Schema
          stepData = {
            fromId: formData.fromId,
            toId: formData.toId,
            containerSizeIds: formData.containerSizeIds,
            containerQuantities: formData.containerQuantities,
          }
          break
        case 3:
          schema = step4Schema
          stepData = {
            emptyRouting: formData.emptyRouting,
            fullRouting: formData.fullRouting,
          }
          break
        case 4:
          schema = step5Schema
          stepData = {
            containerDetails: formData.containerDetails,
          }
          break
        case 5:
          schema = step6Schema
          // Normalize stockAllocations to match schema expectations
          // Step 6 is optional - stock allocations can be added later, so allow empty/undefined
          const stockAllocations = formData.stockAllocations
          if (!stockAllocations || stockAllocations.length === 0) {
            // Empty or undefined is valid for step 6
            stepData = {
              stockAllocations: undefined,
            }
          } else {
            const normalizedStockAllocations = stockAllocations
              .map((allocation: any) => {
                // Extract containerDetailId (handle both object and number)
                const containerDetailId =
                  typeof allocation.containerDetailId === 'object' &&
                  allocation.containerDetailId !== null
                    ? allocation.containerDetailId.id || allocation.containerDetailId
                    : allocation.containerDetailId

                const containerDetailIdNum = Number(containerDetailId)
                // Skip allocations without valid containerDetailId
                if (!containerDetailIdNum || containerDetailIdNum <= 0) {
                  return null
                }

                // Normalize product lines if they exist
                // Filter out product lines that don't have required fields (skuId)
                const normalizedProductLines = (allocation.productLines || [])
                  .map((line: any) => {
                    // Extract skuId (handle both object and number)
                    const skuId =
                      typeof line.skuId === 'object' && line.skuId !== null
                        ? line.skuId.id || line.skuId
                        : line.skuId

                    const skuIdNum = Number(skuId)
                    // Skip product lines without valid skuId
                    if (!skuIdNum || skuIdNum <= 0) {
                      return null
                    }

                    return {
                      skuId: skuIdNum,
                      batchNumber: line.batchNumber || undefined,
                      expectedQty: line.expectedQty,
                      pickedQty: line.pickedQty,
                      expectedWeight: line.expectedWeight,
                      pickedWeight: line.pickedWeight,
                      allocatedQty: line.allocatedQty,
                      allocatedWeight: line.allocatedWeight,
                      allocatedCubicPerHU: line.allocatedCubicPerHU,
                      pltQty: line.pltQty,
                      LPN: line.LPN,
                      location: line.location === null ? undefined : line.location,
                      // Convert null to undefined for optional string fields
                      expiryDate: line.expiryDate === null ? undefined : line.expiryDate,
                      attribute1: line.attribute1 === null ? undefined : line.attribute1,
                      attribute2: line.attribute2 === null ? undefined : line.attribute2,
                    }
                  })
                  .filter((line: any) => line !== null) // Remove invalid product lines

                return {
                  containerDetailId: containerDetailIdNum,
                  productLines:
                    normalizedProductLines.length > 0 ? normalizedProductLines : undefined,
                  stage: allocation.stage || 'allocated',
                }
              })
              .filter((allocation: any) => allocation !== null) // Remove invalid allocations
            stepData = {
              stockAllocations: normalizedStockAllocations,
            }
          }
          break
        case 6:
          schema = step7Schema
          stepData = {
            driverAllocation: formData.driverAllocation,
          }
          break
        default:
          return true
      }

      const result = schema.safeParse(stepData)
      if (!result.success) {
        const errors: Record<string, string> = {}
        result.error.errors.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path.join('.')] = err.message
          }
        })
        setValidationErrors((prev) => ({ ...prev, [stepNumber]: errors }))
        return false
      }

      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[stepNumber]
        return newErrors
      })
      return true
    },
    [formData],
  )

  // Transform formData to API format (parse chargeToId, fromId, toId from "collection:id" format)
  const transformFormDataForAPI = (data: ExportContainerBookingData) => {
    const transformed = { ...data }

    // Parse chargeToId if it's in "collection:id" format
    if (typeof transformed.chargeToId === 'string' && transformed.chargeToId.includes(':')) {
      const [collection, idStr] = transformed.chargeToId.split(':')
      const id = parseInt(idStr, 10)
      if (!isNaN(id) && (collection === 'customers' || collection === 'paying-customers')) {
        transformed.chargeToId = id as any
        ;(transformed as any).chargeToCollection = collection
      }
    }

    // Parse fromId if it's in "collection:id" format
    if (typeof transformed.fromId === 'string' && transformed.fromId.includes(':')) {
      const [collection, idStr] = transformed.fromId.split(':')
      const id = parseInt(idStr, 10)
      if (
        !isNaN(id) &&
        (collection === 'customers' ||
          collection === 'paying-customers' ||
          collection === 'empty-parks' ||
          collection === 'wharves')
      ) {
        // Set fromCollection first so the hook can use it
        ;(transformed as any).fromCollection = collection
        // Set fromId as number - the hook will populate address fields
        transformed.fromId = id as any
      } else {
        // Invalid format, remove it
        delete transformed.fromId
      }
    } else if (transformed.fromId === '' || transformed.fromId === null) {
      delete transformed.fromId
    }

    // Parse toId if it's in "collection:id" format
    if (typeof transformed.toId === 'string' && transformed.toId.includes(':')) {
      const [collection, idStr] = transformed.toId.split(':')
      const id = parseInt(idStr, 10)
      if (
        !isNaN(id) &&
        (collection === 'customers' ||
          collection === 'paying-customers' ||
          collection === 'empty-parks' ||
          collection === 'wharves')
      ) {
        // Set toCollection first so the hook can use it
        ;(transformed as any).toCollection = collection
        // Set toId as number - the hook will populate address fields
        transformed.toId = id as any
      } else {
        // Invalid format, remove it
        delete transformed.toId
      }
    } else if (transformed.toId === '' || transformed.toId === null) {
      delete transformed.toId
    }

    // Parse routing fields - convert "collection:id" format to numbers
    // Full Routing
    if (transformed.fullRouting) {
      const fullRouting = { ...transformed.fullRouting }

      // Parse pickupLocationId
      if (
        typeof fullRouting.pickupLocationId === 'string' &&
        fullRouting.pickupLocationId.includes(':')
      ) {
        const [, idStr] = fullRouting.pickupLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          fullRouting.pickupLocationId = id as any
        } else {
          delete fullRouting.pickupLocationId
        }
      }

      // Parse dropoffLocationId
      if (
        typeof fullRouting.dropoffLocationId === 'string' &&
        fullRouting.dropoffLocationId.includes(':')
      ) {
        const [, idStr] = fullRouting.dropoffLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          fullRouting.dropoffLocationId = id as any
        } else {
          delete fullRouting.dropoffLocationId
        }
      }

      // Parse viaLocations array - filter out empty strings and invalid values
      if (Array.isArray(fullRouting.viaLocations)) {
        const parsedVia = fullRouting.viaLocations
          .map((via) => {
            if (!via || via === '') return null
            if (typeof via === 'string' && via.includes(':')) {
              const [, idStr] = via.split(':')
              const id = parseInt(idStr, 10)
              return !isNaN(id) ? id : null
            }
            return typeof via === 'number' ? via : null
          })
          .filter((via): via is number => via !== null) as any
        // Only set if array has valid values, otherwise set to empty array
        fullRouting.viaLocations = parsedVia.length > 0 ? parsedVia : []
      }

      transformed.fullRouting = fullRouting
    }

    // Empty Routing
    if (transformed.emptyRouting) {
      const emptyRouting = { ...transformed.emptyRouting }

      // Parse pickupLocationId
      if (
        typeof emptyRouting.pickupLocationId === 'string' &&
        emptyRouting.pickupLocationId.includes(':')
      ) {
        const [, idStr] = emptyRouting.pickupLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          emptyRouting.pickupLocationId = id as any
        } else {
          delete emptyRouting.pickupLocationId
        }
      }

      // Parse dropoffLocationId
      if (
        typeof emptyRouting.dropoffLocationId === 'string' &&
        emptyRouting.dropoffLocationId.includes(':')
      ) {
        const [, idStr] = emptyRouting.dropoffLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          emptyRouting.dropoffLocationId = id as any
        } else {
          delete emptyRouting.dropoffLocationId
        }
      }

      // Parse viaLocations array - filter out empty strings and invalid values
      if (Array.isArray(emptyRouting.viaLocations)) {
        const parsedVia = emptyRouting.viaLocations
          .map((via) => {
            if (!via || via === '') return null
            if (typeof via === 'string' && via.includes(':')) {
              const [, idStr] = via.split(':')
              const id = parseInt(idStr, 10)
              return !isNaN(id) ? id : null
            }
            return typeof via === 'number' ? via : null
          })
          .filter((via): via is number => via !== null) as any
        // Only set if array has valid values, otherwise set to empty array
        emptyRouting.viaLocations = parsedVia.length > 0 ? parsedVia : []
      }

      transformed.emptyRouting = emptyRouting
    }

    return transformed
  }

  const autoSave = async () => {
    // Only send fields relevant to completed steps to avoid validation errors
    const transformedData = transformFormDataForAPI(formData)
    
    // Filter out step 4+ fields if user hasn't reached those steps yet
    const dataToSave: any = { ...transformedData }
    
    // Step 0 (Basic Info) - always include
    // Step 1 (Vessel Info) - include if step >= 1
    if (step < 1) {
      delete dataToSave.vesselId
      delete dataToSave.etd
      delete dataToSave.receivalStart
      delete dataToSave.cutoff
    }
    
    // Step 2 (Locations) - include if step >= 2
    if (step < 2) {
      delete dataToSave.fromId
      delete dataToSave.fromCollection
      delete dataToSave.toId
      delete dataToSave.toCollection
      delete dataToSave.containerSizeIds
      delete dataToSave.containerQuantities
      delete dataToSave.fromAddress
      delete dataToSave.fromCity
      delete dataToSave.fromState
      delete dataToSave.fromPostcode
      delete dataToSave.toAddress
      delete dataToSave.toCity
      delete dataToSave.toState
      delete dataToSave.toPostcode
    }
    
    // Step 3 (Routing) - include if step >= 3
    if (step < 3) {
      delete dataToSave.emptyRouting
      delete dataToSave.fullRouting
      delete dataToSave.instructions
      delete dataToSave.jobNotes
      delete dataToSave.releaseNumber
      delete dataToSave.weight
    }
    
    // Step 4 (Container Details) - include if step >= 4
    if (step < 4) {
      delete dataToSave.containerDetails
    }
    
    // Step 5 (Stock Allocation) - include if step >= 5
    if (step < 5) {
      delete dataToSave.stockAllocations
    }
    
    // Step 6 (Driver Allocation) - include if step >= 6
    if (step < 6) {
      delete dataToSave.driverAllocation
    }

    if (!formData.id) {
      // Create new booking first
      try {
        const res = await fetch('/api/export-container-bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dataToSave,
            status: 'draft',
          }),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.exportContainerBooking) {
            setFormData((prev) => ({ ...prev, id: data.exportContainerBooking.id }))
            toast.success('Draft saved')
          }
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Error auto-saving:', errorData)
        }
      } catch (error) {
        console.error('Error auto-saving:', error)
      }
    } else {
      // Update existing booking
      try {
        const res = await fetch(`/api/export-container-bookings/${formData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })

        if (res.ok) {
          toast.success('Draft saved')
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error('Error auto-saving:', errorData)
        }
      } catch (error) {
        console.error('Error auto-saving:', error)
      }
    }
  }

  const handleNext = async () => {
    if (!validateStep(step)) {
      toast.error('Please fix validation errors before proceeding')
      return
    }

    // Auto-save before moving to next step
    await autoSave()

    if (step < TOTAL_STEPS - 1) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1)
    }
  }

  const handleSave = async () => {
    // Validate all steps
    let allValid = true
    for (let i = 0; i < TOTAL_STEPS; i++) {
      if (!validateStep(i)) {
        allValid = false
      }
    }

    if (!allValid) {
      toast.error('Please fix all validation errors before saving')
      return
    }

    setSaving(true)
    try {
      if (onSave) {
        await onSave(formData)
      } else {
        await autoSave()
      }
      toast.success('Booking saved successfully')
    } catch (error) {
      console.error('Error saving booking:', error)
      toast.error('Failed to save booking')
    } finally {
      setSaving(false)
    }
  }

  const stepTitles = [
    'Basic Information',
    'Vessel Information',
    'Locations',
    'Routing',
    'Container Details',
    'Stock Allocation',
    'Driver Allocation',
  ]

  // Memoize props for Step 7 to prevent infinite re-renders
  const step7RoutingData = useMemo(
    () => ({
      emptyRouting: formData.emptyRouting,
      fullRouting: formData.fullRouting,
    }),
    [formData.emptyRouting, formData.fullRouting],
  )

  const step7Step3Data = useMemo(
    () => ({
      fromId: formData.fromId,
      toId: formData.toId,
    }),
    [formData.fromId, formData.toId],
  )

  const step7OnUpdate = useCallback(
    (data: any) =>
      setFormData((prev) => ({
        ...prev,
        driverAllocation: { ...(prev.driverAllocation || {}), ...data },
      })),
    [],
  )

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Create Export Container Booking</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-6">
            {stepTitles.map((title, index) => (
              <div key={index} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      index === step
                        ? 'bg-primary text-primary-foreground border-primary'
                        : index < step
                          ? 'bg-primary/20 text-primary border-primary'
                          : 'bg-muted text-muted-foreground border-muted'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span className="mt-2 text-xs text-center max-w-[100px]">{title}</span>
                </div>
                {index < stepTitles.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${index < step ? 'bg-primary' : 'bg-muted'}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            {step === 0 && (
              <Step1BasicInfoExport
                formData={{
                  customerReference: formData.customerReference,
                  bookingReference: formData.bookingReference,
                  chargeToId: formData.chargeToId,
                  consignorId: formData.consignorId,
                  chargeToContactName: formData.chargeToContactName,
                  chargeToContactNumber: formData.chargeToContactNumber,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[0]}
              />
            )}
            {step === 1 && (
              <Step2VesselInfoExport
                formData={{
                  vesselId: formData.vesselId,
                  etd: formData.etd,
                  receivalStart: formData.receivalStart,
                  cutoff: formData.cutoff,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[1]}
              />
            )}
            {step === 2 && (
              <Step3Locations
                formData={{
                  fromId: formData.fromId,
                  toId: formData.toId,
                  containerSizeIds: formData.containerSizeIds,
                  containerQuantities: formData.containerQuantities,
                  fromAddress: formData.fromAddress,
                  fromCity: formData.fromCity,
                  fromState: formData.fromState,
                  fromPostcode: formData.fromPostcode,
                  toAddress: formData.toAddress,
                  toCity: formData.toCity,
                  toState: formData.toState,
                  toPostcode: formData.toPostcode,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[2]}
              />
            )}
            {step === 3 && (
              <Step4RoutingExport
                formData={{
                  emptyRouting: formData.emptyRouting,
                  fullRouting: formData.fullRouting,
                  instructions: formData.instructions,
                  jobNotes: formData.jobNotes,
                  releaseNumber: formData.releaseNumber,
                  weight: formData.weight,
                }}
                step3Data={{
                  fromId: formData.fromId,
                  toId: formData.toId,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[3]}
              />
            )}
            {step === 4 && (
              <Step5ContainerDetailsExport
                bookingId={formData.id}
                formData={{
                  containerDetails: formData.containerDetails,
                }}
                step3Data={{
                  containerSizeIds: formData.containerSizeIds,
                  containerQuantities: formData.containerQuantities,
                }}
                step4Data={{
                  emptyRouting: formData.emptyRouting,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[4]}
              />
            )}
            {step === 5 && (
              <Step6StockAllocationExport
                bookingId={formData.id || 0}
                bookingStatus={formData.status}
                formData={{
                  containerDetails: formData.containerDetails,
                  stockAllocations: formData.stockAllocations,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[5]}
              />
            )}
            {step === 6 && (
              <Step7DriverAllocationExport
                bookingId={formData.id || 0}
                formData={formData.driverAllocation || {}}
                routingData={step7RoutingData}
                step3Data={step7Step3Data}
                onUpdate={step7OnUpdate}
                errors={validationErrors[6]}
              />
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center pt-6 border-t">
            <div>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleBack} disabled={step === 0}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              {step < TOTAL_STEPS - 1 ? (
                <Button type="button" onClick={handleNext}>
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button type="button" onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  {saving ? 'Saving...' : 'Save Booking'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
