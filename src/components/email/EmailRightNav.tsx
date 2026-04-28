'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronDown, Upload,
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Plus, Trash2, GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasBlock } from './EmailEditorPanel'
import { GOOGLE_FONT_FAMILIES } from '@/lib/canvas/googleFonts'
import { AlertTriangle } from 'lucide-react'

// ─── Tab routing ──────────────────────────────────────────────────────────────

type RightTab = 'block' | 'font' | 'button' | 'image' | 'link'

// Only blocks where the image has a distinct shape (circle/arch/etc.) get the Image tab.
// Full-bleed blocks intentionally do NOT appear here.
const IMAGE_BLOCK_TYPES = new Set(['testimonial', 'recipe-card'])

// Every layout block that contains a CTA button whose style is driven by
// buttonShapeVariant / buttonFillColor / etc.
const BUTTON_LAYOUT_TYPES = new Set([
  'image-left-text-right',
  'centered-content',
  'text-over-image',
  'text-left-image-right',
  'recipe-card',
  'image-top-text-bottom',
])

function getTabsForBlock(blockType: string): { id: RightTab; label: string }[] {
  const B = { id: 'button' as RightTab, label: 'Button' }
  const F = { id: 'font'   as RightTab, label: 'Font'   }
  const I = { id: 'image'  as RightTab, label: 'Image'  }
  const L = { id: 'link'   as RightTab, label: 'Link'   }
  const K = { id: 'block'  as RightTab, label: 'Block'  }

  // Standalone button block
  if (blockType === 'button') return [B, F, L, K]
  // Text-only block
  if (blockType === 'text')   return [F, L, K]
  // Spacer — only needs Block tab (height + background)
  if (blockType === 'spacer') return [K]
  // Link bar / Footer — only need Block tab (link items editor + background)
  if (blockType === 'link-bar') return [K]
  if (blockType === 'footer')   return [K]

  const hasShape  = IMAGE_BLOCK_TYPES.has(blockType)
  const hasButton = BUTTON_LAYOUT_TYPES.has(blockType)

  // All layout blocks include a Font tab since they contain editable text
  if (hasShape && hasButton) return [B, I, F, L, K]   // recipe-card
  if (hasShape)              return [I, F, L, K]       // testimonial
  if (hasButton)             return [B, F, L, K]       // all other layout blocks with buttons

  return [K, L]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BUTTON_SHAPES = [
  { id: 0, radius: '0px',   filled: true  },
  { id: 1, radius: '4px',   filled: true  },
  { id: 2, radius: '12px',  filled: true  },
  { id: 3, radius: '999px', filled: true  },
  { id: 4, radius: '0px',   filled: false },
  { id: 5, radius: '4px',   filled: false },
  { id: 6, radius: '12px',  filled: false },
  { id: 7, radius: '999px', filled: false },
]

const IMAGE_SHAPES: { id: CanvasBlock['imageShape']; path: string }[] = [
  { id: 'circle',   path: 'M16 0C24.8 0 32 7.2 32 16C32 24.8 24.8 32 16 32C7.2 32 0 24.8 0 16C0 7.2 7.2 0 16 0Z' },
  { id: 'square',   path: 'M0 0H32V32H0Z' },
  { id: 'rounded',  path: 'M4 0H28C30.2 0 32 1.8 32 4V28C32 30.2 30.2 32 28 32H4C1.8 32 0 30.2 0 28V4C0 1.8 1.8 0 4 0Z' },
  { id: 'arch',     path: 'M0 16C0 7.2 7.2 0 16 0C24.8 0 32 7.2 32 16V32H0V16Z' },
  { id: 'diamond',  path: 'M16 0L32 16L16 32L0 16Z' },
  { id: 'hexagon',  path: 'M16 0L32 9.3V22.7L16 32L0 22.7V9.3Z' },
]

// Web-safe system fonts — always available regardless of network / email client
const SYSTEM_FONTS = [
  'Arial', 'Georgia', 'Helvetica', 'Tahoma',
  'Times New Roman', 'Trebuchet MS', 'Verdana', 'Courier New',
]

// Combined set used for "is this font known?" checks
const ALL_KNOWN_FONTS = new Set([...SYSTEM_FONTS, ...GOOGLE_FONT_FAMILIES])

// ─── Preset soft-colour palette (matches ColorPickerPopup) ────────────────────
const PRESET_COLORS = [
  // Row 1 — warm neutrals + slate
  '#D4B5A7','#B07B7B','#F5E6E8','#C9A89C','#E8D5C4','#C9C5A3','#A8A67E','#8FA095','#9EA5A3','#B8CDE0','#000814',
  // Row 2 — blush + sage + sky
  '#E8BBA8','#D4A5A5','#E8D5C4','#D4B5A7','#F5D5C4','#C9D5C4','#7FBC8C','#A8C9C5','#B8CDE0','#D5E0C9','#3D4149',
  // Row 3 — terracotta + teal + lime
  '#E87B5C','#C96B5C','#F5A5A5','#E85C7B','#C96B5C','#E89C5C','#5FBC8C','#A8D5C9','#C9E0D5','#E0E8C9','#5A5D66',
  // Row 4 — deep reds + greens + blues
  '#BC4B3C','#7B3D3D','#C97B8C','#BC3D5C','#E87B5C','#E8A85C','#8FD5A8','#A8C9B8','#C9D5C4','#E0E8D5','#1A3D3D',
  // Row 5 — wine + cobalt + cool grays
  '#8C3D3D','#C9A89C','#C97B9C','#BC5C7B','#E8A87B','#5FBC8C','#7BA8A8','#7BB8D5','#0047AB','#A8B8C9','#8899AA',
]

const LINK_ACTIONS = [
  'Add to segment',
  'Remove from segment',
  'Add to workflow',
  'Remove from workflow',
  'Set custom field value',
]

// ─── Shared micro-components ──────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </p>
  )
}

