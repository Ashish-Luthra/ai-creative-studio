'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown, Upload,
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CanvasBlock } from './EmailEditorPanel'

// ─── Tab routing ──────────────────────────────────────────────────────────────

type RightTab = 'block' | 'font' | 'button' | 'image' | 'link'

// Only blocks where the image has a distinct shape (circle/arch/etc.) get the Image tab.
// Full-bleed blocks (image-left-text-right, text-over-image, text-left-image-right,
// image-top-text-bottom) intentionally fall through to the default [Block, Link] tab set.
const IMAGE_BLOCK_TYPES = new Set(['testimonial', 'recipe-card'])

function getTabsForBlock(blockType: string): { id: RightTab; label: string }[] {
  if (blockType === 'button')          return [{ id: 'button', label: 'Button' }, { id: 'font', label: 'Font' }, { id: 'link', label: 'Link' }, { id: 'block', label: 'Block' }]
  if (blockType === 'text')            return [{ id: 'font', label: 'Font' }, { id: 'link', label: 'Link' }, { id: 'block', label: 'Block' }]
  if (IMAGE_BLOCK_TYPES.has(blockType)) return [{ id: 'image', label: 'Image' }, { id: 'link', label: 'Link' }, { id: 'block', label: 'Block' }]
  return [{ id: 'block', label: 'Block' }, { id: 'link', label: 'Link' }]
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

const FONT_OPTIONS = ['Arial', 'Georgia', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Verdana', 'Times New Roman']

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

function ColorSwatch({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-[11px] font-medium text-gray-700">{label}</p>
      <label className="relative flex h-11 w-11 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-gray-200 shadow-sm">
        <div className="absolute inset-0 rounded-full" style={{ backgroundColor: value }} />
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
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

// ─── Tab: Block ────────────────────────────────────────────────────────────────

function BlockTab({ block, onPatch }: { block: CanvasBlock; onPatch: (p: Partial<CanvasBlock>) => void }) {
  const bg  = block.backgroundColor ?? '#ffffff'
  const pad = block.padding ?? { top: 0, right: 0, bottom: 0, left: 0 }

  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-5">
      {/* Background */}
      <div>
        <SectionLabel>Background</SectionLabel>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5">
          <label className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-gray-200">
            <div className="absolute inset-0 rounded-full" style={{ backgroundColor: bg }} />
            <input
              type="color"
              value={bg}
              onChange={(e) => onPatch({ backgroundColor: e.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
          <input
            type="text"
            value={bg}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onPatch({ backgroundColor: e.target.value })
            }}
            maxLength={7}
            className="flex-1 text-[12px] text-gray-600 focus:outline-none"
          />
          {bg !== '#ffffff' && (
            <button
              onClick={() => onPatch({ backgroundColor: '#ffffff' })}
              className="shrink-0 text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
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
  return (
    <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
      {/* Family */}
      <div>
        <SectionLabel>Font Family</SectionLabel>
        <select
          value={block.fontFamily ?? 'Arial'}
          onChange={(e) => onPatch({ fontFamily: e.target.value })}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          {FONT_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Size + Color */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
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
        <ColorSwatch
          label="Color"
          value={block.fontColor ?? '#111827'}
          onChange={(v) => onPatch({ fontColor: v })}
        />
      </div>

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
  const selectedVariant = block.buttonShapeVariant ?? 0
  const fillColor   = block.buttonFillColor   ?? '#1F2937'
  const borderColor = block.buttonBorderColor ?? '#1F2937'
  const position    = block.buttonPosition    ?? 'center'

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

        {/* Colors */}
        <div className="flex gap-8">
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
}

export function EmailRightNav({ block, onPatch, onOpenImagePicker, onImageUpload, onBack }: EmailRightNavProps) {
  const tabs = getTabsForBlock(block.type)
  const [activeTab, setActiveTab] = useState<RightTab>(tabs[0].id)

  const patch = useCallback(
    (p: Partial<CanvasBlock>) => onPatch(block.id, p),
    [block.id, onPatch],
  )

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
