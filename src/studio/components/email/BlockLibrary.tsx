'use client'
import { BlockPreview, type BlockType } from './BlockPreview'

interface BlockLibraryProps {
  onBlockSelect?: (blockType: string) => void
  selectedBlock?: string
}

const BLOCKS: { id: BlockType; name: string }[] = [
  { id: 'centered-content',      name: 'Centered Content' },
  { id: 'image-left-text-right', name: 'Image Left, Text Right' },
  { id: 'text-over-image',       name: 'Text Over Image' },
  { id: 'text-left-image-right', name: 'Text Left, Image Right' },
  { id: 'recipe-card',           name: 'Recipe Card' },
  { id: 'image-top-text-bottom', name: 'Image Top, Text Bottom' },
  { id: 'testimonial',           name: 'Testimonial' },
]

export function BlockLibrary({ onBlockSelect, selectedBlock }: BlockLibraryProps) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center border-b border-gray-100 px-4">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Design Blocks</span>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 gap-4 border-b border-gray-200 px-4">
        <button className="py-2 text-[11px] font-medium border-b-2 border-gray-900 text-gray-900">Layout</button>
        <button className="py-2 text-[11px] font-medium text-gray-400 hover:text-gray-600">Link</button>
        <button className="py-2 text-[11px] font-medium text-gray-400 hover:text-gray-600">Block</button>
      </div>

      {/* Block grid */}
      <div className="flex-1 overflow-auto px-4 py-4 space-y-4">
        {BLOCKS.map((block) => (
          <div key={block.id}>
            <BlockPreview
              type={block.id}
              isSelected={selectedBlock === block.id}
              onClick={() => onBlockSelect?.(block.id)}
            />
            <p className="mt-1.5 text-center text-[10px] text-gray-400">{block.name}</p>
          </div>
        ))}
      </div>

      {/* Hint */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-2">
        <p className="text-[9px] text-gray-400">Click a block to add it to the canvas</p>
      </div>
    </div>
  )
}