// ─── Quick-access preset dots shown inline inside ColorSwatch ─────────────────
// A curated diverse set — their variety of hues makes it visually obvious
// these are "preset colour options", not a single-purpose picker control.
const QUICK_PRESETS = [
  '#000000', '#ffffff', '#E87B5C', '#5FBC8C',
  '#0047AB', '#FFCC00', '#9B59B6', '#C9A89C',
]

function ColorSwatch({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [showPalette, setShowPalette] = useState(false)
  const [hex, setHex] = useState(value)
  const panelRef = useRef<HTMLDivElement>(null)

  // Keep local hex in sync when value changes externally
  useEffect(() => { setHex(value) }, [value])

  // Close full palette on outside click
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

      {/* ── Row 1: current colour square + hex input + rainbow picker ── */}
      <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2">
        {/* Current colour — ROUNDED SQUARE (not a circle).
            This is purely a value indicator, not a clickable control. */}
        <div
          className="h-7 w-7 shrink-0 rounded-[6px] border border-black/10 shadow-sm"
          style={{ backgroundColor: value }}
        />

        {/* Hex text input — always editable */}
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

        {/* Gradient icon = native OS colour picker trigger */}
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

      {/* ── Row 2: preset colour dots (always visible) + "more" expander ──
          These small, multi-coloured circles are visually unmistakeable as
          "preset palette options" — clearly different from the rainbow picker above. */}
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
              // White needs a visible border so it doesn't disappear
              c === '#ffffff' && 'border-gray-200',
            )}
            style={{ backgroundColor: c }}
          />
        ))}
        {/* Expand to full palette — ColourPalette icon */}
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

      {/* ── Full palette dropdown ── */}
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

