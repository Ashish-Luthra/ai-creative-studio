'use client'

import { Undo2, Redo2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCanvasStore, type CanvasMode } from '@/lib/canvas/canvasStore'
import { useEmailStore } from '@/lib/email/emailStore'

const MODES: { id: CanvasMode; label: string }[] = [
  { id: 'canvas', label: 'Canvas' },
  { id: 'email', label: 'Email' },
  { id: 'feeds', label: 'Feeds' },
]

export interface TopBarProps {
  onExport?: () => void
  onZoomIn?: () => void
  onZoomOut?: () => void
  onZoomReset?: () => void
  onSelectAll?: () => void
  onClearCanvas?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  onExport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onSelectAll,
  onClearCanvas,
}) => {
  const { mode, setMode, undo, redo, undoStack, redoStack, zoom } = useCanvasStore()
  const emailUndo = useEmailStore((s) => s.undo)
  const emailRedo = useEmailStore((s) => s.redo)
  const emailHistoryLength = useEmailStore((s) => s.history.length)
  const emailFutureLength = useEmailStore((s) => s.future.length)
  const compiledHtml = useEmailStore((s) => s.compiledHtml)

  const canUndo = mode === 'email' ? emailHistoryLength > 0 : undoStack.length > 0
  const canRedo = mode === 'email' ? emailFutureLength > 0 : redoStack.length > 0

  const handleUndo = () => {
    if (mode === 'email') {
      emailUndo()
      return
    }
    void undo()
  }

  const handleRedo = () => {
    if (mode === 'email') {
      emailRedo()
      return
    }
    void redo()
  }

  const handleExport = () => {
    if (mode === 'email') {
      const blob = new Blob([compiledHtml], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = 'email-export.html'
      anchor.click()
      URL.revokeObjectURL(url)
      return
    }
    onExport?.()
  }

  return (
    <header className="z-40 flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3.5">
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
            type="button"
            onClick={() => setMode(id)}
            className={cn(
              'rounded-md px-3.5 py-1 text-[11px] font-medium transition-all',
              mode === id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Right — canvas zoom / selection (canvas only) + undo/redo/export */}
      <div className="flex items-center gap-1.5">
        {mode === 'canvas' && (
          <>
            <button
              type="button"
              onClick={onZoomOut}
              title="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              −
            </button>
            <button
              type="button"
              onClick={onZoomReset}
              title="Reset zoom"
              className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={onZoomIn}
              title="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              +
            </button>
            <div className="mx-1 h-4 w-px bg-gray-200" />
            <button
              type="button"
              onClick={onSelectAll}
              title="Select all"
              className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-gray-500 hover:bg-gray-100"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={onClearCanvas}
              title="Clear canvas"
              className="rounded-md px-1.5 py-1 text-[10px] font-semibold text-red-500 hover:bg-red-50"
            >
              Clear
            </button>
            <div className="mx-1 h-4 w-px bg-gray-200" />
          </>
        )}

        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          title="Undo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          title="Redo"
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
        >
          <Redo2 size={13} />
        </button>

        <div className="mx-1.5 h-4 w-px bg-gray-200" />

        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Download size={11} />
          {mode === 'email' ? 'Export HTML' : 'Export'}
        </button>
      </div>
    </header>
  )
}
