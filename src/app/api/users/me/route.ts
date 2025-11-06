import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config })
    
    const { user } = await payload.auth({
      headers: request.headers,
    })

    if (!user) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: (user as { fullName?: string }).fullName,
        role: (user as { role?: string }).role,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ message: 'Not authenticated' }, { status: 401 })
  }
}


