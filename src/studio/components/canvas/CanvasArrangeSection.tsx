'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { cn } from '@studio/lib/utils'

interface Props {
  canvas: Canvas | null
  onCommit: () => void
}

const cmdLabel = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform) ? '⌘' : 'Ctrl'

const ARRANGE_ACTIONS = [
  { id: 'bringToFront', label: 'Bring to front', shortcut: `${cmdLabel}+⇧+]` },
  { id: 'bringForward', label: 'Bring forward',  shortcut: `${cmdLabel}+]`     },
  { id: 'sendBackward', label: 'Send backward',  shortcut: `${cmdLabel}+[`     },
  { id: 'sendToBack',   label: 'Send to back',   shortcut: `${cmdLabel}+⇧+[`   },
] as const

type ArrangeAction = typeof ARRANGE_ACTIONS[number]['id']

export const CanvasArrangeSection: React.FC<Props> = ({ canvas, onCommit }) => {
  const [open, setOpen] = useState(false)

  const arrange = (action: ArrangeAction) => {
    if (!canvas) return
    const obj = canvas.getActiveObject() as FabricObject | null
    if (!obj) return
    const c = canvas as Canvas & {
      bringObjectToFront?: (o: FabricObject) => void
      bringObjectForward?: (o: FabricObject) => void
      sendObjectBackwards?: (o: FabricObject) => void
      sendObjectToBack?: (o: FabricObject) => void
    }
    switch (action) {
      case 'bringToFront': c.bringObjectToFront?.(obj); break
      case 'bringForward': c.bringObjectForward?.(obj); break
      case 'sendBackward': c.sendObjectBackwards?.(obj); break
      case 'sendToBack':   c.sendObjectToBack?.(obj);   break
    }
    canvas.requestRenderAll()
    onCommit()
  }

  useEffect(() => {
    if (!canvas) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      if (e.key === ']' && e.shiftKey)      { e.preventDefault(); arrange('bringToFront') }
      else if (e.key === ']')               { e.preventDefault(); arrange('bringForward') }
      else if (e.key === '[' && e.shiftKey) { e.preventDefault(); arrange('sendToBack') }
      else if (e.key === '[')               { e.preventDefault(); arrange('sendBackward') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas])

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between py-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
      >
        Arrange
        <ChevronDown size={12} className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="pb-3">
          <div className="space-y-1">
            {ARRANGE_ACTIONS.map(({ id, label, shortcut }) => (
              <button
                key={id}
                onClick={() => arrange(id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] text-gray-700 hover:bg-gray-100"
              >
                <span>{label}</span>
                <span className="font-mono text-[10px] text-gray-400">{shortcut}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
