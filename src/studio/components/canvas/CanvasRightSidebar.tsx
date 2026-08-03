'use client'

import { ChevronDown } from 'lucide-react'
import { cn } from '@studio/lib/utils'

/**
 * The single right-hand control bar for the ads canvas. Every editing control
 * (text/shape/frame/image for the current selection, plus the design, shapes
 * and draw tools) lives here so the user never hunts floating panels.
 */
export const CanvasRightSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <aside className="absolute inset-y-0 right-0 z-[70] flex w-72 flex-col overflow-y-auto border-l border-gray-200 bg-white">
    {children}
  </aside>
)

/** One collapsible sidebar section. Controlled, so tools can pop theirs open. */
export const SidebarSection: React.FC<{
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}> = ({ title, open, onToggle, children }) => (
  <div className="border-b border-gray-100">
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3 py-2.5 text-[12px] font-semibold text-gray-900 hover:bg-gray-50"
    >
      {title}
      <ChevronDown
        size={14}
        className={cn('text-gray-400 transition-transform', open ? '' : '-rotate-90')}
      />
    </button>
    {open && <div className="pb-2">{children}</div>}
  </div>
)

/** Label above the contextual selection controls ("Text selected", …). */
export const SidebarSelectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="border-b border-gray-100 bg-gray-50/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
    {children}
  </div>
)
