import { NextRequest, NextResponse } from 'next/server'
import { getTenantContext } from '@/lib/api-helpers'
import { getPayload } from 'payload'
import config from '@/payload.config'

/**
 * Generate a random alphanumeric LPN code
 */
function generateLPNCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return 'LPN' + result
}

/**
 * Generate a unique LPN number for a tenant
 */
async function generateUniqueLPN(
  payload: any,
  tenantId: number | string,
  maxAttempts: number = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const lpn = generateLPNCode(8)
    
    // Check if this LPN already exists for this tenant
    const existing = await payload.find({
      collection: 'put-away-stock',
      where: {
        and: [
          {
            tenantId: {
              equals: tenantId,
            },
          },
          {
            lpnNumber: {
              equals: lpn,
            },
          },
        ],
      },
      limit: 1,
    })

    if (existing.docs.length === 0) {
      return lpn
    }
  }

  // Fallback: use timestamp-based LPN if all attempts fail
  return generateLPNCode(6) + Date.now().toString().slice(-4)
}

export async function POST(request: NextRequest) {
  try {
    const context = await getTenantContext(request, 'freight_edit')
    if ('error' in context) {
      return NextResponse.json({ message: context.error }, { status: context.status })
    }

    const { payload, tenant } = context
    const body = await request.json()
    const { count } = body

    if (!count || count < 1) {
      return NextResponse.json({ message: 'Count is required and must be at least 1' }, { status: 400 })
    }

    // Generate unique LPNs
    const lpns: string[] = []
    for (let i = 0; i < count; i++) {
      const lpn = await generateUniqueLPN(payload, tenant.id)
      lpns.push(lpn)
    }

    return NextResponse.json({
      success: true,
      lpns,
    })
  } catch (error) {
    console.error('Error generating LPNs:', error)
    return NextResponse.json(
      { message: 'Failed to generate LPNs' },
      { status: 500 }
    )
  }
}















