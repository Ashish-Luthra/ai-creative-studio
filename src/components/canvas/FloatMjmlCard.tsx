'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MjmlSection {
  id: string
  label: string
  color: string
  columns: MjmlColumn[]
}

export interface MjmlColumn {
  id: string
  label: string
  color: string
  blocks?: MjmlBlock[]
}

export interface MjmlBlock {
  id: string
  label: string
  active?: boolean
}

const DEFAULT_SECTIONS: MjmlSection[] = [
  {
    id: 's1', label: 'Section 1 — Hero', color: '#EDE9FE',
    columns: [
      {
        id: 'c1', label: 'Column (1/1)', color: '#DDD6FE',
        blocks: [{ id: 'b1', label: 'Image Block', active: true }],
      },
    ],
  },
  {
    id: 's2', label: 'Section 2 — Body', color: '#DCFCE7',
    columns: [
      { id: 'c2', label: 'Column (1/2)', color: '#BBF7D0' },
      { id: 'c3', label: 'Column (2/2)', color: '#BBF7D0' },
    ],
  },
  {
    id: 's3', label: 'Section 3 — CTA', color: '#FEF3C7',
    columns: [],
  },
]

export interface FloatMjmlCardProps {
  sections?: MjmlSection[]
  onAddSection?: () => void
  activeBlockId?: string
}

export const FloatMjmlCard: React.FC<FloatMjmlCardProps> = ({
  sections = DEFAULT_SECTIONS,
  onAddSection,
  activeBlockId,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['s1', 'c1']))

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <div
      className={cn(
        // Spec: floating card, right side, vertically centred — not pinned
        'absolute right-5 top-1/2 z-50 w-[220px] -translate-y-1/2',
        'rounded-2xl border border-white/70 bg-white/90',
        'p-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.10),0_2px_6px_rgba(0,0,0,0.05)]',
        'backdrop-blur-[16px]'
      )}
    >
      <h3 className="mb-2.5 text-[10px] font-bold uppercase tracking-[.08em] text-gray-500">
        MJML Structure
      </h3>

      <div className="space-y-0.5">
        {sections.map((section) => {
          const sOpen = expanded.has(section.id)
          return (
            <div key={section.id}>
              {/* Section row */}
              <TreeRow
                color={section.color}
                label={section.label}
                open={sOpen}
                hasChildren={section.columns.length > 0}
                onToggle={() => toggle(section.id)}
              />

              {/* Columns */}
              {sOpen &&
                section.columns.map((col) => {
                  const cOpen = expanded.has(col.id)
                  return (
                    <div key={col.id}>
                      <TreeRow
                        color={col.color}
                        label={col.label}
                        open={cOpen}
                        hasChildren={!!col.blocks?.length}
                        onToggle={() => toggle(col.id)}
                        indent={1}
                      />

                      {/* Blocks */}
                      {cOpen &&
                        col.blocks?.map((block) => (
                          <TreeRow
                            key={block.id}
                            color="#C7D2FE"
                            label={block.label}
                            hasChildren={false}
                            active={block.id === activeBlockId || block.active}
                            indent={2}
                          />
                        ))}
                    </div>
                  )
                })}
            </div>
          )
        })}
      </div>

      {/* Add Section */}
      <div className="mt-2.5 border-t border-black/[0.06] pt-2">
        <button
          onClick={onAddSection}
          className="flex w-full items-center gap-1.5 rounded-md border border-dashed border-black/10 bg-black/[0.02] px-2 py-1.5 text-[11px] text-gray-500 transition-colors hover:bg-black/[0.04]"
        >
          <Plus size={11} />
          Add Section
        </button>
      </div>
    </div>
  )
}

/* ── TreeRow ───────────────────────────────────────────────── */

interface TreeRowProps {
  color: string
  label: string
  open?: boolean
  hasChildren: boolean
  active?: boolean
  indent?: number
  onToggle?: () => void
}

const TreeRow: React.FC<TreeRowProps> = ({
  color, label, open, hasChildren, active, indent = 0, onToggle,
}) => (
  <button
    onClick={onToggle}
    className={cn(
      'flex w-full items-center gap-1.5 rounded-[5px] px-1.5 py-1 text-left transition-colors',
      active ? 'bg-blue-50' : 'hover:bg-black/[0.03]'
    )}
    style={{ paddingLeft: `${6 + indent * 14}px` }}
  >
    {hasChildren ? (
      open
        ? <ChevronDown size={9} className="shrink-0 text-gray-400" />
        : <ChevronRight size={9} className="shrink-0 text-gray-400" />
    ) : (
      <span className="w-[9px] shrink-0" />
    )}
    <div
      className="h-3.5 w-3.5 shrink-0 rounded-[3px]"
      style={{ background: color }}
    />
    <span
      className={cn(
        'text-[11px] font-medium',
        active ? 'text-blue-600' : 'text-gray-700'
      )}
    >
      {label}
    </span>
  </button>
)
