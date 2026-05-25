'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Plus, Trash2, ChevronUp, ChevronDown, Download,
  Image as ImageIcon, Type, Monitor, Smartphone,
  RotateCcw, RotateCw, GripVertical, X, Link, Upload,
  LayoutTemplate,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePageStore, makeDefaultBlock } from '@/lib/page/pageStore'
import type { PageBlockType, PageBlock, ContentSlot } from '@/types/page'
import type { CanvasMode } from '@/lib/canvas/canvasStore'
import { ApprovedImagesPanel } from '@/components/canvas/ApprovedImagesPanel'

// ─── Block type palette ───────────────────────────────────────────────────────

const BLOCK_PALETTE: { type: PageBlockType; label: string; icon: string }[] = [
  { type: 'page-hero',               label: 'Hero',               icon: '🏔' },
  { type: 'page-executive-summary',  label: 'Executive Summary',  icon: '📊' },
  { type: 'page-problem',            label: 'The Challenge',      icon: '⚡' },
  { type: 'page-solution',           label: 'The Solution',       icon: '✅' },
  { type: 'page-results',            label: 'Results / Stats',    icon: '📈' },
  { type: 'page-quote',              label: 'Quote',              icon: '💬' },
  { type: 'page-cta',                label: 'CTA',                icon: '🎯' },
  { type: 'page-image',              label: 'Full Image',         icon: '🖼' },
  { type: 'page-divider',            label: 'Divider',            icon: '—' },
]

const BLOCK_LABELS: Record<PageBlockType, string> = {
  'page-hero':              'Hero',
  'page-executive-summary': 'Executive Summary',
  'page-problem':           'The Challenge',
  'page-solution':          'The Solution',
  'page-results':           'Results / Stats',
  'page-quote':             'Quote',
  'page-cta':               'Call to Action',
  'page-image':             'Full Image',
  'page-divider':           'Divider',
}

// ─── Image picker modal ───────────────────────────────────────────────────────

interface ImagePickerProps {
  onSelect: (src: string) => void
  onClose: () => void
}

