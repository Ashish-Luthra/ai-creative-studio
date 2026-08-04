'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'
import { cn } from '@studio/lib/utils'
import { GOOGLE_FONT_FAMILIES } from '@studio/lib/canvas/googleFonts'

// ── Public types ─────────────────────────────────────────────────────────────

export type TextCase = 'none' | 'lowercase' | 'uppercase'
export type TextAlign = 'left' | 'center' | 'right'

export interface TextStyleValue {
  fontFamily: string
  fontWeight: number
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  underline: boolean
  textCase: TextCase
  textAlign: TextAlign
  lineHeight: number
  letterSpacing: number
}

export interface TextStyleControlsProps {
  value: TextStyleValue
  onChange: (patch: Partial<TextStyleValue>) => void
  orientation?: 'horizontal' | 'vertical'
  compact?: boolean
}

// Web-safe system fonts — always available regardless of network / email client
export const SYSTEM_FONTS = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

// Combined set used for "is this font known?" checks
export const ALL_KNOWN_FONTS = new Set([...SYSTEM_FONTS, ...GOOGLE_FONT_FAMILIES])

// ── Preset palette (shared with email's ColorPickerPopup) ────────────────────
const PRESET_COLORS = [
  '#D4B5A7','#B07B7B','#F5E6E8','#C9A89C','#E8D5C4','#C9C5A3','#A8A67E','#8FA095','#9EA5A3','#B8CDE0','#000814',
  '#E8BBA8','#D4A5A5','#E8D5C4','#D4B5A7','#F5D5C4','#C9D5C4','#7FBC8C','#A8C9C5','#B8CDE0','#D5E0C9','#3D4149',
  '#E87B5C','#C96B5C','#F5A5A5','#E85C7B','#C96B5C','#E89C5C','#5FBC8C','#A8D5C9','#C9E0D5','#E0E8C9','#5A5D66',
  '#BC4B3C','#7B3D3D','#C97B8C','#BC3D5C','#E87B5C','#E8A85C','#8FD5A8','#A8C9B8','#C9D5C4','#E0E8D5','#1A3D3D',
  '#8C3D3D','#C9A89C','#C97B9C','#BC5C7B','#E8A87B','#5FBC8C','#7BA8A8','#7BB8D5','#0047AB','#A8B8C9','#8899AA',
]

const QUICK_PRESETS = [
  '#000000', '#ffffff', '#E87B5C', '#5FBC8C',
  '#0047AB', '#FFCC00', '#9B59B6', '#C9A89C',
]

// ── Shared micro-components ──────────────────────────────────────────────────

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  )
}

