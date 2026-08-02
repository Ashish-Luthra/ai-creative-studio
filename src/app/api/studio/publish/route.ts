import { NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getConnection } from '../../../../lib/connections-store'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Publish a rendered creative to a connected platform.
 *
 * Pipeline: persist the rendered PNG (dataUrl → public/published/<id>.png,
 * giving platforms a fetchable URL) → per-platform transport:
 * - linkedin + real OAuth connection: image upload via
 *   POST /rest/images?action=initializeUpload + PUT binary, then
 *   POST /rest/posts with commentary + image (extends the marketingos
 *   linkedin runtime, which was text-only). Not connected → dryRun preview
 *   with the exact wouldSend payload.
 * - instagram: REAL SEAM = IG Graph container flow
 *   (POST /{ig-user-id}/media {image_url, caption} → POST /{ig-user-id}/media_publish).
 *   Requires Meta app review (instagram_content_publish) + linked FB Page —
 *   until then returns queued + payload preview.
 * - youtube: REAL SEAM = YouTube Data API resumable upload (videos.insert).
 *   Image creatives are thumbnails/Shorts frames; actual upload needs video —
 *   returns queued + payload preview.
 */

interface PublishPayload {
  briefId: string
  presetId: string
  platform: 'instagram' | 'linkedin' | 'youtube'
  placement: string
  caption: string
  copyText: string
  imageUrl: string // may be a data URL of the rendered canvas
}

const LI_VERSION = '202502'

async function persistRender(imageUrl: string, publishId: string, origin: string): Promise<string> {
  if (!imageUrl.startsWith('data:image/')) return imageUrl
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(imageUrl)
  if (!m) return imageUrl
  const dir = path.join(process.cwd(), 'public', 'published')
  await fs.mkdir(dir, { recursive: true })
  const file = `${publishId}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
  await fs.writeFile(path.join(dir, file), Buffer.from(m[2], 'base64'))
  return `${origin}/published/${file}`
}

async function publishToLinkedIn(args: {
  accessToken: string
  caption: string
  imageDataUrl: string | null
}): Promise<{ ok: boolean; postUrn?: string; error?: string }> {
  const headers = {
    Authorization: `Bearer ${args.accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'LinkedIn-Version': LI_VERSION,
    'Content-Type': 'application/json',
  }
  try {
    // Author URN via OpenID userinfo (marketingos _resolve_author_urn pattern).
    const ui = await fetch('https://api.linkedin.com/v2/userinfo', { headers, signal: AbortSignal.timeout(10_000) })
    if (!ui.ok) return { ok: false, error: `userinfo ${ui.status} — token expired?` }
    const { sub } = (await ui.json()) as { sub: string }
    const author = `urn:li:person:${sub}`

    // Optional image upload.
    let imageUrn: string | null = null
    if (args.imageDataUrl?.startsWith('data:image/')) {
      const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ initializeUploadRequest: { owner: author } }),
        signal: AbortSignal.timeout(15_000),
      })
      if (init.ok) {
        const initBody = (await init.json()) as { value?: { uploadUrl?: string; image?: string } }
        const uploadUrl = initBody.value?.uploadUrl
        imageUrn = initBody.value?.image ?? null
        if (uploadUrl) {
          const b64 = args.imageDataUrl.split(',')[1] ?? ''
          await fetch(uploadUrl, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${args.accessToken}` },
            body: Buffer.from(b64, 'base64'),
            signal: AbortSignal.timeout(30_000),
          })
        }
      }
    }

    const postBody: Record<string, unknown> = {
      author,
      commentary: args.caption,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }
    if (imageUrn) postBody.content = { media: { id: imageUrn } }

    const post = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers,
      body: JSON.stringify(postBody),
      signal: AbortSignal.timeout(20_000),
    })
    if (!post.ok) {
      const errText = await post.text().catch(() => '')
      return { ok: false, error: `post ${post.status}: ${errText.slice(0, 180)}` }
    }
    return { ok: true, postUrn: post.headers.get('x-restli-id') ?? undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<PublishPayload>
  if (!body.briefId || !body.platform || !body.presetId) {
    return NextResponse.json({ status: 'failed', message: 'Missing required publish fields' }, { status: 400 })
  }

  const publishId = `pub_${Date.now().toString(36)}`
  const origin = new URL(request.url).origin
  const renderedUrl = body.imageUrl ? await persistRender(body.imageUrl, publishId, origin) : null

  if (body.platform === 'linkedin') {
    const conn = await getConnection('linkedin')
    if (conn.status === 'connected' && conn.kind === 'oauth' && conn.tokens?.access) {
      const result = await publishToLinkedIn({
        accessToken: conn.tokens.access,
        caption: body.caption ?? body.copyText ?? '',
        imageDataUrl: body.imageUrl?.startsWith('data:image/') ? body.imageUrl : null,
      })
      if (result.ok) {
        return NextResponse.json({
          status: 'published',
          message: `Published to LinkedIn${conn.accountName ? ` as ${conn.accountName}` : ''}`,
          publishId,
          targetUrl: result.postUrn
            ? `https://www.linkedin.com/feed/update/${encodeURIComponent(result.postUrn)}/`
            : 'https://www.linkedin.com/feed/',
          renderedUrl,
        })
      }
      return NextResponse.json(
        { status: 'failed', message: `LinkedIn publish failed: ${result.error}`, publishId, renderedUrl },
        { status: 502 }
      )
    }
    // Not connected with real OAuth → dry run preview.
    return NextResponse.json({
      status: 'queued',
      message: 'Dry run — connect LinkedIn (real OAuth) in Studio → Connections to publish for real.',
      publishId,
      targetUrl: `https://linkedin.example.com/feed/${publishId}`,
      renderedUrl,
      wouldSend: {
        endpoint: 'POST https://api.linkedin.com/rest/posts',
        commentary: body.caption ?? body.copyText ?? '',
        image: renderedUrl,
        lifecycleState: 'PUBLISHED',
      },
    })
  }

  // instagram / youtube: demo-grade with documented real seams (see doc-block).
  const conn = await getConnection(body.platform)
  return NextResponse.json({
    status: 'queued',
    message:
      conn.status === 'connected'
        ? `Queued for ${body.platform} (${body.placement ?? 'feed'}) — demo connector; real API pending platform app review`
        : `Queued (dry run) — connect ${body.platform} in Studio → Connections`,
    publishId,
    targetUrl: `https://${body.platform}.example.com/${body.placement ?? 'feed'}/${publishId}`,
    renderedUrl,
    wouldSend:
      body.platform === 'instagram'
        ? { endpoint: 'POST /{ig-user-id}/media → /media_publish', image_url: renderedUrl, caption: body.caption ?? '' }
        : { endpoint: 'YouTube Data videos.insert (resumable)', note: 'image creative = thumbnail/Short frame; upload requires video', thumbnail: renderedUrl },
  })
}
