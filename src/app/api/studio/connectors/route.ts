import { NextResponse } from 'next/server'
import { listConnections, publicView } from '../../../../lib/connections-store'

export const runtime = 'nodejs'

// GET /api/studio/connectors — connection status for all platforms (no tokens)
export async function GET() {
  const conns = await listConnections()
  return NextResponse.json({
    items: conns.map(publicView),
    linkedinOauthReady: Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET),
  })
}
