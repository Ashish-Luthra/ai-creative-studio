'use client'

import { useState, useCallback } from 'react'
import { useEmailStore } from '@/lib/email/emailStore'
import {
  presetHero,
  presetImageText,
  presetBodyText,
  presetTextOverImage,
  presetTextLeftImageRight,
  presetTwoColumn,
} from '@/lib/email/templates'
import { BlockPreview } from './BlockPreview'

// ─── Block catalogue ──────────────────────────────────────────────────────────

const LAYOUT_BLOCKS = [
  {
    id: 'image-left-text-right',
    name: 'Image + Text',
    fn: presetImageText,
  },
  {
    id: 'centered-content',
    name: 'Centered Content',
    fn: presetHero,
  },
  {
    id: 'text-over-image',
    name: 'Text + Image',
    fn: presetTextOverImage,
  },
  {
    id: 'text-left-image-right',
    name: 'Text Left, Image Right',
    fn: presetTextLeftImageRight,
  },
] as const

type BlockId = typeof LAYOUT_BLOCKS[number]['id']

type Tab = 'layout' | 'link' | 'block'

// ─── Component ────────────────────────────────────────────────────────────────

export function BlockLibrary() {
  const { selectedSectionId, insertSection } = useEmailStore()
  const [activeTab, setActiveTab] = useState<Tab>('layout')
  const [lastSelected, setLastSelected] = useState<BlockId | null>(null)

  const handleSelect = useCallback(
    (id: BlockId) => {
      const entry = LAYOUT_BLOCKS.find((b) => b.id === id)
      if (!entry) return
      setLastSelected(id)
      const section = entry.fn()
      insertSection(section, selectedSectionId)
    },
    [selectedSectionId, insertSection],
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          Design Blocks
        </span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-4 border-b border-gray-200 px-4">
        {(['layout', 'link', 'block'] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-2 text-[11px] font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Block grid */}
      <div className="flex-1 overflow-auto px-4 py-4">
        {activeTab === 'layout' && (
          <div className="space-y-4">
            {LAYOUT_BLOCKS.map((block) => (
              <div key={block.id}>
                <BlockPreview
                  type={block.id}
                  isSelected={lastSelected === block.id}
                  onClick={() => handleSelect(block.id)}
                />
                <p className="mt-1.5 text-center text-[10px] text-gray-400">{block.name}</p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'link' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[11px] text-gray-400">Link blocks coming soon</p>
          </div>
        )}

        {activeTab === 'block' && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-[11px] text-gray-400">Custom blocks coming soon</p>
          </div>
        )}
      </div>

      {/* Hint */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-2">
        <p className="text-[9px] text-gray-400">
          Click a block to insert it after the selected section
        </p>
      </div>
    </div>
  )
}
