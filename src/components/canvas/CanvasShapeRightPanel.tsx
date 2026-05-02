'use client'

import { useEffect, useState } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { ColorSwatch } from '@/components/shared/TextStyleControls'

interface Props {
  canvas: Canvas | null
  selected: FabricObject | null
  onCommit: () => void
}

// Lightweight right-side panel for creative-shape layers — just colour for now.
// Stroke-based shapes (line, arrow shaft) read/write `stroke`; filled shapes
// read/write `fill`. Groups (the arrow) recurse so the colour applies to every
// member that has a stroke or fill.
export const CanvasShapeRightPanel: React.FC<Props> = ({ canvas, selected, onCommit }) => {
  const [color, setColor] = useState('#1B51B3')

  const isShape = !!selected && (selected as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-shape'

  useEffect(() => {
    if (!isShape || !selected) return
    const c = readPrimaryColor(selected)
    if (c) setColor(c)
  }, [isShape, selected])

  if (!isShape || !selected || !canvas) return null

  const handleColor = (next: string) => {
    setColor(next)
    applyColor(selected, next)
    canvas.requestRenderAll()
    onCommit()
  }

  return (
    <aside className="absolute right-5 top-20 z-[60] w-72 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Shape</h3>
      <ColorSwatch label="Colour" value={color} onChange={handleColor} />
    </aside>
  )
}

// ── helpers ──────────────────────────────────────────────────────────────────

const isStringColor = (v: unknown): v is string => typeof v === 'string'

const readPrimaryColor = (obj: FabricObject): string | null => {
  const filled = (obj as FabricObject & { fill?: unknown }).fill
  if (isStringColor(filled) && filled !== '') return filled
  const stroked = (obj as FabricObject & { stroke?: unknown }).stroke
  if (isStringColor(stroked) && stroked !== '') return stroked
  // Group — pick the first member with a colour.
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) {
      const c = readPrimaryColor(m)
      if (c) return c
    }
  }
  return null
}

const applyColor = (obj: FabricObject, color: string) => {
  // Recurse into groups so every member is recoloured.
  const grouped = obj as FabricObject & { _objects?: FabricObject[] }
  if (grouped._objects?.length) {
    for (const m of grouped._objects) applyColor(m, color)
    obj.dirty = true
    return
  }
  const filled = (obj as FabricObject & { fill?: unknown }).fill
  if (isStringColor(filled) && filled !== '') {
    obj.set({ fill: color })
  }
  const stroked = (obj as FabricObject & { stroke?: unknown }).stroke
  if (isStringColor(stroked) && stroked !== '') {
    obj.set({ stroke: color })
  }
  obj.dirty = true
}
