import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Get database URL from environment
const DATABASE_URL =
  process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!DATABASE_URL) {
  console.error('❌ No database connection string found in environment variables')
  process.exit(1)
}

async function verifyColumns() {
  try {
    const { default: pg } = await import('pg')
    const { Client } = pg

    const client = new Client({
      connectionString: DATABASE_URL,
    })

    await client.connect()
    console.log('✅ Connected to database')

    // Query to get all routing-related columns
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'import_container_bookings' 
      AND column_name LIKE '%routing%'
      ORDER BY column_name;
    `

    const result = await client.query(query)

    console.log('\n📋 Routing columns in import_container_bookings table:')
    console.log('─'.repeat(80))
    console.log('Column Name'.padEnd(50), 'Type'.padEnd(20), 'Nullable')
    console.log('─'.repeat(80))

    result.rows.forEach((row) => {
      console.log(row.column_name.padEnd(50), row.data_type.padEnd(20), row.is_nullable)
    })
    console.log('─'.repeat(80))
    console.log(`Total: ${result.rows.length} routing columns found\n`)

    // Check for required columns
    const requiredColumns = [
      'full_routing_pickup_location_id',
      'full_routing_pickup_location_collection',
      'full_routing_dropoff_location_id',
      'full_routing_dropoff_location_collection',
      'full_routing_via_locations',
      'full_routing_via_locations_collections',
      'empty_routing_pickup_location_id',
      'empty_routing_dropoff_location_id',
      'empty_routing_dropoff_location_collection',
      'empty_routing_via_locations',
      'empty_routing_via_locations_collections',
    ]

    const foundColumns = result.rows.map((row) => row.column_name)
    const missingColumns = requiredColumns.filter((col) => !foundColumns.includes(col))

    if (missingColumns.length === 0) {
      console.log('✅ All required routing columns exist!')
    } else {
      console.log('⚠️  Missing columns:')
      missingColumns.forEach((col) => console.log(`   - ${col}`))
    }

    await client.end()
  } catch (error) {
    console.error('❌ Verification failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

verifyColumns()
