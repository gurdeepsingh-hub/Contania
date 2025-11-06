import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

// Helper to check if user is super admin
async function isSuperAdmin(req: NextRequest): Promise<boolean> {
  try {
    const payload = await getPayload({ config })
    const token = req.cookies.get('payload-token')?.value

    if (!token) return false

    const { user } = await payload.auth({
      headers: req.headers,
    })

    return !!(user && (user as { role?: string }).role === 'superadmin')
  } catch {
    return false
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: Number(params.id),
    })

    // Get tenant users
    const tenantUsers = await payload.find({
      collection: 'tenant-users',
      where: {
        tenantId: {
          equals: tenant.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      tenant: {
        ...tenant,
        users: tenantUsers.docs,
      },
    })
  } catch (error) {
    console.error('Error fetching tenant:', error)
    return NextResponse.json(
      { message: 'Failed to fetch tenant' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!(await isSuperAdmin(request))) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const payload = await getPayload({ config })

    // Get current user for approvedBy field
    const { user } = await payload.auth({
      headers: request.headers,
    })

    const updated = await payload.update({
      collection: 'tenants',
      id: Number(params.id),
      data: {
        ...body,
        approvedBy: user?.id,
      },
    })

    return NextResponse.json({
      success: true,
      tenant: updated,
    })
  } catch (error) {
    console.error('Error updating tenant:', error)
    return NextResponse.json(
      { message: 'Failed to update tenant' },
      { status: 500 }
    )
  }
}

