'use client'

import React, { useEffect, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight,
  Bold, ChevronDown, Italic, Underline,
} from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@studio/lib/utils'
import { GOOGLE_FONT_FAMILIES } from '@studio/lib/canvas/googleFonts'
import { ColorSwatch } from '@studio/components/shared/TextStyleControls'
import { CanvasArrangeSection } from './CanvasArrangeSection'

const SYSTEM_FONTS = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

interface Props {
  canvas: Canvas | null
  selected: FabricObject | null
  position?: { x: number; y: number }
  onCommit: () => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

// Collapsible section with chevron — Figma-style accordion. Defaults open.
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

export const CanvasTextRightPanel: React.FC<Props> = ({ canvas, selected, onCommit, embedded = false }) => {
  const isText = !!selected && (selected.type === 'textbox' || selected.type === 'i-text')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (isText ? selected : null) as any

  const [fontFamily, setFontFamily] = useState<string>('Arial')
  const [fontWeight, setFontWeight] = useState<number>(400)
  const [fontSize, setFontSize] = useState<number>(16)
  const [color, setColor] = useState<string>('#111827')
  const [borderColor, setBorderColor] = useState<string>('#000000')
  const [borderWidth, setBorderWidth] = useState<number>(0)
  const [italic, setItalic] = useState<boolean>(false)
  const [underline, setUnderline] = useState<boolean>(false)
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left')
  const [textCase, setTextCase] = useState<'none' | 'lowercase' | 'uppercase'>('none')
  const [lineHeight, setLineHeight] = useState<number>(1.6)
  const [letterSpacing, setLetterSpacing] = useState<number>(0)

  useEffect(() => {
    if (!t) return
    setFontFamily(t.fontFamily ?? 'Arial')
    const w = typeof t.fontWeight === 'number' ? t.fontWeight : (t.fontWeight === 'bold' ? 700 : 400)
    setFontWeight(w)
    setFontSize(typeof t.fontSize === 'number' ? Math.round(t.fontSize) : 16)
    setColor(typeof t.fill === 'string' ? t.fill : '#111827')
    setBorderColor(typeof t.stroke === 'string' && t.stroke ? t.stroke : '#000000')
    setBorderWidth(typeof t.strokeWidth === 'number' ? t.strokeWidth : 0)
    setItalic(t.fontStyle === 'italic')
    setUnderline(!!t.underline)
    setTextAlign(['left', 'center', 'right'].includes(t.textAlign) ? t.textAlign : 'left')
    setLineHeight(typeof t.lineHeight === 'number' ? t.lineHeight : 1.6)
    setLetterSpacing(typeof t.charSpacing === 'number' ? Math.round(t.charSpacing / 50) : 0)
    const tc = (selected as FabricObject & { data?: { textCase?: string } }).data?.textCase
    setTextCase(tc === 'lowercase' || tc === 'uppercase' ? tc : 'none')
  }, [t, selected])

  if (!isText) return null

  const apply = (patch: Record<string, unknown>) => {
    if (!t || !canvas) return
    t.set(patch)
    // When text/font/size changes, Textbox needs to recompute its line breaks
    // and bounding box. set() alone doesn't always trigger that — without
    // initDimensions() the canvas re-renders the OLD glyph runs, which is why
    // the Case (Aa/AA/aa) buttons appeared to do nothing on Ads.
    if ('text' in patch || 'fontFamily' in patch || 'fontSize' in patch || 'fontWeight' in patch) {
      ;(t as FabricObject & { initDimensions?: () => void }).initDimensions?.()
    }
    t.setCoords?.()
    canvas.requestRenderAll()
    onCommit()
  }

  const isBold = fontWeight >= 600
  const handleBold = () => { const next = isBold ? 400 : 700; setFontWeight(next); apply({ fontWeight: next }) }
  const handleItalic = () => { const n = !italic; setItalic(n); apply({ fontStyle: n ? 'italic' : 'normal' }) }
  const handleUnderline = () => { const n = !underline; setUnderline(n); apply({ underline: n }) }
  const handleAlign = (v: 'left' | 'center' | 'right') => { setTextAlign(v); apply({ textAlign: v }) }
  const handleSize = (v: number) => { setFontSize(v); apply({ fontSize: v }) }
  const handleFont = async (v: string) => {
    setFontFamily(v)
    // Google Fonts arrive via <link> in layout.tsx but the browser only fetches
    // the actual font files when the family is referenced in the DOM. Fabric
    // renders to <canvas>, which doesn't trigger the fetch. Force-load the
    // font via the FontFace API, then apply + re-render so the new family
    // actually shows on canvas instead of silently falling back.
    try {
      const weight = fontWeight || 400
      await document.fonts.load(`${weight} ${fontSize}px "${v}"`)
    } catch {
      // FontFace API failed (offline / CSP) — apply anyway; browser will use fallback
    }
    apply({ fontFamily: v })
  }
  const handleWeight = (v: number) => { setFontWeight(v); apply({ fontWeight: v }) }
  const handleColor = (v: string) => { setColor(v); apply({ fill: v }) }
  const handleBorderColor = (v: string) => {
    setBorderColor(v)
    // Setting a border colour with no current width auto-promotes to 1px so
    // the change is visible. User can dial it down or set 0 to remove.
    if (!borderWidth) {
      setBorderWidth(1)
      apply({ stroke: v, strokeWidth: 1 })
    } else {
      apply({ stroke: v })
    }
  }
  const handleBorderWidth = (v: number) => {
    setBorderWidth(v)
    apply({ strokeWidth: v, stroke: v > 0 ? borderColor : '' })
  }
  const handleLineHeight = (v: number) => { setLineHeight(v); apply({ lineHeight: v }) }
  const handleLetterSpacing = (v: number) => { setLetterSpacing(v); apply({ charSpacing: v * 50 }) }
  const handleCase = (v: 'none' | 'lowercase' | 'uppercase') => {
    setTextCase(v)
    if (!t) return
    const original = (t.data?.originalText ?? t.text) as string
    if (!t.data) t.data = {}
    t.data.originalText = original
    t.data.textCase = v
    const next = v === 'lowercase' ? original.toLowerCase() : v === 'uppercase' ? original.toUpperCase() : original
    apply({ text: next })
  }

  return (
    <aside className={embedded
      ? 'flex w-full flex-col bg-white'
      : 'absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl'}>
      <div className="flex-1 overflow-auto px-4 py-2">

        <Section title="Font">
          <div className="flex gap-2">
            <select
              value={fontFamily}
              onChange={(e) => handleFont(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              <optgroup label="System Fonts">
                {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
              <optgroup label="Google Fonts">
                {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
              </optgroup>
            </select>
            <select
              value={fontWeight}
              onChange={(e) => handleWeight(Number(e.target.value))}
              className="w-[100px] shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
            >
              <option value={100}>Thin</option>
              <option value={200}>Extra Light</option>
              <option value={300}>Light</option>
              <option value={400}>Regular</option>
              <option value={500}>Medium</option>
              <option value={600}>Semi Bold</option>
              <option value={700}>Bold</option>
              <option value={800}>Extra Bold</option>
              <option value={900}>Black</option>
            </select>
          </div>
        </Section>

        <Section title="Size">
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5">
            <input
              type="number" min={8} max={400}
              value={fontSize}
              onChange={(e) => handleSize(Number(e.target.value))}
              className="w-full text-[12px] text-gray-700 focus:outline-none"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </Section>

        <Section title="Fill">
          <ColorSwatch label="" value={color} onChange={handleColor} />
        </Section>

        <Section title="Border" defaultOpen={false}>
          <ColorSwatch label="" value={borderColor} onChange={handleBorderColor} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <span className="text-[11px] text-gray-500">Thickness</span>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1">
              <input
                type="number" min={0} max={20} step={1}
                value={borderWidth}
                onChange={(e) => handleBorderWidth(Number(e.target.value))}
                className="w-10 text-right text-[11px] text-gray-700 focus:outline-none"
              />
              <span className="text-[10px] text-gray-400">px</span>
            </div>
          </div>
        </Section>

        <Section title="Style">
          <div className="flex gap-2">
            {[
              { icon: <Bold size={13} />,      active: isBold,    handler: handleBold,      label: 'Bold' },
              { icon: <Italic size={13} />,    active: italic,    handler: handleItalic,    label: 'Italic' },
              { icon: <Underline size={13} />, active: underline, handler: handleUnderline, label: 'Underline' },
            ].map(({ icon, active, handler, label }) => (
              <button
                key={label}
                onClick={handler}
                title={label}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  active ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Case">
          <div className="flex gap-2">
            {[
              { id: 'none' as const,      label: 'Aa' },
              { id: 'uppercase' as const, label: 'AA' },
              { id: 'lowercase' as const, label: 'aa' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleCase(id)}
                className={cn(
                  'flex-1 rounded-xl border py-2 text-[12px] font-medium transition-colors',
                  textCase === id ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Alignment">
          <div className="flex gap-2">
            {[
              { id: 'left' as const,   icon: <AlignLeft size={14} /> },
              { id: 'center' as const, icon: <AlignCenter size={14} /> },
              { id: 'right' as const,  icon: <AlignRight size={14} /> },
            ].map(({ id, icon }) => (
              <button
                key={id}
                onClick={() => handleAlign(id)}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  textAlign === id ? 'border-blue-400 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                )}
              >
                {icon}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Line Height" defaultOpen={false}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Current</span>
            <span className="text-[11px] text-gray-700">{lineHeight.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.8} max={3} step={0.1}
            value={lineHeight}
            onChange={(e) => handleLineHeight(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </Section>

        <Section title="Letter Spacing" defaultOpen={false}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-500">Current</span>
            <span className="text-[11px] text-gray-700">{letterSpacing}px</span>
          </div>
          <input
            type="range" min={-5} max={20} step={0.5}
            value={letterSpacing}
            onChange={(e) => handleLetterSpacing(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </Section>

        <CanvasArrangeSection canvas={canvas} onCommit={onCommit} />
      </div>
    </aside>
  )
}
