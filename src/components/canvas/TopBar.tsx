'use client'

import { Undo2, Redo2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore, type CanvasMode } from '@/lib/canvas/canvasStore'

const MODES: { id: CanvasMode; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'email',  label: 'Email'  },
  { id: 'feeds',  label: 'Feeds'  },
]

export interface TopBarProps {
  onExport?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({ onExport }) => {
  const { mode, setMode, undo, redo, undoStack, redoStack } = useCanvasStore()

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3.5 z-40">
      {/* Left — logo + wordmark */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-gray-900">
          <span className="text-[11px] font-black text-white">✦</span>
        </div>
        <span className="text-[12px] font-semibold text-gray-700">
          AI <span className="text-blue-600">Creative</span> Studio
        </span>
      </div>

      {/* Centre — mode toggle */}
      <nav className="flex rounded-lg bg-gray-100 p-0.5">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={cn(
              'rounded-md px-3.5 py-1 text-[11px] font-medium transition-all',
              mode === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right — undo / redo / export */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <Redo2 size={13} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-gray-200" />

        <button
          onClick={onExport}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Download size={11} />
          {mode === 'email' ? 'Export HTML' : 'Export'}
        </button>
      </div>
    </header>
  )
}
