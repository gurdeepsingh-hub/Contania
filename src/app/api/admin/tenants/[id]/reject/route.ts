import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

// Helper to check if user is super admin
async function isSuperAdmin(req: NextRequest): Promise<{ payload: any; user: any } | null> {
  try {
    const payload = await getPayload({ config })
    const { user } = await payload.auth({
      headers: req.headers,
    })

    if (user && (user as { role?: string }).role === 'superadmin') {
      return { payload, user }
    }
    return null
  } catch {
    return null
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await isSuperAdmin(request)
    if (!auth) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
    }

    const { payload, user } = auth
    const resolvedParams = await params
    const tenantId = Number(resolvedParams.id)
    const body = await request.json()

    // Get the tenant
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
    })

    if (!tenant) {
      return NextResponse.json({ message: 'Tenant not found' }, { status: 404 })
    }

    // Update tenant to rejected (approved: false)
    const updatedTenant = await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        approved: false,
        approvedBy: user.id,
        status: 'rejected',
      },
    })

    // Rejection email will be sent by the afterChange hook in Tenants collection

    return NextResponse.json({
      success: true,
      tenant: updatedTenant,
      message: 'Tenant rejected',
    })
  } catch (error) {
    console.error('Error rejecting tenant:', error)
    return NextResponse.json(
      { message: 'Failed to reject tenant' },
      { status: 500 }
    )
  }
}

