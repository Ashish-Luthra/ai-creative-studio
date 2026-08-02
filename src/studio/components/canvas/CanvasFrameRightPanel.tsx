'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@studio/lib/utils'
import { ColorSwatch } from '@studio/components/shared/TextStyleControls'
import { CREATIVE_PRESETS } from '@studio/lib/canvas/presets'

interface Props {
  canvas: Canvas | null
  frame: FabricObject | null
  selectedPresetId: string
  onPresetChange: (presetId: string) => void
  onReplicateAll: () => void
  onCommit: () => void
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

// Tiny ratio-rectangle preview for the Ad specs grid. Width/height of the
// outer SVG box stays constant; the inner rect shrinks to match the ratio so
// the user reads the proportions at a glance.
const RatioTile: React.FC<{ width: number; height: number; selected: boolean; onClick: () => void; label: string }> = ({
  width, height, selected, onClick, label,
}) => {
  const ratio = width / height
  const boxW = 28
  const boxH = 28
  let w = boxW, h = boxH
  if (ratio >= 1) { h = Math.round(boxH / ratio) }
  else            { w = Math.round(boxW * ratio) }
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 transition-colors',
        selected
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50',
      )}
    >
      <span className="flex h-7 w-7 items-center justify-center">
        <span
          className={cn('block rounded-[2px] border', selected ? 'border-blue-500' : 'border-gray-400')}
          style={{ width: w, height: h }}
        />
      </span>
      <span className="text-[9px] font-medium leading-none">{label}</span>
    </button>
  )
}

export const CanvasFrameRightPanel: React.FC<Props> = ({
  canvas, frame, selectedPresetId, onPresetChange, onReplicateAll, onCommit,
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
    <aside className="absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
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