export function ColorSwatch({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [showPalette, setShowPalette] = useState(false)
  const [hex, setHex] = useState(value)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setHex(value) }, [value])

  useEffect(() => {
    if (!showPalette) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setShowPalette(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPalette])

  return (
    <div className="relative" ref={panelRef}>
      {label && <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>}

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2">
        <div
          className="h-7 w-7 shrink-0 rounded-[6px] border border-black/10 shadow-sm"
          style={{ backgroundColor: value }}
        />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Hex</span>
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            setHex(e.target.value)
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value)
          }}
          maxLength={7}
          placeholder="#000000"
          className="flex-1 font-mono text-[12px] text-gray-700 focus:outline-none"
        />
        <label
          className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center transition-transform hover:scale-105"
          title="Open colour picker"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/colour-picker.svg" alt="Colour picker" className="h-5 w-5" />
          <input
            type="color"
            value={value}
            onChange={(e) => { onChange(e.target.value); setHex(e.target.value) }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
      </div>

      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <span className="mr-0.5 text-[8px] font-semibold uppercase tracking-wider text-gray-300">Palette</span>
        {QUICK_PRESETS.map((c, i) => (
          <button
            key={`quick-${i}-${c}`}
            type="button"
            onClick={() => { onChange(c); setHex(c) }}
            title={c}
            className={cn(
              'h-[14px] w-[14px] shrink-0 rounded-full border-2 transition-all hover:scale-125',
              value.toLowerCase() === c.toLowerCase()
                ? 'border-[#1B51B3] scale-110'
                : 'border-transparent hover:border-gray-300',
              c === '#ffffff' && 'border-gray-200',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          onClick={() => setShowPalette((o) => !o)}
          title="Colour palette"
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded transition-opacity',
            showPalette ? 'opacity-100' : 'opacity-60 hover:opacity-100',
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/colour-palette.svg" alt="Colour palette" className="h-4 w-4" />
        </button>
      </div>

      {showPalette && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[268px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icons/colour-palette.svg" alt="" className="h-4 w-4 opacity-70" />
              <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Colour Palette</p>
            </div>
            <button type="button" onClick={() => setShowPalette(false)} className="text-[13px] leading-none text-gray-400 hover:text-gray-700">✕</button>
          </div>
          <div className="grid grid-cols-11 gap-1">
            {PRESET_COLORS.map((c, i) => (
              <button
                key={`preset-${i}-${c}`}
                type="button"
                onClick={() => { onChange(c); setHex(c); setShowPalette(false) }}
                title={c}
                className={cn(
                  'h-5 w-5 rounded-full border-2 transition-all hover:scale-110',
                  value === c ? 'border-[#1B51B3] scale-110' : 'border-transparent hover:border-blue-300',
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Compact color trigger (for vertical pill) ────────────────────────────────

function CompactColorButton({
  value, onChange,
}: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        title="Colour"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 hover:border-gray-300"
      >
        <span className="h-4 w-4 rounded-[4px] border border-black/10" style={{ backgroundColor: value }} />
      </button>
      {open && (
        <div className="absolute left-[calc(100%+8px)] top-0 z-50 w-[220px] rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <ColorSwatch label="" value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

// ── Main control ─────────────────────────────────────────────────────────────

export function TextStyleControls({
  value, onChange, orientation = 'horizontal', compact = false,
}: TextStyleControlsProps) {
  const isVertical = orientation === 'vertical'
  const isUnknownFont = !!value.fontFamily && !ALL_KNOWN_FONTS.has(value.fontFamily)

  // ── Vertical/compact pill layout ──────────────────────────────────────────
  if (isVertical) {
    const iconBtn = (active: boolean) =>
      cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
        active
          ? 'border-blue-400 bg-blue-50 text-blue-600'
          : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
      )
    const cycleAlign = () => {
      const order: TextAlign[] = ['left', 'center', 'right']
      const next = order[(order.indexOf(value.textAlign) + 1) % order.length]
      onChange({ textAlign: next })
    }
    const AlignIcon =
      value.textAlign === 'left' ? AlignLeft : value.textAlign === 'right' ? AlignRight : AlignCenter

    return (
      <div className={cn('flex flex-col items-center gap-1.5', compact ? 'p-1.5' : 'p-2')}>
        {/* Family — compact dropdown */}
        <select
          value={ALL_KNOWN_FONTS.has(value.fontFamily) ? value.fontFamily : ''}
          onChange={(e) => onChange({ fontFamily: e.target.value })}
          title="Font family"
          className={cn(
            'h-7 w-9 rounded-lg border text-[10px] text-gray-700 focus:outline-none px-1',
            isUnknownFont ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white',
          )}
        >
          {isUnknownFont && <option value="" disabled>—</option>}
          <optgroup label="System">
            {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
          <optgroup label="Google">
            {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>

        {/* Size */}
        <input
          type="number"
          min={8}
          max={200}
          value={value.fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          title="Font size"
          className="h-7 w-9 rounded-lg border border-gray-200 px-1 text-center text-[11px] text-gray-700 focus:outline-none"
        />

        {/* Weight */}
        <select
          value={value.fontWeight}
          onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
          title="Weight"
          className="h-7 w-9 rounded-lg border border-gray-200 bg-white px-1 text-[10px] text-gray-700 focus:outline-none"
        >
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={300}>300</option>
          <option value={400}>400</option>
          <option value={500}>500</option>
          <option value={600}>600</option>
          <option value={700}>700</option>
          <option value={800}>800</option>
          <option value={900}>900</option>
        </select>

        <div className="my-0.5 h-px w-6 bg-gray-200" />

        {/* B / I / U */}
        <button title="Bold" onClick={() => onChange({ bold: !value.bold })} className={iconBtn(value.bold)}>
          <Bold size={13} />
        </button>
        <button title="Italic" onClick={() => onChange({ italic: !value.italic })} className={iconBtn(value.italic)}>
          <Italic size={13} />
        </button>
        <button title="Underline" onClick={() => onChange({ underline: !value.underline })} className={iconBtn(value.underline)}>
          <Underline size={13} />
        </button>

        {/* Alignment cycle */}
        <button title={`Align: ${value.textAlign}`} onClick={cycleAlign} className={iconBtn(false)}>
          <AlignIcon size={13} />
        </button>

        <div className="my-0.5 h-px w-6 bg-gray-200" />

        {/* Color */}
        <CompactColorButton value={value.color} onChange={(c) => onChange({ color: c })} />

        {/* Line height (compact stepper) */}
        <input
          type="number"
          step={0.1}
          min={1}
          max={3}
          value={value.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          title="Line height"
          className="h-7 w-9 rounded-lg border border-gray-200 px-1 text-center text-[10px] text-gray-700 focus:outline-none"
        />

        {/* Letter spacing */}
        <input
          type="number"
          step={0.5}
          min={-2}
          max={20}
          value={value.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          title="Letter spacing (px)"
          className="h-7 w-9 rounded-lg border border-gray-200 px-1 text-center text-[10px] text-gray-700 focus:outline-none"
        />
      </div>
    )
  }

  // ── Horizontal layout (matches original FontTab) ──────────────────────────
  return (
    <div className="space-y-4">
      {/* Family + Weight */}
      <div>
        <SectionLabel>Font</SectionLabel>
        <div className="flex gap-2">
          <select
            value={ALL_KNOWN_FONTS.has(value.fontFamily) ? value.fontFamily : ''}
            onChange={(e) => onChange({ fontFamily: e.target.value })}
            className={cn(
              'min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[12px] text-gray-700 focus:outline-none',
              isUnknownFont
                ? 'border-amber-300 bg-amber-50 focus:border-amber-400'
                : 'border-gray-200 bg-white focus:border-blue-400',
            )}
          >
            {isUnknownFont && <option value="" disabled>— select a font —</option>}
            <optgroup label="System Fonts">
              {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
            <optgroup label="Google Fonts">
              {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          </select>
          <select
            value={value.fontWeight}
            onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
            className="w-[108px] shrink-0 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 focus:outline-none focus:border-blue-400"
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
            type="number" min={8} max={72}
            value={value.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="w-full text-[12px] text-gray-700 focus:outline-none"
          />
          <span className="text-[10px] text-gray-400">px</span>
        </div>
      </div>

      {/* Font Color */}
      <ColorSwatch label="Font Color" value={value.color} onChange={(v) => onChange({ color: v })} />

      {/* Style toggles */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="flex gap-2">
          {[
            { icon: <Bold size={13} />,      active: value.bold,      handler: () => onChange({ bold: !value.bold }),       label: 'Bold' },
            { icon: <Italic size={13} />,    active: value.italic,    handler: () => onChange({ italic: !value.italic }),   label: 'Italic' },
            { icon: <Underline size={13} />, active: value.underline, handler: () => onChange({ underline: !value.underline }), label: 'Underline' },
          ].map(({ icon, active, handler, label }) => (
            <button
              key={label}
              title={label}
              onClick={handler}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                active
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
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
          {([
            { value: 'none' as const,      label: 'Aa', title: 'Default' },
            { value: 'uppercase' as const, label: 'AA', title: 'Uppercase' },
            { value: 'lowercase' as const, label: 'aa', title: 'Lowercase' },
          ]).map(({ value: caseVal, label, title }) => (
            <button
              key={caseVal}
              title={title}
              onClick={() => onChange({ textCase: caseVal })}
              className={cn(
                'flex h-9 flex-1 items-center justify-center rounded-xl border text-[12px] font-semibold transition-colors',
                value.textCase === caseVal
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
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
            { icon: <AlignLeft size={13} />,   v: 'left'   as const },
            { icon: <AlignCenter size={13} />, v: 'center' as const },
            { icon: <AlignRight size={13} />,  v: 'right'  as const },
          ].map(({ icon, v }) => (
            <button
              key={v}
              onClick={() => onChange({ textAlign: v })}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                value.textAlign === v
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
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
          <SectionLabel>Line Height</SectionLabel>
          <span className="text-[11px] text-gray-500">{value.lineHeight.toFixed(1)}</span>
        </div>
        <input
          type="range" min={1} max={3} step={0.1}
          value={value.lineHeight}
          onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Letter spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Letter Spacing</SectionLabel>
          <span className="text-[11px] text-gray-500">{value.letterSpacing}px</span>
        </div>
        <input
          type="range" min={-2} max={10} step={0.5}
          value={value.letterSpacing}
          onChange={(e) => onChange({ letterSpacing: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  )
}
