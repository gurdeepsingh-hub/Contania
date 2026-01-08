import type { CollectionConfig } from 'payload'

/**
 * Generate a random alphanumeric code for container detail number
 */
function generateContainerDetailCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Generate a unique container number for a tenant
 */
async function generateUniqueContainerNumber(
  payload: any,
  tenantId: number | string,
  maxAttempts: number = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const code = generateContainerDetailCode(8)
    const containerNumber = `CN-${code}`

    // Check if this container number already exists for this tenant
    // We need to check through bookings to ensure tenant uniqueness
    const existing = await payload.find({
      collection: 'container-details',
      where: {
        containerNumber: {
          equals: containerNumber,
        },
      },
      limit: 1,
      depth: 1, // Need depth to check tenant through booking
    })

    // If found, check if it belongs to the same tenant
    if (existing.docs.length > 0) {
      const detail = existing.docs[0] as any
      const bookingRef = detail.containerBookingId

      if (bookingRef) {
        let bookingTenantId: number | string | undefined = undefined

        // Extract tenant from booking
        if (typeof bookingRef === 'object' && bookingRef !== null) {
          const bookingId = bookingRef.id || (bookingRef.value && bookingRef.value.id)
          const collection = bookingRef.relationTo

          if (bookingId && collection) {
            try {
              const booking = await payload.findByID({
                collection: collection as 'import-container-bookings' | 'export-container-bookings',
                id: bookingId,
              })

              const bookingData = booking as { tenantId?: number | { id: number } }
              if (bookingData.tenantId) {
                bookingTenantId =
                  typeof bookingData.tenantId === 'object'
                    ? bookingData.tenantId.id
                    : bookingData.tenantId
              }
            } catch {
              // Continue to next attempt
            }
          }
        }

        // If same tenant, try again
        if (bookingTenantId && String(bookingTenantId) === String(tenantId)) {
          continue
        }
      }
    }

    // If not found or belongs to different tenant, use this number
    if (existing.docs.length === 0) {
      return containerNumber
    }
  }

  // Fallback: use timestamp-based code if all attempts fail
  const timestamp = Date.now().toString().slice(-6)
  const random = generateContainerDetailCode(4)
  return `CN-${timestamp}-${random}`
}

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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'expecting',
      options: [
        // Import statuses
        { label: 'Expecting', value: 'expecting' },
        { label: 'Received', value: 'received' },
        { label: 'Put Away', value: 'put_away' },
        // Export statuses
        { label: 'Allocated', value: 'allocated' },
        { label: 'Picked Up', value: 'picked_up' },
        { label: 'Dispatched', value: 'dispatched' },
      ],
      admin: {
        description:
          'Current status of the container (auto-updated based on product line completion)',
      },
    },
    {
      name: 'warehouseId',
      type: 'relationship',
      relationTo: 'warehouses',
      required: false,
      admin: {
        description: 'Warehouse for put-away operations',
      },
    },
    {
      name: 'containerNumber',
      type: 'text',
      required: false,
      admin: {
        description: 'Container number (auto-generated if not provided)',
      },
    },
    {
      name: 'containerSizeId',
      type: 'relationship',
      relationTo: 'container-sizes',
      required: false,
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
      async ({ data, req, operation }) => {
        // Auto-generate container number if not provided
        if (operation === 'create' && !data.containerNumber && req?.payload) {
          try {
            const user = (
              req as unknown as {
                user?: { role?: string; tenantId?: number | string; collection?: string }
              }
            ).user

            // Get tenant ID from user or from booking
            let tenantId: number | string | undefined = undefined

            if (user?.tenantId) {
              tenantId =
                typeof user.tenantId === 'object'
                  ? (user.tenantId as { id: number }).id
                  : user.tenantId
            } else if (data.containerBookingId) {
              // Try to get tenant from booking
              try {
                let bookingId: number | undefined = undefined
                let collection: string | undefined = undefined

                // Handle polymorphic relationship format: { relationTo: string, value: number | object }
                if (
                  typeof data.containerBookingId === 'object' &&
                  data.containerBookingId !== null &&
                  'relationTo' in data.containerBookingId &&
                  'value' in data.containerBookingId
                ) {
                  collection = data.containerBookingId.relationTo
                  const value = data.containerBookingId.value
                  // Value can be a number (ID) or an object with id
                  if (typeof value === 'number') {
                    bookingId = value
                  } else if (typeof value === 'object' && value !== null && 'id' in value) {
                    bookingId = (value as { id: number }).id
                  }
                } else if (
                  typeof data.containerBookingId === 'object' &&
                  data.containerBookingId !== null
                ) {
                  // Handle direct object format: { id: number, relationTo?: string }
                  const bookingRef = data.containerBookingId as { id?: number; relationTo?: string }
                  bookingId = bookingRef.id
                  collection = bookingRef.relationTo
                }

                if (bookingId && collection) {
                  const booking = await req.payload.findByID({
                    collection: collection as
                      | 'import-container-bookings'
                      | 'export-container-bookings',
                    id: bookingId,
                  })

                  const bookingData = booking as { tenantId?: number | { id: number } }
                  if (bookingData.tenantId) {
                    tenantId =
                      typeof bookingData.tenantId === 'object'
                        ? bookingData.tenantId.id
                        : bookingData.tenantId
                  }
                }
              } catch (error) {
                console.error('Error fetching booking for tenant ID:', error)
              }
            }

            if (tenantId) {
              data.containerNumber = await generateUniqueContainerNumber(req.payload, tenantId)
            } else {
              // Fallback: generate a simple unique number if tenantId not found
              const timestamp = Date.now().toString().slice(-6)
              const random = generateContainerDetailCode(4)
              data.containerNumber = `CN-${timestamp}-${random}`
            }
          } catch (error) {
            console.error('Error generating container number:', error)
            // Fallback: generate a simple unique number
            const timestamp = Date.now().toString().slice(-6)
            const random = generateContainerDetailCode(4)
            data.containerNumber = `CN-${timestamp}-${random}`
          }
        }

        // Set default status based on booking type
        if (operation === 'create' && data.containerBookingId && !data.status && req?.payload) {
          try {
            const bookingRef =
              typeof data.containerBookingId === 'object'
                ? (data.containerBookingId as { id: number; relationTo?: string })
                : null

            if (bookingRef) {
              const bookingId = bookingRef.id
              const collection = bookingRef.relationTo

              if (bookingId && collection) {
                // Determine booking type and set default status
                if (collection === 'import-container-bookings') {
                  data.status = 'expecting'
                } else if (collection === 'export-container-bookings') {
                  data.status = 'allocated'
                }
              }
            }
          } catch (error) {
            console.error('Error setting default container status:', error)
          }
        }

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
                    collection: collection as
                      | 'import-container-bookings'
                      | 'export-container-bookings',
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
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        // Update parent booking status when container status changes
        if (
          operation === 'update' &&
          previousDoc &&
          doc.status !== previousDoc.status &&
          req?.payload
        ) {
          try {
            const bookingRef = doc.containerBookingId
            if (!bookingRef) return doc

            const bookingId = typeof bookingRef === 'object' ? bookingRef.id : bookingRef
            const collection = typeof bookingRef === 'object' ? bookingRef.relationTo : null

            if (!bookingId || !collection) return doc

            // Fetch all containers for this booking
            const allContainers = await req.payload.find({
              collection: 'container-details',
              where: {
                containerBookingId: {
                  equals: bookingId,
                },
              },
            })

            if (allContainers.docs.length === 0) return doc

            // Calculate aggregate status based on container statuses
            const containerStatuses = allContainers.docs.map((c: any) => c.status)

            let newBookingStatus: string | null = null

            if (collection === 'export-container-bookings') {
              // Export booking status logic
              const allPicked = containerStatuses.every((s: string) => s === 'picked_up')
              const somePicked = containerStatuses.some((s: string) => s === 'picked_up')
              const allDispatched = containerStatuses.every((s: string) => s === 'dispatched')
              const someDispatched = containerStatuses.some((s: string) => s === 'dispatched')
              const allAllocated = containerStatuses.every((s: string) => s === 'allocated')

              if (allDispatched) {
                newBookingStatus = 'dispatched'
              } else if (someDispatched) {
                // Some dispatched but not all - could be ready_to_dispatch or partially_picked
                if (allPicked) {
                  newBookingStatus = 'ready_to_dispatch'
                } else if (somePicked) {
                  newBookingStatus = 'partially_picked'
                }
              } else if (allPicked) {
                newBookingStatus = 'picked'
              } else if (somePicked) {
                newBookingStatus = 'partially_picked'
              } else if (allAllocated) {
                newBookingStatus = 'allocated'
              }
            } else if (collection === 'import-container-bookings') {
              // Import booking status logic
              const allReceived = containerStatuses.every((s: string) => s === 'received')
              const someReceived = containerStatuses.some((s: string) => s === 'received')
              const allPutAway = containerStatuses.every((s: string) => s === 'put_away')
              const somePutAway = containerStatuses.some((s: string) => s === 'put_away')
              const allExpecting = containerStatuses.every((s: string) => s === 'expecting')

              if (allPutAway) {
                newBookingStatus = 'put_away'
              } else if (somePutAway) {
                newBookingStatus = 'partially_put_away'
              } else if (allReceived) {
                newBookingStatus = 'received'
              } else if (someReceived) {
                newBookingStatus = 'partially_received'
              } else if (allExpecting) {
                newBookingStatus = 'expecting'
              }
            }

            // Update booking status if we calculated a new status
            if (newBookingStatus) {
              try {
                const booking = await req.payload.findByID({
                  collection: collection as
                    | 'import-container-bookings'
                    | 'export-container-bookings',
                  id: bookingId,
                })

                // Only update if status is different and booking is not cancelled or completed
                const currentStatus = (booking as { status?: string }).status
                if (
                  currentStatus !== newBookingStatus &&
                  currentStatus !== 'cancelled' &&
                  currentStatus !== 'completed'
                ) {
                  await req.payload.update({
                    collection: collection as
                      | 'import-container-bookings'
                      | 'export-container-bookings',
                    id: bookingId,
                    data: {
                      status: newBookingStatus as
                        | 'allocated'
                        | 'picked'
                        | 'dispatched'
                        | 'expecting'
                        | 'received'
                        | 'put_away'
                        | 'draft'
                        | 'confirmed'
                        | 'partially_received'
                        | 'partially_put_away'
                        | 'completed'
                        | 'cancelled'
                        | 'partially_picked'
                        | 'ready_to_dispatch',
                    },
                  })
                }
              } catch (error) {
                console.error('Error updating booking status:', error)
                // Don't throw - status update failure shouldn't break container update
              }
            }
          } catch (error) {
            console.error('Error in ContainerDetails afterChange hook:', error)
            // Don't throw - hook failure shouldn't break container update
          }
        }

        return doc
      },
    ],
  },
}