const ImagePicker: React.FC<ImagePickerProps> = ({ onSelect, onClose }) => {
  const [tab, setTab] = useState<'library' | 'url'>('library')
  const [url, setUrl] = useState('')

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50">
      <div className="w-[600px] max-h-[80vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Replace Image</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-5">
          {(['library', 'url'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'py-2.5 px-1 mr-6 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              {t === 'library' ? 'Image Library' : 'Paste URL'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {tab === 'library' && (
            <ApprovedImagesPanel
              open
              onClose={onClose}
              onSelect={(src) => { onSelect(src); onClose() }}
            />
          )}
          {tab === 'url' && (
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Image URL</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                  />
                  <button
                    onClick={() => { if (url.trim()) { onSelect(url.trim()); onClose() } }}
                    disabled={!url.trim()}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-blue-700"
                  >
                    Use
                  </button>
                </div>
              </div>
              {url.trim() && (
                <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                  <img src={url} alt="Preview" className="w-full h-48 object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Inline editable text ─────────────────────────────────────────────────────

interface InlineTextProps {
  blockId: string
  slotKey: string
  value: string
  className?: string
  as?: React.ElementType
  style?: React.CSSProperties
}

const InlineText: React.FC<InlineTextProps> = ({ blockId, slotKey, value, className, as: Tag = 'span', style }) => {
  const updateSlot = usePageStore((s) => s.updateSlot)
  const ref = useRef<HTMLElement>(null)

  // Sync external value changes (e.g. undo) without losing cursor
  useEffect(() => {
    const el = ref.current
    if (!el || document.activeElement === el) return
    if (el.textContent !== value) el.textContent = value
  }, [value])

  const handleBlur = useCallback(() => {
    const el = ref.current
    if (!el) return
    updateSlot({ blockId, slotKey, value: el.textContent ?? '' })
  }, [blockId, slotKey, updateSlot])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      ;(e.currentTarget as HTMLElement).blur()
    }
    // Prevent bubbling to canvas keyboard shortcuts
    e.stopPropagation()
  }, [])

  return React.createElement(Tag as string, {
    ref,
    contentEditable: true,
    suppressContentEditableWarning: true,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    className: cn('outline-none cursor-text focus:ring-2 focus:ring-blue-400/40 focus:ring-offset-1 rounded', className),
    style,
    'data-slot': slotKey,
  }, value)
}

// ─── Image slot (click to replace) ───────────────────────────────────────────

interface InlineImageProps {
  blockId: string
  slotKey: string
  src: string
  alt: string
  className?: string
  style?: React.CSSProperties
  onPickImage: (blockId: string, slotKey: string) => void
}

const InlineImage: React.FC<InlineImageProps> = ({ blockId, slotKey, src, alt, className, style, onPickImage }) => {
  return (
    <div className="relative group cursor-pointer" onClick={() => onPickImage(blockId, slotKey)}>
      <img src={src} alt={alt} className={cn('block', className)} style={style} />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center rounded-[inherit]">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-gray-800 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow">
          <ImageIcon className="w-3.5 h-3.5" />
          Replace image
        </div>
      </div>
    </div>
  )
}

// ─── Block renderers ──────────────────────────────────────────────────────────

interface BlockRenderProps {
  block: PageBlock
  onPickImage: (blockId: string, slotKey: string) => void
}

const BlockRender: React.FC<BlockRenderProps> = ({ block, onPickImage }) => {
  const c = block.content
  const bg = block.bgColor ?? '#FFFFFF'

  const text = (key: string) => (c[key]?.type === 'text' ? c[key].value : '') as string
  const imgSlot = (key: string) => c[key]?.type === 'image' ? c[key] as { type: 'image'; src: string; alt: string } : null

  switch (block.type) {
    case 'page-hero': {
      const hero = imgSlot('image')
      return (
        <section style={{ backgroundColor: bg, position: 'relative', minHeight: 420, overflow: 'hidden' }}>
          {hero && (
            <InlineImage
              blockId={block.id} slotKey="image"
              src={hero.src} alt={hero.alt}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.35 }}
              onPickImage={onPickImage}
            />
          )}
          <div style={{ position: 'relative', maxWidth: 800, margin: '0 auto', padding: '80px 40px', textAlign: 'center' }}>
            <InlineText blockId={block.id} slotKey="tag" value={text('tag')}
              style={{ display: 'inline-block', fontSize: 13, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: '#93C5FD', marginBottom: 16 }}
            />
            <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h1"
              style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, color: '#FFFFFF', margin: '0 0 20px', display: 'block' }}
            />
            <InlineText blockId={block.id} slotKey="subtext" value={text('subtext')} as="p"
              style={{ fontSize: 18, lineHeight: 1.7, color: '#CBD5E1', margin: 0, display: 'block' }}
            />
          </div>
        </section>
      )
    }

    case 'page-executive-summary': {
      return (
        <section style={{ backgroundColor: bg, padding: '64px 40px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h2"
              style={{ fontSize: 30, fontWeight: 700, color: '#0F172A', margin: '0 0 20px', display: 'block' }}
            />
            <InlineText blockId={block.id} slotKey="body" value={text('body')} as="p"
              style={{ fontSize: 17, lineHeight: 1.75, color: '#475569', margin: '0 0 48px', display: 'block' }}
            />
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ flex: 1, minWidth: 160, borderTop: '3px solid #2563EB', paddingTop: 16 }}>
                  <InlineText blockId={block.id} slotKey={`stat${i}`} value={text(`stat${i}`)}
                    style={{ display: 'block', fontSize: 36, fontWeight: 800, color: '#2563EB' }}
                  />
                  <InlineText blockId={block.id} slotKey={`stat${i}label`} value={text(`stat${i}label`)}
                    style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0F172A', marginTop: 4 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    case 'page-problem': {
      const prob = imgSlot('image')
      return (
        <section style={{ backgroundColor: bg, padding: '64px 40px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap' }}>
            {prob && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <InlineImage blockId={block.id} slotKey="image" src={prob.src} alt={prob.alt}
                  style={{ width: '100%', borderRadius: 12, display: 'block' }}
                  onPickImage={onPickImage}
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 280 }}>
              <InlineText blockId={block.id} slotKey="label" value={text('label')}
                style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#EF4444' }}
              />
              <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h2"
                style={{ display: 'block', fontSize: 30, fontWeight: 700, color: '#0F172A', margin: '12px 0 20px' }}
              />
              <InlineText blockId={block.id} slotKey="body" value={text('body')} as="p"
                style={{ display: 'block', fontSize: 16, lineHeight: 1.75, color: '#475569', margin: 0 }}
              />
            </div>
          </div>
        </section>
      )
    }

    case 'page-solution': {
      const sol = imgSlot('image')
      return (
        <section style={{ backgroundColor: bg, padding: '64px 40px' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 64, alignItems: 'center', flexWrap: 'wrap', flexDirection: 'row-reverse' }}>
            {sol && (
              <div style={{ flex: 1, minWidth: 280 }}>
                <InlineImage blockId={block.id} slotKey="image" src={sol.src} alt={sol.alt}
                  style={{ width: '100%', borderRadius: 12, display: 'block' }}
                  onPickImage={onPickImage}
                />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 280 }}>
              <InlineText blockId={block.id} slotKey="label" value={text('label')}
                style={{ display: 'block', fontSize: 12, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#10B981' }}
              />
              <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h2"
                style={{ display: 'block', fontSize: 30, fontWeight: 700, color: '#0F172A', margin: '12px 0 20px' }}
              />
              <InlineText blockId={block.id} slotKey="body" value={text('body')} as="p"
                style={{ display: 'block', fontSize: 16, lineHeight: 1.75, color: '#475569', margin: 0 }}
              />
            </div>
          </div>
        </section>
      )
    }

    case 'page-results': {
      return (
        <section style={{ backgroundColor: bg, padding: '72px 40px' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
            <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h2"
              style={{ display: 'block', fontSize: 34, fontWeight: 800, color: '#FFFFFF', margin: '0 0 12px' }}
            />
            <InlineText blockId={block.id} slotKey="subtext" value={text('subtext')} as="p"
              style={{ display: 'block', fontSize: 17, color: '#94A3B8', margin: '0 0 56px' }}
            />
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ flex: 1, minWidth: 220, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 16, padding: '32px 24px' }}>
                  <InlineText blockId={block.id} slotKey={`stat${i}`} value={text(`stat${i}`)}
                    style={{ display: 'block', fontSize: 42, fontWeight: 900, color: '#FFFFFF' }}
                  />
                  <InlineText blockId={block.id} slotKey={`stat${i}label`} value={text(`stat${i}label`)}
                    style={{ display: 'block', fontSize: 16, fontWeight: 600, color: '#E2E8F0', marginTop: 8 }}
                  />
                  <InlineText blockId={block.id} slotKey={`stat${i}desc`} value={text(`stat${i}desc`)}
                    style={{ display: 'block', fontSize: 13, color: '#94A3B8', marginTop: 6 }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )
    }

    case 'page-quote': {
      const av = imgSlot('avatar')
      return (
        <section style={{ backgroundColor: bg, padding: '72px 40px' }}>
          <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
            <svg style={{ width: 40, height: 40, color: '#BAE6FD', margin: '0 auto 24px' }} viewBox="0 0 24 24" fill="currentColor">
              <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
            </svg>
            <InlineText blockId={block.id} slotKey="quote" value={text('quote')} as="blockquote"
              style={{ display: 'block', fontSize: 22, fontWeight: 500, lineHeight: 1.65, color: '#0F172A', margin: '0 0 32px', fontStyle: 'italic' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
              {av && (
                <InlineImage blockId={block.id} slotKey="avatar" src={av.src} alt={av.alt}
                  style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  onPickImage={onPickImage}
                />
              )}
              <div style={{ textAlign: 'left' }}>
                <InlineText blockId={block.id} slotKey="name" value={text('name')}
                  style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0F172A' }}
                />
                <InlineText blockId={block.id} slotKey="title" value={text('title')}
                  style={{ display: 'block', fontSize: 13, color: '#64748B' }}
                />
              </div>
            </div>
          </div>
        </section>
      )
    }

    case 'page-cta': {
      return (
        <section style={{ backgroundColor: bg, padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <InlineText blockId={block.id} slotKey="heading" value={text('heading')} as="h2"
              style={{ display: 'block', fontSize: 34, fontWeight: 800, color: '#FFFFFF', margin: '0 0 16px' }}
            />
            <InlineText blockId={block.id} slotKey="subtext" value={text('subtext')} as="p"
              style={{ display: 'block', fontSize: 18, color: 'rgba(255,255,255,0.8)', margin: '0 0 36px' }}
            />
            <div style={{ display: 'inline-block', background: '#FFFFFF', color: '#2563EB', fontSize: 16, fontWeight: 700, padding: '16px 36px', borderRadius: 8 }}>
              <InlineText blockId={block.id} slotKey="btnText" value={text('btnText')}
                style={{ color: '#2563EB', fontWeight: 700 }}
              />
            </div>
          </div>
        </section>
      )
    }

    case 'page-image': {
      const fi = imgSlot('image')
      return (
        <section style={{ backgroundColor: bg }}>
          {fi && (
            <InlineImage blockId={block.id} slotKey="image" src={fi.src} alt={fi.alt}
              style={{ width: '100%', display: 'block', maxHeight: 520, objectFit: 'cover' }}
              onPickImage={onPickImage}
            />
          )}
          {text('caption') && (
            <InlineText blockId={block.id} slotKey="caption" value={text('caption')} as="p"
              style={{ textAlign: 'center', fontSize: 13, color: '#94A3B8', padding: '12px 40px', display: 'block' }}
            />
          )}
        </section>
      )
    }

    case 'page-divider':
      return <div style={{ height: 1, margin: '0 40px', background: 'linear-gradient(to right,transparent,#E2E8F0,transparent)' }} />

    default:
      return null
  }
}

// ─── Block wrapper (hover actions) ───────────────────────────────────────────

interface BlockWrapperProps {
  block: PageBlock
  index: number
  total: number
  selected: boolean
  onSelect: () => void
  onPickImage: (blockId: string, slotKey: string) => void
}

const BlockWrapper: React.FC<BlockWrapperProps> = ({ block, index, total, selected, onSelect, onPickImage }) => {
  const { removeBlock, moveBlock } = usePageStore()
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={cn(
        'relative group',
        selected && 'ring-2 ring-blue-500 ring-inset'
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}
    >
      {/* Block content */}
      <BlockRender block={block} onPickImage={onPickImage} />

      {/* Hover / selection toolbar */}
      {(hovered || selected) && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm px-1.5 py-1">
          <span className="text-[10px] font-semibold text-gray-400 px-1 select-none">
            {BLOCK_LABELS[block.type]}
          </span>
          <div className="w-px h-3.5 bg-gray-200 mx-0.5" />
          <button
            onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up') }}
            disabled={index === 0}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move up"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down') }}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 disabled:opacity-30"
            title="Move down"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); removeBlock(block.id) }}
            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Add block button ─────────────────────────────────────────────────────────

interface AddBlockButtonProps {
  afterId: string | null
}

const AddBlockButton: React.FC<AddBlockButtonProps> = ({ afterId }) => {
  const addBlock = usePageStore((s) => s.addBlock)
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex justify-center py-1 group/add">
      <button
        onClick={() => setOpen((v) => !v)}
        className="opacity-0 group-hover/add:opacity-100 flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-full hover:bg-blue-50 shadow-sm transition-all"
      >
        <Plus className="w-3 h-3" />
        Add block
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
          <div className="absolute top-full mt-1 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-2 w-64">
            {BLOCK_PALETTE.map((item) => (
              <button
                key={item.type}
                onClick={() => { addBlock(item.type, afterId); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-50 text-left"
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main editor panel ────────────────────────────────────────────────────────

interface PageEditorPanelProps {
  mode: Extract<CanvasMode, 'landing-page' | 'case-study'>
}

export const PageEditorPanel: React.FC<PageEditorPanelProps> = ({ mode }) => {
  const { document, compiledHtml, selectedBlockId, setSelectedBlock, undo, redo, resetDocument } = usePageStore()

  // Sync mode into the store when it changes
  useEffect(() => {
    if (document.mode !== mode) {
      resetDocument(mode)
    }
  }, [mode, document.mode, resetDocument])

  // Image picker state
  const [pickerTarget, setPickerTarget] = useState<{ blockId: string; slotKey: string } | null>(null)
  const updateSlot = usePageStore((s) => s.updateSlot)

  const handlePickImage = useCallback((blockId: string, slotKey: string) => {
    setPickerTarget({ blockId, slotKey })
  }, [])

  const handleImageSelected = useCallback((src: string) => {
    if (!pickerTarget) return
    updateSlot({ blockId: pickerTarget.blockId, slotKey: pickerTarget.slotKey, value: src })
    setPickerTarget(null)
  }, [pickerTarget, updateSlot])

  // Export HTML
  const handleExport = useCallback(() => {
    const blob = new Blob([compiledHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${document.title.replace(/\s+/g, '-').toLowerCase() || 'page'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }, [compiledHtml, document.title])

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

  return (
    <div className="flex h-full overflow-hidden bg-[#FDFDFD]">

      {/* ── Left block palette ──────────────────────────────── */}
      <aside className="w-[200px] flex-shrink-0 border-r border-gray-100 bg-white flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              {mode === 'case-study' ? 'Case Study' : 'Landing Page'}
            </span>
          </div>
        </div>

        {/* Block tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {document.blocks.map((block, i) => (
            <button
              key={block.id}
              onClick={() => setSelectedBlock(block.id === selectedBlockId ? null : block.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors',
                selectedBlockId === block.id
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              )}
            >
              <span className="text-sm w-4 text-center flex-shrink-0">
                {BLOCK_PALETTE.find((p) => p.type === block.type)?.icon ?? '▪'}
              </span>
              <span className="truncate">{BLOCK_LABELS[block.type]}</span>
            </button>
          ))}
        </div>

        {/* Add block */}
        <div className="p-2 border-t border-gray-100">
          <AddBlockButton afterId={document.blocks[document.blocks.length - 1]?.id ?? null} />
        </div>
      </aside>

      {/* ── Canvas + toolbar ─────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between h-11 px-4 border-b border-gray-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-1">
            <button onClick={undo} title="Undo" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button onClick={redo} title="Redo" className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><RotateCw className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={cn('p-1.5 rounded-md transition-colors', previewMode === 'desktop' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn('p-1.5 rounded-md transition-colors', previewMode === 'mobile' ? 'bg-white shadow-sm text-gray-700' : 'text-gray-400 hover:text-gray-600')}
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="w-3 h-3" />
            Export HTML
          </button>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-y-auto bg-[#F1F5F9]">
          <div className={cn(
            'mx-auto my-8 bg-white shadow-xl overflow-hidden transition-all duration-300',
            previewMode === 'desktop' ? 'max-w-[1100px] rounded-xl' : 'max-w-[390px] rounded-3xl'
          )}>
            {/* Add block before first */}
            <AddBlockButton afterId={null} />

            {document.blocks.map((block, i) => (
              <React.Fragment key={block.id}>
                <BlockWrapper
                  block={block}
                  index={i}
                  total={document.blocks.length}
                  selected={selectedBlockId === block.id}
                  onSelect={() => setSelectedBlock(block.id === selectedBlockId ? null : block.id)}
                  onPickImage={handlePickImage}
                />
                <AddBlockButton afterId={block.id} />
              </React.Fragment>
            ))}

            {document.blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <LayoutTemplate className="w-10 h-10 text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500">No blocks yet</p>
                <p className="text-xs text-gray-400 mt-1">Click "Add block" above to start building</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image picker modal */}
      {pickerTarget && (
        <ImagePicker
          onSelect={handleImageSelected}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  )
}
