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
} from '@/lib/validations/import-container-booking-schemas'
import { useTenant } from '@/lib/tenant-context'
import { Step1BasicInfoImport } from './steps/step1-basic-info-import'
import { Step2VesselLocationsImport } from './steps/step2-vessel-locations-import'
import { Step4RoutingImport } from './steps/step4-routing-import'
import { Step5ContainerDetailsImport } from './steps/step5-container-details-import'
import { Step6StockAllocationImport } from './steps/step6-stock-allocation-import'
import { Step7DriverAllocationImport } from './steps/step7-driver-allocation-import'
import { canTransitionTo, getNextValidStatus } from '@/lib/container-booking-status'

type ImportContainerBookingData = {
  id?: number
  bookingCode?: string
  status?: 'draft' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  // Step 1
  customerReference?: string
  bookingReference?: string
  chargeToId?: number | string
  consigneeId?: number
  chargeToContactName?: string
  chargeToContactNumber?: string
  // Step 2
  vesselId?: number
  eta?: string
  availability?: boolean
  storageStart?: string
  firstFreeImportDate?: string
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
    pickupLocationCollection?: string
    pickupDate?: string
    viaLocations?: (number | string)[]
    viaLocationsCollections?: string[]
    dropoffLocationId?: number | string
    dropoffLocationCollection?: string
    dropoffDate?: string
    requestedDeliveryDate?: string
  }
  fullRouting?: {
    pickupLocationId?: number | string
    pickupLocationCollection?: string
    pickupDate?: string
    viaLocations?: (number | string)[]
    viaLocationsCollections?: string[]
    dropoffLocationId?: number | string
    dropoffLocationCollection?: string
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
}

interface MultistepImportContainerBookingFormProps {
  initialData?: ImportContainerBookingData
  onSave?: (data: ImportContainerBookingData) => Promise<void>
  onCancel?: () => void
}

const TOTAL_STEPS = 6

