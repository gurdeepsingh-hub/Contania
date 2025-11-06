import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function GET(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id')
    let subdomain = request.headers.get('x-tenant-subdomain')

    // If subdomain not in header (client-side fetch), extract from hostname
    if (!subdomain) {
      const hostname = request.headers.get('host') || ''
      const subdomainMatch = hostname.match(/^([^.]+)\.(.+)$/)
      subdomain = subdomainMatch ? subdomainMatch[1] : null
      
      // Ignore 'www' and 'localhost' as subdomains
      if (subdomain === 'www' || subdomain === 'localhost') {
        subdomain = null
      }
    }

    if (!tenantId && !subdomain) {
      return NextResponse.json({ message: 'No tenant context' }, { status: 404 })
    }

    const payload = await getPayload({ config })

    let tenant
    if (tenantId) {
      tenant = await payload.findByID({
        collection: 'tenants',
        id: Number(tenantId),
      })
    } else if (subdomain) {
      // Search for tenant by subdomain (case-insensitive)
      const result = await payload.find({
        collection: 'tenants',
        where: {
          subdomain: {
            equals: subdomain.toLowerCase(),
          },
        },
        limit: 1,
      })
      tenant = result.docs[0]
      
      // Log for debugging if tenant not found
      if (!tenant) {
        console.log(`Tenant not found for subdomain: ${subdomain}`)
      }
    }

    if (!tenant || !tenant.approved) {
      return NextResponse.json({ 
        message: 'Tenant not found or not approved',
        debug: subdomain ? { subdomain } : undefined
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      tenant,
    })
  } catch (error) {
    console.error('Error fetching current tenant:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant' },
      { status: 500 }
    )
  }
}

