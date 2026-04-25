'use client'

import { useState, useCallback } from 'react'
import {
  Layers, LayoutGrid, Palette, Settings2,
  Monitor, Smartphone, RotateCcw, ChevronUp, ChevronDown, Trash2,
  ChevronLeft, ChevronRight,
  Type, Image as ImageIcon, MousePointer2, Minus, AlignLeft,
  ChevronsUpDown, Star,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import { cn } from '@/lib/utils'
import { useEmailStore } from '@/lib/email/emailStore'
import { BlockLibrary } from './BlockLibrary'
import { FloatingActionBar } from './FloatingActionBar'
import { FloatingTextToolbar } from './FloatingTextToolbar'
import { TextEditPanel } from './TextEditPanel'
import {
  makeTextBlock, makeHeadingBlock, makeBodyBlock,
  makeButtonBlock, makeImageBlock, makeSpacerBlock,
  makeDividerBlock, makeLogoBlock,
  presetHero, presetImageText, presetTwoColumn, presetBodyText,
} from '@/lib/email/templates'
import type {
  SectionLayout,
} from '@/types/email'

// ─── Types ────────────────────────────────────────────────────────────────────

type EmailTab = 'structure' | 'sections' | 'blocks' | 'styles' | 'settings'

interface CanvasBlock {
  id: string
  type: string
}

// ─── Layout visual preview cards ──────────────────────────────────────────────

const LAYOUTS: { id: SectionLayout; label: string; cols: number[] }[] = [
  { id: 'full',        label: 'Full',      cols: [100] },
  { id: 'two-col',     label: '50 / 50',   cols: [50, 50] },
  { id: 'left-heavy',  label: '60 / 40',   cols: [60, 40] },
  { id: 'right-heavy', label: '40 / 60',   cols: [40, 60] },
  { id: 'three-col',   label: '3 Column',  cols: [33, 34, 33] },
  { id: 'image-left',  label: 'Img Left',  cols: [40, 60] },
  { id: 'image-right', label: 'Img Right', cols: [60, 40] },
]

function LayoutCard({
  layout,
  onClick,
}: {
  layout: typeof LAYOUTS[number]
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 rounded-lg border border-gray-200 bg-white p-2 transition-all hover:border-blue-400 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
    >
      <div className="flex h-8 w-full items-stretch gap-0.5 overflow-hidden rounded">
        {layout.cols.map((w, i) => (
          <div
            key={i}
            className="rounded-sm bg-gray-200 group-hover:bg-blue-100"
            style={{ flex: w }}
          />
        ))}
      </div>
      <span className="text-[10px] leading-none text-gray-500 group-hover:text-blue-600">
        {layout.label}
      </span>
    </button>
  )
}

// ─── Preset section cards ──────────────────────────────────────────────────────

const PRESET_SECTIONS = [
  { id: 'hero',        label: 'Hero',           desc: 'Logo · headline · CTA',   fn: presetHero },
  { id: 'image-text',  label: 'Image + Text',   desc: 'Image beside copy',        fn: presetImageText },
  { id: 'two-col',     label: '2-Column',        desc: 'Side-by-side products',    fn: presetTwoColumn },
  { id: 'body-text',   label: 'Body Text',       desc: 'Heading + paragraph',      fn: presetBodyText },
]

// ─── Block type cards ──────────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { id: 'heading',  label: 'Heading',  icon: <AlignLeft size={14} /> },
  { id: 'text',     label: 'Text',     icon: <Type size={14} /> },
  { id: 'image',    label: 'Image',    icon: <ImageIcon size={14} /> },
  { id: 'button',   label: 'Button',   icon: <MousePointer2 size={14} /> },
  { id: 'divider',  label: 'Divider',  icon: <Minus size={14} /> },
  { id: 'spacer',   label: 'Spacer',   icon: <ChevronsUpDown size={14} /> },
  { id: 'logo',     label: 'Logo',     icon: <Star size={14} /> },
] as const

// ─── Font options ──────────────────────────────────────────────────────────────

const FONT_OPTIONS = ['Arial', 'Georgia', 'Helvetica', 'Tahoma', 'Trebuchet MS', 'Verdana']

// ─── Sub-panels ───────────────────────────────────────────────────────────────