export function MultistepImportContainerBookingForm({
  initialData,
  onSave,
  onCancel,
}: MultistepImportContainerBookingFormProps) {
  const { tenant } = useTenant()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<number, Record<string, string>>>(
    {},
  )

  const [formData, setFormData] = useState<ImportContainerBookingData>(() => {
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
      // If initialData has containerDetails, ensure they're available for Step 5
      if (initialData.containerDetails && initialData.containerDetails.length > 0) {
        // Container details will be loaded by Step5ContainerDetailsImport component
        console.log(
          '[Form] Initial data includes container details:',
          initialData.containerDetails.length,
        )
      }
    }
  }, [initialData])

  // Note: Routing location prefilling is now handled by the RoutingSection component
  // to avoid race conditions and duplicate state updates

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
            consigneeId: formData.consigneeId,
          }
          break
        case 1:
          schema = step2Schema
          // Normalize containerSizeIds to just numbers (handle populated objects)
          const normalizedSizeIds = (formData.containerSizeIds || [])
            .map((size: any) => {
              if (typeof size === 'number') return size
              if (typeof size === 'object' && size !== null && typeof size.id === 'number') {
                return size.id
              }
              return Number(size)
            })
            .filter((id: any) => !isNaN(id) && id > 0)

          // Ensure containerQuantities is an object (not undefined) and filter out invalid values
          const quantities = formData.containerQuantities || {}
          const cleanedQuantities: Record<string, number> = {}
          Object.entries(quantities).forEach(([key, value]) => {
            const numValue = typeof value === 'number' ? value : Number(value)
            if (!isNaN(numValue) && numValue >= 1) {
              cleanedQuantities[key] = numValue
            }
          })
          stepData = {
            vesselId: formData.vesselId,
            eta: formData.eta,
            availability: formData.availability === null ? undefined : formData.availability,
            storageStart: formData.storageStart,
            firstFreeImportDate: formData.firstFreeImportDate,
            fromId: formData.fromId,
            toId: formData.toId,
            containerSizeIds: normalizedSizeIds,
            containerQuantities: cleanedQuantities,
          }
          console.log('[validateStep] Step 2 data:', JSON.stringify(stepData, null, 2))
          break
        case 2:
          schema = step3Schema
          stepData = {
            emptyRouting: formData.emptyRouting,
            fullRouting: formData.fullRouting,
          }
          break
        case 3:
          schema = step4Schema
          stepData = {
            containerDetails: formData.containerDetails,
          }
          break
        case 4:
          schema = step5Schema
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
                      batchNumber: line.batchNumber || undefined, // Use undefined instead of empty string
                      expectedQtyImport: line.expectedQtyImport || line.expectedQty,
                      recievedQty: line.recievedQty,
                      expectedWeightImport: line.expectedWeightImport || line.expectedWeight,
                      recievedWeight: line.recievedWeight,
                      weightPerHU: line.weightPerHU,
                      expectedCubicPerHU: line.expectedCubicPerHU,
                      recievedCubicPerHU: line.recievedCubicPerHU,
                      palletSpaces: line.palletSpaces,
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
                  stage: allocation.stage || 'expected',
                }
              })
              .filter((allocation: any) => allocation !== null) // Remove invalid allocations
            stepData = {
              stockAllocations: normalizedStockAllocations,
            }
          }
          break
        case 5:
          schema = step6Schema
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
        result.error.issues.forEach((err) => {
          if (err.path.length > 0) {
            errors[err.path.join('.')] = err.message
          } else {
            // Handle root-level errors
            errors['_root'] = err.message
          }
        })
        console.log(`[validateStep] Step ${stepNumber} validation failed:`, {
          stepData,
          errors,
          zodErrors: result.error.issues,
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

  // Transform formData to API format (parse chargeToId from "customers:6" to Payload relationship format)
  const transformFormDataForAPI = (data: ImportContainerBookingData) => {
    const transformed = { ...data }

    // Parse chargeToId if it's in "collection:id" format
    // For polymorphic relationships in Payload, we need to pass the ID as a number
    // The collection will be determined by the hook based on chargeToCollection
    if (typeof transformed.chargeToId === 'string' && transformed.chargeToId.includes(':')) {
      const [collection, idStr] = transformed.chargeToId.split(':')
      const id = parseInt(idStr, 10)
      if (!isNaN(id) && (collection === 'customers' || collection === 'paying-customers')) {
        // Set chargeToCollection first so the hook can use it
        ;(transformed as any).chargeToCollection = collection
        // Then set chargeToId as number - Payload will use chargeToCollection to determine the relation
        transformed.chargeToId = id as any
      } else {
        // Invalid format, remove it
        delete transformed.chargeToId
      }
    } else if (transformed.chargeToId === '' || transformed.chargeToId === null) {
      // Remove empty chargeToId
      delete transformed.chargeToId
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
        ;(transformed as any).fromCollection = collection
        transformed.fromId = id as any
      } else {
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
        ;(transformed as any).toCollection = collection
        transformed.toId = id as any
      } else {
        delete transformed.toId
      }
    } else if (transformed.toId === '' || transformed.toId === null) {
      delete transformed.toId
    }

    // Parse routing fields - convert "collection:id" format to numbers
    // Full Routing
    if (transformed.fullRouting) {
      const fullRouting: any = { ...transformed.fullRouting }

      // Parse pickupLocationId - handle both "collection:id" format and separate fields
      if (
        typeof fullRouting.pickupLocationId === 'string' &&
        fullRouting.pickupLocationId.includes(':')
      ) {
        // Extract from "collection:id" format
        const [collection, idStr] = fullRouting.pickupLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          fullRouting.pickupLocationId = id
          fullRouting.pickupLocationCollection = collection
        } else {
          delete fullRouting.pickupLocationId
          delete fullRouting.pickupLocationCollection
        }
      } else if (
        !fullRouting.pickupLocationId ||
        fullRouting.pickupLocationId === '' ||
        fullRouting.pickupLocationId === null
      ) {
        delete fullRouting.pickupLocationId
        delete fullRouting.pickupLocationCollection
      } else {
        // ID is already a number, ensure it stays as number
        fullRouting.pickupLocationId = Number(fullRouting.pickupLocationId)
        // Collection should already be set from form data, keep it
        if (!fullRouting.pickupLocationCollection) {
          // If no collection provided, try to infer from step3Data (fromId)
          // This is a fallback for prefilled values from Step 3
          const transformedAny = transformed as any
          if (transformedAny.fromId && transformedAny.fromCollection) {
            // If pickupLocationId matches fromId, use fromCollection
            const fromIdNum =
              typeof transformedAny.fromId === 'number'
                ? transformedAny.fromId
                : parseInt(String(transformedAny.fromId).split(':').pop() || '', 10)
            if (!isNaN(fromIdNum) && fullRouting.pickupLocationId === fromIdNum) {
              fullRouting.pickupLocationCollection = transformedAny.fromCollection
              console.log(
                `[transformFormDataForAPI] Inferred pickupLocationCollection from fromCollection: ${transformedAny.fromCollection}`,
              )
            }
          }
        }
      }

      // Parse dropoffLocationId - handle both "collection:id" format and separate fields
      if (
        typeof fullRouting.dropoffLocationId === 'string' &&
        fullRouting.dropoffLocationId.includes(':')
      ) {
        // Extract from "collection:id" format
        const [collection, idStr] = fullRouting.dropoffLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          fullRouting.dropoffLocationId = id
          fullRouting.dropoffLocationCollection = collection
        } else {
          delete fullRouting.dropoffLocationId
          delete fullRouting.dropoffLocationCollection
        }
      } else if (
        !fullRouting.dropoffLocationId ||
        fullRouting.dropoffLocationId === '' ||
        fullRouting.dropoffLocationId === null
      ) {
        delete fullRouting.dropoffLocationId
        delete fullRouting.dropoffLocationCollection
      } else {
        // ID is already a number, ensure it stays as number
        fullRouting.dropoffLocationId = Number(fullRouting.dropoffLocationId)
        // Collection should already be set from form data, keep it
        if (!fullRouting.dropoffLocationCollection) {
          // If no collection provided, try to infer from step3Data (toId)
          // This is a fallback for prefilled values from Step 3
          const transformedAny = transformed as any
          if (transformedAny.toId && transformedAny.toCollection) {
            // If dropoffLocationId matches toId, use toCollection
            const toIdNum =
              typeof transformedAny.toId === 'number'
                ? transformedAny.toId
                : parseInt(String(transformedAny.toId).split(':').pop() || '', 10)
            if (!isNaN(toIdNum) && fullRouting.dropoffLocationId === toIdNum) {
              fullRouting.dropoffLocationCollection = transformedAny.toCollection
              console.log(
                `[transformFormDataForAPI] Inferred dropoffLocationCollection from toCollection: ${transformedAny.toCollection}`,
              )
            }
          }
        }
      }

      // Parse viaLocations array - omit if empty, extract collections
      if (Array.isArray(fullRouting.viaLocations)) {
        if (fullRouting.viaLocations.length === 0) {
          delete fullRouting.viaLocations
          delete fullRouting.viaLocationsCollections
        } else {
          const parsedVia: number[] = []
          const collections: string[] = []

          fullRouting.viaLocations.forEach((via: number | string, index: number) => {
            if (typeof via === 'string' && via.includes(':')) {
              // Extract from "collection:id" format
              const [collection, idStr] = via.split(':')
              const id = parseInt(idStr, 10)
              if (!isNaN(id)) {
                parsedVia.push(id)
                collections.push(collection)
              }
            } else if (typeof via === 'number') {
              // Already a number, use collection from viaLocationsCollections if available
              parsedVia.push(via)
              if (
                fullRouting.viaLocationsCollections &&
                Array.isArray(fullRouting.viaLocationsCollections) &&
                fullRouting.viaLocationsCollections[index]
              ) {
                collections.push(fullRouting.viaLocationsCollections[index])
              } else {
                collections.push('')
              }
            }
          })

          // Only include if array has valid values, otherwise omit
          if (parsedVia.length > 0) {
            fullRouting.viaLocations = parsedVia
            if (collections.length > 0 && collections.every((c) => c !== '')) {
              fullRouting.viaLocationsCollections = collections
            } else {
              delete fullRouting.viaLocationsCollections
            }
          } else {
            delete fullRouting.viaLocations
            delete fullRouting.viaLocationsCollections
          }
        }
      } else if (
        fullRouting.viaLocations === null ||
        fullRouting.viaLocations === undefined ||
        fullRouting.viaLocations === ''
      ) {
        delete fullRouting.viaLocations
        delete fullRouting.viaLocationsCollections
      }

      // Always include fullRouting if it has pickupLocationId or dropoffLocationId (even if no other fields)
      // This ensures prefilled values from Step 3 are saved
      if (
        fullRouting.pickupLocationId !== undefined ||
        fullRouting.dropoffLocationId !== undefined ||
        fullRouting.pickupDate !== undefined ||
        fullRouting.dropoffDate !== undefined ||
        (Array.isArray(fullRouting.viaLocations) && fullRouting.viaLocations.length > 0)
      ) {
        transformed.fullRouting = fullRouting
      } else {
        delete transformed.fullRouting
      }
    }

    // Empty Routing
    if (transformed.emptyRouting) {
      const emptyRouting: any = { ...transformed.emptyRouting }

      // Parse pickupLocationId
      if (
        typeof emptyRouting.pickupLocationId === 'string' &&
        emptyRouting.pickupLocationId.includes(':')
      ) {
        const [, idStr] = emptyRouting.pickupLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          emptyRouting.pickupLocationId = id
        } else {
          delete emptyRouting.pickupLocationId
        }
      } else if (
        !emptyRouting.pickupLocationId ||
        emptyRouting.pickupLocationId === '' ||
        emptyRouting.pickupLocationId === null
      ) {
        delete emptyRouting.pickupLocationId
      }

      // Parse dropoffLocationId - handle both "collection:id" format and separate fields
      if (
        typeof emptyRouting.dropoffLocationId === 'string' &&
        emptyRouting.dropoffLocationId.includes(':')
      ) {
        // Extract from "collection:id" format
        const [collection, idStr] = emptyRouting.dropoffLocationId.split(':')
        const id = parseInt(idStr, 10)
        if (!isNaN(id)) {
          emptyRouting.dropoffLocationId = id
          emptyRouting.dropoffLocationCollection = collection
        } else {
          delete emptyRouting.dropoffLocationId
          delete emptyRouting.dropoffLocationCollection
        }
      } else if (
        !emptyRouting.dropoffLocationId ||
        emptyRouting.dropoffLocationId === '' ||
        emptyRouting.dropoffLocationId === null
      ) {
        delete emptyRouting.dropoffLocationId
        delete emptyRouting.dropoffLocationCollection
      } else {
        // ID is already a number, ensure it stays as number
        emptyRouting.dropoffLocationId = Number(emptyRouting.dropoffLocationId)
        // Collection should already be set from form data, keep it
      }

      // Parse viaLocations array - omit if empty, extract collections
      if (Array.isArray(emptyRouting.viaLocations)) {
        if (emptyRouting.viaLocations.length === 0) {
          delete emptyRouting.viaLocations
          delete emptyRouting.viaLocationsCollections
        } else {
          const parsedVia: number[] = []
          const collections: string[] = []

          emptyRouting.viaLocations.forEach((via: number | string, index: number) => {
            if (!via || via === '') return
            if (typeof via === 'string' && via.includes(':')) {
              // Extract from "collection:id" format
              const [collection, idStr] = via.split(':')
              const id = parseInt(idStr, 10)
              if (!isNaN(id)) {
                parsedVia.push(id)
                collections.push(collection)
              }
            } else if (typeof via === 'number') {
              // Already a number, use collection from viaLocationsCollections if available
              parsedVia.push(via)
              if (
                emptyRouting.viaLocationsCollections &&
                Array.isArray(emptyRouting.viaLocationsCollections) &&
                emptyRouting.viaLocationsCollections[index]
              ) {
                collections.push(emptyRouting.viaLocationsCollections[index])
              } else {
                collections.push('')
              }
            }
          })

          // Only include if array has valid values, otherwise omit
          if (parsedVia.length > 0) {
            emptyRouting.viaLocations = parsedVia
            if (collections.length > 0 && collections.every((c) => c !== '')) {
              emptyRouting.viaLocationsCollections = collections
            } else {
              delete emptyRouting.viaLocationsCollections
            }
          } else {
            delete emptyRouting.viaLocations
            delete emptyRouting.viaLocationsCollections
          }
        }
      } else if (
        emptyRouting.viaLocations === null ||
        emptyRouting.viaLocations === undefined ||
        emptyRouting.viaLocations === ''
      ) {
        delete emptyRouting.viaLocations
        delete emptyRouting.viaLocationsCollections
      }

      // Always include emptyRouting if it has pickupLocationId, dropoffLocationId, shippingLineId, or dates
      // This ensures prefilled values from Step 3 are saved
      if (
        emptyRouting.pickupLocationId !== undefined ||
        emptyRouting.dropoffLocationId !== undefined ||
        emptyRouting.shippingLineId !== undefined ||
        emptyRouting.pickupDate !== undefined ||
        emptyRouting.dropoffDate !== undefined ||
        emptyRouting.requestedDeliveryDate !== undefined ||
        (Array.isArray(emptyRouting.viaLocations) && emptyRouting.viaLocations.length > 0)
      ) {
        transformed.emptyRouting = emptyRouting
      } else {
        delete transformed.emptyRouting
      }
    }

    // Recursively clean nested objects to remove empty arrays and null values
    // But preserve routing objects even if they only have location IDs (prefilled from Step 3)
    const cleanNestedObject = (obj: any, preserveRouting = false): any => {
      if (Array.isArray(obj)) {
        return obj.length > 0 ? obj : undefined
      }
      if (obj === null || obj === undefined || obj === '') {
        return undefined
      }
      if (typeof obj === 'object') {
        const cleaned: any = {}
        let hasValidFields = false

        // For routing objects, check if they have location IDs (even if no other fields)
        if (preserveRouting) {
          if (
            obj.pickupLocationId !== undefined ||
            obj.dropoffLocationId !== undefined ||
            obj.shippingLineId !== undefined ||
            obj.pickupDate !== undefined ||
            obj.dropoffDate !== undefined ||
            obj.requestedDeliveryDate !== undefined ||
            (Array.isArray(obj.viaLocations) && obj.viaLocations.length > 0)
          ) {
            hasValidFields = true
          }
        }

        for (const [key, val] of Object.entries(obj)) {
          // Always preserve collection fields for routing objects (they're needed for polymorphic relationships)
          if (preserveRouting && (key.endsWith('Collection') || key.endsWith('Collections'))) {
            cleaned[key] = val
            hasValidFields = true
            continue
          }
          const cleanedVal = cleanNestedObject(val, false)
          if (cleanedVal !== undefined) {
            cleaned[key] = cleanedVal
            hasValidFields = true
          }
        }
        return hasValidFields ? cleaned : undefined
      }
      return obj
    }

    // Only include fields that have values to avoid validation errors
    // Remove undefined/null/empty string values for optional fields
    // But preserve routing objects even if they only have location IDs
    const cleaned: any = {}
    Object.keys(transformed).forEach((key) => {
      const value = (transformed as any)[key]
      // Preserve routing objects (fullRouting, emptyRouting) even if they only have location IDs
      const preserveRouting = key === 'fullRouting' || key === 'emptyRouting'
      const cleanedValue = cleanNestedObject(value, preserveRouting)
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue
      }
    })

    // Final validation: Ensure all location IDs are numbers, not strings or arrays
    if (cleaned.fullRouting) {
      if (cleaned.fullRouting.pickupLocationId !== undefined) {
        if (typeof cleaned.fullRouting.pickupLocationId !== 'number') {
          cleaned.fullRouting.pickupLocationId = Number(cleaned.fullRouting.pickupLocationId)
        }
      }
      if (cleaned.fullRouting.dropoffLocationId !== undefined) {
        if (typeof cleaned.fullRouting.dropoffLocationId !== 'number') {
          cleaned.fullRouting.dropoffLocationId = Number(cleaned.fullRouting.dropoffLocationId)
        }
      }
      if (Array.isArray(cleaned.fullRouting.viaLocations)) {
        cleaned.fullRouting.viaLocations = cleaned.fullRouting.viaLocations.map((v: any) => {
          if (typeof v !== 'number') {
            return Number(v)
          }
          return v
        })
      }
    }

    if (cleaned.emptyRouting) {
      if (cleaned.emptyRouting.pickupLocationId !== undefined) {
        if (typeof cleaned.emptyRouting.pickupLocationId !== 'number') {
          cleaned.emptyRouting.pickupLocationId = Number(cleaned.emptyRouting.pickupLocationId)
        }
      }
      if (cleaned.emptyRouting.dropoffLocationId !== undefined) {
        if (typeof cleaned.emptyRouting.dropoffLocationId !== 'number') {
          cleaned.emptyRouting.dropoffLocationId = Number(cleaned.emptyRouting.dropoffLocationId)
        }
      }
      if (Array.isArray(cleaned.emptyRouting.viaLocations)) {
        cleaned.emptyRouting.viaLocations = cleaned.emptyRouting.viaLocations.map((v: any) => {
          return v
        })
      }
    }

    return cleaned
  }

  const autoSave = async () => {
    const transformedData = transformFormDataForAPI(formData)

    // Ensure status is always 'draft' for auto-save
    const dataToSave = {
      ...transformedData,
      status: 'draft',
    }

    if (!formData.id) {
      // Create new booking first
      try {
        const res = await fetch('/api/import-container-bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })

        if (res.ok) {
          const data = await res.json()
          if (data.success && data.importContainerBooking) {
            setFormData((prev) => ({ ...prev, id: data.importContainerBooking.id }))
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
        const res = await fetch(`/api/import-container-bookings/${formData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(dataToSave),
        })

        if (res.ok) {
          toast.success('Draft saved')
          console.log('Data saved:', dataToSave)
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
      const stepErrors = validationErrors[step]
      if (stepErrors) {
        const errorMessages = Object.values(stepErrors).join(', ')
        toast.error(`Please fix validation errors: ${errorMessages}`)
      } else {
        toast.error('Please fix validation errors before proceeding')
      }
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
    'Vessel & Locations',
    'Routing',
    'Container Details',
    'Stock Allocation',
    'Driver Allocation',
  ]

  // Memoize props for Step 6 to prevent infinite re-renders
  const step6RoutingData = useMemo(
    () => ({
      emptyRouting: formData.emptyRouting,
      fullRouting: formData.fullRouting,
    }),
    [formData.emptyRouting, formData.fullRouting],
  )

  const step6Step2Data = useMemo(
    () => ({
      fromId: formData.fromId,
      toId: formData.toId,
    }),
    [formData.fromId, formData.toId],
  )

  const step6OnUpdate = useCallback(
    (data: any) => setFormData((prev) => ({ ...prev, driverAllocation: data })),
    [],
  )

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <Card>
        <CardHeader>
          <CardTitle>Create Import Container Booking</CardTitle>
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
              <Step1BasicInfoImport
                formData={{
                  customerReference: formData.customerReference,
                  bookingReference: formData.bookingReference,
                  chargeToId: formData.chargeToId,
                  consigneeId: formData.consigneeId,
                  chargeToContactName: formData.chargeToContactName,
                  chargeToContactNumber: formData.chargeToContactNumber,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[0]}
              />
            )}
            {step === 1 && (
              <Step2VesselLocationsImport
                formData={{
                  vesselId: formData.vesselId,
                  eta: formData.eta,
                  availability: formData.availability,
                  storageStart: formData.storageStart,
                  firstFreeImportDate: formData.firstFreeImportDate,
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
                errors={validationErrors[1]}
              />
            )}
            {step === 2 && (
              <Step4RoutingImport
                formData={{
                  emptyRouting: formData.emptyRouting,
                  fullRouting: formData.fullRouting,
                  instructions: formData.instructions,
                  jobNotes: formData.jobNotes,
                }}
                step3Data={{
                  fromId: formData.fromId,
                  toId: formData.toId,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[2]}
              />
            )}
            {step === 3 && (
              <Step5ContainerDetailsImport
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
                errors={validationErrors[3]}
              />
            )}
            {step === 4 && (
              <Step6StockAllocationImport
                bookingId={formData.id || 0}
                bookingStatus={formData.status}
                formData={{
                  containerDetails: formData.containerDetails,
                  stockAllocations: formData.stockAllocations,
                }}
                onUpdate={(data) => setFormData((prev) => ({ ...prev, ...data }))}
                errors={validationErrors[4]}
              />
            )}
            {step === 5 && (
              <Step7DriverAllocationImport
                bookingId={formData.id || 0}
                formData={formData.driverAllocation || {}}
                routingData={step6RoutingData}
                step3Data={step6Step2Data}
                onUpdate={step6OnUpdate}
                errors={validationErrors[5]}
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
