'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@studio/lib/utils'
import { ColorSwatch } from '@studio/components/shared/TextStyleControls'
import { CREATIVE_PRESETS } from '@studio/lib/canvas/presets'
import { RatioTile } from './RatioTile'

interface Props {
  canvas: Canvas | null
  frame: FabricObject | null
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onReplicateAll: () => void
  onCommit: () => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

const Section: React.FC<{ title: string; defaultOpen?: boolean; children: React.ReactNode }> = ({
  title, defaultOpen = true, children,
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
      >
        {title}
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

export const CanvasFrameRightPanel: React.FC<Props> = ({
  canvas, frame, selectedPresetId, onPresetChange, onReplicateAll, onCommit, embedded = false,
}) => {
  const [color, setColor] = useState('#FFFFFF')

  useEffect(() => {
    if (!frame) return
    const fill = (frame as FabricObject & { fill?: unknown }).fill
    if (typeof fill === 'string' && fill !== '') setColor(fill)
  }, [frame])

  if (!canvas || !frame) return null

  const handleColor = (next: string) => {
    setColor(next)
    frame.set({ fill: next })
    canvas.requestRenderAll()
    onCommit()
  }

  return (
    <aside className={embedded
      ? 'flex w-full flex-col bg-white'
      : 'absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl'}>
      <div className="flex-1 overflow-auto px-4 py-2">

        <Section title="Ad Specs">
          <div className="grid grid-cols-3 gap-2">
            {CREATIVE_PRESETS.map((p) => (
              <RatioTile
                key={p.id}
                width={p.width}
                height={p.height}
                label={p.ratioLabel}
                selected={selectedPresetId === p.id}
                onClick={() => onPresetChange(p.id)}
              />
            ))}
          </div>
        </Section>

        <Section title="Colour">
          <ColorSwatch label="" value={color} onChange={handleColor} />
        </Section>

        <Section title="Create All Sizes" defaultOpen={false}>
          <button
            onClick={onReplicateAll}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-[12px] text-gray-700 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            Replicate to all preset sizes
          </button>
          <p className="mt-2 text-[10px] leading-snug text-gray-400">
            Replaces the canvas with one blank frame for every preset.
          </p>
        </Section>
      </div>
    </aside>
  )
}
