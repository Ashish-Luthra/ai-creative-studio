'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Eye, FolderOpen, Minus, Plus, Redo2, Undo2 } from 'lucide-react'
import { SaveIcon } from './AllyvateIcons'
import { cn } from '@studio/lib/utils'
import { useCanvasStore } from '@studio/lib/canvas/canvasStore'
import { ExportMenu, type ExportFormat } from '@studio/components/shared/ExportMenu'

export interface CampaignMetaLite {
  briefId: string
  name: string
  updatedAt: string | null
}

export interface CanvasTopHeaderProps {
  fileName: string
  onRename: (next: string) => void
  recentCampaigns: CampaignMetaLite[]
  onOpenRecent: (briefId: string) => void
  onSave?: () => void | Promise<void>
  /** Opens (or reopens) the brief agent — the pill it replaces is gone. */
  onAgentClick?: () => void
  onPublishClick?: () => void
  onPreview?: () => void
  onExport?: (format: ExportFormat) => void | Promise<void>
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error'
}

export const CanvasTopHeader: React.FC<CanvasTopHeaderProps> = ({
  fileName,
  onRename,
  recentCampaigns,
  onOpenRecent,
  onSave,
  onAgentClick,
  onPublishClick,
  onPreview,
  onExport,
  saveStatus = 'idle',
}) => {
  const zoom = useCanvasStore((s) => s.zoom)
  const setZoom = useCanvasStore((s) => s.setZoom)
  const undo = useCanvasStore((s) => s.undo)
  const redo = useCanvasStore((s) => s.redo)
  const undoStack = useCanvasStore((s) => s.undoStack)
  const redoStack = useCanvasStore((s) => s.redoStack)

  const [openDropdown, setOpenDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!openDropdown) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [openDropdown])

  const stepZoom = (delta: number) => {
    const current = useCanvasStore.getState().zoom
    const next = Math.min(4, Math.max(0.1, +(current + delta).toFixed(2)))
    setZoom(next)
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      {/* Open dropdown */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          onClick={() => setOpenDropdown((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
        >
          <FolderOpen size={12} />
          Open
          <ChevronDown size={10} className={cn('transition-transform', openDropdown && 'rotate-180')} />
        </button>
        {openDropdown && (
          <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
            <div className="border-b border-gray-100 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Recent Campaigns</p>
            </div>
            <div className="max-h-64 overflow-auto">
              {recentCampaigns.length === 0 ? (
                <p className="px-3 py-4 text-center text-[11px] text-gray-400">No recent campaigns</p>
              ) : (
                recentCampaigns.map((c) => (
                  <button
                    key={c.briefId}
                    onClick={() => { setOpenDropdown(false); onOpenRecent(c.briefId) }}
                    className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-gray-800">{c.name}</p>
                      {c.updatedAt && (
                        <p className="text-[9px] text-gray-300">
                          {new Date(c.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* File name input */}
      <input
        type="text"
        value={fileName}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Untitled campaign"
        className="w-48 shrink-0 bg-transparent text-left text-[11px] font-medium text-gray-700 placeholder:text-gray-300 focus:outline-none focus:ring-0"
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Agent — the entry into the brief flow now that the canvas pill is gone */}
      {onAgentClick && (
        <button
          onClick={onAgentClick}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-700 transition-colors hover:border-gray-300 hover:text-gray-900"
        >
          <span className="text-[10px] font-black">✦</span>
          Agent
        </button>
      )}

      {/* Save */}
      <button
        onClick={() => onSave?.()}
        disabled={saveStatus === 'saving'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
          saveStatus === 'saved'
            ? 'bg-green-50 text-green-600'
            : saveStatus === 'error'
            ? 'bg-red-50 text-red-600'
            : 'bg-gray-900 text-white hover:bg-gray-700',
        )}
      >
        {saveStatus === 'saved' ? <Check size={11} /> : <SaveIcon size={11} />}
        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Error' : 'Save'}
      </button>

      {/* Preview */}
      <button
        onClick={() => onPreview?.()}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50"
      >
        <Eye size={12} />
        Preview
      </button>

      {/* Export */}
      {onExport && <ExportMenu mode="canvas" onExport={onExport} />}

      {/* Publish */}
      {onPublishClick && (
        <button
          onClick={onPublishClick}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Publish
        </button>
      )}

      {/* Zoom controls */}
      <div className="inline-flex items-center rounded-lg border border-gray-200 bg-white">
        <button
          onClick={() => stepZoom(-0.1)}
          className="flex h-6 w-6 items-center justify-center text-gray-500 hover:text-gray-800"
          title="Zoom out"
        >
          <Minus size={12} />
        </button>
        <span className="min-w-[36px] text-center text-[11px] font-medium text-gray-600">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => stepZoom(0.1)}
          className="flex h-6 w-6 items-center justify-center text-gray-500 hover:text-gray-800"
          title="Zoom in"
        >
          <Plus size={12} />
        </button>
      </div>

      {/* Undo / Redo */}
      <div className="inline-flex items-center gap-0.5">
        <button
          onClick={() => { void undo() }}
          disabled={undoStack.length === 0}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Undo"
        >
          <Undo2 size={13} />
        </button>
        <button
          onClick={() => { void redo() }}
          disabled={redoStack.length === 0}
          className="flex h-6 w-6 items-center justify-center rounded text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
          title="Redo"
        >
          <Redo2 size={13} />
        </button>
      </div>
    </div>
  )
}
