import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'containers_view')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)

    // Validate booking ID
    if (isNaN(bookingId) || bookingId <= 0) {
      console.error('Invalid booking ID:', resolvedParams.id)
      return NextResponse.json({ message: 'Invalid booking ID' }, { status: 400 })
    }

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 2

    // Get the import container booking
    // Note: Payload CMS doesn't always populate polymorphic relationships automatically
    // So we'll fetch with depth and then manually populate if needed
    let booking
    try {
      booking = await payload.findByID({
        collection: 'import-container-bookings',
        id: bookingId,
        depth: Math.max(depth, 1), // Ensure at least depth 1
      })
    } catch (findError: any) {
      console.error('Error finding booking with depth, retrying with depth 0:', findError)
      // If it's a not found error, return 404
      if (findError.status === 404 || findError.name === 'NotFound') {
        return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
      }
      // If it's a relationship population error, try again with depth 0
      // This can happen with polymorphic relationships
      try {
        booking = await payload.findByID({
          collection: 'import-container-bookings',
          id: bookingId,
          depth: 0, // Fetch without populating relationships
        })
        console.log(
          'Successfully fetched booking with depth 0, will manually populate relationships',
        )
      } catch (retryError: any) {
        console.error('Error finding booking even with depth 0:', retryError)
        if (retryError.status === 404 || retryError.name === 'NotFound') {
          return NextResponse.json(
            { message: 'Import container booking not found' },
            { status: 404 },
          )
        }
        throw retryError
      }
    }

    if (!booking) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (booking as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (booking as { tenantId: { id: number } }).tenantId.id
        : (booking as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      console.error(
        `Booking ${bookingId} belongs to tenant ${bookingTenantId}, but current tenant is ${tenant.id}`,
      )
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Manually populate polymorphic chargeToId relationship if not already populated
    const bookingData = booking as any

    // If chargeToId is undefined but chargeToCollection exists, try to find entity by contact info
    if (
      !bookingData.chargeToId &&
      bookingData.chargeToCollection &&
      (bookingData.chargeToContactName || bookingData.chargeToContactNumber)
    ) {
      try {
        const searchConditions: any[] = []

        if (bookingData.chargeToContactName) {
          searchConditions.push({
            contact_name: {
              equals: bookingData.chargeToContactName,
            },
          })
        }

        if (bookingData.chargeToContactNumber) {
          searchConditions.push({
            contact_phone: {
              equals: bookingData.chargeToContactNumber,
            },
          })
        }

        if (searchConditions.length > 0) {
          const searchResult = await payload.find({
            collection: bookingData.chargeToCollection as 'customers' | 'paying-customers',
            where: {
              or: searchConditions,
            },
            limit: 1,
          })

          if (searchResult.docs.length > 0) {
            bookingData.chargeToId = searchResult.docs[0]
          }
        }
      } catch (error: any) {
        console.error('Error searching by contact info:', error.message || error)
      }
    }

    // Extract the actual ID value (could be number or object with id property)
    let chargeToIdValue: number | null = null
    if (typeof bookingData.chargeToId === 'number') {
      chargeToIdValue = bookingData.chargeToId
    } else if (typeof bookingData.chargeToId === 'object' && bookingData.chargeToId !== null) {
      if (bookingData.chargeToId.id) {
        chargeToIdValue = bookingData.chargeToId.id
      }
    }

    // Only populate if we have an ID and collection, and it's not already fully populated
    if (
      chargeToIdValue &&
      bookingData.chargeToCollection &&
      !bookingData.chargeToId?.customer_name
    ) {
      try {
        const chargeToEntity = await payload.findByID({
          collection: bookingData.chargeToCollection as 'customers' | 'paying-customers',
          id: chargeToIdValue,
          depth: 0,
        })

        if (chargeToEntity) {
          bookingData.chargeToId = chargeToEntity
        }
      } catch (error: any) {
        console.error('Error populating chargeToId:', error.message || error)
        // Continue without populating - the ID is still there
      }
    }

    // Populate fromId relationship if needed
    // Store the collection before populating, as it might be lost
    // IMPORTANT: fromCollection MUST be preserved - it tells us which collection the ID belongs to
    const storedFromCollection = bookingData.fromCollection

    // If fromId is undefined but we have collection and address, try to find by address
    if (!bookingData.fromId && bookingData.fromCollection && bookingData.fromAddress) {
      try {
        const collectionToUse = bookingData.fromCollection || 'customers'

        const searchConditions: any[] = []

        // Build search conditions based on collection type
        if (collectionToUse === 'customers' || collectionToUse === 'paying-customers') {
          if (bookingData.fromAddress) {
            searchConditions.push({ street: { equals: bookingData.fromAddress } })
          }
          if (bookingData.fromCity) {
            searchConditions.push({ city: { equals: bookingData.fromCity } })
          }
        } else if (collectionToUse === 'empty-parks' || collectionToUse === 'wharves') {
          if (bookingData.fromAddress) {
            searchConditions.push({ 'address.street': { equals: bookingData.fromAddress } })
          }
          if (bookingData.fromCity) {
            searchConditions.push({ 'address.city': { equals: bookingData.fromCity } })
          }
        }

        if (searchConditions.length > 0) {
          const searchResult = await payload.find({
            collection: collectionToUse as
              | 'customers'
              | 'paying-customers'
              | 'empty-parks'
              | 'wharves',
            where: {
              and: searchConditions,
            },
            limit: 1,
          })

          if (searchResult.docs.length > 0) {
            bookingData.fromId = searchResult.docs[0]
            bookingData.fromCollection = collectionToUse
          }
        }
      } catch (error: any) {
        // Error searching by address - continue without populating
      }
    }

    if (bookingData.fromId) {
      try {
        let fromIdValue: number | null = null
        if (typeof bookingData.fromId === 'number') {
          fromIdValue = bookingData.fromId
        } else if (typeof bookingData.fromId === 'object' && bookingData.fromId !== null) {
          if (bookingData.fromId.id) {
            fromIdValue = bookingData.fromId.id
          } else if (bookingData.fromId.customer_name || bookingData.fromId.name) {
            // Already populated - ensure collection is set
            if (!bookingData.fromCollection && storedFromCollection) {
              bookingData.fromCollection = storedFromCollection
            }
          }
        }

        if (fromIdValue && !bookingData.fromId?.customer_name && !bookingData.fromId?.name) {
          // CRITICAL: Use storedFromCollection first, then bookingData.fromCollection, NEVER default to 'customers'
          const collectionToUse = storedFromCollection || bookingData.fromCollection

          if (collectionToUse) {
            try {
              const fromEntity = await payload.findByID({
                collection: collectionToUse as
                  | 'customers'
                  | 'paying-customers'
                  | 'empty-parks'
                  | 'wharves',
                id: fromIdValue,
                depth: 0,
              })

              if (fromEntity) {
                bookingData.fromId = fromEntity
                bookingData.fromCollection = collectionToUse
              } else {
                bookingData.fromCollection = collectionToUse
              }
            } catch (findError: any) {
              bookingData.fromCollection = collectionToUse
            }
          }
        } else if (typeof bookingData.fromId === 'object' && bookingData.fromId !== null) {
          // If already populated as object, ensure collection is set
          if (!bookingData.fromCollection && storedFromCollection) {
            bookingData.fromCollection = storedFromCollection
          }
        }
      } catch (error: any) {
        // Error populating fromId - continue
      }
    }

    // Populate toId relationship if needed
    // Store the collection before populating, as it might be lost
    // IMPORTANT: toCollection MUST be preserved - it tells us which collection the ID belongs to
    const storedToCollection = bookingData.toCollection

    // If toId is undefined but we have collection and address, try to find by address
    if (!bookingData.toId && bookingData.toCollection && bookingData.toAddress) {
      try {
        const collectionToUse = bookingData.toCollection || 'customers'

        const searchConditions: any[] = []

        // Build search conditions based on collection type
        if (collectionToUse === 'customers' || collectionToUse === 'paying-customers') {
          if (bookingData.toAddress) {
            searchConditions.push({ street: { equals: bookingData.toAddress } })
          }
          if (bookingData.toCity) {
            searchConditions.push({ city: { equals: bookingData.toCity } })
          }
        } else if (collectionToUse === 'empty-parks' || collectionToUse === 'wharves') {
          if (bookingData.toAddress) {
            searchConditions.push({ 'address.street': { equals: bookingData.toAddress } })
          }
          if (bookingData.toCity) {
            searchConditions.push({ 'address.city': { equals: bookingData.toCity } })
          }
        }

        if (searchConditions.length > 0) {
          const searchResult = await payload.find({
            collection: collectionToUse as
              | 'customers'
              | 'paying-customers'
              | 'empty-parks'
              | 'wharves',
            where: {
              and: searchConditions,
            },
            limit: 1,
          })

          if (searchResult.docs.length > 0) {
            bookingData.toId = searchResult.docs[0]
            bookingData.toCollection = collectionToUse
          }
        }
      } catch (error: any) {
        // Error searching by address - continue without populating
      }
    }

    if (bookingData.toId) {
      try {
        let toIdValue: number | null = null
        if (typeof bookingData.toId === 'number') {
          toIdValue = bookingData.toId
        } else if (typeof bookingData.toId === 'object' && bookingData.toId !== null) {
          if (bookingData.toId.id) {
            toIdValue = bookingData.toId.id
          } else if (bookingData.toId.customer_name || bookingData.toId.name) {
            // Already populated - ensure collection is set
            if (!bookingData.toCollection && storedToCollection) {
              bookingData.toCollection = storedToCollection
            }
          }
        }

        if (toIdValue && !bookingData.toId?.customer_name && !bookingData.toId?.name) {
          // CRITICAL: Use storedToCollection first, then bookingData.toCollection, NEVER default to 'customers'
          const collectionToUse = storedToCollection || bookingData.toCollection

          if (collectionToUse) {
            try {
              const toEntity = await payload.findByID({
                collection: collectionToUse as
                  | 'customers'
                  | 'paying-customers'
                  | 'empty-parks'
                  | 'wharves',
                id: toIdValue,
                depth: 0,
              })

              if (toEntity) {
                bookingData.toId = toEntity
                bookingData.toCollection = collectionToUse
              } else {
                bookingData.toCollection = collectionToUse
              }
            } catch (findError: any) {
              bookingData.toCollection = collectionToUse
            }
          }
        } else if (typeof bookingData.toId === 'object' && bookingData.toId !== null) {
          // If already populated as object, ensure collection is set
          if (!bookingData.toCollection && storedToCollection) {
            bookingData.toCollection = storedToCollection
          }
        }
      } catch (error: any) {
        // Error populating toId - continue
      }
    }

    // Normalize polymorphic fields for frontend prefill: send numeric IDs + collection fields
    // We keep the original populated bookingData for view pages and attach a normalized copy for forms
    const extractIdCollection = (rel: any): { id?: number; collection?: string } => {
      if (rel === null || rel === undefined) return {}
      if (typeof rel === 'number') return { id: rel }
      if (Array.isArray(rel)) {
        // Handle Payload relation arrays [id, collectionIndex] or similar
        const idCandidate = Number(rel[0])
        if (!isNaN(idCandidate)) return { id: idCandidate }
      }
      if (typeof rel === 'object') {
        // Payload polymorphic relation object { relationTo, value }
        if ('relationTo' in rel && 'value' in rel) {
          const relationTo = (rel as { relationTo: any }).relationTo
          const value = (rel as { value: any }).value
          if (typeof value === 'number') return { id: value, collection: relationTo as string }
          if (value && typeof value === 'object' && 'id' in value) {
            return { id: Number((value as any).id), collection: relationTo as string }
          }
        }
        // Populated doc with id; collection may be unknown here
        if ('id' in rel) {
          return { id: Number((rel as any).id) }
        }
      }
      return {}
    }

    const normalizeSingle = (obj: any, idField: string, collectionField?: string): void => {
      if (!obj || !(idField in obj)) return
      const { id, collection } = extractIdCollection(obj[idField])
      if (id && id > 0) {
        obj[idField] = id
        if (collectionField && collection) obj[collectionField] = collection
      } else {
        delete obj[idField]
        if (collectionField) delete obj[collectionField]
      }
    }

    const normalizeArray = (obj: any, idsField: string, collectionsField?: string): void => {
      if (!obj || !(idsField in obj) || !Array.isArray(obj[idsField])) return
      const ids: number[] = []
      const cols: string[] = []
      const values = obj[idsField] as any[]
      for (let i = 0; i < values.length; i++) {
        const { id, collection } = extractIdCollection(values[i])
        if (id && id > 0) {
          ids.push(id)
          if (collectionsField) cols.push(collection || '')
        }
      }
      if (ids.length > 0) {
        obj[idsField] = ids
        if (collectionsField) obj[collectionsField] = cols
      } else {
        delete obj[idsField]
        if (collectionsField) delete obj[collectionsField]
      }
    }

    // Create a normalized copy for form prefill; keep original for view
    const normalizedBooking = JSON.parse(JSON.stringify(bookingData))

    // Top-level polymorphic fields
    normalizeSingle(normalizedBooking, 'fromId', 'fromCollection')
    normalizeSingle(normalizedBooking, 'toId', 'toCollection')
    normalizeSingle(normalizedBooking, 'chargeToId', 'chargeToCollection')

    // Single-collection relationship fields (normalize to numeric IDs)
    normalizeSingle(normalizedBooking, 'vesselId')
    normalizeSingle(normalizedBooking, 'consigneeId')

    // Routing group polymorphic fields
    if (normalizedBooking.fullRouting && typeof normalizedBooking.fullRouting === 'object') {
      normalizeSingle(normalizedBooking.fullRouting, 'pickupLocationId', 'pickupLocationCollection')
      normalizeSingle(
        normalizedBooking.fullRouting,
        'dropoffLocationId',
        'dropoffLocationCollection',
      )
      normalizeArray(normalizedBooking.fullRouting, 'viaLocations', 'viaLocationsCollections')
    }

    if (normalizedBooking.emptyRouting && typeof normalizedBooking.emptyRouting === 'object') {
      // shippingLineId is a single-collection relation; normalize in case it's populated object
      normalizeSingle(normalizedBooking.emptyRouting, 'shippingLineId')
      // pickupLocationId here is single-collection (empty-parks) but still normalize
      normalizeSingle(normalizedBooking.emptyRouting, 'pickupLocationId')
      normalizeSingle(
        normalizedBooking.emptyRouting,
        'dropoffLocationId',
        'dropoffLocationCollection',
      )
      normalizeArray(normalizedBooking.emptyRouting, 'viaLocations', 'viaLocationsCollections')
    }

    return NextResponse.json({
      success: true,
      importContainerBooking: bookingData, // original populated (good for view)
      normalizedImportContainerBooking: normalizedBooking, // form-friendly numeric+collection
    })
  } catch (error: any) {
    console.error('Error fetching import container booking:', error)
    const errorMessage =
      error?.message || error?.data?.message || 'Failed to fetch import container booking'
    return NextResponse.json({ message: errorMessage }, { status: error?.status || 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await getTenantContext(request, 'containers_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)
    const body = await request.json()

    console.log('[PATCH] Raw request body:', JSON.stringify(body, null, 2))

    // CRITICAL: Clean routing data FIRST - ensure IDs are numbers, not strings or arrays
    if (body.fullRouting) {
      const fr = body.fullRouting

      // Clean pickupLocationId - must be a number
      if (fr.pickupLocationId !== undefined && fr.pickupLocationId !== null) {
        if (typeof fr.pickupLocationId === 'string' && fr.pickupLocationId.includes(':')) {
          const [collection, idStr] = fr.pickupLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id)) {
            fr.pickupLocationId = id
            fr.pickupLocationCollection = collection
          } else {
            delete fr.pickupLocationId
          }
        } else if (Array.isArray(fr.pickupLocationId)) {
          fr.pickupLocationId = Number(fr.pickupLocationId[0])
        } else {
          fr.pickupLocationId = Number(fr.pickupLocationId)
        }
      }

      // Clean dropoffLocationId - must be a number
      if (fr.dropoffLocationId !== undefined && fr.dropoffLocationId !== null) {
        if (typeof fr.dropoffLocationId === 'string' && fr.dropoffLocationId.includes(':')) {
          const [collection, idStr] = fr.dropoffLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id)) {
            fr.dropoffLocationId = id
            fr.dropoffLocationCollection = collection
          } else {
            delete fr.dropoffLocationId
          }
        } else if (Array.isArray(fr.dropoffLocationId)) {
          fr.dropoffLocationId = Number(fr.dropoffLocationId[0])
        } else {
          fr.dropoffLocationId = Number(fr.dropoffLocationId)
        }
      }

      // Clean viaLocations - must be array of numbers
      if (Array.isArray(fr.viaLocations)) {
        const cleanedVia: number[] = []
        const collections: string[] = []

        fr.viaLocations.forEach((via: any, index: number) => {
          let viaId: number
          let collection: string | undefined

          if (Array.isArray(via)) {
            viaId = Number(via[0])
          } else if (typeof via === 'string' && via.includes(':')) {
            const [coll, idStr] = via.split(':')
            viaId = parseInt(idStr, 10)
            collection = coll
          } else {
            viaId = Number(via)
            // Use collection from viaLocationsCollections if available
            if (
              fr.viaLocationsCollections &&
              Array.isArray(fr.viaLocationsCollections) &&
              fr.viaLocationsCollections[index]
            ) {
              collection = fr.viaLocationsCollections[index]
            }
          }

          if (!isNaN(viaId) && viaId > 0) {
            cleanedVia.push(viaId)
            if (collection) {
              collections.push(collection)
            }
          }
        })

        if (cleanedVia.length > 0) {
          fr.viaLocations = cleanedVia
          if (collections.length === cleanedVia.length && collections.every((c) => c)) {
            fr.viaLocationsCollections = collections
          }
        } else {
          delete fr.viaLocations
          delete fr.viaLocationsCollections
        }
      }
    }

    if (body.emptyRouting) {
      const er = body.emptyRouting

      // Clean pickupLocationId - must be a number
      if (er.pickupLocationId !== undefined && er.pickupLocationId !== null) {
        if (typeof er.pickupLocationId === 'string' && er.pickupLocationId.includes(':')) {
          const [collection, idStr] = er.pickupLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id)) {
            er.pickupLocationId = id
            er.pickupLocationCollection = collection
          } else {
            delete er.pickupLocationId
          }
        } else if (Array.isArray(er.pickupLocationId)) {
          er.pickupLocationId = Number(er.pickupLocationId[0])
        } else {
          er.pickupLocationId = Number(er.pickupLocationId)
        }
      }

      // Clean dropoffLocationId - must be a number
      if (er.dropoffLocationId !== undefined && er.dropoffLocationId !== null) {
        if (typeof er.dropoffLocationId === 'string' && er.dropoffLocationId.includes(':')) {
          const [collection, idStr] = er.dropoffLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id)) {
            er.dropoffLocationId = id
            er.dropoffLocationCollection = collection
          } else {
            delete er.dropoffLocationId
          }
        } else if (Array.isArray(er.dropoffLocationId)) {
          er.dropoffLocationId = Number(er.dropoffLocationId[0])
        } else {
          er.dropoffLocationId = Number(er.dropoffLocationId)
        }
      }

      // Clean viaLocations - must be array of numbers
      if (Array.isArray(er.viaLocations)) {
        const cleanedVia: number[] = []
        const collections: string[] = []

        er.viaLocations.forEach((via: any, index: number) => {
          let viaId: number
          let collection: string | undefined

          if (Array.isArray(via)) {
            viaId = Number(via[0])
          } else if (typeof via === 'string' && via.includes(':')) {
            const [coll, idStr] = via.split(':')
            viaId = parseInt(idStr, 10)
            collection = coll
          } else {
            viaId = Number(via)
            // Use collection from viaLocationsCollections if available
            if (
              er.viaLocationsCollections &&
              Array.isArray(er.viaLocationsCollections) &&
              er.viaLocationsCollections[index]
            ) {
              collection = er.viaLocationsCollections[index]
            }
          }

          if (!isNaN(viaId) && viaId > 0) {
            cleanedVia.push(viaId)
            if (collection) {
              collections.push(collection)
            }
          }
        })

        if (cleanedVia.length > 0) {
          er.viaLocations = cleanedVia
          if (collections.length === cleanedVia.length && collections.every((c) => c)) {
            er.viaLocationsCollections = collections
          }
        } else {
          delete er.viaLocations
          delete er.viaLocationsCollections
        }
      }
    }

    console.log('[PATCH] Cleaned request body:', JSON.stringify(body, null, 2))

    // Get the booking to update
    const bookingToUpdate = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!bookingToUpdate) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (bookingToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (bookingToUpdate as { tenantId: { id: number } }).tenantId.id
        : (bookingToUpdate as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Prepare update data - only include fields that are provided
    const updateData: Record<string, unknown> = {}
    const allowedFields = [
      'status',
      'customerReference',
      'bookingReference',
      'chargeToId',
      'chargeToCollection',
      'chargeToContactName',
      'chargeToContactNumber',
      'consigneeId',
      'vesselId',
      'eta',
      'availability',
      'storageStart',
      'firstFreeImportDate',
      'fromId',
      'fromCollection',
      'fromAddress',
      'fromCity',
      'fromState',
      'fromPostcode',
      'toId',
      'toCollection',
      'toAddress',
      'toCity',
      'toState',
      'toPostcode',
      'containerSizeIds',
      'containerQuantities',
      'emptyRouting',
      'fullRouting',
      'instructions',
      'jobNotes',
      'driverAllocation',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // For polymorphic relationships in groups, Payload has trouble validating them
    // If status is 'draft', we can omit optional routing fields to avoid validation issues
    // Otherwise, we need to ensure the IDs are valid and properly formatted
    const isDraft = updateData.status === 'draft' || bookingToUpdate.status === 'draft'

    // Helper function to find which collection an ID belongs to (for current tenant)
    const findCollectionForId = async (
      id: number,
      allowedCollections: string[],
      tenantId: number,
    ): Promise<string | null> => {
      for (const collection of allowedCollections) {
        try {
          const found = await payload.find({
            collection: collection as any,
            where: {
              and: [{ id: { equals: id } }, { tenantId: { equals: tenantId } }],
            },
            limit: 1,
          })
          if (found.docs.length > 0) {
            return collection
          }
        } catch {
          // Continue checking other collections
        }
      }
      return null
    }

    // Clean fullRouting - for draft status, we can be more lenient
    if (updateData.fullRouting && typeof updateData.fullRouting === 'object') {
      const fullRouting = updateData.fullRouting as any

      // Ensure relationship IDs are numbers, not arrays or other types
      // Payload sometimes interprets values incorrectly for polymorphic relationships in groups
      if (fullRouting.dropoffLocationId !== undefined && fullRouting.dropoffLocationId !== null) {
        // Handle array format [id, collectionIndex] that Payload might be sending
        let dropoffId: number
        if (Array.isArray(fullRouting.dropoffLocationId)) {
          dropoffId = Number(fullRouting.dropoffLocationId[0])
        } else {
          dropoffId = Number(fullRouting.dropoffLocationId)
        }

        if (isNaN(dropoffId) || dropoffId <= 0) {
          delete fullRouting.dropoffLocationId
          delete fullRouting.dropoffLocationCollection
        } else {
          // Use provided collection or find it
          const providedCollection = fullRouting.dropoffLocationCollection
          const allowedCollections = ['customers', 'paying-customers', 'empty-parks', 'wharves']

          if (providedCollection && allowedCollections.includes(providedCollection)) {
            // Validate ID exists in the provided collection AND belongs to this tenant
            try {
              const found = await payload.find({
                collection: providedCollection as any,
                where: {
                  and: [{ id: { equals: dropoffId } }, { tenantId: { equals: tenant.id } }],
                },
                limit: 1,
              })
              if (found.docs.length > 0) {
                console.log(
                  `[PATCH] ✓ dropoffLocationId ${dropoffId} EXISTS in ${providedCollection} for tenant ${tenant.id} (fullRouting)`,
                )
                fullRouting.dropoffLocationId = dropoffId
                fullRouting.dropoffLocationCollection = providedCollection
              } else {
                throw new Error(
                  `ID ${dropoffId} not found in ${providedCollection} for tenant ${tenant.id}`,
                )
              }
            } catch (error: any) {
              console.warn(
                `[PATCH] ✗ dropoffLocationId ${dropoffId} NOT FOUND in ${providedCollection} for tenant ${tenant.id} (fullRouting). Error: ${error.message || error}`,
              )
              // Even in draft mode, keep the ID if we have a collection - let Payload handle validation
              // Only delete if we truly can't find the collection
              if (providedCollection) {
                console.warn(
                  `[PATCH] Keeping dropoffLocationId ${dropoffId} with collection ${providedCollection} (will be validated by Payload)`,
                )
                fullRouting.dropoffLocationId = dropoffId
                fullRouting.dropoffLocationCollection = providedCollection
              } else {
                console.warn(
                  `[PATCH] Deleting dropoffLocationId ${dropoffId} - no valid collection found`,
                )
                delete fullRouting.dropoffLocationId
                delete fullRouting.dropoffLocationCollection
              }
            }
          } else {
            // Try to find collection
            const collection = await findCollectionForId(dropoffId, allowedCollections, tenant.id)
            if (collection) {
              fullRouting.dropoffLocationId = dropoffId
              fullRouting.dropoffLocationCollection = collection
            } else {
              console.warn(
                `[PATCH] dropoffLocationId ${dropoffId} not found in any allowed collection for fullRouting`,
              )
              // If we have a provided collection, keep it even if validation failed
              // Payload will handle the validation
              if (providedCollection) {
                fullRouting.dropoffLocationId = dropoffId
                fullRouting.dropoffLocationCollection = providedCollection
              } else {
                delete fullRouting.dropoffLocationId
                delete fullRouting.dropoffLocationCollection
              }
            }
          }
        }
      }

      if (fullRouting.pickupLocationId !== undefined && fullRouting.pickupLocationId !== null) {
        let pickupId: number
        if (Array.isArray(fullRouting.pickupLocationId)) {
          pickupId = Number(fullRouting.pickupLocationId[0])
        } else {
          pickupId = Number(fullRouting.pickupLocationId)
        }

        if (isNaN(pickupId) || pickupId <= 0) {
          delete fullRouting.pickupLocationId
          delete fullRouting.pickupLocationCollection
        } else {
          // Use provided collection or find it
          const providedCollection = fullRouting.pickupLocationCollection
          const allowedCollections = ['customers', 'paying-customers', 'empty-parks', 'wharves']

          if (providedCollection && allowedCollections.includes(providedCollection)) {
            // Validate ID exists in the provided collection AND belongs to this tenant
            try {
              const found = await payload.find({
                collection: providedCollection as any,
                where: {
                  and: [{ id: { equals: pickupId } }, { tenantId: { equals: tenant.id } }],
                },
                limit: 1,
              })
              if (found.docs.length > 0) {
                console.log(
                  `[PATCH] ✓ pickupLocationId ${pickupId} EXISTS in ${providedCollection} for tenant ${tenant.id} (fullRouting)`,
                )
                fullRouting.pickupLocationId = pickupId
                fullRouting.pickupLocationCollection = providedCollection
              } else {
                throw new Error(
                  `ID ${pickupId} not found in ${providedCollection} for tenant ${tenant.id}`,
                )
              }
            } catch (error: any) {
              console.warn(
                `[PATCH] ✗ pickupLocationId ${pickupId} NOT FOUND in ${providedCollection} for tenant ${tenant.id} (fullRouting). Error: ${error.message || error}`,
              )
              // Even in draft mode, keep the ID if we have a collection - let Payload handle validation
              // Only delete if we truly can't find the collection
              if (providedCollection) {
                console.warn(
                  `[PATCH] Keeping pickupLocationId ${pickupId} with collection ${providedCollection} (will be validated by Payload)`,
                )
                fullRouting.pickupLocationId = pickupId
                fullRouting.pickupLocationCollection = providedCollection
              } else {
                console.warn(
                  `[PATCH] Deleting pickupLocationId ${pickupId} - no valid collection found`,
                )
                delete fullRouting.pickupLocationId
                delete fullRouting.pickupLocationCollection
              }
            }
          } else {
            // Try to find collection
            const collection = await findCollectionForId(pickupId, allowedCollections, tenant.id)
            if (collection) {
              fullRouting.pickupLocationId = pickupId
              fullRouting.pickupLocationCollection = collection
            } else {
              console.warn(
                `[PATCH] pickupLocationId ${pickupId} not found in any allowed collection for fullRouting`,
              )
              // If we have a provided collection, keep it even if validation failed
              // Payload will handle the validation
              if (providedCollection) {
                fullRouting.pickupLocationId = pickupId
                fullRouting.pickupLocationCollection = providedCollection
              } else {
                delete fullRouting.pickupLocationId
                delete fullRouting.pickupLocationCollection
              }
            }
          }
        }
      }

      // Clean viaLocations array - ensure all items are numbers, not arrays
      if (fullRouting.viaLocations !== undefined && fullRouting.viaLocations !== null) {
        if (Array.isArray(fullRouting.viaLocations)) {
          if (fullRouting.viaLocations.length === 0) {
            delete fullRouting.viaLocations
            delete fullRouting.viaLocationsCollections
          } else {
            const cleanedVia: number[] = []
            const collections: string[] = []

            for (const via of fullRouting.viaLocations) {
              let viaId: number

              // Handle array format [id, collectionIndex] that Payload might be sending
              if (Array.isArray(via)) {
                viaId = Number(via[0])
              } else {
                viaId = Number(via)
              }

              if (!isNaN(viaId) && viaId > 0) {
                // Try to find which collection this ID belongs to
                const allowedCollections = ['warehouses', 'wharves', 'empty-parks']
                const providedCollections = fullRouting.viaLocationsCollections
                const index = cleanedVia.length

                let collection: string | null = null

                // Check if we have collection info from the provided collections array
                if (
                  providedCollections &&
                  Array.isArray(providedCollections) &&
                  providedCollections[index]
                ) {
                  const providedCollection = providedCollections[index]
                  if (allowedCollections.includes(providedCollection)) {
                    try {
                      const found = await payload.find({
                        collection: providedCollection as any,
                        where: {
                          and: [{ id: { equals: viaId } }, { tenantId: { equals: tenant.id } }],
                        },
                        limit: 1,
                      })
                      if (found.docs.length > 0) {
                        console.log(
                          `[PATCH] ✓ emptyRouting.viaLocation[${index}] ${viaId} EXISTS in ${providedCollection} for tenant ${tenant.id}`,
                        )
                        collection = providedCollection
                      } else {
                        throw new Error(
                          `ID ${viaId} not found in ${providedCollection} for tenant ${tenant.id}`,
                        )
                      }
                    } catch (error: any) {
                      console.warn(
                        `[PATCH] ✗ emptyRouting.viaLocation[${index}] ${viaId} NOT FOUND in ${providedCollection} for tenant ${tenant.id}. Error: ${error.message || error}`,
                      )
                      // Collection doesn't match, try to find it
                    }
                  }
                }

                // If no collection found yet, search all allowed collections
                if (!collection) {
                  for (const coll of allowedCollections) {
                    try {
                      const found = await payload.find({
                        collection: coll as any,
                        where: {
                          and: [{ id: { equals: viaId } }, { tenantId: { equals: tenant.id } }],
                        },
                        limit: 1,
                      })
                      if (found.docs.length > 0) {
                        console.log(
                          `[PATCH] ✓ emptyRouting.viaLocation[${index}] ${viaId} EXISTS in ${coll} for tenant ${tenant.id} (searched)`,
                        )
                        collection = coll
                        break
                      }
                    } catch (error: any) {
                      // Continue searching
                    }
                  }
                }

                if (collection) {
                  cleanedVia.push(viaId)
                  collections.push(collection)
                } else {
                  // Check if we have a provided collection from viaLocationsCollections
                  const providedCollection =
                    providedCollections &&
                    Array.isArray(providedCollections) &&
                    providedCollections[index] !== undefined &&
                    providedCollections[index] !== null
                      ? providedCollections[index]
                      : null

                  // Always use provided collection if available, even if validation failed
                  // Payload will handle the validation
                  if (providedCollection && allowedCollections.includes(providedCollection)) {
                    console.warn(
                      `[PATCH] viaLocation ${viaId} using provided collection ${providedCollection} (validation may fail but keeping it)`,
                    )
                    cleanedVia.push(viaId)
                    collections.push(providedCollection)
                  } else if (providedCollection) {
                    // Even if collection is not in allowedCollections, keep it if provided
                    // This handles edge cases where collection might be valid but not in our list
                    console.warn(
                      `[PATCH] viaLocation ${viaId} using provided collection ${providedCollection} (not in allowed list but keeping it)`,
                    )
                    cleanedVia.push(viaId)
                    collections.push(providedCollection)
                  } else {
                    console.warn(
                      `[PATCH] viaLocation ${viaId} not found in any allowed collection for fullRouting and no provided collection - SKIPPING`,
                    )
                    // Skip this via location if we truly have no collection info
                  }
                }
              }
            }

            if (cleanedVia.length > 0) {
              fullRouting.viaLocations = cleanedVia
              // Always save collections array if we have viaLocations
              // Ensure collections array matches viaLocations length
              if (collections.length === cleanedVia.length) {
                fullRouting.viaLocationsCollections = collections
              } else {
                // If collections array is shorter, pad with empty strings or use provided collections
                console.warn(
                  `[PATCH] viaLocationsCollections length (${collections.length}) doesn't match viaLocations length (${cleanedVia.length}), padding`,
                )
                // Try to use provided collections if available (from the original fullRouting.viaLocationsCollections)
                const originalCollections = fullRouting.viaLocationsCollections
                if (
                  originalCollections &&
                  Array.isArray(originalCollections) &&
                  originalCollections.length === cleanedVia.length
                ) {
                  fullRouting.viaLocationsCollections = originalCollections
                } else {
                  // Pad with empty strings
                  const paddedCollections = [...collections]
                  while (paddedCollections.length < cleanedVia.length) {
                    paddedCollections.push('')
                  }
                  fullRouting.viaLocationsCollections = paddedCollections
                }
              }
            } else {
              delete fullRouting.viaLocations
              delete fullRouting.viaLocationsCollections
            }
          }
        } else {
          delete fullRouting.viaLocations
          delete fullRouting.viaLocationsCollections
        }
      }

      // If routing object is empty after cleaning, remove it entirely
      if (Object.keys(fullRouting).length === 0) {
        delete updateData.fullRouting
      }
    }

    // Clean emptyRouting
    if (updateData.emptyRouting && typeof updateData.emptyRouting === 'object') {
      const emptyRouting = updateData.emptyRouting as any

      if (emptyRouting.dropoffLocationId !== undefined && emptyRouting.dropoffLocationId !== null) {
        let dropoffId: number
        if (Array.isArray(emptyRouting.dropoffLocationId)) {
          dropoffId = Number(emptyRouting.dropoffLocationId[0])
        } else {
          dropoffId = Number(emptyRouting.dropoffLocationId)
        }

        if (isNaN(dropoffId) || dropoffId <= 0) {
          delete emptyRouting.dropoffLocationId
          delete emptyRouting.dropoffLocationCollection
        } else {
          // Use provided collection or find it
          const providedCollection = emptyRouting.dropoffLocationCollection
          const allowedCollections = ['customers', 'paying-customers', 'empty-parks', 'wharves']

          if (providedCollection && allowedCollections.includes(providedCollection)) {
            // Validate ID exists in the provided collection AND belongs to this tenant
            try {
              const found = await payload.find({
                collection: providedCollection as any,
                where: {
                  and: [{ id: { equals: dropoffId } }, { tenantId: { equals: tenant.id } }],
                },
                limit: 1,
              })
              if (found.docs.length > 0) {
                console.log(
                  `[PATCH] ✓ emptyRouting.dropoffLocationId ${dropoffId} EXISTS in ${providedCollection} for tenant ${tenant.id}`,
                )
                emptyRouting.dropoffLocationId = dropoffId
                emptyRouting.dropoffLocationCollection = providedCollection
              } else {
                throw new Error(
                  `ID ${dropoffId} not found in ${providedCollection} for tenant ${tenant.id}`,
                )
              }
            } catch (error: any) {
              console.warn(
                `[PATCH] ✗ emptyRouting.dropoffLocationId ${dropoffId} NOT FOUND in ${providedCollection} for tenant ${tenant.id}. Error: ${error.message || error}`,
              )
              if (isDraft) {
                console.log(
                  `[PATCH] Deleting emptyRouting.dropoffLocationId ${dropoffId} and collection (draft status)`,
                )
                delete emptyRouting.dropoffLocationId
                delete emptyRouting.dropoffLocationCollection
              } else {
                console.warn(
                  `[PATCH] Keeping emptyRouting.dropoffLocationId ${dropoffId} despite not existing (non-draft status)`,
                )
                emptyRouting.dropoffLocationId = dropoffId
                emptyRouting.dropoffLocationCollection = providedCollection
              }
            }
          } else {
            // Try to find collection
            const collection = await findCollectionForId(dropoffId, allowedCollections, tenant.id)
            if (collection) {
              emptyRouting.dropoffLocationId = dropoffId
              emptyRouting.dropoffLocationCollection = collection
            } else {
              console.warn(
                `[PATCH] dropoffLocationId ${dropoffId} not found in any allowed collection for emptyRouting`,
              )
              if (isDraft) {
                delete emptyRouting.dropoffLocationId
                delete emptyRouting.dropoffLocationCollection
              } else {
                emptyRouting.dropoffLocationId = dropoffId
              }
            }
          }
        }
      }

      if (emptyRouting.pickupLocationId !== undefined && emptyRouting.pickupLocationId !== null) {
        let pickupId: number
        if (Array.isArray(emptyRouting.pickupLocationId)) {
          pickupId = Number(emptyRouting.pickupLocationId[0])
        } else {
          pickupId = Number(emptyRouting.pickupLocationId)
        }

        if (isNaN(pickupId) || pickupId <= 0) {
          delete emptyRouting.pickupLocationId
        } else {
          try {
            const found = await payload.find({
              collection: 'empty-parks',
              where: {
                and: [{ id: { equals: pickupId } }, { tenantId: { equals: tenant.id } }],
              },
              limit: 1,
            })
            if (found.docs.length > 0) {
              console.log(
                `[PATCH] ✓ emptyRouting.pickupLocationId ${pickupId} EXISTS in empty-parks for tenant ${tenant.id}`,
              )
              emptyRouting.pickupLocationId = pickupId
            } else {
              throw new Error(`ID ${pickupId} not found in empty-parks for tenant ${tenant.id}`)
            }
          } catch (error: any) {
            console.warn(
              `[PATCH] ✗ emptyRouting.pickupLocationId ${pickupId} NOT FOUND in empty-parks for tenant ${tenant.id}. Error: ${error.message || error}`,
            )
            if (isDraft) {
              delete emptyRouting.pickupLocationId
            } else {
              emptyRouting.pickupLocationId = pickupId
            }
          }
        }
      }

      // Clean viaLocations array - ensure all items are numbers, not arrays
      if (emptyRouting.viaLocations !== undefined && emptyRouting.viaLocations !== null) {
        if (Array.isArray(emptyRouting.viaLocations)) {
          if (emptyRouting.viaLocations.length === 0) {
            delete emptyRouting.viaLocations
            delete emptyRouting.viaLocationsCollections
          } else {
            const cleanedVia: number[] = []
            const collections: string[] = []

            for (const via of emptyRouting.viaLocations) {
              let viaId: number

              // Handle array format [id, collectionIndex] that Payload might be sending
              if (Array.isArray(via)) {
                viaId = Number(via[0])
              } else {
                viaId = Number(via)
              }

              if (!isNaN(viaId) && viaId > 0) {
                // Try to find which collection this ID belongs to
                const allowedCollections = ['warehouses', 'wharves', 'empty-parks']
                const providedCollections = emptyRouting.viaLocationsCollections
                const index = cleanedVia.length

                let collection: string | null = null

                // Check if we have collection info from the provided collections array
                if (
                  providedCollections &&
                  Array.isArray(providedCollections) &&
                  providedCollections[index]
                ) {
                  const providedCollection = providedCollections[index]
                  if (allowedCollections.includes(providedCollection)) {
                    try {
                      const found = await payload.find({
                        collection: providedCollection as any,
                        where: {
                          and: [{ id: { equals: viaId } }, { tenantId: { equals: tenant.id } }],
                        },
                        limit: 1,
                      })
                      if (found.docs.length > 0) {
                        console.log(
                          `[PATCH] ✓ emptyRouting.viaLocation[${index}] ${viaId} EXISTS in ${providedCollection} for tenant ${tenant.id}`,
                        )
                        collection = providedCollection
                      } else {
                        throw new Error(
                          `ID ${viaId} not found in ${providedCollection} for tenant ${tenant.id}`,
                        )
                      }
                    } catch (error: any) {
                      console.warn(
                        `[PATCH] ✗ emptyRouting.viaLocation[${index}] ${viaId} NOT FOUND in ${providedCollection} for tenant ${tenant.id}. Error: ${error.message || error}`,
                      )
                      // Collection doesn't match, try to find it
                    }
                  }
                }

                // If no collection found yet, search all allowed collections
                if (!collection) {
                  for (const coll of allowedCollections) {
                    try {
                      const found = await payload.find({
                        collection: coll as any,
                        where: {
                          and: [{ id: { equals: viaId } }, { tenantId: { equals: tenant.id } }],
                        },
                        limit: 1,
                      })
                      if (found.docs.length > 0) {
                        console.log(
                          `[PATCH] ✓ emptyRouting.viaLocation[${index}] ${viaId} EXISTS in ${coll} for tenant ${tenant.id} (searched)`,
                        )
                        collection = coll
                        break
                      }
                    } catch (error: any) {
                      // Continue searching
                    }
                  }
                }

                if (collection) {
                  cleanedVia.push(viaId)
                  collections.push(collection)
                } else {
                  // Check if we have a provided collection from viaLocationsCollections
                  const providedCollection =
                    providedCollections &&
                    Array.isArray(providedCollections) &&
                    providedCollections[index]
                      ? providedCollections[index]
                      : null
                  if (providedCollection && allowedCollections.includes(providedCollection)) {
                    // Use provided collection even if validation failed - Payload will handle it
                    console.warn(
                      `[PATCH] viaLocation ${viaId} using provided collection ${providedCollection} (validation may fail but keeping it)`,
                    )
                    cleanedVia.push(viaId)
                    collections.push(providedCollection)
                  } else {
                    console.warn(
                      `[PATCH] viaLocation ${viaId} not found in any allowed collection for emptyRouting and no valid provided collection`,
                    )
                    // Only skip if we truly have no collection info
                    if (providedCollection) {
                      cleanedVia.push(viaId)
                      collections.push(providedCollection)
                    }
                  }
                }
              }
            }

            if (cleanedVia.length > 0) {
              emptyRouting.viaLocations = cleanedVia
              // Always save collections array if we have viaLocations, even if some are empty
              if (collections.length === cleanedVia.length) {
                emptyRouting.viaLocationsCollections = collections
              }
            } else {
              delete emptyRouting.viaLocations
              delete emptyRouting.viaLocationsCollections
            }
          }
        } else {
          delete emptyRouting.viaLocations
          delete emptyRouting.viaLocationsCollections
        }
      }

      // If routing object is empty after cleaning, remove it entirely
      if (Object.keys(emptyRouting).length === 0) {
        delete updateData.emptyRouting
      }
    }

    // For polymorphic relationships in groups, send relation objects { relationTo, value }
    // The validation section above (lines 655-1075) already validated IDs exist (and tenant scope)
    // Now we convert numeric IDs + collection fields to relation objects Payload accepts

    // Full Routing polymorphic relationships
    if (updateData.fullRouting) {
      const fr = updateData.fullRouting as any

      console.log('[PATCH] Full Routing BEFORE conversion:', JSON.stringify(fr, null, 2))
      console.log('[PATCH] Full Routing pickupLocationCollection:', fr.pickupLocationCollection)
      console.log('[PATCH] Full Routing dropoffLocationCollection:', fr.dropoffLocationCollection)
      console.log('[PATCH] Full Routing viaLocationsCollections:', fr.viaLocationsCollections)

      // pickupLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (
        fr.pickupLocationId !== undefined &&
        fr.pickupLocationId !== null &&
        typeof fr.pickupLocationId === 'number'
      ) {
        // Try to infer collection from updateData.fromCollection if missing
        if (!fr.pickupLocationCollection && updateData.fromCollection && updateData.fromId) {
          const fromIdNum =
            typeof updateData.fromId === 'number'
              ? updateData.fromId
              : parseInt(String(updateData.fromId).split(':').pop() || '', 10)
          if (!isNaN(fromIdNum) && fr.pickupLocationId === fromIdNum) {
            fr.pickupLocationCollection = updateData.fromCollection as string
            console.log(
              `[PATCH] Inferred pickupLocationCollection from fromCollection: ${fr.pickupLocationCollection}`,
            )
          }
        }

        if (fr.pickupLocationCollection) {
          console.log(
            `[PATCH] Converting pickupLocationId ${fr.pickupLocationId} with collection "${fr.pickupLocationCollection}" to relation object`,
          )
          fr.pickupLocationId = {
            relationTo: fr.pickupLocationCollection,
            value: fr.pickupLocationId,
          }
          delete fr.pickupLocationCollection
        } else {
          console.warn(
            `[PATCH] pickupLocationId ${fr.pickupLocationId} has no collection field, cannot convert to relation object - DELETING`,
          )
          // Delete if we truly can't find a collection
          delete fr.pickupLocationId
        }
      }

      // dropoffLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (
        fr.dropoffLocationId !== undefined &&
        fr.dropoffLocationId !== null &&
        typeof fr.dropoffLocationId === 'number'
      ) {
        // Try to infer collection from updateData.toCollection if missing
        if (!fr.dropoffLocationCollection && updateData.toCollection && updateData.toId) {
          const toIdNum =
            typeof updateData.toId === 'number'
              ? updateData.toId
              : parseInt(String(updateData.toId).split(':').pop() || '', 10)
          if (!isNaN(toIdNum) && fr.dropoffLocationId === toIdNum) {
            fr.dropoffLocationCollection = updateData.toCollection as string
            console.log(
              `[PATCH] Inferred dropoffLocationCollection from toCollection: ${fr.dropoffLocationCollection}`,
            )
          }
        }

        if (fr.dropoffLocationCollection) {
          console.log(
            `[PATCH] Converting dropoffLocationId ${fr.dropoffLocationId} with collection "${fr.dropoffLocationCollection}" to relation object`,
          )
          fr.dropoffLocationId = {
            relationTo: fr.dropoffLocationCollection,
            value: fr.dropoffLocationId,
          }
          delete fr.dropoffLocationCollection
        } else {
          console.warn(
            `[PATCH] dropoffLocationId ${fr.dropoffLocationId} has no collection field, cannot convert to relation object - DELETING`,
          )
          // Delete if we truly can't find a collection
          delete fr.dropoffLocationId
        }
      }

      // viaLocations: relationTo: ['warehouses', 'wharves', 'empty-parks']
      if (
        Array.isArray(fr.viaLocations) &&
        fr.viaLocations.length > 0 &&
        fr.viaLocations.every((id: any) => typeof id === 'number')
      ) {
        if (Array.isArray(fr.viaLocationsCollections)) {
          fr.viaLocations = fr.viaLocations.map((id: number, index: number) => {
            const collection = fr.viaLocationsCollections[index]
            if (collection && collection.trim() !== '') {
              console.log(
                `[PATCH] Converting viaLocation[${index}] ${id} with collection "${collection}" to relation object`,
              )
              return { relationTo: collection, value: id }
            } else {
              console.warn(
                `[PATCH] viaLocation[${index}] ${id} has no collection, keeping as number (will be skipped by Payload)`,
              )
            }
            return id // Fallback if collection not found
          })
          // Filter out any items that weren't converted (no collection)
          fr.viaLocations = fr.viaLocations.filter((item: any) => {
            if (typeof item === 'object' && 'relationTo' in item && 'value' in item) {
              return true
            }
            // Keep numbers only if they might be valid (but Payload will reject them)
            return typeof item === 'number' && item > 0
          })
          delete fr.viaLocationsCollections
        } else {
          console.warn(
            `[PATCH] viaLocations has no viaLocationsCollections array, cannot convert - DELETING viaLocations`,
          )
          // Delete viaLocations if we don't have collections
          delete fr.viaLocations
        }
      }

      console.log('[PATCH] Full Routing AFTER conversion:', JSON.stringify(fr, null, 2))
    }

    // Empty Routing polymorphic relationships
    if (updateData.emptyRouting) {
      const er = updateData.emptyRouting as any

      console.log('[PATCH] Empty Routing BEFORE conversion:', JSON.stringify(er, null, 2))
      console.log('[PATCH] Empty Routing dropoffLocationCollection:', er.dropoffLocationCollection)
      console.log('[PATCH] Empty Routing viaLocationsCollections:', er.viaLocationsCollections)

      // dropoffLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (
        er.dropoffLocationId !== undefined &&
        er.dropoffLocationId !== null &&
        typeof er.dropoffLocationId === 'number'
      ) {
        if (er.dropoffLocationCollection) {
          console.log(
            `[PATCH] Converting emptyRouting.dropoffLocationId ${er.dropoffLocationId} with collection "${er.dropoffLocationCollection}" to relation object`,
          )
          er.dropoffLocationId = {
            relationTo: er.dropoffLocationCollection,
            value: er.dropoffLocationId,
          }
          delete er.dropoffLocationCollection
        } else {
          console.warn(
            `[PATCH] emptyRouting.dropoffLocationId ${er.dropoffLocationId} has no collection field, cannot convert to relation object`,
          )
        }
      }

      // viaLocations: relationTo: ['warehouses', 'wharves', 'empty-parks']
      if (
        Array.isArray(er.viaLocations) &&
        er.viaLocations.length > 0 &&
        er.viaLocations.every((id: any) => typeof id === 'number')
      ) {
        if (Array.isArray(er.viaLocationsCollections)) {
          er.viaLocations = er.viaLocations.map((id: number, index: number) => {
            const collection = er.viaLocationsCollections[index]
            if (collection) {
              console.log(
                `[PATCH] Converting emptyRouting.viaLocation[${index}] ${id} with collection "${collection}" to relation object`,
              )
              return { relationTo: collection, value: id }
            } else {
              console.warn(
                `[PATCH] emptyRouting.viaLocation[${index}] ${id} has no collection, keeping as number`,
              )
            }
            return id // Fallback if collection not found
          })
          delete er.viaLocationsCollections
        } else {
          console.warn(
            `[PATCH] emptyRouting.viaLocations has no viaLocationsCollections array, cannot convert`,
          )
        }
      }

      console.log('[PATCH] Empty Routing AFTER conversion:', JSON.stringify(er, null, 2))
    }

    // Convert top-level polymorphic relationships (fromId, toId, chargeToId) to relation objects
    const convertTopLevelRelation = (idValue: any, collection?: string) => {
      if (idValue !== undefined && idValue !== null && typeof idValue === 'number' && collection) {
        return { relationTo: collection, value: idValue }
      }
      return idValue
    }

    if (updateData.fromId && typeof updateData.fromId === 'number' && updateData.fromCollection) {
      updateData.fromId = convertTopLevelRelation(
        updateData.fromId,
        updateData.fromCollection as string,
      )
      delete updateData.fromCollection
    }

    if (updateData.toId && typeof updateData.toId === 'number' && updateData.toCollection) {
      updateData.toId = convertTopLevelRelation(updateData.toId, updateData.toCollection as string)
      delete updateData.toCollection
    }

    if (
      updateData.chargeToId &&
      typeof updateData.chargeToId === 'number' &&
      updateData.chargeToCollection
    ) {
      updateData.chargeToId = convertTopLevelRelation(
        updateData.chargeToId as number,
        updateData.chargeToCollection as string,
      )
      delete updateData.chargeToCollection
    }

    // Final cleanup: Preserve relation objects for polymorphic relationships
    // Convert any remaining strings to numbers; leave relation objects intact
    const ensureValidIds = (obj: any, path = ''): void => {
      if (obj === null || obj === undefined) return

      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          // Preserve relation objects
          if (obj[i] && typeof obj[i] === 'object' && 'relationTo' in obj[i] && 'value' in obj[i]) {
            continue
          } else if (Array.isArray(obj[i])) {
            // Convert array wrappers to numbers when possible
            obj[i] = Number(obj[i][0]) || obj[i][0]
          } else if (typeof obj[i] === 'string') {
            // Try to parse if it's a string number
            const num = Number(obj[i])
            if (!isNaN(num)) obj[i] = num
          }
        }
      } else if (typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj)) {
          // Skip collection fields - they should be deleted by now
          if (key.includes('Collection')) continue

          if (key.includes('Id') || key.includes('Locations')) {
            // Preserve relation objects
            if (value && typeof value === 'object' && 'relationTo' in value && 'value' in value) {
              continue
            }

            if (Array.isArray(value)) {
              const cleaned = value
                .map((item: any) => {
                  if (item && typeof item === 'object' && 'relationTo' in item && 'value' in item) {
                    return item
                  } else if (Array.isArray(item)) {
                    return Number(item[0]) || item[0]
                  }
                  return typeof item === 'number' ? item : Number(item) || item
                })
                .filter((item: any) => {
                  if (item && typeof item === 'object' && 'relationTo' in item && 'value' in item)
                    return true
                  return typeof item === 'number' && item > 0
                })

              if (cleaned.length > 0) {
                obj[key] = cleaned
              } else {
                delete obj[key]
              }
            } else if (value !== null && value !== undefined) {
              if (value && typeof value === 'object' && 'relationTo' in value && 'value' in value) {
                continue
              } else if (Array.isArray(value)) {
                obj[key] = Number(value[0]) || value[0]
              } else {
                const num = Number(value)
                if (!isNaN(num) && num > 0) {
                  obj[key] = num
                } else {
                  delete obj[key]
                }
              }
            }
          } else if (typeof value === 'object' && value !== null) {
            ensureValidIds(value, `${path}.${key}`)
          }
        }
      }
    }

    // Apply final cleanup to routing objects (preserve [id, collectionIndex] arrays)
    if (updateData.fullRouting) {
      ensureValidIds(updateData.fullRouting, 'fullRouting')
    }
    if (updateData.emptyRouting) {
      ensureValidIds(updateData.emptyRouting, 'emptyRouting')
    }

    // Log the data being sent for debugging
    console.log(
      '[PATCH /api/import-container-bookings/[id]] Request body:',
      JSON.stringify(body, null, 2),
    )
    console.log(
      '[PATCH /api/import-container-bookings/[id]] Update data (after all processing):',
      JSON.stringify(updateData, null, 2),
    )
    if (updateData.fullRouting) {
      console.log(
        '[PATCH /api/import-container-bookings/[id]] Full Routing (final):',
        JSON.stringify(updateData.fullRouting, null, 2),
      )
    }
    if (updateData.emptyRouting) {
      console.log(
        '[PATCH /api/import-container-bookings/[id]] Empty Routing (final):',
        JSON.stringify(updateData.emptyRouting, null, 2),
      )
    }

    // Update import container booking
    try {
      const updatedBooking = await payload.update({
        collection: 'import-container-bookings',
        id: bookingId,
        data: updateData,
      })

      return NextResponse.json({
        success: true,
        importContainerBooking: updatedBooking,
      })
    } catch (error: any) {
      // Log detailed error information
      console.error('[PATCH] Payload update error:', error)
      if (error?.data?.errors) {
        console.error('[PATCH] Validation errors:', JSON.stringify(error.data.errors, null, 2))
      }
      if (error?.data?.details) {
        console.error('[PATCH] Error details:', JSON.stringify(error.data.details, null, 2))
      }
      // Re-throw to be caught by outer catch
      throw error
    }
  } catch (error: any) {
    console.error('Error updating import container booking:', error)

    // Log detailed error information
    if (error?.data) {
      console.error('Error data:', JSON.stringify(error.data, null, 2))
    }
    if (error?.data?.errors) {
      console.error('Validation errors:', JSON.stringify(error.data.errors, null, 2))
    }
    if (error?.data?.details) {
      console.error('Error details:', JSON.stringify(error.data.details, null, 2))
    }
    if (error?.message) {
      console.error('Error message:', error.message)
    }

    // Return more detailed error message
    const errorMessage =
      error?.message || error?.data?.message || 'Failed to update import container booking'
    const status = error?.status || error?.data?.status || 500

    return NextResponse.json({ message: errorMessage }, { status })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const context = await getTenantContext(request, 'containers_delete')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const resolvedParams = await params
    const bookingId = Number(resolvedParams.id)

    // Get the booking to delete
    const bookingToDelete = await payload.findByID({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    if (!bookingToDelete) {
      return NextResponse.json({ message: 'Import container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (bookingToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (bookingToDelete as { tenantId: { id: number } }).tenantId.id
        : (bookingToDelete as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Import container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Delete import container booking
    await payload.delete({
      collection: 'import-container-bookings',
      id: bookingId,
    })

    return NextResponse.json({
      success: true,
      message: 'Import container booking deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting import container booking:', error)
    return NextResponse.json(
      { message: 'Failed to delete import container booking' },
      { status: 500 },
    )
  }
}
