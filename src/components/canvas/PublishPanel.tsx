'use client'

import { useState } from 'react'

export interface PublishResult {
  status: 'queued' | 'published' | 'failed'
  message: string
  publishId?: string
  targetUrl?: string
}

interface PublishPanelProps {
  onPublish: (args: { platform: 'instagram' | 'linkedin'; placement: string; caption: string }) => Promise<PublishResult>
}

export const PublishPanel: React.FC<PublishPanelProps> = ({ onPublish }) => {
  const [platform, setPlatform] = useState<'instagram' | 'linkedin'>('instagram')
  const [placement, setPlacement] = useState('feed')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PublishResult | null>(null)

  return (
    <aside className="absolute right-5 top-20 z-50 w-80 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.10)] backdrop-blur-sm">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Export / Publish</h3>
      <p className="mb-3 text-sm text-gray-600">Publish current creative to connected platform (mock integration endpoint).</p>

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Platform</label>
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as 'instagram' | 'linkedin')}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none"
      >
        <option value="instagram">Instagram</option>
        <option value="linkedin">LinkedIn</option>
      </select>

      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500">Placement</label>
      <select
        value={placement}
        onChange={(e) => setPlacement(e.target.value)}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none"
      >
        <option value="feed">Feed</option>
        <option value="story">Story</option>
        <option value="reel">Reel</option>
      </select>

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
          {result.targetUrl && <div className="text-gray-500">Target: {result.targetUrl}</div>}
        </div>
      )}
    </aside>
  )
}
