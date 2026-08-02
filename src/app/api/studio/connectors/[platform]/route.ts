import { NextResponse } from 'next/server'
import {
  CONNECTOR_PLATFORMS,
  disconnect,
  getConnection,
  publicView,
  saveConnection,
  type ConnectorPlatform,
} from '../../../../../lib/connections-store'

export const runtime = 'nodejs'

/**
 * Connector lifecycle (pattern ported from Allyvatemarketingos's MCP OAuth
 * flow — popup + code exchange, contracts/mcp/linkedin/tools.v1.json):
 *
 * POST   /api/studio/connectors/linkedin   {action:'authorize'} → {authorizeUrl}
 *        (popup completes at /studio/connections/callback which posts the
 *        code back; the opener then calls {action:'exchange', code})
 * POST   /api/studio/connectors/<platform> {action:'demo-connect'} → demo conn
 * DELETE /api/studio/connectors/<platform> → disconnect
 *
 * Instagram/YouTube real APIs are gated on platform app review (Meta:
 * instagram_content_publish + linked FB Page; Google: YouTube Data upload) —
 * until then demo-connect marks the platform connected in demo mode.
 */

type Ctx = { params: Promise<{ platform: string }> }

const LINKEDIN_AUTH = 'https://www.linkedin.com/oauth/v2/authorization'
const LINKEDIN_TOKEN = 'https://www.linkedin.com/oauth/v2/accessToken'
const LINKEDIN_SCOPES = 'openid profile email w_member_social'

function redirectUri(request: Request): string {
  const origin = new URL(request.url).origin
  return `${origin}/studio/connections/callback`
}

export async function POST(request: Request, { params }: Ctx) {
  const { platform } = await params
  if (!CONNECTOR_PLATFORMS.includes(platform as ConnectorPlatform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 })
  }
  const p = platform as ConnectorPlatform
  const body = (await request.json().catch(() => ({}))) as { action?: string; code?: string }

  if (body.action === 'authorize' && p === 'linkedin') {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    if (!clientId) {
      return NextResponse.json(
        { error: 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET not configured in .env.local' },
        { status: 400 }
      )
    }
    const state = Math.random().toString(36).slice(2)
    const url =
      `${LINKEDIN_AUTH}?response_type=code&client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri(request))}` +
      `&scope=${encodeURIComponent(LINKEDIN_SCOPES)}&state=${state}`
    return NextResponse.json({ authorizeUrl: url, state })
  }

  if (body.action === 'exchange' && p === 'linkedin') {
    const clientId = process.env.LINKEDIN_CLIENT_ID
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
    if (!clientId || !clientSecret || !body.code) {
      return NextResponse.json({ error: 'Missing client credentials or code' }, { status: 400 })
    }
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(request),
    })
    const res = await fetch(LINKEDIN_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(15_000),
    })
    const token = (await res.json().catch(() => ({}))) as {
      access_token?: string
      expires_in?: number
      error_description?: string
    }
    if (!res.ok || !token.access_token) {
      return NextResponse.json({ error: token.error_description ?? `LinkedIn token exchange failed (${res.status})` }, { status: 502 })
    }
    // Resolve display name via OpenID userinfo (same call the marketingos runtime uses).
    let accountName: string | null = null
    try {
      const ui = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: AbortSignal.timeout(10_000),
      })
      const uiBody = (await ui.json()) as { name?: string; email?: string }
      accountName = uiBody.name ?? uiBody.email ?? null
    } catch {
      /* name is cosmetic */
    }
    await saveConnection({
      platform: 'linkedin',
      status: 'connected',
      kind: 'oauth',
      accountName,
      connectedAt: new Date().toISOString(),
      tokens: {
        access: token.access_token,
        expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : undefined,
      },
    })
    return NextResponse.json({ item: publicView(await getConnection('linkedin')) })
  }

  if (body.action === 'demo-connect') {
    await saveConnection({
      platform: p,
      status: 'connected',
      kind: 'demo',
      accountName: `${p === 'youtube' ? 'Allyvate Channel' : 'allyvate'} (demo)`,
      connectedAt: new Date().toISOString(),
      tokens: null,
    })
    return NextResponse.json({ item: publicView(await getConnection(p)) })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { platform } = await params
  if (!CONNECTOR_PLATFORMS.includes(platform as ConnectorPlatform)) {
    return NextResponse.json({ error: 'Unknown platform' }, { status: 404 })
  }
  await disconnect(platform as ConnectorPlatform)
  return new NextResponse(null, { status: 204 })
}
