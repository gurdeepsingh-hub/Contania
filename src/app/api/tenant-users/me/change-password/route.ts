import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
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

    if (!subdomain) {
      return NextResponse.json({ message: 'No tenant context' }, { status: 401 })
    }

    // Verify user is authenticated
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

    // Verify user belongs to the tenant from subdomain
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
    const tenantUser = user as { tenantId?: number | { id: number } }
    const tenantUserId =
      typeof tenantUser.tenantId === 'object' ? tenantUser.tenantId.id : tenantUser.tenantId

    if (tenantUserId !== tenant.id) {
      return NextResponse.json({ message: 'User does not belong to this tenant' }, { status: 403 })
    }

    // Get request body
    const body = await request.json()
    const { oldPassword, newPassword, confirmPassword } = body

    // Validate input
    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { message: 'Old password, new password, and confirm password are required' },
        { status: 400 }
      )
    }

    // Check if new password matches confirm password
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { message: 'New password and confirm password do not match' },
        { status: 400 }
      )
    }

    // Verify old password by attempting login
    try {
      const loginResult = await payload.login({
        collection: 'tenant-users',
        data: {
          email: user.email,
          password: oldPassword,
        },
      })

      if (!loginResult.token || !loginResult.user) {
        return NextResponse.json({ message: 'Old password is incorrect' }, { status: 401 })
      }

      // Verify the logged-in user is the same as the current user
      if (loginResult.user.id !== user.id) {
        return NextResponse.json({ message: 'Authentication error' }, { status: 403 })
      }
    } catch (error) {
      return NextResponse.json({ message: 'Old password is incorrect' }, { status: 401 })
    }

    // Update password
    await payload.update({
      collection: 'tenant-users',
      id: user.id as number,
      data: {
        password: newPassword,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { message: 'Failed to change password' },
      { status: 500 }
    )
  }
}
