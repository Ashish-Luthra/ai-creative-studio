'use client'

import dynamic from 'next/dynamic'
import type { CanvasEditorProps } from './CanvasEditor'

// Fabric.js is a client-only library — ssr: false must live in a 'use client' file
export const CanvasEditorClient = dynamic(
  () => import('./CanvasEditor').then((m) => m.CanvasEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen items-center justify-center bg-[#FDFDFD]">
        <span className="text-[13px] text-gray-400">Loading canvas…</span>
      </div>
    ),
  }
)

export type CanvasEditorClientProps = CanvasEditorProps