function StructurePanel() {
  const { document: doc, selectedSectionId, setSelectedSection, moveSection, removeSection, resetDocument } =
    useEmailStore()

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-gray-100 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Structure
        </span>
        <button
          onClick={resetDocument}
          title="Reset to default"
          className="flex h-5 w-5 items-center justify-center rounded text-gray-300 hover:bg-gray-100 hover:text-gray-500"
        >
          <RotateCcw size={10} />
        </button>
      </div>

      <div className="flex-1 overflow-auto py-1">
        {doc.sections.map((section, i) => (
          <div
            key={section.id}
            className={cn(
              'group flex items-center gap-1.5 px-2 py-1.5 transition-colors',
              selectedSectionId === section.id ? 'bg-blue-50' : 'hover:bg-gray-50',
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-100 text-[9px] font-semibold text-gray-400">
              {i + 1}
            </span>
            <button
              onClick={() => setSelectedSection(section.id)}
              className={cn(
                'flex-1 truncate text-left text-[11px] transition-colors',
                selectedSectionId === section.id ? 'text-blue-700' : 'text-gray-600',
              )}
            >
              {section.label ?? section.layout}
            </button>
            <div className={cn(
              'flex items-center gap-0.5 transition-opacity',
              selectedSectionId === section.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}>
              <button
                onClick={() => moveSection(section.id, 'up')}
                disabled={i === 0}
                className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronUp size={9} />
              </button>
              <button
                onClick={() => moveSection(section.id, 'down')}
                disabled={i === doc.sections.length - 1}
                className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
              >
                <ChevronDown size={9} />
              </button>
              <button
                onClick={() => removeSection(section.id)}
                className="flex h-4 w-4 items-center justify-center rounded text-gray-300 hover:bg-red-50 hover:text-red-400"
              >
                <Trash2 size={9} />
              </button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-1.5 px-2 py-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-gray-50 text-[9px] text-gray-300">
            🔒
          </span>
          <span className="text-[11px] italic text-gray-300">Unsubscribe</span>
        </div>
      </div>
    </div>
  )
}

function SectionsPanel() {
  const { selectedSectionId, insertSection, addSection } = useEmailStore()

  const handleLayout = useCallback(
    (layout: SectionLayout) => {
      addSection({ layout, afterSectionId: selectedSectionId ?? undefined })
    },
    [addSection, selectedSectionId],
  )

  const handlePreset = useCallback(
    (fn: () => ReturnType<typeof presetHero>) => {
      const section = fn()
      insertSection(section, selectedSectionId)
    },
    [insertSection, selectedSectionId],
  )

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="border-b border-gray-100 px-3 pb-3 pt-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Layout
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          {LAYOUTS.map((l) => (
            <LayoutCard key={l.id} layout={l} onClick={() => handleLayout(l.id)} />
          ))}
        </div>
        <p className="mt-2 text-[9px] text-gray-400">
          Inserts after selected section
        </p>
      </div>

      <div className="px-3 pb-3 pt-2">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Presets
        </p>
        <div className="flex flex-col gap-1.5">
          {PRESET_SECTIONS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePreset(p.fn)}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-left transition-all hover:border-blue-400 hover:shadow-sm"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-50 text-gray-400">
                <LayoutGrid size={14} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-gray-700">{p.label}</p>
                <p className="text-[10px] text-gray-400">{p.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function BlocksPanel() {
  const { document: doc, selectedSectionId, addBlock } = useEmailStore()

  const selectedSection = doc.sections.find((s) => s.id === selectedSectionId)
  const targetColumnId = selectedSection?.columns[0]?.id

  const handleAdd = useCallback(
    (blockTypeId: string) => {
      if (!selectedSectionId || !targetColumnId) return

      let block
      switch (blockTypeId) {
        case 'heading':  block = makeHeadingBlock('Your heading here'); break
        case 'text':     block = makeBodyBlock('Add your copy here.'); break
        case 'image':    block = makeImageBlock('', 'Image'); break
        case 'button':   block = makeButtonBlock('Click Here', '#'); break
        case 'divider':  block = makeDividerBlock(); break
        case 'spacer':   block = makeSpacerBlock(24); break
        case 'logo':     block = makeLogoBlock({ isGlobal: true }); break
        default: return
      }

      addBlock({ sectionId: selectedSectionId, columnId: targetColumnId, block })
    },
    [selectedSectionId, targetColumnId, addBlock],
  )

  const hasTarget = !!selectedSectionId && !!targetColumnId

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <div className={cn(
        'mb-3 rounded-lg border px-3 py-2 text-[11px]',
        hasTarget
          ? 'border-blue-200 bg-blue-50 text-blue-700'
          : 'border-gray-200 bg-gray-50 text-gray-400',
      )}>
        {hasTarget
          ? `Adding to: ${selectedSection?.label ?? selectedSection?.layout}`
          : 'Select a section first'}
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        Content
      </p>
      <div className="mb-3 grid grid-cols-2 gap-1.5">
        {BLOCK_TYPES.map((b) => (
          <button
            key={b.id}
            onClick={() => handleAdd(b.id)}
            disabled={!hasTarget}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-medium transition-all',
              hasTarget
                ? 'border-gray-200 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
                : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300',
            )}
          >
            <span className={hasTarget ? 'text-gray-400' : 'text-gray-200'}>{b.icon}</span>
            {b.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StylesPanel() {
  const { document: doc, updateGlobalStyles } = useEmailStore()
  const g = doc.globalStyles

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
      <Field label="Email Background">
        <ColorRow
          value={g.backgroundColor}
          onChange={(v) => updateGlobalStyles({ backgroundColor: v })}
        />
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
        <ColorRow
          value={g.linkColor}
          onChange={(v) => updateGlobalStyles({ linkColor: v })}
        />
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

function SettingsPanel() {
  const { document: doc, updateSubject, updatePreheader, updateGlobalStyles } = useEmailStore()

  return (
    <div className="flex flex-1 flex-col overflow-auto px-3 pb-3 pt-2">
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
        <p className="mt-1 text-[10px] text-gray-400">
          Shown after subject in most email clients
        </p>
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
        'flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[9px] font-medium transition-colors',
        active
          ? 'bg-blue-50 text-blue-600'
          : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600',
      )}
    >
      {icon}
      <span className="leading-none">{label}</span>
    </button>
  )
}

// ─── BlockContent: full-size interactive block renderer ───────────────────────

function BlockContent({
  type,
  onTextClick,
}: {
  type: string
  onTextClick: (e: React.MouseEvent) => void
}) {
  const editableProps = {
    contentEditable: true as const,
    suppressContentEditableWarning: true,
    onClick: onTextClick,
    className: 'cursor-text outline-none border-2 border-transparent hover:border-blue-200 rounded px-1',
  }

  switch (type) {
    case 'image-left-text-right':
      return (
        <div className="flex min-h-[300px]">
          <div className="w-1/2">
            <img
              src="https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=500&fit=crop"
              alt="Fashion"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="w-1/2 flex flex-col items-center justify-center p-12 gap-4">
            <p {...editableProps} className={`${editableProps.className} italic text-sm text-gray-500`}>
              From The &apos;Gram
            </p>
            <h2 {...editableProps} className={`${editableProps.className} text-3xl text-center font-serif`}>
              The Post That Got Everyone Talking
            </h2>
            <div className="w-16 h-px bg-gray-400" />
            <button className="text-xs bg-gray-200 px-6 py-2">SEE IT</button>
          </div>
        </div>
      )

    case 'centered-content':
      return (
        <div className="bg-gray-100 p-12 text-center">
          <div className="bg-white p-8 inline-block rounded shadow-sm">
            <div {...editableProps} className={`${editableProps.className} text-5xl font-serif text-gray-600`}>
              6
            </div>
            <h3 {...editableProps} className={`${editableProps.className} text-2xl font-serif mt-2`}>
              Tips to Photograph Food
            </h3>
            <p {...editableProps} className={`${editableProps.className} text-sm text-gray-600 max-w-xs mt-3`}>
              I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <span className="text-sm text-gray-400">001</span>
              <button className="text-xs bg-gray-800 text-white px-6 py-2">READ IT</button>
            </div>
          </div>
        </div>
      )

    case 'text-over-image':
      return (
        <div className="bg-white">
          <div className="p-12 text-center">
            <div className="w-16 h-px bg-black mb-4 mx-auto" />
            <h3 {...editableProps} className={`${editableProps.className} text-2xl font-bold tracking-widest uppercase`}>
              A Little Gift of Thanks for Joining the List.
            </h3>
            <div className="w-16 h-px bg-black mt-4 mx-auto" />
          </div>
          <div
            className="h-64 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=680&h=400&fit=crop)' }}
          />
        </div>
      )

    case 'text-left-image-right':
      return (
        <div className="flex min-h-[300px]">
          <div className="w-1/3 p-12 flex items-center justify-center">
            <h3 {...editableProps} className={`${editableProps.className} text-4xl font-bold leading-tight`}>
              WEL—COME
            </h3>
          </div>
          <div
            className="w-2/3 bg-cover bg-center min-h-[300px]"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&h=400&fit=crop)' }}
          />
        </div>
      )

    case 'recipe-card':
      return (
        <div className="flex bg-white p-8 gap-8 min-h-[280px]">
          <div
            className="w-1/2 bg-cover bg-center rounded"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop)' }}
          />
          <div className="w-1/2 flex flex-col justify-center gap-3 px-4">
            <p {...editableProps} className={`${editableProps.className} italic text-gray-500 text-sm`}>
              One
            </p>
            <h3 {...editableProps} className={`${editableProps.className} text-xl font-serif`}>
              Click here for my creamy butternut squash soup
            </h3>
            <p {...editableProps} className={`${editableProps.className} italic text-gray-500 text-sm`}>
              A warming recipe perfect for fall evenings.
            </p>
          </div>
        </div>
      )

    case 'image-top-text-bottom':
      return (
        <div className="bg-white">
          <div
            className="h-96 bg-cover bg-center"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=680&h=400&fit=crop)' }}
          />
          <div className="bg-gray-100 p-12 text-center">
            <h3 {...editableProps} className={`${editableProps.className} text-2xl font-serif mb-3`}>
              Get 25% off when you book my services
            </h3>
            <p {...editableProps} className={`${editableProps.className} italic text-gray-500`}>
              for the next 24 hours only.
            </p>
          </div>
        </div>
      )

    case 'testimonial':
      return (
        <div className="flex bg-gray-50 p-12 gap-8 min-h-[200px]">
          <div
            className="w-32 h-32 bg-cover bg-center rounded shrink-0"
            style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop)' }}
          />
          <div className="flex-1 flex flex-col justify-center gap-3">
            <h4 {...editableProps} className={`${editableProps.className} font-bold tracking-widest text-sm`}>
              TESTIMONIAL NAME
            </h4>
            <p {...editableProps} className={`${editableProps.className} text-gray-600 text-sm leading-relaxed`}>
              Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.
            </p>
            <div className="text-xl text-yellow-400">★★★★☆</div>
          </div>
        </div>
      )

    default:
      return (
        <div className="h-32 flex items-center justify-center text-gray-400 text-sm">
          Unknown block type: {type}
        </div>
      )
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export const EmailEditorPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<EmailTab>('sections')
  const [panelOpen, setPanelOpen] = useState(true)

  // Canvas state
  const [canvasBlocks, setCanvasBlocks] = useState<CanvasBlock[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showTextEdit, setShowTextEdit] = useState(false)
  const [textToolbarPosition, setTextToolbarPosition] = useState<{ top: number; left: number } | undefined>(undefined)

  const {
    document: doc,
    previewMode,
    setPreviewMode,
  } = useEmailStore()

  const handleTabClick = (tab: EmailTab) => {
    if (activeTab === tab) {
      setPanelOpen((o) => !o)
    } else {
      setActiveTab(tab)
      setPanelOpen(true)
    }
  }

  const RAIL_ITEMS: { id: EmailTab; icon: React.ReactNode; label: string }[] = [
    { id: 'structure', icon: <Layers size={14} />,   label: 'Tree' },
    { id: 'sections',  icon: <LayoutGrid size={14} />, label: 'Sections' },
    { id: 'blocks',    icon: <Type size={14} />,      label: 'Blocks' },
    { id: 'styles',    icon: <Palette size={14} />,   label: 'Styles' },
    { id: 'settings',  icon: <Settings2 size={14} />, label: 'Settings' },
  ]

  // Canvas block actions
  const handleMoveUp = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx <= 0) return prev
      const next = [...prev]
      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
      return next
    })
  }, [])

  const handleMoveDown = useCallback((id: string) => {
    setCanvasBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id)
      if (idx < 0 || idx >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
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
  }, [])

  const handleBlockSelect = useCallback((blockType: string) => {
    const newBlock: CanvasBlock = { id: nanoid(), type: blockType }
    setCanvasBlocks((prev) => [...prev, newBlock])
    setSelectedId(newBlock.id)
  }, [])

  const handleTextClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setTextToolbarPosition({ top: e.clientY - 50, left: e.clientX - 60 })
    setShowTextEdit(true)
  }, [])

  const handleCanvasClick = useCallback(() => {
    setSelectedId(null)
    setTextToolbarPosition(undefined)
    setShowTextEdit(false)
  }, [])

  return (
    <div className="absolute inset-0 flex overflow-hidden">

      {/* ── Icon Rail ─────────────────────────────────────── */}
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

      {/* ── Slide-out Sub-panel ───────────────────────────── */}
      <aside
        className={cn(
          'flex shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-200',
          panelOpen ? 'w-[216px]' : 'w-0 overflow-hidden',
        )}
      >
        {panelOpen && (
          <>
            {activeTab === 'structure' && <StructurePanel />}
            {activeTab === 'sections'  && <SectionsPanel />}
            {activeTab === 'blocks'    && <BlocksPanel />}
            {activeTab === 'styles'    && <StylesPanel />}
            {activeTab === 'settings'  && <SettingsPanel />}
          </>
        )}
      </aside>

      {/* ── Centre: Canvas ────────────────────────────────── */}
      <div className="relative flex flex-1 flex-col overflow-hidden bg-[#F3F4F6]">

        {/* Toolbar strip */}
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
              <Monitor size={12} />
              Desktop
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] transition-colors',
                previewMode === 'mobile' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500',
              )}
            >
              <Smartphone size={12} />
              Mobile
            </button>
          </div>
        </div>

        {/* Scrollable canvas area */}
        <div
          className="flex flex-1 items-start justify-center overflow-auto py-8"
          onClick={handleCanvasClick}
        >
          <div className="max-w-[680px] w-full px-4">
            {canvasBlocks.length === 0 ? (
              <div className="flex items-center justify-center rounded-xl bg-white border-2 border-dashed border-gray-300 py-24">
                <div className="text-center">
                  <p className="text-[13px] text-gray-400 font-medium">Select a block from the right panel to get started</p>
                  <p className="text-[11px] text-gray-300 mt-1">Your email blocks will appear here</p>
                </div>
              </div>
            ) : (
              canvasBlocks.map((block) => (
                <div
                  key={block.id}
                  className="flex items-start gap-3 mb-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Block content */}
                  <div
                    className={cn(
                      'flex-1 border-2 rounded cursor-pointer overflow-hidden',
                      selectedId === block.id ? 'border-blue-500' : 'border-transparent',
                    )}
                    onClick={() => setSelectedId(block.id)}
                  >
                    <BlockContent type={block.type} onTextClick={handleTextClick} />
                  </div>

                  {/* Floating action bar — only when selected */}
                  {selectedId === block.id && (
                    <FloatingActionBar
                      onMoveUp={() => handleMoveUp(block.id)}
                      onMoveDown={() => handleMoveDown(block.id)}
                      onDuplicate={() => handleDuplicate(block.id)}
                      onDelete={() => handleDelete(block.id)}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Floating text toolbar */}
        <FloatingTextToolbar position={textToolbarPosition} />
      </div>

      {/* ── Right: Block Library / Text Edit Panel ────────── */}
      <aside className="flex w-[320px] shrink-0 flex-col border-l border-gray-200 bg-white">
        {showTextEdit ? (
          <TextEditPanel onClose={() => { setShowTextEdit(false); setTextToolbarPosition(undefined) }} />
        ) : (
          <BlockLibrary
            selectedBlock={selectedId ? canvasBlocks.find((b) => b.id === selectedId)?.type : undefined}
            onBlockSelect={handleBlockSelect}
          />
        )}
      </aside>

    </div>
  )
}
