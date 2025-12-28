import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'
import { getPayload } from 'payload'
import config from '../src/payload.config.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load .env file from root
dotenv.config({ path: path.resolve(__dirname, '../.env') })

// Validate required environment variables
if (!process.env.DATABASE_URI) {
  console.error('❌ Error: DATABASE_URI is not defined in .env file')
  process.exit(1)
}

if (!process.env.PAYLOAD_SECRET) {
  console.error('❌ Error: PAYLOAD_SECRET is not defined in .env file')
  process.exit(1)
}

async function seedUser() {
  let payload

  try {
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
