import { NextRequest, NextResponse } from 'next/server'
import { getAuthCookieOptions } from '@/lib/cookie-config'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // #region agent log
  const cookieOptions = getAuthCookieOptions(request)
  fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      location: 'users/logout/route.ts:7',
      message: 'Clearing cookie',
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

  // Clear the payload-token cookie
  response.cookies.set('payload-token', '', {
    ...cookieOptions,
    maxAge: 0, // Expire immediately
  })

  return response
}
