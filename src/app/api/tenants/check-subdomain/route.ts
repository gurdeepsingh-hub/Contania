import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { slugify } from '@/lib/subdomain'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const subdomain = searchParams.get('subdomain')

    if (!subdomain) {
      return NextResponse.json(
        { message: 'Subdomain parameter is required' },
        { status: 400 }
      )
    }

    // Normalize subdomain (lowercase, slugify)
    const normalizedSubdomain = slugify(subdomain.toLowerCase())

    // Validate subdomain format (alphanumeric and hyphens only, 3-63 chars)
    if (!/^[a-z0-9-]{3,63}$/.test(normalizedSubdomain)) {
      return NextResponse.json({
        available: false,
        message: 'Subdomain must be 3-63 characters and contain only lowercase letters, numbers, and hyphens',
      })
    }

    // Check if subdomain is reserved (common reserved subdomains)
    const reservedSubdomains = [
      'www',
      'admin',
      'api',
      'app',
      'mail',
      'ftp',
      'localhost',
      'test',
      'staging',
      'dev',
      'development',
      'production',
      'prod',
    ]

    if (reservedSubdomains.includes(normalizedSubdomain)) {
      return NextResponse.json({
        available: false,
        message: 'This subdomain is reserved and cannot be used',
      })
    }

    const payload = await getPayload({ config })

    // Check if subdomain already exists
    const existing = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: {
          equals: normalizedSubdomain,
        },
      },
      limit: 1,
    })

    return NextResponse.json({
      available: existing.docs.length === 0,
      subdomain: normalizedSubdomain,
      message:
        existing.docs.length === 0
          ? 'Subdomain is available'
          : 'This subdomain is already taken',
    })
  } catch (error) {
    console.error('Error checking subdomain:', error)
    return NextResponse.json(
      { message: 'Failed to check subdomain availability' },
      { status: 500 }
    )
  }
}

