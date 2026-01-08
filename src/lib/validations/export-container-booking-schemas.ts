import { z } from 'zod'

// Helper to convert NaN/empty to undefined for optional numbers
const numberOrUndefined = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') {
    return undefined
  }
  if (typeof val === 'number' && (Number.isNaN(val) || !Number.isFinite(val))) {
    return undefined
  }
  if (typeof val === 'number') {
    return val
  }
  if (typeof val === 'string') {
    const parsed = parseFloat(val)
    return Number.isNaN(parsed) || !Number.isFinite(parsed) ? undefined : parsed
  }
  return undefined
}, z.number().optional())

// Helper for date strings
const dateStringOrUndefined = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') {
    return undefined
  }
  if (typeof val === 'string' && val.trim() === '') {
    return undefined
  }
  return val
}, z.string().optional())

// Step 1: Basic Info
export const step1Schema = z.object({
  customerReference: z.string().min(1, 'Customer reference is required'),
  bookingReference: z.string().min(1, 'Booking reference is required'),
  chargeToId: z.union([
    z.string().refine((val) => {
      if (!val || typeof val !== 'string') return false
      const [collection, id] = val.split(':')
      return (
        (collection === 'paying-customers' || collection === 'customers') &&
        !Number.isNaN(parseInt(id, 10))
      )
    }, 'Charge to is required'),
    z.number().min(1, 'Charge to is required'),
  ]),
  consignorId: z.number().min(1, 'Consignor is required'),
})

// Step 2: Vessel Info + Locations (Merged) (Export-specific)
export const step2Schema = z
  .object({
    vesselId: numberOrUndefined,
    etd: dateStringOrUndefined,
    receivalStart: dateStringOrUndefined,
    cutoff: z.boolean().optional(),
    fromId: z.union([
      z.string().refine((val) => {
        if (!val || typeof val !== 'string') return false
        const [collection, id] = val.split(':')
        return (
          ['customers', 'paying-customers', 'empty-parks', 'wharves', 'warehouses'].includes(collection) &&
          !Number.isNaN(parseInt(id, 10))
        )
      }, 'From location is required'),
      z.number().min(1, 'From location is required'),
    ]),
    toId: z.union([
      z.string().refine((val) => {
        if (!val || typeof val !== 'string') return false
        const [collection, id] = val.split(':')
        return (
          ['customers', 'paying-customers', 'empty-parks', 'wharves', 'warehouses'].includes(collection) &&
          !Number.isNaN(parseInt(id, 10))
        )
      }, 'To location is required'),
      z.number().min(1, 'To location is required'),
    ]),
    containerSizeIds: z.array(z.number()).min(1, 'At least one container size is required'),
    containerQuantities: z.record(z.string(), z.number().min(1)).refine(
      (val) => {
        return Object.keys(val).length > 0 && Object.values(val).every((qty) => qty > 0)
      },
      {
        message: 'Container quantities are required',
      },
    ),
  })
  .refine(
    (data) => {
      // Ensure every selected container size has a quantity >= 1
      if (!data.containerSizeIds || data.containerSizeIds.length === 0) return false
      if (!data.containerQuantities || typeof data.containerQuantities !== 'object') return false

      const quantities = data.containerQuantities
      const allSizesHaveQuantities = data.containerSizeIds.every((sizeId) => {
        const sizeIdStr = String(sizeId)
        const qty = quantities[sizeIdStr]
        return typeof qty === 'number' && qty >= 1 && Number.isFinite(qty)
      })

      return allSizesHaveQuantities
    },
    {
      message: 'Please enter a quantity (≥1) for each selected container size.',
      path: ['containerQuantities'],
    },
  )

// Step 3: Routing (Export: Empty → Full)
export const step3Schema = z.object({
  emptyRouting: z
    .object({
      shippingLineId: numberOrUndefined,
      pickupLocationId: z.union([z.string(), z.number()]).optional(),
      pickupDate: dateStringOrUndefined,
      viaLocations: z.array(z.union([z.string(), z.number()])).optional(),
      dropoffLocationId: z.union([z.string(), z.number()]).optional(),
      dropoffDate: dateStringOrUndefined,
      requestedDeliveryDate: dateStringOrUndefined,
    })
    .optional(),
  fullRouting: z
    .object({
      pickupLocationId: z.union([z.string(), z.number()]).optional(),
      pickupDate: dateStringOrUndefined,
      viaLocations: z.array(z.union([z.string(), z.number()])).optional(),
      dropoffLocationId: z.union([z.string(), z.number()]).optional(),
      dropoffDate: dateStringOrUndefined,
    })
    .optional(),
})

