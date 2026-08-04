'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Creative Studio → Connections: Instagram / LinkedIn / YouTube publishing
 * connectors. LinkedIn is a real OAuth flow when LINKEDIN_CLIENT_ID/SECRET
 * are configured; Instagram and YouTube run demo-grade connections until
 * their platform app reviews clear.
 */

interface ConnItem {
  platform: 'linkedin' | 'instagram' | 'youtube'
  status: 'connected' | 'disconnected'
  kind: 'oauth' | 'demo' | null
  accountName: string | null
  connectedAt: string | null
}

const META: Record<ConnItem['platform'], { label: string; blurb: string; scopes: string; color: string; initial: string }> = {
  linkedin: {
    label: 'LinkedIn',
    blurb: 'Publish feed posts with the rendered creative and caption.',
    scopes: 'openid · profile · w_member_social',
    color: '#0A66C2',
    initial: 'in',
  },
  instagram: {
    label: 'Instagram',
    blurb: 'Feed, story and reel publishing via the Instagram Graph API.',
    scopes: 'instagram_content_publish (pending Meta app review)',
    color: '#E1306C',
    initial: 'IG',
  },
  youtube: {
    label: 'YouTube',
    blurb: 'Thumbnails and Shorts formats; video upload via YouTube Data API.',
    scopes: 'youtube.upload (pending Google verification)',
    color: '#FF0000',
    initial: '▶',
  },
}

export default function ConnectionsPage() {
  const [items, setItems] = useState<ConnItem[]>([])
  const [linkedinReady, setLinkedinReady] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((m: string) => {
    setToast(m)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 3000)
  }, [])

  const refresh = useCallback(async () => {
    const res = await fetch('/api/studio/connectors').catch(() => null)
    if (!res?.ok) return
    const body = (await res.json()) as { items: ConnItem[]; linkedinOauthReady: boolean }
    setItems(body.items)
    setLinkedinReady(body.linkedinOauthReady)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // OAuth popup relay (marketingos pattern): popup posts the code, opener exchanges it.
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const data = e.data as { type?: string; code?: string; error?: string }
      if (data?.type !== 'allyvate:connector-oauth') return
      if (data.error || !data.code) {
        showToast(`LinkedIn connection failed: ${data.error ?? 'no code returned'}`)
        return
      }
      setBusy('linkedin')
      const res = await fetch('/api/studio/connectors/linkedin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'exchange', code: data.code }),
      })
      const body = await res.json()
      setBusy(null)
      if (!res.ok) return showToast(body.error ?? 'Token exchange failed')
      showToast('LinkedIn connected ✓')
      void refresh()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [refresh, showToast])

  const connect = async (platform: ConnItem['platform']) => {
    setBusy(platform)
    try {
      if (platform === 'linkedin' && linkedinReady) {
        const res = await fetch('/api/studio/connectors/linkedin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'authorize' }),
        })
        const body = (await res.json()) as { authorizeUrl?: string; error?: string }
        if (!res.ok || !body.authorizeUrl) return showToast(body.error ?? 'Could not start OAuth')
        window.open(body.authorizeUrl, 'allyvate-linkedin-oauth', 'width=600,height=720')
        return // exchange happens via postMessage relay
      }
      const res = await fetch(`/api/studio/connectors/${platform}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'demo-connect' }),
      })
      if (!res.ok) return showToast('Connect failed')
      showToast(
        platform === 'linkedin'
          ? 'LinkedIn connected in demo mode (add LINKEDIN_CLIENT_ID/SECRET for real OAuth)'
          : `${META[platform].label} connected in demo mode`
      )
      void refresh()
    } finally {
      setBusy(null)
    }
  }

  const doDisconnect = async (platform: ConnItem['platform']) => {
    await fetch(`/api/studio/connectors/${platform}`, { method: 'DELETE' })
    showToast('Disconnected')
    void refresh()
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-[#e5e5e5] px-6 py-4">
        <h1 className="text-[20px] font-bold text-[#0d1117]">Connections</h1>
        <p className="mt-0.5 text-[12.5px] text-[#6b7280]">
          Where the Studio publishes. Connected platforms appear in the Publish menu with real, sized creatives.
        </p>
      </div>
      <div className="flex-1 overflow-auto p-6">
        <div className="grid max-w-[880px] grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((c) => {
            const m = META[c.platform]
            const connected = c.status === 'connected'
            return (
              <div key={c.platform} className="flex flex-col rounded-2xl border border-[#e5e7eb] p-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[13px] font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.initial}
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold text-[#0d1117]">{m.label}</div>
                    <div className="text-[11px] text-[#6b7280]">
                      {connected ? (
                        <span className="text-[#047857]">
                          ● Connected{c.kind === 'demo' ? ' (demo)' : ''}{c.accountName ? ` · ${c.accountName}` : ''}
                        </span>
                      ) : (
                        '○ Not connected'
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-[12px] leading-relaxed text-[#4b5563]">{m.blurb}</p>
                <p className="mt-2 text-[10.5px] text-[#9ca3af]">{m.scopes}</p>
                {c.platform === 'linkedin' && !linkedinReady && !connected && (
                  <p className="mt-1 text-[10.5px] text-[#b45309]">
                    Real OAuth needs LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in .env.local — Connect uses demo mode until then.
                  </p>
                )}
                <div className="mt-3">
                  {connected ? (
                    <button
                      className="h-8 rounded-lg border border-[#e5e7eb] px-3 text-[12.5px] font-medium text-[#374151] hover:bg-[#f9fafb]"
                      onClick={() => void doDisconnect(c.platform)}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className="h-8 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-medium text-white hover:opacity-90 disabled:opacity-60"
                      disabled={busy === c.platform}
                      onClick={() => void connect(c.platform)}
                    >
                      {busy === c.platform ? 'Connecting…' : 'Connect'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[99] -translate-x-1/2 rounded-lg bg-[#111827] px-4 py-2.5 text-[12.5px] text-white shadow-xl">{toast}</div>
      )}
    </div>
  )
}
