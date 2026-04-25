'use client'

import React, { useState, useCallback } from 'react'
import {
  Layers, LayoutGrid, Palette, FileText,
  Monitor, Smartphone, ChevronUp, ChevronDown, Trash2,
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

type EmailTab = 'tree' | 'sections' | 'text' | 'content' | 'style'

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

// Font options
const FONT_OPTIONS = ['Arial', 'Georgia', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Verdana']

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

// ─── Tree / Layer Panel ───────────────────────────────────────────────────────

interface TreePanelProps {
  blocks: CanvasBlock[]
  selectedId: string | null
  onSelect: (id: string) => void
  onMoveUp: (id: string) => void
  onMoveDown: (id: string) => void
  onDelete: (id: string) => void
}

function TreePanel({ blocks, selectedId, onSelect, onMoveUp, onMoveDown, onDelete }: TreePanelProps) {
  const getIcon = (type: string) => {
    const found = CANVAS_BLOCK_TYPES.find((b) => b.id === type)
    if (found) {
      const { Icon } = found
      return <Icon size={10} />
    }
    return <Layout size={10} />
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center border-b border-gray-100 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Layer Tree
        </span>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {blocks.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[11px] text-gray-400">No blocks yet.</p>
            <p className="text-[10px] text-gray-300 mt-1">Add from Sections or Right Nav.</p>
          </div>
        ) : (
          blocks.map((block, i) => (
            <div
              key={block.id}
              onClick={() => onSelect(block.id)}
              className={cn(
                'group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors',
                selectedId === block.id ? 'bg-blue-50' : 'hover:bg-gray-50',
              )}
            >
              <span
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded',
                  selectedId === block.id
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-gray-100 text-gray-400',
                )}
              >
                {getIcon(block.type)}
              </span>
              <span
                className={cn(
                  'flex-1 truncate text-[11px] capitalize',
                  selectedId === block.id
                    ? 'font-medium text-blue-700'
                    : 'text-gray-600',
                )}
              >
                {BLOCK_LABEL[block.type] ?? block.type}
              </span>
              <div
                className={cn(
                  'flex items-center gap-0.5 transition-opacity',
                  selectedId === block.id
                    ? 'opacity-100'
                    : 'opacity-0 group-hover:opacity-100',
                )}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveUp(block.id) }}
                  disabled={i === 0}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronUp size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onMoveDown(block.id) }}
                  disabled={i === blocks.length - 1}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-20"
                >
                  <ChevronDown size={9} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(block.id) }}
                  className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-400"
                >
                  <Trash2 size={9} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Sections Panel ───────────────────────────────────────────────────────────

