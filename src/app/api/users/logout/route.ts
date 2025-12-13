import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/19ea95ca-f91f-42cf-bdc2-ddbb2f0588ad',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'users/logout/route.ts:7',message:'Clearing cookie',data:{hostname:request.headers.get('host'),cookieDomain:'NOT_SET',sameSite:'strict'},timestamp:Date.now(),sessionId:'debug-session',runId:'pre-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  // Clear the payload-token cookie
  response.cookies.set('payload-token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0, // Expire immediately
    path: '/',
  })

  return response
}
