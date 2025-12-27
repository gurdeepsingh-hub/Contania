import type { CollectionConfig } from 'payload'

export const ContainerDetails: CollectionConfig = {
  slug: 'container-details',
  admin: {
    useAsTitle: 'containerNumber',
  },
  access: {
    create: ({ req }) => {
      const user = (req as unknown as { user?: { role?: string; tenantId?: number | string } }).user
      if (user?.role === 'superadmin') return true
      return !!user?.tenantId
    },
    read: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        // Will be filtered through container booking relationship in API routes
        return true
      }
      return false
    },
    update: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return true // Will be filtered in API routes
      }
      return false
    },
    delete: ({ req }) => {
      const user = (
        req as unknown as {
          user?: { role?: string; tenantId?: number | string; collection?: string }
        }
      ).user
      if (user?.role === 'superadmin' || user?.collection === 'users') return true
      if (user?.tenantId) {
        return true // Will be filtered in API routes
      }
      return false
    },
  },
  fields: [
    {
      name: 'containerBookingId',
      type: 'relationship',
      relationTo: ['import-container-bookings', 'export-container-bookings'],
      required: true,
      admin: {
        description: 'Links container detail to container booking (import or export)',
      },
    },
    {
      name: 'containerNumber',
      type: 'text',
      required: true,
      admin: {
        description: 'Container number',
      },
    },
    {
      name: 'containerSizeId',
      type: 'relationship',
      relationTo: 'container-sizes',
      required: true,
      admin: {
        description: 'Container size (prefilled from Step 3)',
      },
    },
    {
      name: 'gross',
      type: 'text',
      admin: {
        description: 'Gross weight',
      },
    },
    {
      name: 'tare',
      type: 'text',
      admin: {
        description: 'Tare weight',
      },
    },
    {
      name: 'net',
      type: 'text',
      admin: {
        description: 'Net weight',
      },
    },
    {
      name: 'pin',
      type: 'text',
      admin: {
        description: 'PIN number',
      },
    },
    {
      name: 'whManifest',
      type: 'text',
      admin: {
        description: 'Warehouse manifest number',
      },
    },
    {
      name: 'isoCode',
      type: 'text',
      admin: {
        description: 'ISO container code',
      },
    },
    {
      name: 'timeSlot',
      type: 'text',
      admin: {
        description: 'Time slot for container',
      },
    },
    {
      name: 'emptyTimeSlot',
      type: 'text',
      admin: {
        description: 'Empty container time slot',
      },
    },
    {
      name: 'dehireDate',
      type: 'date',
      admin: {
        description: 'Dehire date',
      },
    },
    {
      name: 'shippingLineId',
      type: 'relationship',
      relationTo: 'shipping-lines',
      admin: {
        description: 'Shipping line (auto-filled from Step 4 empty routing)',
      },
    },
    {
      name: 'countryOfOrigin',
      type: 'text',
      admin: {
        description: 'Country of origin',
      },
    },
    {
      name: 'orderRef',
      type: 'text',
      admin: {
        description: 'Order reference',
      },
    },
    {
      name: 'jobAvailability',
      type: 'date',
      admin: {
        description: 'Job availability date',
      },
    },
    {
      name: 'sealNumber',
      type: 'text',
      admin: {
        description: 'Seal number',
      },
    },
    {
      name: 'customerRequestDate',
      type: 'date',
      admin: {
        description: 'Customer requested date',
      },
    },
    {
      name: 'dock',
      type: 'text',
      admin: {
        description: 'Dock location',
      },
    },
    {
      name: 'confirmedUnpackDate',
      type: 'date',
      admin: {
        description: 'Confirmed unpack date',
      },
    },
    {
      name: 'yardLocation',
      type: 'text',
      admin: {
        description: 'Yard location',
      },
    },
    {
      name: 'secureSealsIntact',
      type: 'date',
      admin: {
        description: 'Secure seals intact date',
      },
    },
    {
      name: 'inspectUnpack',
      type: 'date',
      admin: {
        description: 'Inspect unpack date',
      },
    },
    {
      name: 'directionType',
      type: 'text',
      admin: {
        description: 'Direction type',
      },
    },
    {
      name: 'houseBillNumber',
      type: 'text',
      admin: {
        description: 'House bill of lading number',
      },
    },
    {
      name: 'oceanBillNumber',
      type: 'text',
      admin: {
        description: 'Ocean bill of lading number',
      },
    },
    {
      name: 'ventAirflow',
      type: 'text',
      admin: {
        description: 'Vent airflow information',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        // Auto-fill shipping line from container booking's empty routing
        if (data.containerBookingId && !data.shippingLineId && req?.payload) {
          try {
            const bookingRef =
              typeof data.containerBookingId === 'object'
                ? (data.containerBookingId as { id: number; relationTo?: string })
                : null

            if (bookingRef) {
              const bookingId = bookingRef.id
              const collection = bookingRef.relationTo

              if (bookingId && collection) {
                // Try both collections
                let booking = null
                try {
                  booking = await req.payload.findByID({
                    collection: collection as 'import-container-bookings' | 'export-container-bookings',
                    id: bookingId,
                  })
                } catch (error) {
                  // If collection name doesn't match, try the other one
                  const otherCollection =
                    collection === 'import-container-bookings'
                      ? 'export-container-bookings'
                      : 'import-container-bookings'
                  try {
                    booking = await req.payload.findByID({
                      collection: otherCollection,
                      id: bookingId,
                    })
                  } catch (e) {
                    console.error('Error fetching booking:', e)
                  }
                }

                if (booking) {
                  const bookingData = booking as {
                    emptyRouting?: {
                      shippingLineId?: number | { id: number }
                    }
                  }

                  if (bookingData.emptyRouting?.shippingLineId) {
                    const shippingLineId =
                      typeof bookingData.emptyRouting.shippingLineId === 'object'
                        ? bookingData.emptyRouting.shippingLineId.id
                        : bookingData.emptyRouting.shippingLineId

                    data.shippingLineId = shippingLineId
                  }
                }
              }
            }
          } catch (error) {
            console.error('Error auto-filling shipping line:', error)
          }
        }

        return data
      },
    ],
  },
}

