'use client'

import { Copy } from 'lucide-react'
import type { Canvas, FabricObject } from 'fabric'
import { LockClosedIcon, LockOpenIcon } from './AllyvateIcons'

interface Props {
  canvas: Canvas | null
  frame: FabricObject | null
  imageLocked: boolean
  onToggleLock: () => void
  onReplicate: () => void
}

// Two icon-only actions attached to the frame's top-right corner. Visually
// part of the frame chrome (matches the "Frame X:Y" label rendered at the
// top-left): plain gray icons, no pill, no shadow, sits 24px above the frame.
export const FrameActionsToolbar: React.FC<Props> = ({
  canvas, frame, imageLocked, onToggleLock, onReplicate,
}) => {
  if (!canvas || !frame) return null
  const r = frame.getBoundingRect()
  const right = canvas.getWidth() - (r.left + r.width)
  const top = Math.max(12, r.top - 24)

  const Btn: React.FC<{ title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className="flex h-5 w-5 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
    >
      {children}
    </button>
  )

  return (
    <div
      className="pointer-events-auto absolute z-[55] flex items-center gap-2"
      style={{ right, top }}
    >
      <Btn title={imageLocked ? 'Unlock image' : 'Lock image'} onClick={onToggleLock}>
        {imageLocked ? <LockClosedIcon size={14} /> : <LockOpenIcon size={14} />}
      </Btn>
      <Btn title="Duplicate frame" onClick={onReplicate}>
        <Copy size={13} />
      </Btn>
    </div>
  )
}
