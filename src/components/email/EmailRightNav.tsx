'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronDown, Upload,
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  Plus, Trash2, X as XIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasBlock } from './EmailEditorPanel'
import { GOOGLE_FONT_FAMILIES } from '@/lib/canvas/googleFonts'
import { AlertTriangle } from 'lucide-react'

// ─── Tab routing ──────────────────────────────────────────────────────────────

type RightTab = 'block' | 'font' | 'button' | 'image' | 'link' | 'icons' | 'links'

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
  // Social — Icons styling, Links management, Block (bg + padding)
  if (blockType === 'social') return [
    { id: 'icons' as RightTab, label: 'Icons' },
    { id: 'links' as RightTab, label: 'Links' },
    K,
  ]

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

// ─── Social platforms list ────────────────────────────────────────────────────

type SocialPlatform = { key: string; name: string; icon: React.ReactNode }

const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { key: 'instagram', name: 'Instagram', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg> },
  { key: 'facebook',  name: 'Facebook',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.931-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg> },
  { key: 'pinterest', name: 'Pinterest', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg> },
  { key: 'youtube',   name: 'YouTube',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg> },
  { key: 'linkedin',  name: 'LinkedIn',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { key: 'tiktok',   name: 'TikTok',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg> },
  { key: 'twitter',  name: 'X',         icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> },
  { key: 'bluesky',  name: 'Bluesky',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.689-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg> },
  { key: 'spotify',  name: 'Spotify',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> },
  { key: 'podcast',  name: 'Podcast',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/><line x1="8" x2="16" y1="22" y2="22"/></svg> },
  { key: 'music',    name: 'Music',     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg> },
  { key: 'vimeo',    name: 'Vimeo',     icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197a315.065 315.065 0 0 0 3.501-3.12C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.637 2.473.06 3.628 1.664 3.48 4.807z"/></svg> },
  { key: 'patreon',  name: 'Patreon',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M14.82 2.41c3.96 0 7.18 3.24 7.18 7.21 0 3.96-3.22 7.18-7.18 7.18-3.97 0-7.21-3.22-7.21-7.18 0-3.97 3.24-7.21 7.21-7.21M2 21.6h3.5V2.41H2V21.6z"/></svg> },
  { key: 'telegram', name: 'Telegram',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> },
  { key: 'tumblr',   name: 'Tumblr',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.228 2.371h.08c.682-.02 1.646-.298 2.messenger.582l1.34 3.24c-.733.395-2.158.981-4.56 1.02z"/></svg> },
  { key: 'flickr',   name: 'Flickr',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M0 12c0 3.074 2.494 5.564 5.565 5.564 3.075 0 5.569-2.49 5.569-5.564S8.64 6.436 5.565 6.436C2.495 6.436 0 8.926 0 12zm12.866 0c0 3.074 2.493 5.564 5.567 5.564C21.496 17.564 24 15.074 24 12s-2.504-5.564-5.567-5.564c-3.074 0-5.567 2.49-5.567 5.564z"/></svg> },
  { key: 'bookbub',  name: 'BookBub',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><text x="3" y="18" fontSize="16" fontWeight="700" fontFamily="serif">BB</text></svg> },
  { key: 'behance',  name: 'Behance',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M22 7h-7V5h7v2zm1.726 10c-.442 1.297-2.029 3-5.101 3-3.074 0-5.564-1.729-5.564-5.675 0-3.91 2.325-5.92 5.466-5.92 3.082 0 4.964 1.782 5.375 4.426.078.506.109 1.188.095 2.14H15.97c.13 3.211 3.483 3.312 4.588 2.029H23.726zm-7.726-3h3.578c-.117-1.715-1.208-2.124-1.84-2.124-.744 0-1.604.469-1.738 2.124zM8.49 10.655c1.928 0 2.274 1.054 2.274 1.801 0 .706-.457 1.479-1.604 1.633v.037C10.478 14.27 11 15.098 11 16.256c0 1.972-1.624 2.916-3.599 2.916H3V7h4.07c2.147 0 3.49 1.082 3.49 2.745 0 .9-.379 1.57-.975 1.932l-.095.978zM5.5 9.5v1.737h1.617c.67 0 1.161-.34 1.161-.868C8.278 9.846 7.808 9.5 7.117 9.5H5.5zm0 5.5v2h1.999c.731 0 1.376-.374 1.376-1.002 0-.626-.645-1-1.376-1H5.5z"/></svg> },
  { key: 'discord',  name: 'Discord',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg> },
  { key: 'medium',   name: 'Medium',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z"/></svg> },
  { key: 'steam',    name: 'Steam',     icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.455 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z"/></svg> },
  { key: 'github',   name: 'GitHub',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg> },
  { key: 'dribbble', name: 'Dribbble',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.017-8.04 6.39 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.814zm-11.62-2.logout.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.838zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.825 0-1.63.1-2.4.285zm10.335 3.483c-.218.29-1.935 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z"/></svg> },
  { key: 'amazon',   name: 'Amazon',    icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M.045 18.02c.072-.116.187-.124.348-.022 3.636 2.11 7.594 3.166 11.87 3.166 2.852 0 5.668-.533 8.447-1.595l.315-.14c.138-.06.234-.1.293-.13.226-.088.39-.046.5.13.107.173.083.35-.07.55-.645.85-1.427 1.565-2.35 2.14-2.293 1.41-4.975 2.113-8.054 2.113-3.306 0-6.317-.839-9.035-2.512-.54-.335-1.023-.725-1.449-1.168-.175-.192-.22-.377-.125-.55l.31-.48zm21.92-3.08c-.144-.198-.41-.24-.804-.14-.263.07-.483.132-.65.18l-.356.102c-.27.072-.553.138-.847.2a18.13 18.13 0 0 1-3.57.36c-2.195 0-4.075-.43-5.643-1.29-1.582-.862-2.758-1.887-3.525-3.078l-.192-.29c-.07-.113-.134-.2-.196-.264-.215-.225-.438-.27-.67-.133-.24.137-.308.34-.21.606.08.22.23.49.448.805 1.247 1.76 2.85 3.08 4.81 3.963 1.964.882 4.085 1.323 6.362 1.323 2.57 0 4.94-.618 7.104-1.857.166-.098.326-.205.475-.32.264-.197.36-.417.29-.662zM14.29 8.64c-.46-.015-.785.13-.975.44-.196.32-.16.66.112.906l.104.095c.34.27.728.405 1.164.41.547 0 .987-.22 1.32-.66.095-.13.162-.284.21-.465.108-.39.016-.713-.27-.97-.218-.2-.503-.296-.855-.286-.028.002-.054.003-.07.004l-.004-.002c.025-.002.05-.003.076-.005l-.001.002c-.33.01-.638-.018-.87-.048a7.2 7.2 0 0 1-.01-.002c.002 0 .004.002.007.003l-.006-.003z"/><path d="M14.483 5.56c-.77 0-1.35.196-1.734.59l-.078.088.015.13c.03.31.16.52.39.635.228.112.462.09.703-.065.24-.155.44-.28.603-.375.31-.18.632-.27.96-.27.343 0 .604.096.777.29.174.19.26.468.26.83 0 .47-.094.847-.284 1.133-.19.286-.464.428-.826.428-.27 0-.508-.07-.71-.208-.204-.138-.37-.32-.5-.548-.128-.226-.215-.473-.265-.74l-.023-.115-.102-.077a.68.68 0 0 0-.362-.128h-.02c-.24 0-.445.105-.618.317-.17.21-.256.452-.256.726v.04c0 .3.087.574.262.82.174.247.408.435.7.566.296.13.618.196.968.196.5 0 .93-.1 1.29-.3a2.14 2.14 0 0 0 .855-.854c.2-.368.3-.797.3-1.287 0-.742-.203-1.32-.61-1.74-.407-.42-.985-.63-1.734-.63l-.003.001z"/></svg> },
  { key: 'goodreads',name: 'Goodreads', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M11.43 23.995c-3.608-.208-6.274-2.077-6.448-5.648h2.124c.29 2.027 2.004 3.398 4.57 3.507 3.375.14 5.156-1.902 5.156-5.33v-1.99h-.075c-.841 1.808-2.64 2.958-4.99 2.958-4.07 0-6.863-3.107-6.863-7.744 0-4.744 2.85-7.98 7-7.98 2.297 0 4.148 1.104 5.02 2.976h.075V.49h2.04v15.868c0 4.996-2.95 7.637-7.609 7.637zm.182-9.48c2.976 0 4.894-2.404 4.894-6.008 0-3.65-1.93-6.082-4.894-6.082-2.976 0-4.795 2.423-4.795 6.082 0 3.615 1.819 6.008 4.795 6.008z"/></svg> },
  { key: 'houzz',    name: 'Houzz',     icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M 11.969 0 L 0 7.0078 L 0 24 L 9.0508 24 L 9.0508 15.008 L 14.934 15.008 L 14.934 24 L 23.984 24 L 23.984 7.0234 Z"/></svg> },
  { key: 'threads',  name: 'Threads',   icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.868 1.205 8.617.024 12.197 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.371-.887h-.018c-.934 0-1.686.317-2.302 1.088L8.92 8.492c.81-1.051 2.019-1.606 3.496-1.606h.028c2.97.016 4.741 1.895 4.762 5.202l.004.067-.053.009c.816.345 1.489.834 2 1.447 1.058 1.274 1.313 2.945 1.096 4.462-.288 2.042-1.286 3.759-2.818 4.978-1.535 1.22-3.509 1.939-5.92 1.949h-.009zM13.196 12.54a12.47 12.47 0 0 0-2.724.124c-1.83.316-2.833 1.217-2.773 2.482.08 1.633 1.445 2.328 2.806 2.252 1.256-.069 2.134-.543 2.677-1.413.509-.815.73-1.972.82-3.373a7.085 7.085 0 0 0-.806-.072z"/></svg> },
  { key: 'etsy',     name: 'Etsy',      icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M10.049 0c-.174 0-.35.032-.505.093L1.39 3.136C.566 3.445 0 4.232 0 5.087v13.826c0 .855.566 1.641 1.39 1.951l8.154 3.043c.155.061.331.093.505.093.174 0 .35-.032.505-.093l8.154-3.043c.824-.31 1.39-1.096 1.39-1.951V5.087c0-.855-.566-1.641-1.39-1.951L10.554.093A1.324 1.324 0 0 0 10.049 0zm.003 2.194l5.997 2.24v15.133l-5.997 2.24-5.997-2.24V4.434l5.997-2.24zM7.08 6.857v.002c-.403 0-.73.326-.73.729v9.824c0 .403.327.73.73.73h5.907c.403 0 .73-.327.73-.73v-1.09h-1.09v.36h-4.82V7.587h4.82v.36h1.09v-1.09c0-.403-.327-.73-.73-.73H7.08zm3.02 2.18v1.092h2.363v1.09H10.1v2.184H8.988V9.037h3.455V9.037H10.1z"/></svg> },
  { key: 'flipboard',name: 'Flipboard', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M.557 0v24H12.43v-7.716h4.559V7.714H12.43V0zm11.871 11.666H7.87V7.715h4.558z"/></svg> },
  { key: 'substack', name: 'Substack',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z"/></svg> },
  { key: 'website',  name: 'Website',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
  { key: 'linktree', name: 'Linktree',  icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M13.511 5.853l4.005-4.117 2.394 2.393-4.2 4.2h5.784v3.348h-5.765l4.201 4.201-2.394 2.393-5.54-5.634-5.54 5.634-2.394-2.393 4.201-4.2H2.505V8.329h5.784l-4.2-4.2 2.393-2.393 4.005 4.117V0h3.024v5.853zM10.508 24v-8.82h3.024V24h-3.024z"/></svg> },
  { key: 'squarespace', name: 'Squarespace', icon: <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5"><path d="M19.304 5.454a3.637 3.637 0 0 0-5.146 0L5.454 14.16a3.639 3.639 0 0 0 5.146 5.147l8.704-8.706a3.639 3.639 0 0 0 0-5.147zm-1.214 3.932L9.386 18.09a1.82 1.82 0 0 1-2.574-2.573l3.35-3.35 2.476 2.476 1.215-1.215-2.476-2.475 2.265-2.266a1.818 1.818 0 0 1 2.573 0c.71.71.71 1.864 0 2.574l-.125.125zm-9.918 9.918a3.64 3.64 0 0 1-5.147-5.147l1.214-1.215 2.573 2.573-1.215 1.215 2.574 2.574zm11.346-11.346L17.303 9.17l-2.573-2.573 2.215-2.215a1.82 1.82 0 0 1 2.573 2.573z"/></svg> },
]

// ─── Social: Icons tab ────────────────────────────────────────────────────────

function SocialIconsTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const iconStyle    = block.socialIconStyle    ?? 'outline'
  const iconColor    = block.socialIconColor    ?? '#1F2937'
  const iconSize     = block.socialIconSize     ?? 'M'
  const iconPosition = block.socialIconPosition ?? 'center'
  const iconSpacing  = block.socialIconSpacing  ?? 12

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
      {/* Style — outline / filled */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="flex gap-2">
          {(['outline', 'filled'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onPatch({ socialIconStyle: id })}
              className={cn(
                'flex-1 rounded-xl border py-2 text-[11px] font-medium transition-colors',
                iconStyle === id
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Color */}
      <ColorSwatch
        label="Color"
        value={iconColor}
        onChange={(v) => onPatch({ socialIconColor: v })}
      />

      {/* Size — S / M / L */}
      <div>
        <SectionLabel>Size</SectionLabel>
        <div className="flex gap-2">
          {([
            { id: 'S', hint: '32px' },
            { id: 'M', hint: '40px' },
            { id: 'L', hint: '48px' },
          ] as const).map(({ id, hint }) => (
            <button
              key={id}
              type="button"
              onClick={() => onPatch({ socialIconSize: id })}
              title={hint}
              className={cn(
                'flex-1 rounded-xl border py-2 text-[11px] font-medium transition-colors',
                iconSize === id
                  ? 'border-blue-400 bg-blue-50 text-blue-600'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
              )}
            >
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Position — left / center / right */}
      <div>
        <SectionLabel>Position</SectionLabel>
        <div className="flex gap-2">
          {(['left', 'center', 'right'] as const).map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => onPatch({ socialIconPosition: align })}
              className={cn(
                'flex h-10 flex-1 items-center justify-center rounded-xl border transition-colors',
                iconPosition === align
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <PositionIcon align={align} active={iconPosition === align} />
            </button>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Space between icons</SectionLabel>
          <span className="text-[11px] text-gray-500">{iconSpacing}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPatch({ socialIconSpacing: Math.max(4, iconSpacing - 2) })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            −
          </button>
          <input
            type="range"
            min={4}
            max={32}
            step={2}
            value={iconSpacing}
            onChange={(e) => onPatch({ socialIconSpacing: Number(e.target.value) })}
            className="flex-1 accent-gray-800"
          />
          <button
            type="button"
            onClick={() => onPatch({ socialIconSpacing: Math.min(32, iconSpacing + 2) })}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Social: Links tab ────────────────────────────────────────────────────────

function SocialLinksSection({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const [showModal, setShowModal] = useState(false)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [urlInput, setUrlInput] = useState('')

  const socialLinks = block.socialLinks ?? {}
  const linkedPlatforms = SOCIAL_PLATFORMS.filter((p) => socialLinks[p.key])

  function openPlatform(key: string) {
    setEditKey(key)
    setUrlInput(socialLinks[key] ?? '')
  }

  function savePlatformUrl() {
    if (!editKey) return
    const next = { ...socialLinks }
    if (urlInput.trim()) {
      next[editKey] = urlInput.trim()
    } else {
      delete next[editKey]
    }
    onPatch({ socialLinks: next })
    setEditKey(null)
  }

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
      {/* Status */}
      {linkedPlatforms.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-center">
          <p className="text-[13px] font-semibold text-gray-800">Your social icons aren&apos;t linked</p>
          <p className="mt-1 text-[11px] text-gray-400">Add your social media links by clicking below:</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <SectionLabel>Linked accounts</SectionLabel>
          {linkedPlatforms.map((p) => (
            <div key={p.key} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-500">{p.icon}</span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-gray-600">{socialLinks[p.key]}</span>
              <button
                type="button"
                onClick={() => openPlatform(p.key)}
                className="shrink-0 text-[10px] text-blue-500 hover:text-blue-700 transition-colors"
              >
                Edit
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Manage button */}
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="w-full rounded-xl border border-gray-200 bg-white py-2.5 text-[12px] font-semibold text-gray-700 transition-colors hover:bg-gray-50"
      >
        Manage social links
      </button>

      {/* ── Modal: Platform grid ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-[16px] font-bold text-gray-900">Social links</p>
                <p className="mt-0.5 text-[11px] text-gray-400">Icons in your emails will automatically link to these URLs</p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              >
                <XIcon size={15} />
              </button>
            </div>

            {/* Platform grid — 5 columns */}
            <div className="max-h-[60vh] overflow-auto px-6 py-4">
              <div className="grid grid-cols-5 gap-3">
                {SOCIAL_PLATFORMS.map((p) => {
                  const isLinked = !!socialLinks[p.key]
                  return (
                    <button
                      key={p.key}
                      type="button"
                      title={p.name}
                      onClick={() => { setShowModal(false); openPlatform(p.key) }}
                      className={cn(
                        'flex h-12 w-12 flex-col items-center justify-center rounded-full border-2 transition-all',
                        isLinked
                          ? 'border-blue-400 bg-blue-50 text-blue-600 ring-2 ring-blue-200'
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-400 hover:bg-gray-100',
                      )}
                    >
                      {p.icon}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: URL input for a single platform ── */}
      {editKey && (() => {
        const platform = SOCIAL_PLATFORMS.find((p) => p.key === editKey)!
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
            <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4">
                <p className="text-[18px] font-bold text-gray-900">{platform.name} link</p>
                <button
                  type="button"
                  onClick={() => setEditKey(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <XIcon size={15} />
                </button>
              </div>

              {/* URL input */}
              <div className="px-6 pb-6">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') savePlatformUrl() }}
                  placeholder="https://..."
                  autoFocus
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-[13px] text-gray-800 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
                />

                {/* Actions */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  {socialLinks[editKey] && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = { ...socialLinks }
                        delete next[editKey]
                        onPatch({ socialLinks: next })
                        setEditKey(null)
                      }}
                      className="text-[11px] text-red-400 hover:text-red-600 transition-colors"
                    >
                      Remove link
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => setEditKey(null)}
                      className="rounded-xl border border-gray-200 px-5 py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={savePlatformUrl}
                      disabled={!urlInput.trim()}
                      className={cn(
                        'rounded-xl px-5 py-2 text-[12px] font-semibold transition-colors',
                        urlInput.trim()
                          ? 'bg-gray-900 text-white hover:bg-gray-700'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                      )}
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
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

function FontTab({
  block,
  onPatch,
  activeTextKey,
}: {
  block: CanvasBlock
  onPatch: (p: Partial<CanvasBlock>) => void
  activeTextKey?: string
}) {
  // When a text field is focused, read/write its per-field style override.
  // Otherwise fall back to block-level font properties.
  const fieldStyle = activeTextKey ? (block.textStyles?.[activeTextKey] ?? {}) : null

  const patchField = (updates: NonNullable<CanvasBlock['textStyles']>[string]) => {
    if (!activeTextKey) return
    onPatch({
      textStyles: {
        ...(block.textStyles ?? {}),
        [activeTextKey]: { ...(block.textStyles?.[activeTextKey] ?? {}), ...updates },
      },
    })
  }

  const clearField = () => {
    if (!activeTextKey) return
    const next = { ...(block.textStyles ?? {}) }
    delete next[activeTextKey]
    onPatch({ textStyles: Object.keys(next).length ? next : undefined })
  }

  // Resolved values — field overrides take priority over block defaults
  const currentFont     = (fieldStyle ? fieldStyle.fontFamily  : block.fontFamily)  ?? 'Arial'
  const currentSize     = (fieldStyle ? fieldStyle.fontSize     : block.fontSize)    ?? 16
  const currentColor    = (fieldStyle ? fieldStyle.fontColor    : block.fontColor)   ?? '#111827'
  const currentWeight   = (fieldStyle ? fieldStyle.fontWeight   : block.fontWeight)  ?? ((fieldStyle ? fieldStyle.fontBold : block.fontBold) ? 700 : 400)
  const currentBold     = (fieldStyle ? fieldStyle.fontBold     : block.fontBold)    ?? false
  const currentItalic   = (fieldStyle ? fieldStyle.fontItalic   : block.fontItalic)  ?? false
  const currentUnderline = (fieldStyle ? fieldStyle.fontUnderline : block.fontUnderline) ?? false
  const currentAlign    = (fieldStyle ? fieldStyle.textAlign    : block.textAlign)   ?? 'left'
  const currentLH       = (fieldStyle ? fieldStyle.lineHeight   : block.lineHeight)  ?? 1.6
  const currentLS       = (fieldStyle ? fieldStyle.letterSpacing : block.letterSpacing) ?? 0
  const currentCase     = (fieldStyle ? fieldStyle.fontCase     : block.fontCase)    ?? 'none'

  const isUnknownFont   = !!currentFont && !ALL_KNOWN_FONTS.has(currentFont)

  const handleFont    = (v: string)  => fieldStyle !== null ? patchField({ fontFamily: v })    : onPatch({ fontFamily: v })
  const handleSize    = (v: number)  => fieldStyle !== null ? patchField({ fontSize: v })       : onPatch({ fontSize: v })
  const handleColor   = (v: string)  => fieldStyle !== null ? patchField({ fontColor: v })      : onPatch({ fontColor: v })
  const handleWeight  = (v: number)  => fieldStyle !== null ? patchField({ fontWeight: v })          : onPatch({ fontWeight: v })
  const handleBold    = ()           => fieldStyle !== null ? patchField({ fontBold: !currentBold })       : onPatch({ fontBold: !currentBold })
  const handleItalic  = ()           => fieldStyle !== null ? patchField({ fontItalic: !currentItalic })   : onPatch({ fontItalic: !currentItalic })
  const handleUnder   = ()           => fieldStyle !== null ? patchField({ fontUnderline: !currentUnderline }) : onPatch({ fontUnderline: !currentUnderline })
  const handleAlign   = (v: 'left' | 'center' | 'right') => fieldStyle !== null ? patchField({ textAlign: v }) : onPatch({ textAlign: v })
  const handleLH      = (v: number)  => fieldStyle !== null ? patchField({ lineHeight: v })     : onPatch({ lineHeight: v })
  const handleLS      = (v: number)  => fieldStyle !== null ? patchField({ letterSpacing: v })  : onPatch({ letterSpacing: v })
  const handleCase    = (v: 'none' | 'lowercase' | 'uppercase') => fieldStyle !== null ? patchField({ fontCase: v }) : onPatch({ fontCase: v })

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

      {/* ── Active field indicator ───────────────────────────────────────────── */}
      {activeTextKey && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 py-2">
          <span className="text-[11px] font-medium text-blue-700 capitalize">
            Editing: <strong>{activeTextKey.replace(/-/g, ' ')}</strong>
          </span>
          {block.textStyles?.[activeTextKey] && (
            <button
              onClick={clearField}
              className="text-[10px] text-blue-500 hover:text-blue-700 underline transition-colors"
              title="Reset to block style"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* ── Unknown-font warning ─────────────────────────────────────────────── */}
      {isUnknownFont && (
        <div className="flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-amber-700">Font not available in editor</p>
            <p className="mt-0.5 text-[10px] leading-snug text-amber-600">
              <span className="font-mono">&ldquo;{currentFont}&rdquo;</span> isn&apos;t in
              the font list and won&apos;t render correctly in the email.
              Please select a replacement below.
            </p>
          </div>
        </div>
      )}

      {/* Family + Weight */}
      <div>
        <SectionLabel>Font</SectionLabel>
        <div className="flex gap-2">
          <select
            value={ALL_KNOWN_FONTS.has(currentFont) ? currentFont : ''}
            onChange={(e) => handleFont(e.target.value)}
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
            value={currentWeight}
            onChange={(e) => handleWeight(Number(e.target.value))}
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
            value={currentSize}
            onChange={(e) => handleSize(Number(e.target.value))}
            className="w-full text-[12px] text-gray-700 focus:outline-none"
          />
          <span className="text-[10px] text-gray-400">px</span>
        </div>
      </div>

      {/* Font Color */}
      <ColorSwatch label="Font Color" value={currentColor} onChange={handleColor} />

      {/* Style toggles */}
      <div>
        <SectionLabel>Style</SectionLabel>
        <div className="flex gap-2">
          {[
            { icon: <Bold size={13} />,      active: currentBold,      handler: handleBold,   label: 'Bold' },
            { icon: <Italic size={13} />,    active: currentItalic,    handler: handleItalic, label: 'Italic' },
            { icon: <Underline size={13} />, active: currentUnderline, handler: handleUnder,  label: 'Underline' },
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
            { value: 'none',      label: 'aA', title: 'Default' },
            { value: 'lowercase', label: 'aa', title: 'Lowercase' },
            { value: 'uppercase', label: 'AA', title: 'Uppercase' },
          ] as const).map(({ value, label, title }) => (
            <button
              key={value}
              title={title}
              onClick={() => handleCase(value)}
              className={cn(
                'flex h-9 flex-1 items-center justify-center rounded-xl border text-[12px] font-semibold transition-colors',
                currentCase === value
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
            { icon: <AlignLeft size={13} />,   value: 'left'   as const },
            { icon: <AlignCenter size={13} />, value: 'center' as const },
            { icon: <AlignRight size={13} />,  value: 'right'  as const },
          ].map(({ icon, value }) => (
            <button
              key={value}
              onClick={() => handleAlign(value)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                currentAlign === value
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
          <span className="text-[11px] text-gray-500">{currentLH.toFixed(1)}</span>
        </div>
        <input
          type="range" min={1} max={3} step={0.1}
          value={currentLH}
          onChange={(e) => handleLH(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Letter spacing */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>Letter Spacing</SectionLabel>
          <span className="text-[11px] text-gray-500">{currentLS}px</span>
        </div>
        <input
          type="range" min={-2} max={10} step={0.5}
          value={currentLS}
          onChange={(e) => handleLS(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {/* Block-level defaults separator */}
      {activeTextKey && (
        <div className="border-t border-gray-100 pt-3">
          <p className="text-[10px] text-gray-400 text-center">
            Changes above apply to the <strong>{activeTextKey.replace(/-/g, ' ')}</strong> field only.
            Click elsewhere to edit block-level defaults.
          </p>
        </div>
      )}
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
  /** The text field key that currently has focus (e.g. 'heading', 'body') */
  activeTextKey?: string
}

export function EmailRightNav({ block, onPatch, onOpenImagePicker, onImageUpload, onBack, focusTab, activeTextKey }: EmailRightNavProps) {
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
      {resolvedTab === 'icons'  && <SocialIconsTab block={block} onPatch={patch} />}
      {resolvedTab === 'links'  && <SocialLinksSection block={block} onPatch={patch} />}
      {resolvedTab === 'block'  && <BlockTab  block={block} onPatch={patch} />}
      {resolvedTab === 'font'   && <FontTab   block={block} onPatch={patch} activeTextKey={activeTextKey} />}
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
