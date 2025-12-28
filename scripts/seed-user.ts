import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Determine .env file path (try multiple locations)
const possibleEnvPaths = [
  path.resolve(__dirname, '../.env'), // Project root
  path.resolve(process.cwd(), '.env'), // Current working directory
  path.join(process.cwd(), '.env'), // Alternative cwd path
]

const envExamplePath = path.resolve(__dirname, '../.env.example')
let envPath: string | null = null

// Find the first existing .env file
for (const possiblePath of possibleEnvPaths) {
  if (fs.existsSync(possiblePath)) {
    envPath = possiblePath
    break
  }
}

if (!envPath) {
  console.error('❌ Error: .env file not found!')
  console.error('   Checked locations:')
  possibleEnvPaths.forEach((p) => {
    console.error(`   - ${p}`)
  })
  if (fs.existsSync(envExamplePath)) {
    console.error(`\n   Tip: Copy .env.example to .env and fill in the required values:`)
    console.error(`   cp .env.example .env`)
  }
  process.exit(1)
}

console.log(`📄 Loading .env file from: ${envPath}`)

// Load .env file
const result = dotenv.config({ path: envPath })

if (result.error) {
  console.error('❌ Error loading .env file:', result.error.message)
  process.exit(1)
}

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URI', 'PAYLOAD_SECRET']
const missingVars = requiredEnvVars.filter(
  (varName) => !process.env[varName] || process.env[varName]?.trim() === '',
)

if (missingVars.length > 0) {
  console.error('❌ Error: Missing or empty required environment variables:')
  missingVars.forEach((varName) => {
    const value = process.env[varName]
    if (!value) {
      console.error(`   - ${varName} (not set)`)
    } else {
      console.error(`   - ${varName} (empty string)`)
    }
  })
  console.error(`\n   Please ensure these are set with valid values in your .env file: ${envPath}`)
  console.error(`   Example: PAYLOAD_SECRET=your-secret-key-here`)
  process.exit(1)
}

// Verify PAYLOAD_SECRET is not just whitespace
if (process.env.PAYLOAD_SECRET && process.env.PAYLOAD_SECRET.trim().length < 10) {
  console.error('❌ Error: PAYLOAD_SECRET must be at least 10 characters long')
  console.error(`   Current length: ${process.env.PAYLOAD_SECRET.trim().length}`)
  console.error(`   Please set a longer secret in your .env file: ${envPath}`)
  process.exit(1)
}

// Debug: Show that env vars are loaded (without showing full values)
console.log('✅ Environment variables loaded:')
console.log(`   DATABASE_URI: ${process.env.DATABASE_URI ? '✓ Set' : '✗ Missing'}`)
console.log(
  `   PAYLOAD_SECRET: ${process.env.PAYLOAD_SECRET ? `✓ Set (${process.env.PAYLOAD_SECRET.length} chars)` : '✗ Missing'}`,
)

// Double-check PAYLOAD_SECRET is actually set and not empty
if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.trim() === '') {
  console.error('\n❌ Error: PAYLOAD_SECRET is missing or empty after loading .env file')
  console.error(`   Please check your .env file: ${envPath}`)
  console.error(`   Make sure it contains: PAYLOAD_SECRET=your-secret-key-here`)
  process.exit(1)
}

// Verify the secret value (show first few chars for debugging)
const secretPreview = process.env.PAYLOAD_SECRET.substring(0, 8) + '...'
console.log(`   PAYLOAD_SECRET preview: ${secretPreview}`)

async function seedUser() {
  let payload

  try {
    // Dynamically import Payload and config AFTER env vars are loaded
    console.log('🔄 Loading Payload config...')
    const { getPayload } = await import('payload')
    const configModule = await import('../src/payload.config.js')
    // Config is loaded dynamically to ensure env vars are set first
    const config = configModule.default as Parameters<typeof getPayload>[0]['config']

    // Verify config has the secret by checking process.env again (config reads from it)
    if (!process.env.PAYLOAD_SECRET || process.env.PAYLOAD_SECRET.trim() === '') {
      console.error('❌ Error: PAYLOAD_SECRET is not available when initializing Payload!')
      console.error('   This might indicate the .env file was not loaded correctly')
      process.exit(1)
    }

    console.log('🔄 Initializing Payload...')
    payload = await getPayload({ config })

    // Get user data from environment variables or use defaults
    const email = process.env.SEED_USER_EMAIL || 'admin@containa.io'
    const password = process.env.SEED_USER_PASSWORD || 'Admin123'
    const fullName = process.env.SEED_USER_FULL_NAME || 'Super Admin'
    const role = (process.env.SEED_USER_ROLE || 'superadmin') as 'superadmin'
    const status = (process.env.SEED_USER_STATUS || 'active') as 'active' | 'inactive'

    console.log(`📝 Creating user: ${email}`)

    // Check if user already exists
    const existingUsers = await payload.find({
      collection: 'users',
      where: {
        email: {
          equals: email,
        },
      },
      limit: 1,
    })

    if (existingUsers.docs.length > 0) {
      console.log(`⚠️  User with email ${email} already exists. Skipping creation.`)
      console.log(`   User ID: ${existingUsers.docs[0].id}`)
      return
    }

    // Create the user
    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        fullName,
        role,
        status,
      },
    })

    console.log('✅ User created successfully!')
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Full Name: ${user.fullName}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Status: ${user.status}`)
    console.log('\n📧 You can now login with:')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
  } catch (err) {
    const error = err as Error
    console.error('❌ Seeding failed:', error.message)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    if (payload && payload.db && typeof payload.db.destroy === 'function') {
      await payload.db.destroy()
    }
  }
}

seedUser()
