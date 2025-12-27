import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Read the SQL migration file
const migrationPath = path.join(__dirname, '..', 'migrations', 'add_routing_location_id_fields.sql')
const sql = fs.readFileSync(migrationPath, 'utf-8')

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URI || process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!DATABASE_URL) {
  console.error('❌ No database connection string found in environment variables')
  console.error('Please set DATABASE_URI, DATABASE_URL, or POSTGRES_URL')
  process.exit(1)
}

// Import pg dynamically
async function runMigration() {
  try {
    const { default: pg } = await import('pg')
    const { Client } = pg

    console.log('🔌 Connecting to database...')
    const client = new Client({
      connectionString: DATABASE_URL,
    })

    await client.connect()
    console.log('✅ Connected to database')

    console.log('🚀 Running migration: add_routing_location_id_fields.sql')
    console.log('─'.repeat(80))
    
    await client.query(sql)
    
    console.log('─'.repeat(80))
    console.log('✅ Migration completed successfully!')
    console.log('')
    console.log('Added columns:')
    console.log('  - full_routing_pickup_location_id')
    console.log('  - full_routing_dropoff_location_id')
    console.log('  - full_routing_via_locations')
    console.log('  - empty_routing_dropoff_location_id')
    console.log('  - empty_routing_via_locations')
    console.log('')
    console.log('Created indexes for better performance')
    
    await client.end()
    console.log('🔌 Database connection closed')
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

runMigration()