function Accordion({
  title, children, defaultOpen = false,
}: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-[13px] font-semibold text-gray-800"
      >
        {title}
        <ChevronDown
          size={14}
          className={cn('text-gray-400 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}

// ─── Link Bar editor (used inside BlockTab) ───────────────────────────────────

const DEFAULT_LINK_BAR_ITEMS = [
  { label: 'Home',     url: '' },
  { label: 'About',    url: '' },
  { label: 'Products', url: '' },
  { label: 'Blog',     url: '' },
  { label: 'Contact',  url: '' },
]

function LinkBarEditor({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const items = (block.linkBarItems && block.linkBarItems.length > 0)
    ? block.linkBarItems
    : DEFAULT_LINK_BAR_ITEMS

  const patchItems = (next: { label: string; url: string }[]) =>
    onPatch({ linkBarItems: next })

  const updateItem = (i: number, field: 'label' | 'url', value: string) => {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: value } : item)
    patchItems(next)
  }

  const removeItem = (i: number) => {
    if (items.length <= 1) return
    patchItems(items.filter((_, idx) => idx !== i))
  }

  const addItem = () => {
    patchItems([...items, { label: 'New Link', url: '' }])
  }

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchItems(next)
  }

  return (
    <div>
      <SectionLabel>Navigation Links</SectionLabel>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
            {/* Row 1: drag handle + label + delete */}
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => moveItem(i, i - 1)}
                  disabled={i === 0}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(i, i + 1)}
                  disabled={i === items.length - 1}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <input
                type="text"
                value={item.label}
                placeholder="Label"
                onChange={(e) => updateItem(i, 'label', e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={items.length <= 1}
                className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors"
                title="Remove"
              >
                <Trash2 size={13} />
              </button>
            </div>
            {/* Row 2: URL input */}
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="text-[9px] text-gray-300 font-mono shrink-0">URL</span>
              <input
                type="url"
                value={item.url}
                placeholder="https://…"
                onChange={(e) => updateItem(i, 'url', e.target.value)}
                className="flex-1 text-[11px] text-gray-700 font-mono focus:outline-none min-w-0"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus size={12} />
        Add link
      </button>
    </div>
  )
}

// ─── Footer editor (used inside BlockTab) ────────────────────────────────────

const DEFAULT_FOOTER_LINKS = [
  { label: 'Privacy Policy',  url: '' },
  { label: 'Unsubscribe',     url: '' },
  { label: 'View in Browser', url: '' },
  { label: 'Contact Us',      url: '' },
]

function FooterEditor({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const items = (block.footerLinks && block.footerLinks.length > 0)
    ? block.footerLinks
    : DEFAULT_FOOTER_LINKS

  const patchItems = (next: { label: string; url: string }[]) =>
    onPatch({ footerLinks: next })

  const updateItem = (i: number, field: 'label' | 'url', value: string) =>
    patchItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item))

  const removeItem = (i: number) => {
    if (items.length <= 1) return
    patchItems(items.filter((_, idx) => idx !== i))
  }

  const addItem = () => patchItems([...items, { label: 'New Link', url: '' }])

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    patchItems(next)
  }

  return (
    <div>
      <SectionLabel>Footer Links</SectionLabel>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button type="button" onClick={() => moveItem(i, i - 1)} disabled={i === 0}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none" title="Move up">▲</button>
                <button type="button" onClick={() => moveItem(i, i + 1)} disabled={i === items.length - 1}
                  className="text-[0.95em] text-gray-300 hover:text-gray-500 disabled:opacity-20 leading-none" title="Move down">▼</button>
              </div>
              <input
                type="text"
                value={item.label}
                placeholder="Label"
                onChange={(e) => updateItem(i, 'label', e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[12px] text-gray-800 focus:outline-none focus:ring-1 focus:ring-gray-300"
              />
              <button type="button" onClick={() => removeItem(i)} disabled={items.length <= 1}
                className="text-gray-300 hover:text-red-400 disabled:opacity-20 transition-colors" title="Remove">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
              <span className="text-[9px] text-gray-300 font-mono shrink-0">URL</span>
              <input
                type="url"
                value={item.url}
                placeholder="https://…"
                onChange={(e) => updateItem(i, 'url', e.target.value)}
                className="flex-1 text-[11px] text-gray-700 font-mono focus:outline-none min-w-0"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-[11px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
      >
        <Plus size={12} />
        Add link
      </button>
    </div>
  )
}

// ─── Tab: Block ────────────────────────────────────────────────────────────────

function BlockTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const bg  = block.backgroundColor ?? '#ffffff'
  const pad = block.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }
  const spacerH = block.spacerHeight ?? 64
  const contentH = block.contentHeight ?? 200

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-5">

      {/* Spacer height — only shown for spacer blocks */}
      {block.type === 'spacer' && (
        <div>
          <SectionLabel>Height</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={8}
              max={320}
              step={4}
              value={spacerH}
              onChange={(e) => onPatch({ spacerHeight: Number(e.target.value) })}
              className="flex-1 accent-gray-800"
            />
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 w-20 shrink-0">
              <input
                type="number"
                min={8}
                max={320}
                value={spacerH}
                onChange={(e) => onPatch({ spacerHeight: Math.max(8, Math.min(320, Number(e.target.value))) })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Content block height — only shown when a layout is active */}
      {block.type === 'content' && block.contentLayout && (
        <div>
          <SectionLabel>Min Height</SectionLabel>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={80}
              max={800}
              step={8}
              value={contentH}
              onChange={(e) => onPatch({ contentHeight: Number(e.target.value) })}
              className="flex-1 accent-gray-800"
            />
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-2.5 py-2 w-20 shrink-0">
              <input
                type="number"
                min={80}
                max={800}
                value={contentH}
                onChange={(e) => onPatch({ contentHeight: Math.max(80, Math.min(800, Number(e.target.value))) })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          </div>
        </div>
      )}

      {/* Link Bar items — only shown for link-bar blocks */}
      {block.type === 'link-bar' && (
        <LinkBarEditor block={block} onPatch={onPatch} />
      )}

      {/* Footer links — only shown for footer blocks */}
      {block.type === 'footer' && (
        <FooterEditor block={block} onPatch={onPatch} />
      )}

      {/* Background */}
      <div>
        <ColorSwatch
          label="Background"
          value={bg}
          onChange={(v) => onPatch({ backgroundColor: v })}
        />
        {bg !== '#ffffff' && (
          <button
            type="button"
            onClick={() => onPatch({ backgroundColor: '#ffffff' })}
            className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            Reset to white
          </button>
        )}
      </div>

      {/* Padding */}
      <div>
        <SectionLabel>Padding</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <div key={side} className="flex items-center gap-1.5 rounded-xl border border-gray-200 px-2.5 py-2">
              <span className="w-4 text-[9px] uppercase text-gray-400">{side[0]}</span>
              <input
                type="number"
                min={0}
                max={80}
                value={pad[side]}
                onChange={(e) => onPatch({ padding: { ...pad, [side]: Number(e.target.value) } })}
                className="w-full text-[12px] text-gray-700 focus:outline-none"
              />
              <span className="text-[9px] text-gray-300">px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Font ─────────────────────────────────────────────────────────────────

function FontTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const currentFont = block.fontFamily ?? 'Arial'
  const isUnknownFont = !!block.fontFamily && !ALL_KNOWN_FONTS.has(block.fontFamily)

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

      {/* ── Unknown-font warning ─────────────────────────────────────────────── */}
      {isUnknownFont && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">
              Font not available in editor
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-amber-600">
              <span className="font-mono">&ldquo;{block.fontFamily}&rdquo;</span> isn&apos;t in
              the font list and won&apos;t render correctly in the email.
              Please select a replacement below.
            </p>
          </div>
        </div>
      )}

      {/* Family */}
      <div>
        <SectionLabel>Font Family</SectionLabel>
        <select
          value={ALL_KNOWN_FONTS.has(currentFont) ? currentFont : ''}
          onChange={(e) => onPatch({ fontFamily: e.target.value })}
          className={cn(
            'w-full rounded-xl border px-3 py-2.5 text-[12px] text-gray-700 focus:outline-none',
            isUnknownFont
              ? 'border-amber-300 bg-amber-50 focus:border-amber-400'
              : 'border-gray-200 bg-white focus:border-blue-400',
          )}
        >
          {/* Placeholder shown only when current font is unknown */}
          {isUnknownFont && (
            <option value="" disabled>— select a font —</option>
          )}
          <optgroup label="System Fonts">
            {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
          <optgroup label="Google Fonts">
            {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Size */}
      <div>
        <SectionLabel>Size</SectionLabel>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2.5">
          <input
            type="number"
            min={8}
            max={72}
            value={block.fontSize ?? 16}
            onChange={(e) => onPatch({ fontSize: Number(e.target.value) })}
            className="w-full text-[12px] text-gray-700 focus:outline-none"
          />
          <span className="text-[10px] text-gray-400">px</span>
        </div>
      </div>

      {/* Font Color */}
      <ColorSwatch
        label="Font Color"
        value={block.fontColor ?? '#111827'}
        onChange={(v) => onPatch({ fontColor: v })}
      />

      {/* Style toggles */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="flex gap-2">
          {[
            { icon: <Bold size={13} />,      key: 'fontBold'      as const, label: 'Bold' },
            { icon: <Italic size={13} />,    key: 'fontItalic'    as const, label: 'Italic' },
            { icon: <Underline size={13} />, key: 'fontUnderline' as const, label: 'Underline' },
          ].map(({ icon, key, label }) => (
            <button
              key={key}
              title={label}
              onClick={() => onPatch({ [key]: !block[key] })}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                block[key]
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
              )}
            >
              {icon}
            </button>
          ))}
        </div>
      </div>

      {/* Alignment */}
      <div>
        <SectionLabel>Alignment</SectionLabel>
        <div className="flex gap-2">
          {[
            { icon: <AlignLeft size={13} />,   value: 'left'   as const },
            { icon: <AlignCenter size={13} />, value: 'center' as const },
            { icon: <AlignRight size={13} />,  value: 'right'  as const },
          ].map(({ icon, value }) => (
            <button
              key={value}
              onClick={() => onPatch({ textAlign: value })}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                (block.textAlign ?? 'left') === value
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
          <span className="text-[11px] text-gray-500">{(block.lineHeight ?? 1.6).toFixed(1)}</span>
        </div>
        <input
          type="range" min={1} max={3} step={0.1}
          value={block.lineHeight ?? 1.6}
          onChange={(e) => onPatch({ lineHeight: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Letter spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Letter Spacing</SectionLabel>
          <span className="text-[11px] text-gray-500">{block.letterSpacing ?? 0}px</span>
        </div>
        <input
          type="range" min={-2} max={10} step={0.5}
          value={block.letterSpacing ?? 0}
          onChange={(e) => onPatch({ letterSpacing: Number(e.target.value) })}
          className="w-full accent-blue-500"
        />
      </div>
    </div>
  )
}

// ─── Tab: Button ───────────────────────────────────────────────────────────────

function PositionIcon({ align, active }: { align: 'left' | 'center' | 'right'; active: boolean }) {
  const accent = active ? '#3B82F6' : '#9CA3AF'
  const muted  = active ? '#BFDBFE' : '#E5E7EB'
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none">
      {align === 'left'   && <><rect x="0" y="3" width="13" height="10" rx="2" fill={accent} /><rect x="15" y="6" width="9" height="4" rx="1" fill={muted} /></>}
      {align === 'center' && <rect x="4" y="3" width="16" height="10" rx="2" fill={accent} />}
      {align === 'right'  && <><rect x="0" y="6" width="9" height="4" rx="1" fill={muted} /><rect x="11" y="3" width="13" height="10" rx="2" fill={accent} /></>}
    </svg>
  )
}

function ButtonTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const selectedVariant  = block.buttonShapeVariant  ?? 0
  const fillColor        = block.buttonFillColor      ?? '#1F2937'
  const borderColor      = block.buttonBorderColor    ?? '#1F2937'
  const position         = block.buttonPosition       ?? 'center'
  const buttonFontFamily = block.buttonFontFamily     ?? block.fontFamily ?? 'Arial'

  return (
    <div className="flex-1 overflow-auto">
      {/* Saved styles */}
      <div className="border-b border-gray-100 px-4 py-4">
        <p className="text-[13px] font-semibold text-gray-800">Saved styles</p>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-400">
          Save your button settings as a style you can easily reuse
        </p>
        <button className="w-full rounded-xl border border-gray-200 py-2.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50">
          Save this button style
        </button>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Font Family — independent from text font */}
        <div>
          <SectionLabel>Font Family</SectionLabel>
          <select
            value={ALL_KNOWN_FONTS.has(buttonFontFamily) ? buttonFontFamily : (block.fontFamily ?? 'Arial')}
            onChange={(e) => onPatch({ buttonFontFamily: e.target.value })}
            className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
          >
            <optgroup label="System Fonts">
              {SYSTEM_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
            <optgroup label="Google Fonts">
              {GOOGLE_FONT_FAMILIES.map((f) => <option key={f} value={f}>{f}</option>)}
            </optgroup>
          </select>
        </div>

        {/* Shape variants — 4 × 2 grid */}
        <div>
          <SectionLabel>Style</SectionLabel>
          <div className="grid grid-cols-4 gap-2">
            {BUTTON_SHAPES.map((v) => (
              <button
                key={v.id}
                onClick={() => onPatch({ buttonShapeVariant: v.id })}
                title={`Style ${v.id + 1}`}
                style={{ borderRadius: v.radius }}
                className={cn(
                  'h-9 w-full border transition-all',
                  v.filled ? 'bg-gray-200 border-gray-200' : 'bg-white border-gray-300',
                  selectedVariant === v.id
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : 'hover:ring-1 hover:ring-gray-400',
                )}
              />
            ))}
          </div>
        </div>

        {/* Colors — each on its own row so the palette dropdown has full width */}
        <div className="space-y-4">
          <ColorSwatch label="Fill color"   value={fillColor}   onChange={(v) => onPatch({ buttonFillColor: v })} />
          <ColorSwatch label="Border color" value={borderColor} onChange={(v) => onPatch({ buttonBorderColor: v })} />
        </div>

        {/* Position */}
        <div>
          <SectionLabel>Position</SectionLabel>
          <div className="flex gap-2">
            {(['left', 'center', 'right'] as const).map((align) => (
              <button
                key={align}
                onClick={() => onPatch({ buttonPosition: align })}
                className={cn(
                  'flex h-10 flex-1 items-center justify-center rounded-xl border transition-colors',
                  position === align
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <PositionIcon align={align} active={position === align} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Border & sizing accordion */}
      <Accordion title="Border and sizing">
        <div className="space-y-3">
          {[
            { label: 'Border Width', key: 'buttonBorderWidth' as const, min: 0, max: 10,  unit: 'px', def: 1   },
            { label: 'Button Width', key: 'buttonWidth'       as const, min: 60, max: 500, unit: 'px', def: 160 },
            { label: 'Button Height',key: 'buttonHeight'      as const, min: 28, max: 120, unit: 'px', def: 44  },
          ].map(({ label, key, min, max, unit, def }) => (
            <div key={key}>
              <label className="mb-1.5 block text-[10px] font-medium text-gray-500">{label}</label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                <input
                  type="number"
                  min={min}
                  max={max}
                  value={(block[key] as number | undefined) ?? def}
                  onChange={(e) => onPatch({ [key]: Number(e.target.value) })}
                  className="w-full text-[12px] text-gray-700 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </Accordion>
    </div>
  )
}

// ─── Tab: Image ────────────────────────────────────────────────────────────────

function ImageTab({
  block, onPatch, onImageUpload,
}: {
  block: CanvasBlock
  onPatch: (p: Partial<CanvasBlock>) => void
  onImageUpload: (src: string) => void
}) {
  const selectedShape = block.imageShape ?? 'circle'

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onImageUpload(reader.result)
        }
      }
      reader.readAsDataURL(file)
      // Reset the input so the same file can be re-selected
      e.target.value = ''
    },
    [onImageUpload],
  )

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-4 space-y-5">
        {/* Shape grid */}
        <div>
          <SectionLabel>Shape</SectionLabel>
          <div className="grid grid-cols-6 gap-1.5">
            {IMAGE_SHAPES.map((shape) => (
              <button
                key={shape.id}
                onClick={() => onPatch({ imageShape: shape.id })}
                title={shape.id ?? ''}
                className={cn(
                  'flex h-9 items-center justify-center rounded-lg border transition-all',
                  selectedShape === shape.id
                    ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-400 ring-offset-1'
                    : 'border-gray-200 hover:border-gray-300',
                )}
              >
                <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
                  <path d={shape.path} fill={selectedShape === shape.id ? '#3B82F6' : '#D1D5DB'} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div>
          <SectionLabel>Add image from…</SectionLabel>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 px-4 py-2.5 text-[12px] text-gray-700">
            My computer
            <ChevronDown size={13} className="text-gray-400" />
          </div>
          {/* Hidden file input — label acts as the clickable upload area */}
          <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 text-[12px] text-gray-400 transition-colors hover:border-blue-300 hover:text-blue-500">
            <Upload size={15} />
            Upload image
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              className="sr-only"
              onChange={handleFileChange}
            />
          </label>
          <p className="mt-2 text-center text-[10px] text-gray-400">Max image size 10MB</p>
        </div>
      </div>

      <Accordion title="Overlay effects">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Overlay colour</label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
              <input type="color" defaultValue="#000000" className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0" />
              <span className="flex-1 text-[12px] text-gray-600">#000000</span>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-medium text-gray-500">Opacity</label>
              <span className="text-[10px] text-gray-400">0%</span>
            </div>
            <input type="range" min={0} max={100} defaultValue={0} className="w-full accent-blue-500" />
          </div>
        </div>
      </Accordion>

      <Accordion title="Accessibility">
        <div>
          <label className="mb-1.5 block text-[10px] font-medium text-gray-500">Alt text</label>
          <input
            type="text"
            placeholder="Describe the image…"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
          />
          <p className="mt-1 text-[9px] text-gray-400">Shown when the image cannot load</p>
        </div>
      </Accordion>
    </div>
  )
}

// ─── Tab: Link ─────────────────────────────────────────────────────────────────

function LinkTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const [showActions, setShowActions] = useState(false)
  const linkType = block.linkType ?? 'url'

  return (
    <div className="flex-1 overflow-auto px-4 py-4">
      {/* Sub-tabs */}
      <div className="mb-4 flex rounded-xl bg-gray-100 p-0.5">
        {(['url', 'file', 'checkout'] as const).map((t) => (
          <button
            key={t}
            onClick={() => onPatch({ linkType: t })}
            className={cn(
              'flex-1 rounded-lg py-1.5 text-[11px] font-medium capitalize transition-colors',
              linkType === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t === 'url' ? 'URL' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* URL input */}
      {linkType === 'url' && (
        <textarea
          value={block.linkUrl ?? ''}
          onChange={(e) => onPatch({ linkUrl: e.target.value })}
          placeholder="https://"
          rows={5}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      )}

      {linkType === 'file' && (
        <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-8 text-[12px] text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
          <Upload size={15} />
          Upload a file
        </button>
      )}

      {linkType === 'checkout' && (
        <div className="rounded-xl border border-gray-200 px-4 py-4 text-[12px] text-gray-400">
          Connect a checkout page
        </div>
      )}

      {/* Link actions */}
      <div className="mt-5">
        <p className="text-[13px] font-semibold text-gray-800">Link actions</p>
        <p className="mt-0.5 mb-3 text-[11px] text-gray-400">When a subscriber clicks this link:</p>

        <div className="relative">
          <button
            onClick={() => setShowActions((o) => !o)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-[12px] text-gray-500 transition-colors hover:border-gray-300"
          >
            <span>{block.linkAction ?? 'Choose action'}</span>
            <ChevronDown size={13} className={cn('text-gray-400 transition-transform', showActions && 'rotate-180')} />
          </button>

          {showActions && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
              {LINK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => { onPatch({ linkAction: action }); setShowActions(false) }}
                  className="w-full px-4 py-2.5 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-50"
                >
                  {action}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main: EmailRightNav ──────────────────────────────────────────────────────

export interface EmailRightNavProps {
  block: CanvasBlock
  onPatch: (id: string, patch: Partial<CanvasBlock>) => void
  onOpenImagePicker: (blockId: string, imageKey: string) => void
  /** Called when the user uploads an image directly from their computer via the Image tab */
  onImageUpload: (blockId: string, imageKey: string, src: string) => void
  onBack: () => void
  /**
   * Imperative tab-focus signal from the canvas.
   * `seq` increments on every click so the effect always fires, even if
   * the same tab is requested twice in a row.
   */
  focusTab?: { tab: string; seq: number }
}

export function EmailRightNav({ block, onPatch, onOpenImagePicker, onImageUpload, onBack, focusTab }: EmailRightNavProps) {
  const tabs = getTabsForBlock(block.type)
  const [activeTab, setActiveTab] = useState<RightTab>(tabs[0].id)

  const patch = useCallback(
    (p: Partial<CanvasBlock>) => onPatch(block.id, p),
    [block.id, onPatch],
  )

  // Switch to the tab requested by a canvas click (text → font, button → button)
  useEffect(() => {
    if (!focusTab?.tab) return
    const found = tabs.find((t) => t.id === focusTab.tab)
    if (found) setActiveTab(found.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTab?.seq])

  // If block type changes (e.g. user selects different block), resolve tab
  const resolvedTab = tabs.some((t) => t.id === activeTab) ? activeTab : tabs[0].id

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 items-center border-b border-gray-100 px-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px',
              resolvedTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-700',
            )}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={onBack}
          className="ml-auto px-3 text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
          title="Deselect block"
        >
          ✕
        </button>
      </div>

      {/* Tab content */}
      {resolvedTab === 'block'  && <BlockTab  block={block} onPatch={patch} />}
      {resolvedTab === 'font'   && <FontTab   block={block} onPatch={patch} />}
      {resolvedTab === 'button' && <ButtonTab block={block} onPatch={patch} />}
      {resolvedTab === 'image'  && (
        <ImageTab
          block={block}
          onPatch={patch}
          onImageUpload={(src) => {
            // testimonial uses 'avatar' key; recipe-card uses 'main'
            const imageKey = block.type === 'testimonial' ? 'avatar' : 'main'
            onImageUpload(block.id, imageKey, src)
          }}
        />
      )}
      {resolvedTab === 'link'   && <LinkTab   block={block} onPatch={patch} />}
    </div>
  )
}
