import dotenv from 'dotenv'

dotenv.config()

const DATABASE_URL =
  process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!DATABASE_URL) {
  console.error('❌ No database connection string found in environment variables')
  process.exit(1)
}

async function verifyBookingData(bookingId) {
  try {
    const { default: pg } = await import('pg')
    const { Client } = pg
    const client = new Client({ connectionString: DATABASE_URL })
    await client.connect()
    console.log('✅ Connected to database\n')

    if (!bookingId) {
      // Get the most recent booking
      const latestResult = await client.query(`
        SELECT id, booking_code 
        FROM import_container_bookings 
        ORDER BY created_at DESC 
        LIMIT 5
      `)

      if (latestResult.rows.length === 0) {
        console.log('❌ No bookings found in database')
        await client.end()
        return
      }

      console.log('📋 Latest bookings:')
      console.log('─'.repeat(80))
      latestResult.rows.forEach((row) => {
        console.log(`  ID: ${row.id} - ${row.booking_code}`)
      })
      console.log('─'.repeat(80))
      console.log('\nUsage: node scripts/verify-booking-data.js <booking_id>')
      console.log(`Example: node scripts/verify-booking-data.js ${latestResult.rows[0].id}`)
      await client.end()
      return
    }

    const result = await client.query(
      `
      SELECT 
        booking_code,
        status,
        full_routing_pickup_location_id,
        full_routing_pickup_location_collection,
        full_routing_dropoff_location_id,
        full_routing_dropoff_location_collection,
        full_routing_via_locations,
        full_routing_via_locations_collections,
        empty_routing_pickup_location_id_id as empty_routing_pickup_location_id,
        empty_routing_dropoff_location_id,
        empty_routing_dropoff_location_collection,
        empty_routing_via_locations,
        empty_routing_via_locations_collections
      FROM import_container_bookings
      WHERE id = $1
    `,
      [bookingId],
    )

    if (result.rows.length === 0) {
      console.log(`❌ Booking with ID ${bookingId} not found`)
      await client.end()
      return
    }

    const booking = result.rows[0]
    console.log('✅ Booking Data:')
    console.log('─'.repeat(80))
    console.log(`Booking Code: ${booking.booking_code}`)
    console.log(`Status: ${booking.status}`)
    console.log('\n📦 Full Container Routing:')
    console.log(`  Pickup Location ID: ${booking.full_routing_pickup_location_id || 'NULL'}`)
    console.log(`  Pickup Collection: ${booking.full_routing_pickup_location_collection || 'NULL'}`)
    console.log(`  Dropoff Location ID: ${booking.full_routing_dropoff_location_id || 'NULL'}`)
    console.log(
      `  Dropoff Collection: ${booking.full_routing_dropoff_location_collection || 'NULL'}`,
    )
    console.log(`  Via Locations: ${booking.full_routing_via_locations || 'NULL'}`)
    console.log(
      `  Via Collections: ${JSON.stringify(booking.full_routing_via_locations_collections) || 'NULL'}`,
    )
    console.log('\n📭 Empty Container Routing:')
    console.log(`  Pickup Location ID: ${booking.empty_routing_pickup_location_id || 'NULL'}`)
    console.log(`  Dropoff Location ID: ${booking.empty_routing_dropoff_location_id || 'NULL'}`)
    console.log(
      `  Dropoff Collection: ${booking.empty_routing_dropoff_location_collection || 'NULL'}`,
    )
    console.log(`  Via Locations: ${booking.empty_routing_via_locations || 'NULL'}`)
    console.log(
      `  Via Collections: ${JSON.stringify(booking.empty_routing_via_locations_collections) || 'NULL'}`,
    )
    console.log('─'.repeat(80))

    // Check for missing data
    const issues = []
    const warnings = []

    // Check full routing
    if (!booking.full_routing_pickup_location_id) {
      warnings.push('Full routing pickup location ID is NULL (may be draft)')
    }
    if (!booking.full_routing_dropoff_location_id) {
      warnings.push('Full routing dropoff location ID is NULL (may be draft)')
    }
    if (
      booking.full_routing_pickup_location_id &&
      !booking.full_routing_pickup_location_collection
    ) {
      issues.push('Full routing pickup location has ID but missing collection')
    }
    if (
      booking.full_routing_dropoff_location_id &&
      !booking.full_routing_dropoff_location_collection
    ) {
      issues.push('Full routing dropoff location has ID but missing collection')
    }
    if (booking.full_routing_via_locations && booking.full_routing_via_locations.length > 0) {
      if (!booking.full_routing_via_locations_collections) {
        issues.push('Full routing has via locations but missing collections array')
      } else {
        const viaCollections = booking.full_routing_via_locations_collections
        if (viaCollections.length !== booking.full_routing_via_locations.length) {
          issues.push(
            `Full routing via locations (${booking.full_routing_via_locations.length}) and collections (${viaCollections.length}) count mismatch`,
          )
        }
      }
    }

    // Check empty routing
    if (!booking.empty_routing_dropoff_location_id) {
      warnings.push('Empty routing dropoff location ID is NULL (may be draft)')
    }
    if (
      booking.empty_routing_dropoff_location_id &&
      !booking.empty_routing_dropoff_location_collection
    ) {
      issues.push('Empty routing dropoff location has ID but missing collection')
    }
    if (booking.empty_routing_via_locations && booking.empty_routing_via_locations.length > 0) {
      if (!booking.empty_routing_via_locations_collections) {
        issues.push('Empty routing has via locations but missing collections array')
      } else {
        const viaCollections = booking.empty_routing_via_locations_collections
        if (viaCollections.length !== booking.empty_routing_via_locations.length) {
          issues.push(
            `Empty routing via locations (${booking.empty_routing_via_locations.length}) and collections (${viaCollections.length}) count mismatch`,
          )
        }
      }
    }

    if (issues.length > 0) {
      console.log('\n❌ Issues found:')
      issues.forEach((issue) => console.log(`  - ${issue}`))
    }

    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      warnings.forEach((warning) => console.log(`  - ${warning}`))
    }

    if (issues.length === 0 && warnings.length === 0) {
      console.log('\n✅ All routing data is complete and consistent!')
    } else if (issues.length === 0) {
      console.log('\n✅ No critical issues found (warnings are okay for draft bookings)')
    }

    await client.end()
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Get booking ID from command line argument
const bookingId = process.argv[2] ? parseInt(process.argv[2]) : null
verifyBookingData(bookingId)
