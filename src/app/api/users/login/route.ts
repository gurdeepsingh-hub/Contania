import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthCookieOptions } from '@/lib/cookie-config'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    const payload = await getPayload({ config })

    const result = await payload.login({
      collection: 'users',
      data: {
        email,
        password,
      },
    })

    if (result.token) {
      const response = NextResponse.json({ success: true, user: result.user })

      // #region agent log
      const cookieOptions = getAuthCookieOptions(request)
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'users/login/route.ts:21',
          message: 'Setting cookie (main domain)',
          data: {
            hostname: request.headers.get('host'),
            hasToken: !!result.token,
            cookieDomain: cookieOptions.domain || 'NOT_SET',
            sameSite: cookieOptions.sameSite,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {})
      // #endregion

      response.cookies.set('payload-token', result.token, cookieOptions)

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'users/login/route.ts:28',
          message: 'Cookie set (main domain)',
          data: {
            hostname: request.headers.get('host'),
            cookieDomain: cookieOptions.domain || 'NOT_SET',
            sameSite: cookieOptions.sameSite,
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'post-fix',
          hypothesisId: 'A',
        }),
      }).catch(() => {})
      // #endregion

      return response
    } else {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
