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

    return NextResponse.json({
      success: true,
      exportContainerBooking: bookingData,
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
      'consignorId',
      'vesselId',
      'etd',
      'receivalStart',
      'cutoff',
      'fromId',
      'toId',
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

