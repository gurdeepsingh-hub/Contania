/**
 * Shared utility for generating unique job numbers across all job collections
 * Ensures uniqueness per tenant across:
 * - inbound-inventory (jobCode)
 * - outbound-inventory (jobCode)
 * - import-container-bookings (bookingCode)
 * - export-container-bookings (bookingCode)
 */

/**
 * Generate a random alphanumeric code
 */
function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Check if a job number already exists across all job collections for a tenant
 */
async function checkJobNumberExists(
  payload: any,
  tenantId: number | string,
  jobNumber: string,
): Promise<boolean> {
  // Check all collections that have job numbers
  const collections = [
    { name: 'inbound-inventory', field: 'jobCode' },
    { name: 'outbound-inventory', field: 'jobCode' },
    { name: 'import-container-bookings', field: 'bookingCode' },
    { name: 'export-container-bookings', field: 'bookingCode' },
  ]

  // Check each collection in parallel
  const checks = await Promise.all(
    collections.map(async ({ name, field }) => {
      try {
        const existing = await payload.find({
          collection: name,
          where: {
            and: [
              {
                tenantId: {
                  equals: tenantId,
                },
              },
              {
                [field]: {
                  equals: jobNumber,
                },
              },
            ],
          },
          limit: 1,
        })
        return existing.docs.length > 0
      } catch (error) {
        // If collection doesn't exist or query fails, assume no conflict
        console.error(`Error checking ${name}:`, error)
        return false
      }
    }),
  )

  // Return true if any collection has this job number
  return checks.some((exists) => exists)
}

/**
 * Generate a unique job number with prefix for a tenant
 * Checks uniqueness across all job collections
 */
export async function generateUniqueJobNumber(
  payload: any,
  tenantId: number | string,
  prefix: string,
  maxAttempts: number = 10,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate random code (6 characters for the numeric part)
    const randomCode = generateRandomCode(6)
    const jobNumber = `${prefix}-${randomCode}`

    // Check if this job number already exists across all collections
    const exists = await checkJobNumberExists(payload, tenantId, jobNumber)

    if (!exists) {
      return jobNumber
    }
  }

  // Fallback: use timestamp-based code if all attempts fail
  const timestamp = Date.now().toString().slice(-6)
  const random = generateRandomCode(4)
  return `${prefix}-${timestamp}-${random}`
}
