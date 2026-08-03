'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@studio/lib/utils'
import { ColorSwatch } from '@studio/components/shared/TextStyleControls'
import { updateLinearShape, type LinearConfig, type LinearHead } from '@studio/lib/canvas/fabricInit'
import { CanvasArrangeSection } from './CanvasArrangeSection'

interface Props {
  canvas: Canvas | null
  selected: FabricObject | null
  onCommit: () => void
  onAfterReplace?: (next: FabricObject) => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

type WithLinear = FabricObject & { data?: { kind?: string; linear?: LinearConfig } }

const isShape = (obj: FabricObject | null): obj is FabricObject =>
  !!obj && (obj as WithLinear).data?.kind === 'creative-shape'

const linearOf = (obj: FabricObject | null): LinearConfig | null =>
  (obj as WithLinear | null)?.data?.linear ?? null

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

export const CanvasShapeRightPanel: React.FC<Props> = ({ canvas, selected, onCommit, onAfterReplace, embedded = false }) => {
  const [fillColor, setFillColor] = useState('#1B51B3')
  const [borderColor, setBorderColor] = useState('#000000')
  const [borderWidth, setBorderWidth] = useState(0)
  const linear = linearOf(selected)
  const isLinear = !!linear

  useEffect(() => {
    if (!isShape(selected)) return
    const f = readFill(selected)
    const s = readStroke(selected)
    if (f) setFillColor(f)
    if (s) setBorderColor(s)
    setBorderWidth(readStrokeWidth(selected))
  }, [selected])

  if (!isShape(selected) || !canvas) return null

  const commit = () => {
    canvas.requestRenderAll()
    onCommit()
  }

  const handleFill = (next: string) => {
    setFillColor(next)
    if (isLinear) {
      // Linear paths use fill = stroke so closed heads stay filled.
      // For these "Fill" controls the head colour; thickness lives in Border.
      applyFill(selected, next)
      applyStroke(selected, next)
    } else {
      applyFill(selected, next)
    }
    commit()
  }

  const handleBorderColor = (next: string) => {
    setBorderColor(next)
    if (isLinear) {
      // For linear paths, "Border" is the stroke colour itself — also push to
      // fill so closed arrowheads track.
      applyStroke(selected, next)
      applyFill(selected, next)
    } else {
      applyStroke(selected, next)
      // Setting a border colour on a fill-only shape promotes width to >=1.
      if (!readStrokeWidth(selected)) {
        ;(selected as FabricObject & { strokeWidth?: number }).set({ strokeWidth: 2 })
        setBorderWidth(2)
      }
    }
    commit()
  }

  const handleBorderWidth = (next: number) => {
    setBorderWidth(next)
    if (isLinear) {
      void updateLinearShape(canvas, selected, { thickness: Math.max(1, next) })
        .then((replaced) => { if (replaced) onAfterReplace?.(replaced) })
      onCommit()
      return
    }
    ;(selected as FabricObject & { strokeWidth?: number }).set({ strokeWidth: next })
    if (next > 0 && !readStroke(selected)) {
      applyStroke(selected, borderColor)
    }
    commit()
  }

  const headPicker = (which: 'startHead' | 'endHead') => (
    <select
      value={linear?.[which] ?? 'none'}
      onChange={(e) => {
        void updateLinearShape(canvas, selected, { [which]: e.target.value as LinearHead })
          .then((replaced) => { if (replaced) onAfterReplace?.(replaced) })
        onCommit()
      }}
      className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] text-gray-700 focus:border-blue-400 focus:outline-none"
    >
      {HEAD_OPTIONS.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}
    </select>
  )

  return (
    <aside className={embedded
      ? 'flex w-full flex-col bg-white'
      : 'absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl'}>
      <div className="flex-1 overflow-auto px-4 py-2">
        {!isLinear && (
          <Section title="Fill">
            <ColorSwatch label="" value={fillColor} onChange={handleFill} />
          </Section>
        )}

        <Section title={isLinear ? 'Stroke' : 'Border'}>
          <ColorSwatch label="" value={isLinear ? fillColor : borderColor} onChange={isLinear ? handleFill : handleBorderColor} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500">Thickness</span>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
              <input
                type="number" min={isLinear ? 1 : 0} max={40} step={1}
                value={isLinear ? (linear?.thickness ?? 4) : borderWidth}
                onChange={(e) => handleBorderWidth(Number(e.target.value))}
                className="w-10 text-right text-[11px] text-gray-700 focus:outline-none"
              />
              <span className="text-[10px] text-gray-400">px</span>
            </div>
          </div>
        </Section>

        {isLinear && (
          <Section title="Arrowheads" defaultOpen={false}>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">Start</span>
                <div className="w-40">{headPicker('startHead')}</div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-gray-500">End</span>
                <div className="w-40">{headPicker('endHead')}</div>
              </div>
            </div>
          </Section>
        )}

        <CanvasArrangeSection canvas={canvas} onCommit={onCommit} />
      </div>
    </aside>
  )
}

const HEAD_OPTIONS: { id: LinearHead; label: string }[] = [
  { id: 'none',              label: 'None' },
  { id: 'line',              label: 'Line arrow' },
  { id: 'triangle',          label: 'Triangle arrow' },
  { id: 'triangle-reversed', label: 'Reversed triangle' },
  { id: 'circle',            label: 'Circle arrow' },
  { id: 'diamond',           label: 'Diamond arrow' },
]

// ── helpers ──────────────────────────────────────────────────────────────────

const isStringColor = (v: unknown): v is string => typeof v === 'string' && v !== ''

const readFill = (obj: FabricObject): string | null => {
  const f = (obj as FabricObject & { fill?: unknown }).fill
  if (isStringColor(f)) return f
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) {
      const c = readFill(m)
      if (c) return c
    }
  }
  return null
}

const readStroke = (obj: FabricObject): string | null => {
  const s = (obj as FabricObject & { stroke?: unknown }).stroke
  if (isStringColor(s)) return s
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) {
      const c = readStroke(m)
      if (c) return c
    }
  }
  return null
}

const readStrokeWidth = (obj: FabricObject): number => {
  const w = (obj as FabricObject & { strokeWidth?: number }).strokeWidth
  return typeof w === 'number' ? w : 0
}

const applyFill = (obj: FabricObject, color: string) => {
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) applyFill(m, color)
    obj.dirty = true
    return
  }
  if (isStringColor((obj as FabricObject & { fill?: unknown }).fill)) {
    obj.set({ fill: color })
  } else {
    // Empty/null fill — only set when caller explicitly wants fill on this layer.
    obj.set({ fill: color })
  }
  obj.dirty = true
}

const applyStroke = (obj: FabricObject, color: string) => {
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) applyStroke(m, color)
    obj.dirty = true
    return
  }
  obj.set({ stroke: color })
  obj.dirty = true
}