// Step 4: Container Details (optional - containers can be auto-saved)
export const step4Schema = z.object({
  containerDetails: z
    .array(
      z.object({
        containerNumber: z.string().optional(),
        containerSizeId: z.number().optional(),
        gross: z.string().optional(),
        tare: z.string().optional(),
        net: z.string().optional(),
        pin: z.string().optional(),
        whManifest: z.string().optional(),
        isoCode: z.string().optional(),
        timeSlot: dateStringOrUndefined,
        emptyTimeSlot: dateStringOrUndefined,
        dehireDate: dateStringOrUndefined,
        shippingLineId: numberOrUndefined,
        countryOfOrigin: z.string().optional(),
        orderRef: z.string().optional(),
        jobAvailability: dateStringOrUndefined,
        sealNumber: z.string().optional(),
        customerRequestDate: dateStringOrUndefined,
        dock: z.string().optional(),
        confirmedUnpackDate: dateStringOrUndefined,
        yardLocation: z.string().optional(),
        secureSealsIntact: dateStringOrUndefined,
        inspectUnpack: dateStringOrUndefined,
        directionType: z.string().optional(),
        houseBillNumber: z.string().optional(),
        oceanBillNumber: z.string().optional(),
      }),
    )
    .optional(),
})

// Step 5: Stock Allocation (Export)
// Stock allocations are optional - can be added later, so validation is lenient
export const step5Schema = z.object({
  stockAllocations: z
    .array(
      z.object({
        containerDetailId: z.number().min(1, 'Container detail is required'),
        productLines: z
          .array(
            z.object({
              skuId: z.number().min(1, 'SKU is required'),
              batchNumber: z.string().optional(), // Made optional since it might not be set initially
              expectedQty: numberOrUndefined,
              pickedQty: numberOrUndefined,
              expectedWeight: numberOrUndefined,
              pickedWeight: numberOrUndefined,
              allocatedQty: numberOrUndefined,
              allocatedWeight: numberOrUndefined,
              allocatedCubicPerHU: numberOrUndefined,
              pltQty: numberOrUndefined,
              LPN: z
                .array(
                  z.object({
                    lpnNumber: z.string().min(1, 'LPN number is required'),
                  }),
                )
                .optional(),
              location: z.string().optional(),
              expiryDate: z.string().optional(),
              attribute1: z.string().optional(),
              attribute2: z.string().optional(),
            }),
          )
          .optional(),
        stage: z.enum(['allocated', 'picked', 'dispatched']).optional(),
      }),
    )
    .optional(),
})

// Step 6: Driver Allocation
export const step6Schema = z.object({
  driverAllocation: z
    .object({
      emptyContainer: z
        .object({
          date: dateStringOrUndefined,
          time: z.string().optional(),
          vehicleId: numberOrUndefined,
          driverId: numberOrUndefined,
          legs: z
            .array(
              z.object({
                from: z.union([z.string(), z.number()]),
                to: z.union([z.string(), z.number()]),
              }),
            )
            .optional(),
        })
        .optional(),
      fullContainer: z
        .object({
          date: dateStringOrUndefined,
          time: z.string().optional(),
          vehicleId: numberOrUndefined,
          driverId: numberOrUndefined,
          legs: z
            .array(
              z.object({
                from: z.union([z.string(), z.number()]),
                to: z.union([z.string(), z.number()]),
              }),
            )
            .optional(),
        })
        .optional(),
    })
    .optional(),
})

// Complete booking schema (all steps combined)
export const completeBookingSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)
  .merge(step5Schema)
  .merge(step6Schema)

export type Step1Data = z.infer<typeof step1Schema>
export type Step2Data = z.infer<typeof step2Schema>
export type Step3Data = z.infer<typeof step3Schema>
export type Step4Data = z.infer<typeof step4Schema>
export type Step5Data = z.infer<typeof step5Schema>
export type Step6Data = z.infer<typeof step6Schema>
export type CompleteBookingData = z.infer<typeof completeBookingSchema>
