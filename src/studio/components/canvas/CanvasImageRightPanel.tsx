'use client'

import type { Canvas } from 'fabric'
import { CanvasArrangeSection } from './CanvasArrangeSection'

interface Props {
  canvas: Canvas | null
  onCommit: () => void
  /** Render in-flow inside CanvasRightSidebar instead of floating. */
  embedded?: boolean
}

export const CanvasImageRightPanel: React.FC<Props> = ({ canvas, onCommit, embedded = false }) => {
  if (!canvas) return null
  return (
    <aside className={embedded
    ? 'flex w-full flex-col bg-white'
    : 'absolute right-5 top-20 z-[60] flex max-h-[calc(100vh-120px)] w-72 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl'}>
      <div className="flex-1 overflow-auto px-4 py-2">
        <CanvasArrangeSection canvas={canvas} onCommit={onCommit} />
      </div>
    </aside>
  )
}
