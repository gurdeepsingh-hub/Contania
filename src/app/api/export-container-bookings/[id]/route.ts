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

    // Get depth parameter from query string
    const url = new URL(request.url)
    const depth = url.searchParams.get('depth') ? Number(url.searchParams.get('depth')) : 2

    // Get the export container booking with error handling
    // Try with depth first, but if it fails due to polymorphic relationship issues, retry with depth 0
    let booking: any
    try {
      booking = await payload.findByID({
        collection: 'export-container-bookings',
        id: bookingId,
        depth: Math.max(depth, 1), // Ensure at least depth 1
      })
    } catch (findError: any) {
      console.error('Error finding booking with depth, retrying with depth 0:', findError)
      // If it's a not found error, return 404
      if (findError.status === 404 || findError.name === 'NotFound') {
        return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
      }
      // If it's a relationship population error, try again with depth 0
      // This can happen with polymorphic relationships
      try {
        booking = await payload.findByID({
          collection: 'export-container-bookings',
          id: bookingId,
          depth: 0, // Fetch without populating relationships
        })
        console.log('Successfully fetched booking with depth 0, will manually populate relationships')
      } catch (retryError: any) {
        console.error('Error finding booking even with depth 0:', retryError)
        if (retryError.status === 404 || retryError.name === 'NotFound') {
          return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
        }
        throw retryError
      }
    }

    if (!booking) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
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
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Manually populate polymorphic chargeToId relationship if not already populated
    const bookingData = booking as any
    
    // If chargeToId is undefined but chargeToCollection exists, try to find entity by contact info
    if (!bookingData.chargeToId && bookingData.chargeToCollection && (bookingData.chargeToContactName || bookingData.chargeToContactNumber)) {
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
    if (chargeToIdValue && bookingData.chargeToCollection && !bookingData.chargeToId?.customer_name) {
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
    const storedFromCollection = bookingData.fromCollection
    console.log('[API] Step 3 - fromId DEBUG:', {
      fromId: bookingData.fromId,
      fromIdType: typeof bookingData.fromId,
      fromCollection: bookingData.fromCollection,
      storedFromCollection,
      fromIdIsObject: typeof bookingData.fromId === 'object' && bookingData.fromId !== null,
      fromIdHasId: bookingData.fromId?.id,
      fromIdHasName: bookingData.fromId?.customer_name || bookingData.fromId?.name,
      fromAddress: bookingData.fromAddress,
      fromCity: bookingData.fromCity,
    })
    
    // If fromId is undefined but we have collection and address, try to find by address
    if (!bookingData.fromId && bookingData.fromCollection && bookingData.fromAddress) {
      try {
        const collectionToUse = bookingData.fromCollection || 'customers'
        console.log(`[API] Step 3 - fromId is undefined, attempting to find by address in ${collectionToUse}`)
        
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
            collection: collectionToUse as 'customers' | 'paying-customers' | 'empty-parks' | 'wharves',
            where: {
              and: searchConditions,
            },
            limit: 1,
          })
          
          if (searchResult.docs.length > 0) {
            bookingData.fromId = searchResult.docs[0]
            bookingData.fromCollection = collectionToUse
            console.log(`[API] Step 3 - Found fromId by address:`, (searchResult.docs[0] as any).customer_name || (searchResult.docs[0] as any).name || searchResult.docs[0].id)
          } else {
            console.warn(`[API] Step 3 - Could not find entity by address in ${collectionToUse}`)
          }
        }
      } catch (error: any) {
        console.error('[API] Step 3 - Error searching for fromId by address:', error.message || error)
      }
    }
    
    if (bookingData.fromId) {
      try {
        let fromIdValue: number | null = null
        if (typeof bookingData.fromId === 'number') {
          fromIdValue = bookingData.fromId
          console.log('[API] Step 3 - fromId is number:', fromIdValue)
        } else if (typeof bookingData.fromId === 'object' && bookingData.fromId !== null) {
          if (bookingData.fromId.id) {
            fromIdValue = bookingData.fromId.id
            console.log('[API] Step 3 - fromId object has id:', fromIdValue)
          } else if (bookingData.fromId.customer_name || bookingData.fromId.name) {
            // Already populated - ensure collection is set
            if (!bookingData.fromCollection && storedFromCollection) {
              bookingData.fromCollection = storedFromCollection
            }
            console.log('[API] Step 3 - fromId already populated:', bookingData.fromId.customer_name || bookingData.fromId.name)
          }
        }

        if (fromIdValue && !bookingData.fromId?.customer_name && !bookingData.fromId?.name) {
          // CRITICAL: Use storedFromCollection first, then bookingData.fromCollection, NEVER default to 'customers'
          const collectionToUse = storedFromCollection || bookingData.fromCollection
          
          if (!collectionToUse) {
            console.error(`[API] Step 3 - CRITICAL ERROR: Cannot populate fromId ${fromIdValue} - fromCollection is missing!`)
            console.error('This means the collection was not saved with the booking. Check the beforeChange hook.')
            // Don't populate - we don't know which collection to use
          } else {
            console.log(`[API] Step 3 - Attempting to populate fromId ${fromIdValue} from ${collectionToUse}`)
            try {
              const fromEntity = await payload.findByID({
                collection: collectionToUse as 'customers' | 'paying-customers' | 'empty-parks' | 'wharves',
                id: fromIdValue,
                depth: 0,
              })
              
              if (fromEntity) {
                bookingData.fromId = fromEntity
                // CRITICAL: Always set fromCollection to ensure it's in the response
                bookingData.fromCollection = collectionToUse
                console.log(`[API] Step 3 - Successfully populated fromId:`, (fromEntity as any).customer_name || (fromEntity as any).name || fromEntity.id, 'collection:', collectionToUse)
              } else {
                console.warn(`[API] Step 3 - Entity ${fromIdValue} not found in ${collectionToUse}`)
                // Still set the collection even if entity not found
                bookingData.fromCollection = collectionToUse
              }
            } catch (findError: any) {
              console.error(`[API] Step 3 - Error finding fromId ${fromIdValue} in ${collectionToUse}:`, findError.message || findError)
              // Still set the collection even if lookup failed
              bookingData.fromCollection = collectionToUse
            }
          }
        } else if (typeof bookingData.fromId === 'object' && bookingData.fromId !== null) {
          // If already populated as object, ensure collection is set
          if (!bookingData.fromCollection && storedFromCollection) {
            bookingData.fromCollection = storedFromCollection
            console.log('[API] Step 3 - Restored fromCollection from stored value:', storedFromCollection)
          }
          console.log('[API] Step 3 - fromId already populated as object, collection:', bookingData.fromCollection)
        }
      } catch (error: any) {
        console.error('[API] Step 3 - Error populating fromId:', error.message || error)
      }
    }
    
    console.log('[API] Step 3 - fromId FINAL:', {
      fromId: bookingData.fromId,
      fromCollection: bookingData.fromCollection,
    })

    // Populate toId relationship if needed
    // Store the collection before populating, as it might be lost
    const storedToCollection = bookingData.toCollection
    console.log('[API] Step 3 - toId DEBUG:', {
      toId: bookingData.toId,
      toIdType: typeof bookingData.toId,
      toCollection: bookingData.toCollection,
      storedToCollection,
      toIdIsObject: typeof bookingData.toId === 'object' && bookingData.toId !== null,
      toIdHasId: bookingData.toId?.id,
      toIdHasName: bookingData.toId?.customer_name || bookingData.toId?.name,
      toAddress: bookingData.toAddress,
      toCity: bookingData.toCity,
    })
    
    // If toId is undefined but we have collection and address, try to find by address
    if (!bookingData.toId && bookingData.toCollection && bookingData.toAddress) {
      try {
        const collectionToUse = bookingData.toCollection || 'customers'
        console.log(`[API] Step 3 - toId is undefined, attempting to find by address in ${collectionToUse}`)
        
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
            collection: collectionToUse as 'customers' | 'paying-customers' | 'empty-parks' | 'wharves',
            where: {
              and: searchConditions,
            },
            limit: 1,
          })
          
          if (searchResult.docs.length > 0) {
            bookingData.toId = searchResult.docs[0]
            bookingData.toCollection = collectionToUse
            console.log(`[API] Step 3 - Found toId by address:`, (searchResult.docs[0] as any).customer_name || (searchResult.docs[0] as any).name || searchResult.docs[0].id)
          } else {
            console.warn(`[API] Step 3 - Could not find entity by address in ${collectionToUse}`)
          }
        }
      } catch (error: any) {
        console.error('[API] Step 3 - Error searching for toId by address:', error.message || error)
      }
    }
    
    if (bookingData.toId) {
      try {
        let toIdValue: number | null = null
        if (typeof bookingData.toId === 'number') {
          toIdValue = bookingData.toId
          console.log('[API] Step 3 - toId is number:', toIdValue)
        } else if (typeof bookingData.toId === 'object' && bookingData.toId !== null) {
          if (bookingData.toId.id) {
            toIdValue = bookingData.toId.id
            console.log('[API] Step 3 - toId object has id:', toIdValue)
          } else if (bookingData.toId.customer_name || bookingData.toId.name) {
            // Already populated - ensure collection is set
            if (!bookingData.toCollection && storedToCollection) {
              bookingData.toCollection = storedToCollection
            }
            console.log('[API] Step 3 - toId already populated:', bookingData.toId.customer_name || bookingData.toId.name)
          }
        }

        if (toIdValue && !bookingData.toId?.customer_name && !bookingData.toId?.name) {
          // CRITICAL: Use storedToCollection first, then bookingData.toCollection, NEVER default to 'customers'
          const collectionToUse = storedToCollection || bookingData.toCollection
          
          if (!collectionToUse) {
            console.error(`[API] Step 3 - CRITICAL ERROR: Cannot populate toId ${toIdValue} - toCollection is missing!`)
            console.error('This means the collection was not saved with the booking. Check the beforeChange hook.')
            // Don't populate - we don't know which collection to use
          } else {
            console.log(`[API] Step 3 - Attempting to populate toId ${toIdValue} from ${collectionToUse}`)
            try {
              const toEntity = await payload.findByID({
                collection: collectionToUse as 'customers' | 'paying-customers' | 'empty-parks' | 'wharves',
                id: toIdValue,
                depth: 0,
              })
              
              if (toEntity) {
                bookingData.toId = toEntity
                // CRITICAL: Always set toCollection to ensure it's in the response
                bookingData.toCollection = collectionToUse
                console.log(`[API] Step 3 - Successfully populated toId:`, (toEntity as any).customer_name || (toEntity as any).name || toEntity.id, 'collection:', collectionToUse)
              } else {
                console.warn(`[API] Step 3 - Entity ${toIdValue} not found in ${collectionToUse}`)
                // Still set the collection even if entity not found
                bookingData.toCollection = collectionToUse
              }
            } catch (findError: any) {
              console.error(`[API] Step 3 - Error finding toId ${toIdValue} in ${collectionToUse}:`, findError.message || findError)
              // Still set the collection even if lookup failed
              bookingData.toCollection = collectionToUse
            }
          }
        } else if (typeof bookingData.toId === 'object' && bookingData.toId !== null) {
          // If already populated as object, ensure collection is set
          if (!bookingData.toCollection && storedToCollection) {
            bookingData.toCollection = storedToCollection
            console.log('[API] Step 3 - Restored toCollection from stored value:', storedToCollection)
          }
          console.log('[API] Step 3 - toId already populated as object, collection:', bookingData.toCollection)
        }
      } catch (error: any) {
        console.error('[API] Step 3 - Error populating toId:', error.message || error)
      }
    }
    
    console.log('[API] Step 3 - toId FINAL:', {
      toId: bookingData.toId,
      toCollection: bookingData.toCollection,
    })

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
    normalizeSingle(normalizedBooking, 'consignorId')

    // Routing group polymorphic fields
    if (normalizedBooking.emptyRouting && typeof normalizedBooking.emptyRouting === 'object') {
      // shippingLineId is a single-collection relation; normalize in case it's populated object
      normalizeSingle(normalizedBooking.emptyRouting, 'shippingLineId')
      // pickupLocationId here is single-collection (empty-parks) but still normalize
      normalizeSingle(normalizedBooking.emptyRouting, 'pickupLocationId', 'pickupLocationCollection')
      normalizeSingle(
        normalizedBooking.emptyRouting,
        'dropoffLocationId',
        'dropoffLocationCollection',
      )
      normalizeArray(normalizedBooking.emptyRouting, 'viaLocations', 'viaLocationsCollections')
    }

    if (normalizedBooking.fullRouting && typeof normalizedBooking.fullRouting === 'object') {
      normalizeSingle(normalizedBooking.fullRouting, 'pickupLocationId', 'pickupLocationCollection')
      normalizeSingle(
        normalizedBooking.fullRouting,
        'dropoffLocationId',
        'dropoffLocationCollection',
      )
      normalizeArray(normalizedBooking.fullRouting, 'viaLocations', 'viaLocationsCollections')
    }

    return NextResponse.json({
      success: true,
      exportContainerBooking: bookingData, // original populated (good for view)
      normalizedExportContainerBooking: normalizedBooking, // form-friendly numeric+collection
    })
  } catch (error: any) {
    console.error('Error fetching export container booking:', error)
    const errorMessage =
      error?.message || error?.data?.message || 'Failed to fetch export container booking'
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
        let cleanedId: number | null = null
        let collection: string | undefined = undefined

        if (typeof fr.pickupLocationId === 'string' && fr.pickupLocationId.includes(':')) {
          const [coll, idStr] = fr.pickupLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
            collection = coll
          }
        } else if (Array.isArray(fr.pickupLocationId)) {
          const id = Number(fr.pickupLocationId[0])
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        } else {
          const id = Number(fr.pickupLocationId)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        }

        if (cleanedId !== null && cleanedId > 0) {
          fr.pickupLocationId = cleanedId
          if (collection) {
            fr.pickupLocationCollection = collection
          }
        } else {
          delete fr.pickupLocationId
          delete fr.pickupLocationCollection
        }
      }

      // Clean dropoffLocationId - must be a number
      if (fr.dropoffLocationId !== undefined && fr.dropoffLocationId !== null) {
        let cleanedId: number | null = null
        let collection: string | undefined = undefined

        if (typeof fr.dropoffLocationId === 'string' && fr.dropoffLocationId.includes(':')) {
          const [coll, idStr] = fr.dropoffLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
            collection = coll
          }
        } else if (Array.isArray(fr.dropoffLocationId)) {
          const id = Number(fr.dropoffLocationId[0])
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        } else {
          const id = Number(fr.dropoffLocationId)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        }

        if (cleanedId !== null && cleanedId > 0) {
          fr.dropoffLocationId = cleanedId
          if (collection) {
            fr.dropoffLocationCollection = collection
          }
        } else {
          delete fr.dropoffLocationId
          delete fr.dropoffLocationCollection
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
        let cleanedId: number | null = null
        let collection: string | undefined = undefined

        if (typeof er.pickupLocationId === 'string' && er.pickupLocationId.includes(':')) {
          const [coll, idStr] = er.pickupLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
            collection = coll
          }
        } else if (Array.isArray(er.pickupLocationId)) {
          const id = Number(er.pickupLocationId[0])
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        } else {
          const id = Number(er.pickupLocationId)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        }

        if (cleanedId !== null && cleanedId > 0) {
          er.pickupLocationId = cleanedId
          if (collection) {
            er.pickupLocationCollection = collection
          }
        } else {
          delete er.pickupLocationId
          delete er.pickupLocationCollection
        }
      }

      // Clean dropoffLocationId - must be a number
      if (er.dropoffLocationId !== undefined && er.dropoffLocationId !== null) {
        let cleanedId: number | null = null
        let collection: string | undefined = undefined

        if (typeof er.dropoffLocationId === 'string' && er.dropoffLocationId.includes(':')) {
          const [coll, idStr] = er.dropoffLocationId.split(':')
          const id = parseInt(idStr, 10)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
            collection = coll
          }
        } else if (Array.isArray(er.dropoffLocationId)) {
          const id = Number(er.dropoffLocationId[0])
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        } else {
          const id = Number(er.dropoffLocationId)
          if (!isNaN(id) && id > 0) {
            cleanedId = id
          }
        }

        if (cleanedId !== null && cleanedId > 0) {
          er.dropoffLocationId = cleanedId
          if (collection) {
            er.dropoffLocationCollection = collection
          }
        } else {
          delete er.dropoffLocationId
          delete er.dropoffLocationCollection
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
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!bookingToUpdate) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (bookingToUpdate as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (bookingToUpdate as { tenantId: { id: number } }).tenantId.id
        : (bookingToUpdate as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
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
      'consignorId',
      'vesselId',
      'etd',
      'receivalStart',
      'cutoff',
      'fromId',
      'fromCollection',
      'toId',
      'toCollection',
      'containerSizeIds',
      'containerQuantities',
      'emptyRouting',
      'fullRouting',
      'instructions',
      'jobNotes',
      'releaseNumber',
      'weight',
      'driverAllocation',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field]
      }
    }

    // If emptyRouting is sent but should be excluded (from steps 1-3), remove it
    // Or if it's an empty object, remove it to avoid validation issues
    if (updateData.emptyRouting && typeof updateData.emptyRouting === 'object') {
      const er = updateData.emptyRouting as any
      const hasValidFields =
        er.shippingLineId ||
        (er.pickupLocationId !== undefined && er.pickupLocationId !== null) ||
        er.pickupDate ||
        (er.viaLocations && Array.isArray(er.viaLocations) && er.viaLocations.length > 0) ||
        (er.dropoffLocationId !== undefined && er.dropoffLocationId !== null) ||
        er.dropoffDate ||
        er.requestedDeliveryDate

      if (!hasValidFields) {
        // Empty object, remove it to avoid validation errors
        delete updateData.emptyRouting
      }
    }

    // Convert routing fields from numeric IDs + collection fields to Payload's {relationTo, value} format
    // Full Routing polymorphic relationships
    if (updateData.fullRouting && typeof updateData.fullRouting === 'object') {
      const fr = updateData.fullRouting as any

      // pickupLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (fr.pickupLocationId !== undefined && fr.pickupLocationId !== null) {
        // If it's already a valid relation object, keep it
        if (
          typeof fr.pickupLocationId === 'object' &&
          'relationTo' in fr.pickupLocationId &&
          'value' in fr.pickupLocationId
        ) {
          // Check if the value is valid
          const value = fr.pickupLocationId.value
          if (
            typeof value === 'number' &&
            value > 0 &&
            typeof fr.pickupLocationId.relationTo === 'string' &&
            fr.pickupLocationId.relationTo.trim() !== ''
          ) {
            // Already valid relation object, keep it
          } else {
            // Invalid relation object, remove it
            delete fr.pickupLocationId
            delete fr.pickupLocationCollection
          }
        } else if (
          typeof fr.pickupLocationId === 'number' &&
          fr.pickupLocationId > 0
        ) {
          if (fr.pickupLocationCollection) {
            fr.pickupLocationId = {
              relationTo: fr.pickupLocationCollection,
              value: fr.pickupLocationId,
            }
            delete fr.pickupLocationCollection
          } else {
            // No collection provided, delete the field to avoid validation errors
            console.warn('[PATCH] pickupLocationId has no collection, deleting field')
            delete fr.pickupLocationId
          }
        } else {
          // Invalid value - remove it
          delete fr.pickupLocationId
          delete fr.pickupLocationCollection
        }
      }

      // dropoffLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (fr.dropoffLocationId !== undefined && fr.dropoffLocationId !== null) {
        // If it's already a valid relation object, keep it
        if (
          typeof fr.dropoffLocationId === 'object' &&
          'relationTo' in fr.dropoffLocationId &&
          'value' in fr.dropoffLocationId
        ) {
          // Check if the value is valid
          const value = fr.dropoffLocationId.value
          if (
            typeof value === 'number' &&
            value > 0 &&
            typeof fr.dropoffLocationId.relationTo === 'string' &&
            fr.dropoffLocationId.relationTo.trim() !== ''
          ) {
            // Already valid relation object, keep it
          } else {
            // Invalid relation object, remove it
            delete fr.dropoffLocationId
            delete fr.dropoffLocationCollection
          }
        } else if (
          typeof fr.dropoffLocationId === 'number' &&
          fr.dropoffLocationId > 0
        ) {
          if (fr.dropoffLocationCollection) {
            fr.dropoffLocationId = {
              relationTo: fr.dropoffLocationCollection,
              value: fr.dropoffLocationId,
            }
            delete fr.dropoffLocationCollection
          } else {
            // No collection provided, delete the field to avoid validation errors
            console.warn('[PATCH] dropoffLocationId has no collection, deleting field')
            delete fr.dropoffLocationId
          }
        } else {
          // Invalid value - remove it
          delete fr.dropoffLocationId
          delete fr.dropoffLocationCollection
        }
      }

      // viaLocations: relationTo: ['warehouses', 'wharves', 'empty-parks']
      if (
        Array.isArray(fr.viaLocations) &&
        fr.viaLocations.length > 0 &&
        fr.viaLocations.every((id: any) => typeof id === 'number') &&
        Array.isArray(fr.viaLocationsCollections)
      ) {
        fr.viaLocations = fr.viaLocations.map((id: number, index: number) => {
          const collection = fr.viaLocationsCollections[index]
          if (collection && collection.trim() !== '') {
            return { relationTo: collection, value: id }
          }
          return id
        }).filter((item: any) => {
          // Only keep relation objects
          return typeof item === 'object' && 'relationTo' in item && 'value' in item
        })
        delete fr.viaLocationsCollections
      }
    }

    // Empty Routing polymorphic relationships
    if (updateData.emptyRouting && typeof updateData.emptyRouting === 'object') {
      const er = updateData.emptyRouting as any

      // pickupLocationId: relationTo: 'empty-parks' (single collection - keep as plain number like import)
      if (er.pickupLocationId !== undefined && er.pickupLocationId !== null) {
        let pickupId: number
        if (Array.isArray(er.pickupLocationId)) {
          pickupId = Number(er.pickupLocationId[0])
        } else if (
          typeof er.pickupLocationId === 'object' &&
          'relationTo' in er.pickupLocationId &&
          'value' in er.pickupLocationId
        ) {
          // Extract value from relation object
          pickupId = Number(er.pickupLocationId.value)
        } else {
          pickupId = Number(er.pickupLocationId)
        }

        if (isNaN(pickupId) || pickupId <= 0) {
          delete er.pickupLocationId
          delete er.pickupLocationCollection
        } else {
          // Validate ID exists in empty-parks collection (like import does)
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
              // Keep as plain number (single collection relationship)
              er.pickupLocationId = pickupId
              delete er.pickupLocationCollection
            } else {
              throw new Error(`ID ${pickupId} not found in empty-parks for tenant ${tenant.id}`)
            }
          } catch (error: any) {
            console.warn(
              `[PATCH] ✗ emptyRouting.pickupLocationId ${pickupId} NOT FOUND in empty-parks for tenant ${tenant.id}. Error: ${error.message || error}`,
            )
            // Check if booking is draft - if so, delete invalid ID; otherwise keep it for Payload validation
            const isDraft = updateData.status === 'draft' || (bookingToUpdate as any)?.status === 'draft'
            if (isDraft) {
              delete er.pickupLocationId
              delete er.pickupLocationCollection
            } else {
              // Keep as plain number - let Payload handle validation
              er.pickupLocationId = pickupId
              delete er.pickupLocationCollection
            }
          }
        }
      }

      // dropoffLocationId: relationTo: ['customers', 'paying-customers', 'empty-parks', 'wharves']
      if (er.dropoffLocationId !== undefined && er.dropoffLocationId !== null) {
        // If it's already a valid relation object, keep it
        if (
          typeof er.dropoffLocationId === 'object' &&
          'relationTo' in er.dropoffLocationId &&
          'value' in er.dropoffLocationId
        ) {
          // Check if the value is valid
          const value = er.dropoffLocationId.value
          if (
            typeof value === 'number' &&
            value > 0 &&
            typeof er.dropoffLocationId.relationTo === 'string' &&
            er.dropoffLocationId.relationTo.trim() !== ''
          ) {
            // Already valid relation object, keep it
          } else {
            // Invalid relation object, remove it
            delete er.dropoffLocationId
            delete er.dropoffLocationCollection
          }
        } else if (
          typeof er.dropoffLocationId === 'number' &&
          er.dropoffLocationId > 0
        ) {
          if (er.dropoffLocationCollection) {
            er.dropoffLocationId = {
              relationTo: er.dropoffLocationCollection,
              value: er.dropoffLocationId,
            }
            delete er.dropoffLocationCollection
          } else {
            // No collection provided, delete the field to avoid validation errors
            console.warn('[PATCH] emptyRouting.dropoffLocationId has no collection, deleting field')
            delete er.dropoffLocationId
          }
        } else {
          // Invalid value - remove it
          delete er.dropoffLocationId
          delete er.dropoffLocationCollection
        }
      }

      // viaLocations: relationTo: ['warehouses', 'wharves', 'empty-parks']
      if (
        Array.isArray(er.viaLocations) &&
        er.viaLocations.length > 0 &&
        er.viaLocations.every((id: any) => typeof id === 'number') &&
        Array.isArray(er.viaLocationsCollections)
      ) {
        er.viaLocations = er.viaLocations.map((id: number, index: number) => {
          const collection = er.viaLocationsCollections[index]
          if (collection && collection.trim() !== '') {
            return { relationTo: collection, value: id }
          }
          return id
        }).filter((item: any) => {
          // Only keep relation objects
          return typeof item === 'object' && 'relationTo' in item && 'value' in item
        })
        delete er.viaLocationsCollections
      }
    }

    // Convert top-level polymorphic relationships (fromId, toId, chargeToId) to relation objects
    if (updateData.fromId && typeof updateData.fromId === 'number' && updateData.fromCollection) {
      updateData.fromId = {
        relationTo: updateData.fromCollection as string,
        value: updateData.fromId,
      }
      delete updateData.fromCollection
    }

    if (updateData.toId && typeof updateData.toId === 'number' && updateData.toCollection) {
      updateData.toId = {
        relationTo: updateData.toCollection as string,
        value: updateData.toId,
      }
      delete updateData.toCollection
    }

    if (
      updateData.chargeToId &&
      typeof updateData.chargeToId === 'number' &&
      updateData.chargeToCollection
    ) {
      updateData.chargeToId = {
        relationTo: updateData.chargeToCollection as string,
        value: updateData.chargeToId,
      }
      delete updateData.chargeToCollection
    }

    // Update export container booking
    const updatedBooking = await payload.update({
      collection: 'export-container-bookings',
      id: bookingId,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      exportContainerBooking: updatedBooking,
    })
  } catch (error) {
    console.error('Error updating export container booking:', error)
    return NextResponse.json({ message: 'Failed to update export container booking' }, { status: 500 })
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
      collection: 'export-container-bookings',
      id: bookingId,
    })

    if (!bookingToDelete) {
      return NextResponse.json({ message: 'Export container booking not found' }, { status: 404 })
    }

    // Verify booking belongs to this tenant
    const bookingTenantId =
      typeof (bookingToDelete as { tenantId?: number | { id: number } }).tenantId === 'object'
        ? (bookingToDelete as { tenantId: { id: number } }).tenantId.id
        : (bookingToDelete as { tenantId?: number }).tenantId

    if (bookingTenantId !== tenant.id) {
      return NextResponse.json(
        { message: 'Export container booking does not belong to this tenant' },
        { status: 403 },
      )
    }

    // Delete export container booking
    await payload.delete({
      collection: 'export-container-bookings',
      id: bookingId,
    })

    return NextResponse.json({
      success: true,
      message: 'Export container booking deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting export container booking:', error)
    return NextResponse.json({ message: 'Failed to delete export container booking' }, { status: 500 })
  }
}

