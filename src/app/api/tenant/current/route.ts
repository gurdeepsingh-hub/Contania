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
      
      // Remove port if present
      const cleanHostname = hostname.split(':')[0]
      const defaultHost = process.env.DEFAULT_HOST || 'containa.io'

      // Check if we are on the root domain or localhost
      if (
        cleanHostname === defaultHost || 
        cleanHostname === 'localhost' ||
        cleanHostname === 'www.' + defaultHost
      ) {
        subdomain = null
      } else {
        // Extract subdomain
        const subdomainMatch = cleanHostname.match(/^([^.]+)\.(.+)$/)
        
        // Ensure the domain part matches defaultHost to avoid false positives on different domains
        // or just accept the first part as subdomain if it's not the root.
        // If we are on 'tenant.containa.io', match[1] is 'tenant', match[2] is 'containa.io'
        if (subdomainMatch && subdomainMatch[2] === defaultHost) {
           subdomain = subdomainMatch[1]
        } else if (subdomainMatch && cleanHostname !== 'localhost') {
           // Fallback for localhost subdomains like tenant.localhost
           subdomain = subdomainMatch[1]
        } else {
           subdomain = null
        }
      }
      
      // Explicitly ignore 'www'
      if (subdomain === 'www') {
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

