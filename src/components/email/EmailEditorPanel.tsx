'use client'

import React, { useState, useCallback } from 'react'
import {
  Monitor, Smartphone,
  Type, Plus, X, MousePointer2, ChevronsUpDown,
  Star, Link2, Share2, MapPin, Mail, Layout,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { useEmailStore } from '@/lib/email/emailStore'
import { BlockLibrary } from './BlockLibrary'
import { FloatingActionBar } from './FloatingActionBar'
import { FloatingTextToolbar } from './FloatingTextToolbar'
import { TextEditPanel } from './TextEditPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CanvasBlock {
  id: string
  type: string
  backgroundColor?: string
}

// afterId: null = insert at very top; string = insert after that block id
type InsertState = { afterId: string | null } | null

// ─── Canvas block type palette (structural blocks from left nav) ──────────────

const CANVAS_BLOCK_TYPES = [
  { id: 'logo',     label: 'Logo',     Icon: Star },
  { id: 'link-bar', label: 'Link Bar', Icon: Link2 },
  { id: 'content',  label: 'Content',  Icon: Layout },
  { id: 'text',     label: 'Text',     Icon: Type },
  { id: 'button',   label: 'Button',   Icon: MousePointer2 },
  { id: 'social',   label: 'Social',   Icon: Share2 },
  { id: 'address',  label: 'Address',  Icon: MapPin },
  { id: 'footer',   label: 'Footer',   Icon: Mail },
  { id: 'spacer',   label: 'Spacer',   Icon: ChevronsUpDown },
] as const

// Map all block type ids → display label (structural + prebuilt design blocks)
const BLOCK_LABEL: Record<string, string> = {
  'logo':                  'Logo',
  'link-bar':              'Link Bar',
  'content':               'Content',
  'text':                  'Text',
  'button':                'Button',
  'social':                'Social',
  'address':               'Address',
  'footer':                'Footer',
  'spacer':                'Spacer',
  'image-left-text-right': 'Image Left, Text Right',
  'centered-content':      'Centered Content',
  'text-over-image':       'Text Over Image',
  'text-left-image-right': 'Text Left, Image Right',
  'recipe-card':           'Recipe Card',
  'image-top-text-bottom': 'Image Top, Text Bottom',
  'testimonial':           'Testimonial',
}

// ─── Default canvas (email content flow) ─────────────────────────────────────

function makeDefaultBlocks(): CanvasBlock[] {
  return [
    { id: nanoid(), type: 'logo' },
    { id: nanoid(), type: 'link-bar' },
    { id: nanoid(), type: 'spacer' },
    { id: nanoid(), type: 'footer' },
  ]
}

// ─── Inline Block Inserter ────────────────────────────────────────────────────

function BlockInserter({
  onSelect,
  onClose,
}: {
  onSelect: (type: string) => void
  onClose: () => void
}) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 my-1 mx-auto max-w-[640px] bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
      <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wider mr-1 shrink-0">
        Add block:
      </span>
      <div className="flex items-center gap-1 flex-wrap flex-1">
        {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-blue-200 hover:bg-blue-100 hover:border-blue-400 text-blue-700 text-[10px] font-medium transition-colors shadow-sm"
          >
            <Icon size={9} />
            {label}
          </button>
        ))}
      </div>
      <button
        onClick={onClose}
        className="shrink-0 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-200 transition-colors ml-1"
      >
        <X size={11} />
      </button>
    </div>
  )
}


// ─── Block Properties Panel (Right Nav — shown when a block is selected) ─────

const BG_SWATCHES = [
  '#ffffff','#f9fafb','#f3f4f6','#e5e7eb','#d1d5db',
  '#111827','#1f2937','#374151','#6b7280','#9ca3af',
  '#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#3b82f6',
  '#fdf4ff','#fae8ff','#e9d5ff','#c084fc','#a855f7',
  '#fdf2f8','#fce7f3','#fbcfe8','#f9a8d4','#ec4899',
  '#fff7ed','#ffedd5','#fed7aa','#fb923c','#f97316',
  '#f0fdf4','#dcfce7','#bbf7d0','#86efac','#22c55e',
  '#fefce8','#fef9c3','#fef08a','#fde047','#eab308',
]

interface BlockPropertiesPanelProps {
  block: CanvasBlock
  onColorChange: (id: string, color: string) => void
  onBack: () => void
}

