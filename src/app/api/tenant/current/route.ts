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
      return NextResponse.json(
        {
          message: 'Tenant not found or not approved',
          debug: subdomain ? { subdomain } : undefined,
        },
        { status: 404 },
      )
    }

    return NextResponse.json({
      success: true,
      tenant,
    })
  } catch (error) {
    console.error('Error fetching current tenant:', error)
    return NextResponse.json({ message: 'Failed to fetch tenant' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
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

    if (!subdomain) {
      return NextResponse.json({ message: 'No tenant context' }, { status: 404 })
    }

    // Verify user is authenticated as a tenant-user
    const { user } = await payload.auth({
      headers: request.headers,
    })

    if (!user) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
    }

    // Verify user is from tenant-users collection
    if ((user as { collection?: string }).collection !== 'tenant-users') {
      return NextResponse.json({ message: 'Invalid user type' }, { status: 403 })
    }

    // Get tenant from subdomain
    const tenantResult = await payload.find({
      collection: 'tenants',
      where: {
        subdomain: {
          equals: subdomain.toLowerCase(),
        },
      },
      limit: 1,
    })

    if (tenantResult.docs.length === 0) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    const tenant = tenantResult.docs[0]

    // Verify user belongs to the tenant
    const tenantUser = user as { tenantId?: number | { id: number } }
    const tenantUserId =
      typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

    if (tenantUserId !== tenant.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 403 })
    }

    // Get update data from request body
    const body = await request.json()

    // Restrict fields that tenants cannot update
    const restrictedFields = [
      'subdomain',
      'approved',
      'approvedBy',
      'verified',
      'verifiedAt',
      'status',
      'editToken',
      'editTokenExpiresAt',
      'revertReason',
      'deletedAt',
      'onboardingStep',
    ]

    // Remove restricted fields from update data
    const updateData: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body)) {
      if (!restrictedFields.includes(key)) {
        updateData[key] = value
      }
    }

    // Update tenant
    const updated = await payload.update({
      collection: 'tenants',
      id: tenant.id,
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      tenant: updated,
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json({ message: 'Failed to update tenant' }, { status: 500 })
  }
}