function SectionsPanel({ onInsert }: { onInsert: (type: string) => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="px-3 pb-3 pt-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Email Blocks
        </p>
        <p className="mb-3 text-[10px] text-gray-400 leading-relaxed">
          Click a block to insert it after the selected block in the canvas.
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {CANVAS_BLOCK_TYPES.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => onInsert(id)}
              className="flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2.5 text-center transition-all hover:border-blue-400 hover:bg-blue-50 hover:shadow-sm active:scale-95"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-500">
                <Icon size={13} />
              </div>
              <span className="text-[9px] font-medium leading-tight text-gray-500">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Text Blocks Panel ────────────────────────────────────────────────────────

function TextBlocksPanel({ onInsert }: { onInsert: (type: string) => void }) {
  const TEXT_STYLES = [
    { id: 'h1',      label: 'Heading 1',  preview: 'Heading 1',   cls: 'text-xl font-bold' },
    { id: 'h2',      label: 'Heading 2',  preview: 'Heading 2',   cls: 'text-lg font-semibold' },
    { id: 'h3',      label: 'Heading 3',  preview: 'Heading 3',   cls: 'text-base font-medium' },
    { id: 'body',    label: 'Body Text',  preview: 'Body copy',   cls: 'text-sm' },
    { id: 'caption', label: 'Caption',    preview: 'Caption text', cls: 'text-xs text-gray-500 italic' },
  ]

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Text Styles
      </p>
      <div className="flex flex-col gap-1.5">
        {TEXT_STYLES.map(({ id, label, preview, cls }) => (
          <button
            key={id}
            onClick={() => onInsert('text')}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50 active:scale-[0.99]"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gray-100 text-gray-400 shrink-0">
              <Type size={11} />
            </div>
            <div className="min-w-0">
              <p className={cn('text-gray-700 leading-tight truncate', cls)}>{preview}</p>
              <p className="text-[9px] text-gray-400 mt-0.5">{label}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Content Panel (replaces Settings) ───────────────────────────────────────

function ContentPanel({
  selectedBlock,
  onBlockColorChange,
}: {
  selectedBlock: CanvasBlock | null
  onBlockColorChange: (id: string, color: string) => void
}) {
  const { document: doc, updateSubject, updatePreheader, updateGlobalStyles } = useEmailStore()

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      {selectedBlock ? (
        <>
          {/* Selected block badge */}
          <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-blue-400">Selected Block</p>
            <p className="mt-0.5 text-[12px] font-medium capitalize text-blue-800">
              {BLOCK_LABEL[selectedBlock.type] ?? selectedBlock.type}
            </p>
          </div>

          {/* Block background colour */}
          <Field label="Block Background">
            <div className="flex items-center gap-2">
              <ColorRow
                value={selectedBlock.backgroundColor ?? '#ffffff'}
                onChange={(v) => onBlockColorChange(selectedBlock.id, v)}
              />
              {selectedBlock.backgroundColor && selectedBlock.backgroundColor !== '#ffffff' && (
                <button
                  onClick={() => onBlockColorChange(selectedBlock.id, '#ffffff')}
                  title="Reset to white"
                  className="shrink-0 rounded border border-gray-200 px-2 py-1.5 text-[10px] text-gray-400 hover:border-gray-300 hover:text-gray-600"
                >
                  Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-[10px] text-gray-400">
              Pick a colour to change this block&apos;s background
            </p>
          </Field>

          <div className="mb-3 h-px bg-gray-100" />
        </>
      ) : (
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 text-center">
          <p className="text-[11px] text-gray-400">Click a block on the canvas to style it</p>
        </div>
      )}

      <Field label="Subject Line">
        <input
          type="text"
          value={doc.subject}
          onChange={(e) => updateSubject(e.target.value)}
          placeholder="Your email subject…"
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>

      <Field label="Preheader Text">
        <textarea
          value={doc.preheader}
          onChange={(e) => updatePreheader(e.target.value)}
          placeholder="Preview text shown in inbox…"
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">Shown after subject line in most clients</p>
      </Field>

      <Field label="Unsubscribe Text">
        <textarea
          value={doc.globalStyles.unsubscribeText}
          onChange={(e) => updateGlobalStyles({ unsubscribeText: e.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
        <p className="mt-1 text-[10px] text-gray-400">
          Use <code className="text-[10px]">[[unsubscribe]]</code> for the link
        </p>
      </Field>
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

// ─── Style Panel ──────────────────────────────────────────────────────────────

function StylePanel() {
  const { document: doc, updateGlobalStyles } = useEmailStore()
  const g = doc.globalStyles

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <Field label="Email Background">
        <ColorRow value={g.backgroundColor} onChange={(v) => updateGlobalStyles({ backgroundColor: v })} />
      </Field>

      <Field label="Body Font">
        <select
          value={g.fontFamily}
          onChange={(e) => updateGlobalStyles({ fontFamily: e.target.value })}
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 focus:border-blue-400 focus:outline-none"
        >
          {FONT_OPTIONS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </Field>

      <Field label="Link Colour">
        <ColorRow value={g.linkColor} onChange={(v) => updateGlobalStyles({ linkColor: v })} />
      </Field>

      <Field label="Content Width">
        <div className="flex gap-1.5">
          {[600, 640].map((w) => (
            <button
              key={w}
              onClick={() => updateGlobalStyles({ contentWidth: w })}
              className={cn(
                'flex-1 rounded-md border py-1.5 text-[11px] font-medium transition-colors',
                g.contentWidth === w
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300',
              )}
            >
              {w}px
            </button>
          ))}
        </div>
      </Field>

      <Field label="Logo URL">
        <input
          type="text"
          placeholder="https://…/logo.png"
          value={g.logo?.src ?? ''}
          onChange={(e) =>
            updateGlobalStyles({
              logo: { src: e.target.value, alt: g.logo?.alt ?? 'Logo', width: g.logo?.width ?? 120 },
            })
          }
          className="w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-[12px] text-gray-700 placeholder-gray-300 focus:border-blue-400 focus:outline-none"
        />
      </Field>
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

// ─── Rail button ──────────────────────────────────────────────────────────────

function RailBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      className={cn(
        'flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium transition-colors',
        active ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
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
  const [activeTab, setActiveTab] = useState<EmailTab>('sections')
  const [panelOpen, setPanelOpen] = useState(true)

  // Canvas state
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>(makeDefaultBlocks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [insertState, setInsertState] = useState<InsertState>(null)
  const [showTextEdit, setShowTextEdit] = useState(false)
  const [textToolbarPosition, setTextToolbarPosition] = useState<{ top: number; left: number } | undefined>()

  const { document: doc, previewMode, setPreviewMode } = useEmailStore()

  const handleTabClick = (tab: EmailTab) => {
    if (activeTab === tab) setPanelOpen((o) => !o)
    else { setActiveTab(tab); setPanelOpen(true) }
  }

  const RAIL_ITEMS: { id: EmailTab; icon: React.ReactNode; label: string }[] = [
    { id: 'tree',     icon: <Layers size={14} />,     label: 'Tree' },
    { id: 'sections', icon: <LayoutGrid size={14} />, label: 'Sections' },
    { id: 'text',     icon: <Type size={14} />,       label: 'Text' },
    { id: 'content',  icon: <FileText size={14} />,   label: 'Content' },
    { id: 'style',    icon: <Palette size={14} />,    label: 'Style' },
  ]

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

      {/* ── Icon Rail ────────────────────────────────────── */}
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-gray-200 bg-white py-2 px-1">
        {RAIL_ITEMS.map((item) => (
          <RailBtn
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeTab === item.id && panelOpen}
            onClick={() => handleTabClick(item.id)}
          />
        ))}
      </aside>

      {/* ── Slide-out Sub-panel ──────────────────────────── */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200',
          panelOpen ? 'w-[216px]' : 'w-0 overflow-hidden',
        )}
      >
        {panelOpen && (
          <>
            {activeTab === 'tree'     && (
              <TreePanel
                blocks={canvasBlocks}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onDelete={handleDelete}
              />
            )}
            {activeTab === 'sections' && <SectionsPanel onInsert={handleAppendInsert} />}
            {activeTab === 'text'     && <TextBlocksPanel onInsert={handleAppendInsert} />}
            {activeTab === 'content'  && <ContentPanel selectedBlock={selectedBlock} onBlockColorChange={handleBlockColorChange} />}
            {activeTab === 'style'    && <StylePanel />}
          </>
        )}
      </aside>

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
