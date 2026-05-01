'use client'

import React, { useEffect, useState } from 'react'
import {
  AlignCenter, AlignLeft, AlignRight,
  Bold, Italic, Underline,
} from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@/lib/utils'
import { GOOGLE_FONT_FAMILIES } from '@/lib/canvas/googleFonts'
import { ColorSwatch } from '@/components/shared/TextStyleControls'

const SYSTEM_FONTS = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

interface Props {
  canvas: Canvas | null
  selected: FabricObject | null
  position: { x: number; y: number }
  onCommit: () => void
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{children}</p>
  )
}

export const CanvasTextRightPanel: React.FC<Props> = ({ canvas, selected, position, onCommit }) => {
  const isText = !!selected && (selected.type === 'textbox' || selected.type === 'i-text')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = (isText ? selected : null) as any

  const [fontFamily, setFontFamily] = useState<string>('Arial')
  const [fontWeight, setFontWeight] = useState<number>(400)
  const [fontSize, setFontSize] = useState<number>(16)
  const [color, setColor] = useState<string>('#111827')
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
    canvas.requestRenderAll()
    onCommit()
  }

  const isBold = fontWeight >= 600
  const handleBold = () => { const next = isBold ? 400 : 700; setFontWeight(next); apply({ fontWeight: next }) }
  const handleItalic = () => { const n = !italic; setItalic(n); apply({ fontStyle: n ? 'italic' : 'normal' }) }
  const handleUnderline = () => { const n = !underline; setUnderline(n); apply({ underline: n }) }
  const handleAlign = (v: 'left' | 'center' | 'right') => { setTextAlign(v); apply({ textAlign: v }) }
  const handleSize = (v: number) => { setFontSize(v); apply({ fontSize: v }) }
  const handleFont = (v: string) => { setFontFamily(v); apply({ fontFamily: v }) }
  const handleWeight = (v: number) => { setFontWeight(v); apply({ fontWeight: v }) }
  const handleColor = (v: string) => { setColor(v); apply({ fill: v }) }
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
    <aside className="absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="flex-1 overflow-auto px-4 py-4 space-y-5">

        {/* Font */}
        <div>
          <SectionLabel>Font</SectionLabel>
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
        </div>

        {/* Size */}
        <div>
          <SectionLabel>Size</SectionLabel>
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5">
            <input
              type="number" min={8} max={400}
              value={fontSize}
              onChange={(e) => handleSize(Number(e.target.value))}
              className="w-full text-[12px] text-gray-700 focus:outline-none"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </div>

        {/* Font color — shared with Email FontTab */}
        <ColorSwatch label="Font Color" value={color} onChange={(v) => { setColor(v); handleColor(v) }} />

        {/* Style */}
        <div>
          <SectionLabel>Style</SectionLabel>
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
        </div>

        {/* Case */}
        <div>
          <SectionLabel>Case</SectionLabel>
          <div className="flex gap-2">
            {[
              { id: 'none' as const,      label: 'aA' },
              { id: 'lowercase' as const, label: 'aa' },
              { id: 'uppercase' as const, label: 'AA' },
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
        </div>

        {/* Alignment */}
        <div>
          <SectionLabel>Alignment</SectionLabel>
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
        </div>

        {/* Line height */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Line height</span>
            <span className="text-[11px] text-gray-500">{lineHeight.toFixed(1)}</span>
          </div>
          <input
            type="range" min={0.8} max={3} step={0.1}
            value={lineHeight}
            onChange={(e) => handleLineHeight(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>

        {/* Letter spacing */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Letter spacing</span>
            <span className="text-[11px] text-gray-500">{letterSpacing}px</span>
          </div>
          <input
            type="range" min={-5} max={20} step={0.5}
            value={letterSpacing}
            onChange={(e) => handleLetterSpacing(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      </div>
    </aside>
  )
}
