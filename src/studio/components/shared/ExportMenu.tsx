'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, Code2, Download, FileText, Image as ImageIcon, Send } from 'lucide-react'
import { cn } from '@studio/lib/utils'

export type ExportFormat = 'png' | 'pdf' | 'html'

export interface ExportMenuProps {
  mode: 'canvas' | 'email'
  onExport: (format: ExportFormat) => void | Promise<void>
  /** Required when mode === 'email'. Click handler for the "Send test email" item. */
  onSendTest?: () => void
  /** Optional className for the trigger button (so it can match its host nav). */
  className?: string
}

/**
 * Shared Export dropdown menu.
 * Renders an "Export" button + a dropdown with PNG, PDF, HTML and (email-only) "Send test email".
 */
export const ExportMenu: React.FC<ExportMenuProps> = ({
  mode,
  onExport,
  onSendTest,
  className,
}) => {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const run = async (format: ExportFormat) => {
    setOpen(false)
    setBusy(true)
    try {
      await onExport(format)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50',
          className,
        )}
      >
        <Download size={12} />
        {busy ? 'Exporting…' : 'Export'}
        <ChevronDown
          size={10}
          className={cn('transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-48 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <MenuItem icon={<ImageIcon size={13} />} label="PNG" onClick={() => run('png')} />
          <MenuItem icon={<FileText size={13} />} label="PDF" onClick={() => run('pdf')} />
          <MenuItem icon={<Code2 size={13} />} label="HTML" onClick={() => run('html')} />
          {mode === 'email' && onSendTest && (
            <>
              <div className="border-t border-gray-100" />
              <MenuItem
                icon={<Send size={13} />}
                label="Send test email"
                onClick={() => {
                  setOpen(false)
                  onSendTest()
                }}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}

const MenuItem: React.FC<{
  icon: React.ReactNode
  label: string
  onClick: () => void
}> = ({ icon, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-gray-700 transition-colors hover:bg-gray-50"
  >
    <span className="text-gray-500">{icon}</span>
    {label}
  </button>
)
