import type { CollectionConfig } from 'payload'

export const PickupStock: CollectionConfig = {
  slug: 'pickup-stock',
  admin: {
    useAsTitle: 'id',
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
        return true // Will be filtered in API routes
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
      name: 'tenantId',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'Links pickup record to tenant',
      },
    },
    {
      name: 'outboundInventoryId',
      type: 'relationship',
      relationTo: 'outbound-inventory',
      admin: {
        description: 'Outbound job this pickup belongs to (for outbound jobs)',
      },
    },
    {
      name: 'outboundProductLineId',
      type: 'relationship',
      relationTo: 'outbound-product-line',
      admin: {
        description: 'Product line this pickup is for (for outbound jobs)',
      },
    },
    {
      name: 'containerDetailId',
      type: 'relationship',
      relationTo: 'container-details',
      admin: {
        description: 'Links to container detail (for container bookings)',
      },
    },
    {
      name: 'containerStockAllocationId',
      type: 'relationship',
      relationTo: 'container-stock-allocations',
      admin: {
        description: 'Links to container stock allocation product line (for container bookings)',
      },
    },
    {
      name: 'pickedUpLPNs',
      type: 'array',
      required: true,
      fields: [
        {
          name: 'lpnId',
          type: 'relationship',
          relationTo: 'put-away-stock',
          required: true,
          admin: {
            description: 'Reference to the PutAwayStock record',
          },
        },
        {
          name: 'lpnNumber',
          type: 'text',
          required: true,
          admin: {
            description: 'LPN number (cached for quick access)',
          },
        },
        {
          name: 'huQty',
          type: 'number',
          required: true,
          admin: {
            description: 'Quantity on this LPN pallet',
            readOnly: true,
          },
        },
        {
          name: 'location',
          type: 'text',
          admin: {
            description: 'Storage location of LPN (cached)',
            readOnly: true,
          },
        },
        {
          name: 'isLoosened',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Whether this is a loosened item (non-LPN)',
          },
        },
      ],
      admin: {
        description: 'LPN pallets that have been picked up',
      },
    },
    {
      name: 'pickedUpLoosenedQty',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Quantity of loosened items picked up (non-LPN items)',
      },
    },
    {
      name: 'pickedUpQty',
      type: 'number',
      required: true,
      admin: {
        description: 'Total quantity calculated from picked up LPNs',
        readOnly: true,
      },
    },
    {
      name: 'bufferQty',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Buffer quantity to handle actual quantity discrepancies',
      },
    },
    {
      name: 'finalPickedUpQty',
      type: 'number',
      required: true,
      admin: {
        description: 'Final pickup quantity (pickedUpQty + bufferQty)',
        readOnly: true,
      },
    },
    {
      name: 'pickupStatus',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'draft',
      admin: {
        description: 'Status of the pickup record',
      },
    },
    {
      name: 'pickedUpBy',
      type: 'relationship',
      relationTo: 'tenant-users',
      required: true,
      admin: {
        description: 'User who recorded the pickup',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Additional notes about the pickup',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, req, operation }) => {
        const user = (
          req as unknown as {
            user?: { role?: string; tenantId?: number | string; collection?: string }
          }
        ).user

        // Auto-populate tenantId from outboundInventoryId or containerDetailId
        if (!data.tenantId && req?.payload) {
          if (data.outboundInventoryId) {
            try {
              const jobId =
                typeof data.outboundInventoryId === 'object'
                  ? (data.outboundInventoryId as { id: number }).id
                  : data.outboundInventoryId
              const job = await req.payload.findByID({
                collection: 'outbound-inventory',
                id: jobId,
              })
              if (job && job.tenantId) {
                data.tenantId =
                  typeof job.tenantId === 'object' ? (job.tenantId as { id: number }).id : job.tenantId
              }
            } catch (error) {
              console.error('Error fetching tenant from job:', error)
            }
          } else if (data.containerDetailId) {
            try {
              const containerId =
                typeof data.containerDetailId === 'object'
                  ? (data.containerDetailId as { id: number }).id
                  : data.containerDetailId
              const container = await req.payload.findByID({
                collection: 'container-details',
                id: containerId,
              })
              if (container) {
                // Get tenant from container booking
                const bookingRef =
                  typeof container.containerBookingId === 'object'
                    ? container.containerBookingId
                    : null
                if (bookingRef) {
                  let bookingId: number
                  let collection: 'import-container-bookings' | 'export-container-bookings'
                  
                  if (typeof bookingRef === 'object') {
                    // Polymorphic relationship: { relationTo: string, value: number | object }
                    if ('value' in bookingRef) {
                      bookingId = typeof bookingRef.value === 'object' && bookingRef.value !== null && 'id' in bookingRef.value
                        ? (bookingRef.value as { id: number }).id
                        : (bookingRef.value as number)
                      collection = bookingRef.relationTo as 'import-container-bookings' | 'export-container-bookings'
                    } else {
                      // Direct object with id
                      bookingId = (bookingRef as { id: number }).id
                      collection = 'import-container-bookings'
                    }
                  } else {
                    bookingId = bookingRef
                    collection = 'import-container-bookings'
                  }
                  const booking = await req.payload.findByID({
                    collection: collection as 'import-container-bookings' | 'export-container-bookings',
                    id: bookingId,
                  })
                  if (booking && booking.tenantId) {
                    data.tenantId =
                      typeof booking.tenantId === 'object'
                        ? (booking.tenantId as { id: number }).id
                        : booking.tenantId
                  }
                }
              }
            } catch (error) {
              console.error('Error fetching tenant from container:', error)
            }
          }
        }

        // Auto-populate LPN details from PutAwayStock records
        if (data.pickedUpLPNs && Array.isArray(data.pickedUpLPNs) && req?.payload) {
          for (const lpn of data.pickedUpLPNs) {
            if (lpn.lpnId && (!lpn.lpnNumber || !lpn.huQty)) {
              try {
                const lpnId =
                  typeof lpn.lpnId === 'object' ? (lpn.lpnId as { id: number }).id : lpn.lpnId
                const lpnRecord = await req.payload.findByID({
                  collection: 'put-away-stock',
                  id: lpnId,
                })
                if (lpnRecord) {
                  lpn.lpnNumber = lpnRecord.lpnNumber
                  lpn.huQty = lpnRecord.huQty
                  lpn.location = lpnRecord.location
                }
              } catch (error) {
                console.error('Error fetching LPN details:', error)
              }
            }
          }
        }

        // Auto-calculate pickedUpQty from LPNs and loosened items
        // Exclude loosened stock from LPN sum since it's tracked separately in pickedUpLoosenedQty
        if (data.pickedUpLPNs && Array.isArray(data.pickedUpLPNs)) {
          const lpnQty = data.pickedUpLPNs.reduce(
            (sum, lpn) => {
              // Skip loosened stock items - they're counted in pickedUpLoosenedQty
              if (lpn.isLoosened) {
                return sum
              }
              return sum + (lpn.huQty || 0)
            },
            0,
          )
          const loosenedQty = data.pickedUpLoosenedQty || 0
          data.pickedUpQty = lpnQty + loosenedQty
        }

        // Auto-calculate finalPickedUpQty
        if (data.pickedUpQty !== undefined && data.bufferQty !== undefined) {
          data.finalPickedUpQty = data.pickedUpQty + (data.bufferQty || 0)
        }

        // Ensure tenantId matches user's tenantId (unless superadmin)
        if (user?.tenantId && data.tenantId !== user.tenantId) {
          if (user.role !== 'superadmin' && user.collection !== 'users') {
            data.tenantId = user.tenantId
          }
        }

        return data
      },
    ],
  },
}

