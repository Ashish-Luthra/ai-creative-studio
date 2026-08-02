'use client'

import { useState } from 'react'

export interface PublishResult {
  status: 'queued' | 'published' | 'failed'
  message: string
  publishId?: string
  targetUrl?: string
  renderedUrl?: string | null
  wouldSend?: Record<string, unknown>
}

export type PublishPlatform = 'instagram' | 'linkedin' | 'youtube'

const PLACEMENTS: Record<PublishPlatform, string[]> = {
  instagram: ['feed', 'story', 'reel'],
  linkedin: ['feed'],
  youtube: ['thumbnail', 'short'],
}

interface PublishPanelProps {
  onPublish: (args: { platform: PublishPlatform; placement: string; caption: string }) => Promise<PublishResult>
  onClose?: () => void
}

export const PublishPanel: React.FC<PublishPanelProps> = ({ onPublish, onClose }) => {
  const [platform, setPlatformState] = useState<PublishPlatform>('linkedin')
  const [placement, setPlacement] = useState('feed')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  return (
    <aside className="absolute right-5 top-20 z-50 w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Publish</h3>
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">×</button>
        )}
      </div>
      <p className="mb-3 text-sm text-gray-600">Renders the current creative and publishes it to a connected platform (manage in Connections).</p>

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Platform</label>
      <select
        value={platform}
        onChange={(e) => {
          const next = e.target.value as PublishPlatform
          setPlatformState(next)
          setPlacement(PLACEMENTS[next][0])
        }}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none"
      >
        <option value="linkedin">LinkedIn</option>
        <option value="instagram">Instagram</option>
        <option value="youtube">YouTube</option>
      </select>

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Placement</label>
      <select
        value={placement}
        onChange={(e) => setPlacement(e.target.value)}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none"
      >
        {PLACEMENTS[platform].map((pl) => (
          <option key={pl} value={pl}>{pl[0].toUpperCase() + pl.slice(1)}</option>
        ))}
      </select>
      {platform === 'youtube' && (
        <p className="mb-2 text-[11px] text-amber-700">YouTube requires video — image creatives publish as thumbnails/Short frames only.</p>
      )}

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Caption</label>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write publishing caption"
        className="mb-3 h-20 w-full resize-none rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none"
      />

      <button
        onClick={async () => {
          setLoading(true)
          const publishResult = await onPublish({ platform, placement, caption })
          setResult(publishResult)
          setLoading(false)
        }}
        disabled={loading}
        className="mb-3 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Publishing...' : 'Publish Now'}
      </button>

      {result && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
          <div className="font-semibold text-gray-800">Status: {result.status}</div>
          <div className="text-gray-600">{result.message}</div>
          {result.publishId && <div className="mt-1 text-gray-500">Publish ID: {result.publishId}</div>}
          {result.targetUrl && <div className="break-all text-gray-500">Target: {result.targetUrl}</div>}
          {result.renderedUrl && <div className="break-all text-gray-500">Rendered: {result.renderedUrl}</div>}
          {result.wouldSend && (
            <pre className="mt-1 max-h-28 overflow-auto rounded bg-gray-100 p-1.5 text-[10px] leading-snug">{JSON.stringify(result.wouldSend, null, 1)}</pre>
          )}
        </div>
      )}
    </aside>
  )
}
