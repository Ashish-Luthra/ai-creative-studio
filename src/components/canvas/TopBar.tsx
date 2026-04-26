'use client'

import { Minus, Plus, Save, Trash2 } from 'lucide-react'

export interface TopBarProps {
  fileName: string
  onSave: () => void
  onClear: () => void
  zoomPercent?: number
  onZoomIn?: () => void
  onZoomOut?: () => void
}

export const TopBar: React.FC<TopBarProps> = ({
  fileName,
  onSave,
  onClear,
  zoomPercent = 100,
  onZoomIn,
  onZoomOut,
}) => {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-3.5 z-40">
      <div className="flex items-center gap-2 text-[12px] font-medium text-gray-700">
        <span className="text-gray-500">File:</span>
        <span>{fileName?.trim() ? fileName : 'Untitled'}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="mr-1 flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
          <button
            onClick={onZoomOut}
            title="Zoom out"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Minus size={12} />
          </button>
          <span className="min-w-[48px] text-center text-[11px] font-semibold text-gray-700">
            {zoomPercent}%
          </span>
          <button
            onClick={onZoomIn}
            title="Zoom in"
            className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Plus size={12} />
          </button>
        </div>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700"
        >
          <Save size={11} />
          Save
        </button>
        <button
          onClick={onClear}
          className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 transition-colors hover:bg-gray-100"
        >
          <Trash2 size={11} />
          Clear
        </button>
      </div>
    </header>
  )
}
