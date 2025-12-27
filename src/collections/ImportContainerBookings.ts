import type { CollectionConfig } from 'payload'

export const ImportContainerBookings: CollectionConfig = {
  slug: 'import-container-bookings',
  admin: {
    useAsTitle: 'bookingCode',
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
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
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
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
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
        return {
          tenantId: {
            equals: user.tenantId,
          },
        }
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
        description: 'Links container booking to their company (tenant)',
      },
    },
    {
      name: 'bookingCode',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Auto-generated unique booking code (IMP- prefix)',
        readOnly: true,
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Confirmed', value: 'confirmed' },
        { label: 'Expecting', value: 'expecting' },
        { label: 'Partially Received', value: 'partially_received' },
        { label: 'Received', value: 'received' },
        { label: 'Partially Put Away', value: 'partially_put_away' },
        { label: 'Put Away', value: 'put_away' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      admin: {
        description: 'Current status of the container booking (auto-calculated from container statuses)',
      },
    },
    // Step 1: Basic Info
    {
      name: 'customerReference',
      type: 'text',
      required: true,
      admin: {
        description: 'Customer reference number',
      },
    },
    {
      name: 'bookingReference',
      type: 'text',
      required: true,
      admin: {
        description: 'Booking reference number',
      },
    },
    {
      name: 'chargeToId',
      type: 'relationship',
      relationTo: ['paying-customers', 'customers'],
      required: ({ data, operation }) => {
        // Only required when status is not 'draft' and it's a create/update operation
        if (operation === 'create' || operation === 'update') {
          return data?.status !== 'draft'
        }
        return false
      },
      validate: (value, { data }) => {
        // Allow empty value when status is 'draft'
        if (
          data?.status === 'draft' &&
          (!value || value === '' || value === null || value === undefined)
        ) {
          return true
        }
        // For non-draft status, value is required (handled by required function)
        return true
      },
      admin: {
        description: 'Entity responsible for charges (paying customer or delivery customer)',
      },
    },
    {
      name: 'chargeToCollection',
      type: 'text',
      admin: {
        description: 'Collection type for chargeToId',
        readOnly: true,
      },
    },
    {
      name: 'chargeToContactName',
      type: 'text',
      admin: {
        description: 'Contact name fetched from chargeTo entity',
        readOnly: true,
      },
    },
    {
      name: 'chargeToContactNumber',
      type: 'text',
      admin: {
        description: 'Contact number fetched from chargeTo entity',
        readOnly: true,
      },
    },
    {
      name: 'consigneeId',
      type: 'relationship',
      relationTo: 'customers',
      required: ({ data, operation }) => {
        // Only required when status is not 'draft' and it's a create/update operation
        if (operation === 'create' || operation === 'update') {
          return data?.status !== 'draft'
        }
        return false
      },
      validate: (value, { data }) => {
        // Allow empty value when status is 'draft'
        if (
          data?.status === 'draft' &&
          (!value || value === '' || value === null || value === undefined)
        ) {
          return true
        }
        return true
      },
      admin: {
        description: 'Consignee (for import jobs)',
      },
    },
    // Step 2: Vessel Info (Import-specific)
    {
      name: 'vesselId',
      type: 'relationship',
      relationTo: 'vessels',
      admin: {
        description: 'Vessel associated with this booking',
      },
    },
    {
      name: 'eta',
      type: 'date',
      admin: {
        description: 'Estimated Time of Arrival',
      },
    },
    {
      name: 'availability',
      type: 'checkbox',
      admin: {
        description: 'Availability status',
      },
    },
    {
      name: 'storageStart',
      type: 'date',
      admin: {
        description: 'Storage start date',
      },
    },
    {
      name: 'firstFreeImportDate',
      type: 'date',
      admin: {
        description: 'First free import date',
      },
    },
    // Step 3: Locations
    {
      name: 'fromId',
      type: 'relationship',
      relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves'],
      required: ({ data, operation }) => {
        // Only required when status is not 'draft' and it's a create/update operation
        if (operation === 'create' || operation === 'update') {
          return data?.status !== 'draft'
        }
        return false
      },
      validate: (value, { data }) => {
        // Allow empty value when status is 'draft'
        if (
          data?.status === 'draft' &&
          (!value || value === '' || value === null || value === undefined)
        ) {
          return true
        }
        return true
      },
      admin: {
        description: 'Origin location (delivery customer, paying customer, empty park, or wharf)',
      },
    },
    {
      name: 'fromCollection',
      type: 'text',
      admin: {
        description: 'Collection type for fromId',
        readOnly: true,
      },
    },
    {
      name: 'fromAddress',
      type: 'text',
      admin: {
        description: 'Address fetched from fromId entity',
        readOnly: true,
      },
    },
    {
      name: 'fromCity',
      type: 'text',
      admin: {
        description: 'City fetched from fromId entity',
        readOnly: true,
      },
    },
    {
      name: 'fromState',
      type: 'text',
      admin: {
        description: 'State fetched from fromId entity',
        readOnly: true,
      },
    },
    {
      name: 'fromPostcode',
      type: 'text',
      admin: {
        description: 'Postcode fetched from fromId entity',
        readOnly: true,
      },
    },
    {
      name: 'toId',
      type: 'relationship',
      relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves'],
      required: ({ data, operation }) => {
        // Only required when status is not 'draft' and it's a create/update operation
        if (operation === 'create' || operation === 'update') {
          return data?.status !== 'draft'
        }
        return false
      },
      validate: (value, { data }) => {
        // Allow empty value when status is 'draft'
        if (
          data?.status === 'draft' &&
          (!value || value === '' || value === null || value === undefined)
        ) {
          return true
        }
        return true
      },
      admin: {
        description:
          'Destination location (delivery customer, paying customer, empty park, or wharf)',
      },
    },
    {
      name: 'toCollection',
      type: 'text',
      admin: {
        description: 'Collection type for toId',
        readOnly: true,
      },
    },
    {
      name: 'toAddress',
      type: 'text',
      admin: {
        description: 'Address fetched from toId entity',
        readOnly: true,
      },
    },
    {
      name: 'toCity',
      type: 'text',
      admin: {
        description: 'City fetched from toId entity',
        readOnly: true,
      },
    },
    {
      name: 'toState',
      type: 'text',
      admin: {
        description: 'State fetched from toId entity',
        readOnly: true,
      },
    },
    {
      name: 'toPostcode',
      type: 'text',
      admin: {
        description: 'Postcode fetched from toId entity',
        readOnly: true,
      },
    },
    {
      name: 'containerSizeIds',
      type: 'relationship',
      relationTo: 'container-sizes',
      hasMany: true,
      required: ({ data, operation }) => {
        // Only required when status is not 'draft' and it's a create/update operation
        if (operation === 'create' || operation === 'update') {
          return data?.status !== 'draft'
        }
        return false
      },
      validate: (value, { data }) => {
        // Allow empty array when status is 'draft'
        if (data?.status === 'draft' && (!value || (Array.isArray(value) && value.length === 0))) {
          return true
        }
        return true
      },
      admin: {
        description: 'Container sizes for this booking',
      },
    },
    {
      name: 'containerQuantities',
      type: 'json',
      admin: {
        description: 'Object mapping container size ID to quantity',
      },
    },
    // Step 4: Routing (Import: Full → Empty)
    {
      name: 'fullRouting',
      type: 'group',
      admin: {
        description: 'Full container routing details (runs first for import)',
      },
      fields: [
        {
          name: 'pickupLocationId',
          type: 'relationship',
          relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves'],
          admin: {
            description: 'Full container pickup location (prefilled from Step 3 From)',
          },
        },
        {
          name: 'pickupLocationCollection',
          type: 'text',
          admin: {
            description: 'Collection type for pickupLocationId',
            readOnly: true,
          },
        },
        {
          name: 'pickupDate',
          type: 'date',
          admin: {
            description: 'Full container pickup date',
          },
        },
        {
          name: 'viaLocations',
          type: 'relationship',
          relationTo: ['warehouses', 'wharves', 'empty-parks'],
          hasMany: true,
          admin: {
            description: 'Via locations (sequence matters)',
          },
        },
        {
          name: 'viaLocationsCollections',
          type: 'json',
          admin: {
            description: 'Collection types for viaLocations (array matching viaLocations order)',
            readOnly: true,
          },
        },
        {
          name: 'dropoffLocationId',
          type: 'relationship',
          relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves'],
          admin: {
            description: 'Full container dropoff location (prefilled from Step 3 To)',
          },
        },
        {
          name: 'dropoffLocationCollection',
          type: 'text',
          admin: {
            description: 'Collection type for dropoffLocationId',
            readOnly: true,
          },
        },
        {
          name: 'dropoffDate',
          type: 'date',
          admin: {
            description: 'Full container dropoff date',
          },
        },
      ],
    },
    {
      name: 'emptyRouting',
      type: 'group',
      admin: {
        description: 'Empty container routing details (runs second for import)',
      },
      fields: [
        {
          name: 'shippingLineId',
          type: 'relationship',
          relationTo: 'shipping-lines',
          admin: {
            description: 'Shipping line for empty containers',
          },
        },
        {
          name: 'pickupLocationId',
          type: 'relationship',
          relationTo: 'empty-parks',
          admin: {
            description: 'Empty container pickup location',
          },
        },
        {
          name: 'pickupDate',
          type: 'date',
          admin: {
            description: 'Empty container pickup date',
          },
        },
        {
          name: 'viaLocations',
          type: 'relationship',
          relationTo: ['warehouses', 'wharves', 'empty-parks'],
          hasMany: true,
          admin: {
            description: 'Via locations (sequence matters)',
          },
        },
        {
          name: 'viaLocationsCollections',
          type: 'json',
          admin: {
            description: 'Collection types for viaLocations (array matching viaLocations order)',
            readOnly: true,
          },
        },
        {
          name: 'dropoffLocationId',
          type: 'relationship',
          relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves'],
          admin: {
            description: 'Empty container dropoff location (prefilled from Step 3 From)',
          },
        },
        {
          name: 'dropoffLocationCollection',
          type: 'text',
          admin: {
            description: 'Collection type for dropoffLocationId',
            readOnly: true,
          },
        },
        {
          name: 'dropoffDate',
          type: 'date',
          admin: {
            description: 'Empty container dropoff date',
          },
        },
        {
          name: 'requestedDeliveryDate',
          type: 'date',
          admin: {
            description: 'Requested delivery date for empty containers',
          },
        },
      ],
    },
    // Additional fields
    {
      name: 'instructions',
      type: 'textarea',
      admin: {
        description: 'General instructions for the booking',
      },
    },
    {
      name: 'jobNotes',
      type: 'textarea',
      admin: {
        description: 'Additional notes for the job',
      },
    },
    // Step 7: Driver Allocation (stored as JSON for flexibility)
    {
      name: 'driverAllocation',
      type: 'json',
      admin: {
        description:
          'Driver allocation details for empty and full container movements (Full → Empty for import)',
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

        // Auto-set tenantId
        if (user?.tenantId && data.tenantId !== user.tenantId) {
          if (user.role !== 'superadmin' && user.collection !== 'users') {
            data.tenantId = user.tenantId
          }
        }

        // Auto-generate booking code with IMP- prefix
        if (operation === 'create' && !data.bookingCode) {
          const prefix = 'IMP'
          const timestamp = Date.now().toString().slice(-8)
          const random = Math.floor(Math.random() * 1000)
            .toString()
            .padStart(3, '0')
          data.bookingCode = `${prefix}-${timestamp}-${random}`
        }

        // Auto-fetch chargeTo entity details
        if (data.chargeToId && req?.payload) {
          try {
            let chargeToId: number | undefined
            let collection: string | undefined

            // Handle different chargeToId formats
            if (typeof data.chargeToId === 'object' && data.chargeToId !== null) {
              // Object format: { id: number, relationTo?: string }
              chargeToId = (data.chargeToId as { id: number; relationTo?: string }).id
              collection = (data.chargeToId as { relationTo?: string })?.relationTo
            } else if (typeof data.chargeToId === 'string' && data.chargeToId.includes(':')) {
              // String format: "customers:6" or "paying-customers:6"
              const [collectionPart, idStr] = data.chargeToId.split(':')
              const parsedId = parseInt(idStr, 10)
              if (
                !isNaN(parsedId) &&
                (collectionPart === 'customers' || collectionPart === 'paying-customers')
              ) {
                chargeToId = parsedId
                collection = collectionPart
              }
            } else if (typeof data.chargeToId === 'number') {
              // Number format: just the ID
              chargeToId = data.chargeToId
            }

            // Use chargeToCollection if collection is not determined yet
            if (!collection) {
              collection = data.chargeToCollection || 'paying-customers'
            }

            if (chargeToId && (collection === 'paying-customers' || collection === 'customers')) {
              try {
                const entity = await req.payload.findByID({
                  collection: collection as 'paying-customers' | 'customers',
                  id: chargeToId,
                })

                if (entity) {
                  // Verify entity belongs to the tenant (if tenantId exists in entity)
                  const entityTenantId =
                    typeof (entity as { tenantId?: number | { id: number } }).tenantId === 'object'
                      ? (entity as { tenantId: { id: number } }).tenantId.id
                      : (entity as { tenantId?: number }).tenantId

                  // Only use entity if it belongs to the current tenant or if tenantId is not set (for backward compatibility)
                  if (
                    !entityTenantId ||
                    !req.user ||
                    (req.user as { tenantId?: number | { id: number } }).tenantId === entityTenantId
                  ) {
                    const entityData = entity as {
                      contact_name?: string
                      contact_phone?: string
                      contactName?: string
                      contactPhoneNumber?: string
                    }
                    data.chargeToContactName =
                      entityData.contact_name || entityData.contactName || ''
                    data.chargeToContactNumber =
                      entityData.contact_phone || entityData.contactPhoneNumber || ''
                    data.chargeToCollection = collection
                    // Ensure chargeToId is set as number for storage
                    data.chargeToId = chargeToId as any
                  } else {
                    // Entity doesn't belong to tenant, but still set the ID and collection
                    data.chargeToCollection = collection
                    data.chargeToId = chargeToId as any
                    console.warn(`ChargeTo entity ${chargeToId} does not belong to the tenant`)
                  }
                } else {
                  // Entity not found, but still set the ID and collection to allow save
                  data.chargeToCollection = collection
                  data.chargeToId = chargeToId as any
                  console.warn(
                    `ChargeTo entity ${chargeToId} not found in collection ${collection}`,
                  )
                }
              } catch (findError: any) {
                // Entity lookup failed, but still set the ID and collection to allow save
                // This prevents the entire save from failing if the entity lookup has issues
                data.chargeToCollection = collection
                data.chargeToId = chargeToId as any
                console.warn(
                  `Error looking up chargeTo entity ${chargeToId}:`,
                  findError.message || findError,
                )
              }
            }
          } catch (error) {
            console.error('Error fetching chargeTo entity:', error)
          }
        }

        // Auto-fetch fromId entity details
        // Store original fromId before processing (in case Payload modifies it)
        let originalFromId: number | undefined = undefined
        if (data.fromId) {
          if (typeof data.fromId === 'number') {
            originalFromId = data.fromId
          } else if (
            typeof data.fromId === 'object' &&
            data.fromId !== null &&
            (data.fromId as any).id
          ) {
            originalFromId = (data.fromId as any).id
          } else if (typeof data.fromId === 'string' && data.fromId.includes(':')) {
            const parsed = parseInt(data.fromId.split(':')[1], 10)
            if (!isNaN(parsed)) originalFromId = parsed
          }
        }

        if (data.fromId && req?.payload) {
          try {
            let fromId: number | undefined
            let fromCollection: string | undefined // Renamed to avoid confusion

            // Handle different fromId formats
            if (typeof data.fromId === 'object' && data.fromId !== null) {
              // Object format: { id: number, relationTo?: string }
              fromId = (data.fromId as { id: number; relationTo?: string }).id
              fromCollection = (data.fromId as { relationTo?: string })?.relationTo
            } else if (typeof data.fromId === 'string' && data.fromId.includes(':')) {
              // String format: "customers:6" or "paying-customers:6"
              const [collectionPart, idStr] = data.fromId.split(':')
              const parsedId = parseInt(idStr, 10)
              if (
                !isNaN(parsedId) &&
                (collectionPart === 'customers' ||
                  collectionPart === 'paying-customers' ||
                  collectionPart === 'empty-parks' ||
                  collectionPart === 'wharves')
              ) {
                fromId = parsedId
                fromCollection = collectionPart
              }
            } else if (typeof data.fromId === 'number') {
              // Number format: just the ID
              fromId = data.fromId
            }

            // Use fromCollection if collection is not determined yet
            // CRITICAL: Only use data.fromCollection, NEVER use data.toCollection
            if (!fromCollection) {
              fromCollection = data.fromCollection || 'customers'
            }

            const validCollections = ['customers', 'paying-customers', 'empty-parks', 'wharves']
            if (fromId && validCollections.includes(fromCollection)) {
              try {
                const entity = await req.payload.findByID({
                  collection: fromCollection as
                    | 'customers'
                    | 'paying-customers'
                    | 'empty-parks'
                    | 'wharves',
                  id: fromId,
                })

                if (entity) {
                  const entityData = entity as {
                    street?: string
                    city?: string
                    state?: string
                    postcode?: string
                    address?: {
                      street?: string
                      city?: string
                      state?: string
                      postcode?: string
                    }
                    delivery_street?: string
                    delivery_city?: string
                    delivery_state?: string
                    delivery_postcode?: string
                  }

                  const street =
                    entityData.street ||
                    entityData.address?.street ||
                    entityData.delivery_street ||
                    ''
                  const city =
                    entityData.city || entityData.address?.city || entityData.delivery_city || ''
                  const state =
                    entityData.state || entityData.address?.state || entityData.delivery_state || ''
                  const postcode =
                    entityData.postcode ||
                    entityData.address?.postcode ||
                    entityData.delivery_postcode ||
                    ''

                  data.fromAddress = street
                  data.fromCity = city
                  data.fromState = state
                  data.fromPostcode = postcode
                  // CRITICAL: Set fromCollection using the fromCollection variable, NOT toCollection
                  data.fromCollection = fromCollection
                  // CRITICAL: Explicitly set fromId to ensure it's saved (Payload needs the ID, not the full object)
                  data.fromId = fromId as any
                } else {
                  // Entity not found, but still set the collection to allow save
                  data.fromCollection = fromCollection
                  data.fromId = fromId as any
                }
              } catch (entityError: any) {
                // Entity lookup failed, but still set the collection to allow save
                data.fromCollection = fromCollection
                data.fromId = fromId as any
                console.error(
                  `[ImportCollection Hook] Error fetching fromId entity ${fromId} from ${fromCollection}:`,
                  entityError.message || entityError,
                )
              }
            } else {
              // No entity lookup attempted, but ensure collection is set if we have it
              if (fromCollection && fromId && !data.fromCollection) {
                data.fromCollection = fromCollection
                data.fromId = fromId as any
              }
            }
          } catch (error) {
            console.error('[ImportCollection Hook] Error in fromId processing:', error)
          }
        }

        // Auto-fetch toId entity details
        // Store original toId before processing (in case Payload modifies it)
        let originalToId: number | undefined = undefined
        if (data.toId) {
          if (typeof data.toId === 'number') {
            originalToId = data.toId
          } else if (typeof data.toId === 'object' && data.toId !== null && (data.toId as any).id) {
            originalToId = (data.toId as any).id
          } else if (typeof data.toId === 'string' && data.toId.includes(':')) {
            const parsed = parseInt(data.toId.split(':')[1], 10)
            if (!isNaN(parsed)) originalToId = parsed
          }
        }

        if (data.toId && req?.payload) {
          try {
            let toId: number | undefined
            let toCollection: string | undefined // Renamed to avoid confusion

            // Handle different toId formats
            if (typeof data.toId === 'object' && data.toId !== null) {
              // Object format: { id: number, relationTo?: string }
              toId = (data.toId as { id: number; relationTo?: string }).id
              toCollection = (data.toId as { relationTo?: string })?.relationTo
            } else if (typeof data.toId === 'string' && data.toId.includes(':')) {
              // String format: "customers:6" or "paying-customers:6"
              const [collectionPart, idStr] = data.toId.split(':')
              const parsedId = parseInt(idStr, 10)
              if (
                !isNaN(parsedId) &&
                (collectionPart === 'customers' ||
                  collectionPart === 'paying-customers' ||
                  collectionPart === 'empty-parks' ||
                  collectionPart === 'wharves')
              ) {
                toId = parsedId
                toCollection = collectionPart
              }
            } else if (typeof data.toId === 'number') {
              // Number format: just the ID
              toId = data.toId
            }

            const validCollections = ['customers', 'paying-customers', 'empty-parks', 'wharves']

            if (toId && validCollections.includes(toCollection)) {
              try {
                const entity = await req.payload.findByID({
                  collection: toCollection as
                    | 'customers'
                    | 'paying-customers'
                    | 'empty-parks'
                    | 'wharves',
                  id: toId,
                })

                if (entity) {
                  const entityData = entity as {
                    street?: string
                    city?: string
                    state?: string
                    postcode?: string
                    address?: {
                      street?: string
                      city?: string
                      state?: string
                      postcode?: string
                    }
                    delivery_street?: string
                    delivery_city?: string
                    delivery_state?: string
                    delivery_postcode?: string
                  }

                  const street =
                    entityData.street ||
                    entityData.address?.street ||
                    entityData.delivery_street ||
                    ''
                  const city =
                    entityData.city || entityData.address?.city || entityData.delivery_city || ''
                  const state =
                    entityData.state || entityData.address?.state || entityData.delivery_state || ''
                  const postcode =
                    entityData.postcode ||
                    entityData.address?.postcode ||
                    entityData.delivery_postcode ||
                    ''

                  data.toAddress = street
                  data.toCity = city
                  data.toState = state
                  data.toPostcode = postcode
                  // CRITICAL: Set toCollection using the toCollection variable, NOT fromCollection
                  data.toCollection = toCollection
                  // Ensure toId is set as number for storage
                  data.toId = toId as any
                } else {
                  // Entity not found, but still set the ID and collection to allow save
                  data.toCollection = toCollection
                  data.toId = toId as any
                }
              } catch (entityError: any) {
                // Entity lookup failed, but still set the ID and collection to allow save
                data.toCollection = toCollection
                data.toId = toId as any
                console.error(
                  `[ImportCollection Hook] Error fetching toId entity ${toId} from ${toCollection}:`,
                  entityError.message || entityError,
                )
              }
            } else {
              // No entity lookup attempted, but ensure collection is set if we have it
              if (toCollection && toId && !data.toCollection) {
                data.toCollection = toCollection
                data.toId = toId as any
              }
            }

            // CRITICAL: Ensure toId is always set if we have it, even if entity lookup didn't happen
            if (toId && !data.toId) {
              data.toId = toId as any
            }
          } catch (error: any) {
            console.error(
              '[ImportCollection Hook] Error in toId processing:',
              error.message || error,
            )
          }
        }

        // CRITICAL: Final check - ensure fromId and toId are preserved before returning
        // This prevents Payload from clearing them during relationship resolution
        // If IDs are missing but we have the original values and collections, restore them
        if (data.fromCollection && !data.fromId && originalFromId) {
          data.fromId = originalFromId as any
        }

        if (data.toCollection && !data.toId && originalToId) {
          data.toId = originalToId as any
        }

        // Ensure all routing relationship IDs are in correct format for Payload
        // Payload polymorphic relationships need {relationTo, value} format
        // This function converts various formats to what Payload expects
        const ensurePlainNumberId = (
          value: unknown,
        ): number | { relationTo: string; value: number } | null => {
          if (value === null || value === undefined) return null

          // If it's already a Payload relation object {relationTo, value}, preserve it
          if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const relObj = value as any
            if ('relationTo' in relObj && 'value' in relObj) {
              // Valid Payload relation object - preserve it
              return relObj as { relationTo: string; value: number }
            }
          }

          if (Array.isArray(value)) {
            // Convert [id, collectionIndex] to just id
            const id = Number(value[0])
            return !isNaN(id) && id > 0 ? id : null
          }
          if (typeof value === 'number') {
            return value > 0 ? value : null
          }
          if (typeof value === 'string') {
            const num = Number(value)
            return !isNaN(num) && num > 0 ? num : null
          }
          return null
        }

        // Clean fullRouting relationship IDs
        if (data.fullRouting && typeof data.fullRouting === 'object') {
          const fullRouting = data.fullRouting as any

          // Clean pickupLocationId - preserve {relationTo, value} format or convert to number
          if (fullRouting.pickupLocationId !== undefined && fullRouting.pickupLocationId !== null) {
            const cleanedId = ensurePlainNumberId(fullRouting.pickupLocationId)
            if (cleanedId !== null) {
              fullRouting.pickupLocationId = cleanedId
              // If it's a relation object, remove the collection field (it's in the object)
              if (typeof cleanedId === 'object' && 'relationTo' in cleanedId) {
                delete fullRouting.pickupLocationCollection
              }
            } else {
              delete fullRouting.pickupLocationId
              delete fullRouting.pickupLocationCollection
            }
          }

          // Clean dropoffLocationId - preserve {relationTo, value} format or convert to number
          if (
            fullRouting.dropoffLocationId !== undefined &&
            fullRouting.dropoffLocationId !== null
          ) {
            const cleanedId = ensurePlainNumberId(fullRouting.dropoffLocationId)
            if (cleanedId !== null) {
              fullRouting.dropoffLocationId = cleanedId
              // If it's a relation object, remove the collection field (it's in the object)
              if (typeof cleanedId === 'object' && 'relationTo' in cleanedId) {
                delete fullRouting.dropoffLocationCollection
              }
            } else {
              delete fullRouting.dropoffLocationId
              delete fullRouting.dropoffLocationCollection
            }
          }

          // Clean viaLocations array - preserve {relationTo, value} format or convert to numbers
          if (Array.isArray(fullRouting.viaLocations)) {
            const cleanedVia = fullRouting.viaLocations
              .map((via: unknown) => ensurePlainNumberId(via))
              .filter((id): id is number | { relationTo: string; value: number } => id !== null)

            if (cleanedVia.length > 0) {
              fullRouting.viaLocations = cleanedVia
              // If all are relation objects, remove the collections field
              if (cleanedVia.every((item) => typeof item === 'object' && 'relationTo' in item)) {
                delete fullRouting.viaLocationsCollections
              }
            } else {
              delete fullRouting.viaLocations
              delete fullRouting.viaLocationsCollections
            }
          }
        }

        // Clean emptyRouting relationship IDs
        if (data.emptyRouting && typeof data.emptyRouting === 'object') {
          const emptyRouting = data.emptyRouting as any

          // Clean pickupLocationId - preserve {relationTo, value} format or convert to number
          if (
            emptyRouting.pickupLocationId !== undefined &&
            emptyRouting.pickupLocationId !== null
          ) {
            const cleanedId = ensurePlainNumberId(emptyRouting.pickupLocationId)
            if (cleanedId !== null) {
              emptyRouting.pickupLocationId = cleanedId
              // If it's a relation object, remove the collection field (it's in the object)
              if (typeof cleanedId === 'object' && 'relationTo' in cleanedId) {
                delete emptyRouting.pickupLocationCollection
              }
            } else {
              delete emptyRouting.pickupLocationId
              delete emptyRouting.pickupLocationCollection
            }
          }

          // Clean dropoffLocationId - preserve {relationTo, value} format or convert to number
          if (
            emptyRouting.dropoffLocationId !== undefined &&
            emptyRouting.dropoffLocationId !== null
          ) {
            const cleanedId = ensurePlainNumberId(emptyRouting.dropoffLocationId)
            if (cleanedId !== null) {
              emptyRouting.dropoffLocationId = cleanedId
              // If it's a relation object, remove the collection field (it's in the object)
              if (typeof cleanedId === 'object' && 'relationTo' in cleanedId) {
                delete emptyRouting.dropoffLocationCollection
              }
            } else {
              delete emptyRouting.dropoffLocationId
              delete emptyRouting.dropoffLocationCollection
            }
          }

          // Clean viaLocations array - preserve {relationTo, value} format or convert to numbers
          if (Array.isArray(emptyRouting.viaLocations)) {
            const cleanedVia = emptyRouting.viaLocations
              .map((via: unknown) => ensurePlainNumberId(via))
              .filter((id): id is number | { relationTo: string; value: number } => id !== null)

            if (cleanedVia.length > 0) {
              emptyRouting.viaLocations = cleanedVia
              // If all are relation objects, remove the collections field
              if (cleanedVia.every((item) => typeof item === 'object' && 'relationTo' in item)) {
                delete emptyRouting.viaLocationsCollections
              }
            } else {
              delete emptyRouting.viaLocations
              delete emptyRouting.viaLocationsCollections
            }
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // Auto-calculate job status from container statuses
        if (doc && doc.id && req?.payload && operation !== 'delete') {
          try {
            // Get all container details for this booking
            const containerDetails = await req.payload.find({
              collection: 'container-details',
              where: {
                containerBookingId: {
                  equals: doc.id,
                },
              },
            })

            if (containerDetails.docs.length === 0) {
              // No containers yet, keep current status or set to draft/confirmed
              return
            }

            const containerStatuses = containerDetails.docs.map(
              (container: any) => container.status,
            )

            // Calculate job status based on container statuses
            let newStatus = doc.status

            // Check if all containers are in the same status
            const allExpecting = containerStatuses.every((s) => s === 'expecting')
            const allReceived = containerStatuses.every((s) => s === 'received')
            const allPutAway = containerStatuses.every((s) => s === 'put_away')

            // Check for partial states
            const someReceived =
              containerStatuses.some((s) => s === 'received' || s === 'put_away') &&
              containerStatuses.some((s) => s === 'expecting')
            const somePutAway =
              containerStatuses.some((s) => s === 'put_away') &&
              containerStatuses.some((s) => s === 'received')

            if (allPutAway) {
              newStatus = 'put_away'
            } else if (somePutAway) {
              newStatus = 'partially_put_away'
            } else if (allReceived) {
              newStatus = 'received'
            } else if (someReceived) {
              newStatus = 'partially_received'
            } else if (allExpecting) {
              newStatus = 'expecting'
            }

            // Only update if status changed and not cancelled/completed
            if (
              newStatus !== doc.status &&
              doc.status !== 'cancelled' &&
              doc.status !== 'completed'
            ) {
              await req.payload.update({
                collection: 'import-container-bookings',
                id: doc.id,
                data: {
                  status: newStatus,
                },
              })
            }
          } catch (error) {
            console.error('Error calculating import booking status:', error)
          }
        }
      },
    ],
  },
}
