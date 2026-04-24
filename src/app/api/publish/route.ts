import { NextResponse } from 'next/server'

interface PublishPayload {
  briefId: string
  presetId: string
  platform: 'instagram' | 'linkedin'
  placement: string
  caption: string
  copyText: string
  imageUrl: string
}

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<PublishPayload>

  if (!body.briefId || !body.platform || !body.presetId) {
    return NextResponse.json(
      { status: 'failed', message: 'Missing required publish fields' },
      { status: 400 }
    )
  }

  const publishId = `pub_${Date.now().toString(36)}`
  const targetUrl = `https://${body.platform}.example.com/${body.placement ?? 'feed'}/${publishId}`

  return NextResponse.json({
    status: 'queued',
    message: `Publish request queued for ${body.platform} (${body.placement ?? 'feed'})`,
    publishId,
    targetUrl,
    payloadEcho: body,
  })
}