function BlockPropertiesPanel({ block, onColorChange, onBack }: BlockPropertiesPanelProps) {
  const bg = block.backgroundColor ?? '#ffffff'

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Block Style
        </span>
        <button
          onClick={onBack}
          className="text-[11px] text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Blocks
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">

        {/* Selected block badge */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">
            Selected
          </p>
          <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
            {BLOCK_LABEL[block.type] ?? block.type}
          </p>
        </div>

        {/* Background colour */}
        <div>
          <label className="mb-2 block text-[10px] font-medium text-gray-500">
            Background Colour
          </label>

          {/* Native colour input + hex field row */}
          <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
            <input
              type="color"
              value={bg}
              onChange={(e) => onColorChange(block.id, e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={bg}
              onChange={(e) => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                  onColorChange(block.id, e.target.value)
                }
              }}
              maxLength={7}
              className="flex-1 text-[12px] text-gray-600 focus:outline-none"
            />
            {bg !== '#ffffff' && (
              <button
                onClick={() => onColorChange(block.id, '#ffffff')}
                className="shrink-0 rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Swatch grid */}
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {BG_SWATCHES.map((colour) => (
              <button
                key={colour}
                onClick={() => onColorChange(block.id, colour)}
                title={colour}
                className={cn(
                  'h-8 w-full rounded-md border transition-transform hover:scale-105',
                  bg === colour ? 'border-blue-400 ring-2 ring-blue-200' : 'border-gray-200',
                )}
                style={{ backgroundColor: colour }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Shared micro-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[10px] font-medium text-gray-500">{label}</label>
      {children}
    </div>
  )
}

function ColorRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-2 py-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 text-[12px] text-gray-600 focus:outline-none"
        maxLength={7}
      />
    </div>
  )
}

// ─── BlockContent: full-size block renderer (9 structural + 7 prebuilt) ───────

function BlockContent({
  type,
  backgroundColor,
  onTextClick,
}: {
  type: string
  backgroundColor?: string
  onTextClick: (e: React.MouseEvent) => void
}) {
  const editable = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onClick: onTextClick,
    className:
      'outline-none cursor-text border-2 border-transparent hover:border-blue-200 rounded px-1 transition-colors',
  }

  // Inline bg style — overrides Tailwind bg-* classes on the outermost element
  const bg = backgroundColor ? { backgroundColor } : {}

  // ── Structural blocks ──────────────────────────────────────────────────────

  if (type === 'logo') {
    return (
      <div className="flex items-center justify-center bg-white py-6" style={bg}>
        <div className="flex h-14 w-40 items-center justify-center rounded-md border-2 border-dashed border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-widest text-gray-300">
          YOUR LOGO
        </div>
      </div>
    )
  }

  if (type === 'link-bar') {
    return (
      <div className="flex items-center justify-center gap-6 border-b border-gray-100 bg-white px-8 py-3" style={bg}>
        {['Home', 'About', 'Products', 'Contact'].map((link) => (
          <span
            key={link}
            {...editable}
            className={`${editable.className} text-[11px] font-medium tracking-wide text-gray-600 hover:text-gray-900`}
          >
            {link}
          </span>
        ))}
      </div>
    )
  }

  if (type === 'content') {
    return (
      <div className="flex min-h-[160px] items-center justify-center border-2 border-dashed border-gray-200 bg-gray-50 p-8" style={bg}>
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200">
            <Layout size={16} className="text-gray-400" />
          </div>
          <p className="text-[12px] font-medium text-gray-400">Content Block</p>
          <p className="mt-1 text-[10px] text-gray-300">Select a design from the right panel</p>
        </div>
      </div>
    )
  }

  if (type === 'text') {
    return (
      <div className="bg-white px-12 py-8" style={bg}>
        <p
          {...editable}
          className={`${editable.className} text-sm leading-relaxed text-gray-700`}
        >
          Your text content here. Click to edit this paragraph and add your own copy. You can style the text using the formatting toolbar that appears when you click.
        </p>
      </div>
    )
  }

  if (type === 'button') {
    return (
      <div className="flex items-center justify-center bg-white py-8" style={bg}>
        <div
          {...editable}
          className={`${editable.className} bg-gray-900 px-10 py-3 text-sm font-semibold tracking-widest text-white`}
        >
          CLICK HERE
        </div>
      </div>
    )
  }

  if (type === 'social') {
    return (
      <div className="flex items-center justify-center gap-4 bg-white py-6" style={bg}>
        {[
          { label: 'IG', color: '#E1306C' },
          { label: 'FB', color: '#1877F2' },
          { label: 'TW', color: '#1DA1F2' },
          { label: 'PT', color: '#E60023' },
          { label: 'YT', color: '#FF0000' },
        ].map((s) => (
          <div
            key={s.label}
            className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-sm transition-transform hover:scale-110"
            style={{ backgroundColor: s.color }}
          >
            {s.label}
          </div>
        ))}
      </div>
    )
  }

  if (type === 'address') {
    return (
      <div className="bg-white px-12 py-4 text-center" style={bg}>
        <p
          {...editable}
          className={`${editable.className} text-[11px] leading-relaxed text-gray-500`}
        >
          123 Main Street, Suite 100 · City, State 12345 · United States
        </p>
      </div>
    )
  }

  if (type === 'footer') {
    return (
      <div className="bg-gray-50 px-12 py-6 text-center" style={bg}>
        <div className="mb-3 flex items-center justify-center gap-4 text-[11px] text-gray-500">
          {['Privacy Policy', 'Unsubscribe', 'View in Browser', 'Contact Us'].map((link, i, arr) => (
            <React.Fragment key={link}>
              <span className="cursor-pointer hover:text-gray-800 hover:underline">{link}</span>
              {i < arr.length - 1 && <span className="text-gray-300">·</span>}
            </React.Fragment>
          ))}
        </div>
        <p
          {...editable}
          className={`${editable.className} text-[10px] text-gray-400`}
        >
          © 2024 Your Company Name. All rights reserved.
        </p>
      </div>
    )
  }

  if (type === 'spacer') {
    return (
      <div className="flex h-16 items-center justify-center border-y border-dashed border-gray-200 bg-white" style={bg}>
        <span className="text-[9px] font-medium uppercase tracking-widest text-gray-300">
          Spacer
        </span>
      </div>
    )
  }

  // ── Prebuilt design blocks (from right nav) ────────────────────────────────

  if (type === 'image-left-text-right') {
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <div className="w-1/2">
          <img
            src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=500&fit=crop"
            alt="Fashion"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex w-1/2 flex-col items-center justify-center gap-4 p-12">
          <p {...editable} className={`${editable.className} text-sm italic text-gray-500`}>
            From The &apos;Gram
          </p>
          <h2 {...editable} className={`${editable.className} text-center font-serif text-3xl`}>
            The Post That Got Everyone Talking
          </h2>
          <div className="h-px w-16 bg-gray-400" />
          <button className="bg-gray-200 px-6 py-2 text-xs">SEE IT</button>
        </div>
      </div>
    )
  }

  if (type === 'centered-content') {
    return (
      <div className="bg-gray-100 p-12 text-center" style={bg}>
        <div className="inline-block rounded bg-white p-8 shadow-sm">
          <div {...editable} className={`${editable.className} font-serif text-5xl text-gray-600`}>
            6
          </div>
          <h3 {...editable} className={`${editable.className} mt-2 font-serif text-2xl`}>
            Tips to Photograph Food
          </h3>
          <p {...editable} className={`${editable.className} mx-auto mt-3 max-w-xs text-sm text-gray-600`}>
            I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <span className="text-sm text-gray-400">001</span>
            <button className="bg-gray-800 px-6 py-2 text-xs text-white">READ IT</button>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'text-over-image') {
    return (
      <div className="bg-white" style={bg}>
        <div className="p-12 text-center">
          <div className="mx-auto mb-4 h-px w-16 bg-black" />
          <h3 {...editable} className={`${editable.className} text-2xl font-bold uppercase tracking-widest`}>
            A Little Gift of Thanks for Joining the List.
          </h3>
          <div className="mx-auto mt-4 h-px w-16 bg-black" />
        </div>
        <div
          className="h-64 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=680&h=400&fit=crop)' }}
        />
      </div>
    )
  }

  if (type === 'text-left-image-right') {
    return (
      <div className="flex min-h-[300px]" style={bg}>
        <div className="flex w-1/3 items-center justify-center p-12">
          <h3 {...editable} className={`${editable.className} text-4xl font-bold leading-tight`}>
            WEL—COME
          </h3>
        </div>
        <div
          className="min-h-[300px] w-2/3 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&h=400&fit=crop)' }}
        />
      </div>
    )
  }

  if (type === 'recipe-card') {
    return (
      <div className="flex min-h-[280px] gap-8 bg-white p-8" style={bg}>
        <div
          className="w-1/2 rounded bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop)' }}
        />
        <div className="flex w-1/2 flex-col justify-center gap-3 px-4">
          <p {...editable} className={`${editable.className} text-sm italic text-gray-500`}>One</p>
          <h3 {...editable} className={`${editable.className} font-serif text-xl`}>
            Click here for my creamy butternut squash soup
          </h3>
          <p {...editable} className={`${editable.className} text-sm italic text-gray-500`}>
            A warming recipe perfect for fall evenings.
          </p>
        </div>
      </div>
    )
  }

  if (type === 'image-top-text-bottom') {
    return (
      <div className="bg-white" style={bg}>
        <div
          className="h-96 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=680&h=400&fit=crop)' }}
        />
        <div className="bg-gray-100 p-12 text-center">
          <h3 {...editable} className={`${editable.className} mb-3 font-serif text-2xl`}>
            Get 25% off when you book my services
          </h3>
          <p {...editable} className={`${editable.className} italic text-gray-500`}>
            for the next 24 hours only.
          </p>
        </div>
      </div>
    )
  }

  if (type === 'testimonial') {
    return (
      <div className="flex min-h-[200px] gap-8 bg-gray-50 p-12" style={bg}>
        <div
          className="h-32 w-32 shrink-0 rounded bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop)' }}
        />
        <div className="flex flex-1 flex-col justify-center gap-3">
          <h4 {...editable} className={`${editable.className} text-sm font-bold tracking-widest`}>
            TESTIMONIAL NAME
          </h4>
          <p {...editable} className={`${editable.className} text-sm leading-relaxed text-gray-600`}>
            Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.
          </p>
          <div className="text-xl text-yellow-400">★★★★☆</div>
        </div>
      </div>
    )
  }

  // Fallback
  return (
    <div className="flex h-24 items-center justify-center bg-gray-50 text-sm text-gray-400">
      Unknown block: {type}
    </div>
  )
}

// ─── Main EmailEditorPanel ────────────────────────────────────────────────────

export const EmailEditorPanel: React.FC = () => {
  // Canvas state
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>(makeDefaultBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insertState, setInsertState] = useState<InsertState>(null)
  const [showTextEdit, setShowTextEdit] = useState(false)
  const [textToolbarPosition, setTextToolbarPosition] = useState<{ top: number; left: number } | undefined>()

  const { document: doc, previewMode, setPreviewMode } = useEmailStore()

  // ── Canvas block actions ────────────────────────────────────────────────────

  const handleMoveUp = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx <= 0) return prev
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
      return next
    })
  }, [])

  const handleDuplicate = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0) return prev
      const copy: CanvasBlock = { id: nanoid(), type: prev[idx].type }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setCanvasBlocks((prev) => prev.filter((b) => b.id !== id))
    setSelectedId((prev) => (prev === id ? null : prev))
    setInsertState(null)
  }, [])

  const handleBlockColorChange = useCallback((id: string, color: string) => {
    setCanvasBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, backgroundColor: color } : b)),
    )
  }, [])

  // Insert a block inline (from "+" button)
  const handleInlineInsert = useCallback((type: string, afterId: string | null) => {
    const newBlock: CanvasBlock = { id: nanoid(), type }
    setCanvasBlocks((prev) => {
      if (afterId === null) return [newBlock, ...prev]
      const idx = prev.findIndex((b) => b.id === afterId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [])

  // Insert after selected (or append) — used by Sections panel + right nav
  const handleAppendInsert = useCallback((type: string) => {
    const newBlock: CanvasBlock = { id: nanoid(), type }
    setCanvasBlocks((prev) => {
      if (!selectedId) return [...prev, newBlock]
      const idx = prev.findIndex((b) => b.id === selectedId)
      if (idx < 0) return [...prev, newBlock]
      const next = [...prev]
      next.splice(idx + 1, 0, newBlock)
      return next
    })
    setSelectedId(newBlock.id)
    setInsertState(null)
  }, [selectedId])

  const handleTextClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setTextToolbarPosition({ top: e.clientY - 50, left: e.clientX - 60 })
    setShowTextEdit(true)
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedId(null)
    setInsertState(null)
    setTextToolbarPosition(undefined)
    setShowTextEdit(false)
  }, [])

  const selectedBlock = canvasBlocks.find((b) => b.id === selectedId) ?? null

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Centre: Interactive Canvas ───────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-[#F3F4F6]">

        {/* Top toolbar strip */}
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4">
          <span className="truncate text-[11px] text-gray-400">
            {doc.subject || 'Untitled email'}
          </span>
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'desktop' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Monitor size={12} /> Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Smartphone size={12} /> Mobile
            </button>
          </div>
        </div>

        {/* Scrollable canvas */}
        <div
          className="flex flex-1 items-start justify-center overflow-auto py-8"
          onClick={handleCanvasClick}
        >
          <div className="w-full max-w-[680px] px-4">

            {/* Empty state */}
            {canvasBlocks.length === 0 && (
              <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white py-24">
                <div className="text-center">
                  <p className="text-[13px] font-medium text-gray-400">Add a block from the right panel or Sections</p>
                  <p className="mt-1 text-[11px] text-gray-300">Your email will be built here</p>
                </div>
              </div>
            )}

            {/* Top inserter (before first block) */}
            {insertState?.afterId === null && (
              <BlockInserter
                onSelect={(t) => handleInlineInsert(t, null)}
                onClose={() => setInsertState(null)}
              />
            )}

            {canvasBlocks.map((block, i) => {
              const isSelected = selectedId === block.id
              const prevId = i === 0 ? null : canvasBlocks[i - 1].id

              return (
                <React.Fragment key={block.id}>
                  {/* Block row — extra right margin so the absolute action bar has room */}
                  <div
                    className="relative mb-1 mr-14"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* The block itself */}
                    <div
                      className={cn(
                        'cursor-pointer overflow-hidden rounded border-2 transition-all',
                        isSelected
                          ? 'border-blue-400 shadow-[0_0_0_3px_rgba(96,165,250,0.15)]'
                          : 'border-transparent hover:border-gray-200',
                      )}
                      onClick={() => {
                        setSelectedId(block.id)
                        setInsertState(null)
                      }}
                    >
                      <BlockContent
                        type={block.type}
                        backgroundColor={block.backgroundColor}
                        onTextClick={handleTextClick}
                      />
                    </div>

                    {/* ± Insert above (top center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: prevId })
                        }}
                        className="absolute -top-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block above"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* ± Insert below (bottom center of outline) */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setInsertState({ afterId: block.id })
                        }}
                        className="absolute -bottom-3 left-1/2 z-20 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-blue-500 text-white shadow-md transition-transform hover:scale-110 hover:bg-blue-600"
                        title="Insert block below"
                      >
                        <Plus size={12} />
                      </button>
                    )}

                    {/* Floating action bar — absolutely to the right, outside the block */}
                    {isSelected && (
                      <div className="absolute right-[-52px] top-2 z-30">
                        <FloatingActionBar
                          onMoveUp={() => handleMoveUp(block.id)}
                          onMoveDown={() => handleMoveDown(block.id)}
                          onDuplicate={() => handleDuplicate(block.id)}
                          onDelete={() => handleDelete(block.id)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inline block inserter — shown after this block when triggered */}
                  {insertState?.afterId === block.id && (
                    <BlockInserter
                      onSelect={(t) => handleInlineInsert(t, block.id)}
                      onClose={() => setInsertState(null)}
                    />
                  )}
                </React.Fragment>
              )
            })}
          </div>
        </div>

        {/* Floating text toolbar */}
        <FloatingTextToolbar position={textToolbarPosition} />
      </div>

      {/* ── Right Nav: Text Edit → Block Props → Block Library ─ */}
      <aside className="flex w-[300px] shrink-0 flex-col border-l border-gray-200 bg-white">
        {showTextEdit ? (
          <TextEditPanel
            onClose={() => {
              setShowTextEdit(false)
              setTextToolbarPosition(undefined)
            }}
          />
        ) : selectedBlock ? (
          <BlockPropertiesPanel
            block={selectedBlock}
            onColorChange={handleBlockColorChange}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <BlockLibrary
            selectedBlock={undefined}
            onBlockSelect={handleAppendInsert}
          />
        )}
      </aside>

    </div>
  )
}
