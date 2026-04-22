'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { Canvas, FabricObject } from 'fabric'
import { useCanvasStore } from '@/lib/canvas/canvasStore'
import { initFabricCanvas, disposeCanvas } from '@/lib/canvas/fabricInit'
import { TopBar } from './TopBar'
import { ToolbarLeft } from './ToolbarLeft'
import { AgentPill } from './AgentPill'
import { FloatToolbar } from './FloatToolbar'
import { FloatPropertiesCard } from './FloatPropertiesCard'
import { FloatMjmlCard } from './FloatMjmlCard'

// ── Email viewport placeholder (replace with react-email later) ──
const EmailViewport: React.FC = () => (
  <div className="absolute left-[46%] top-1/2 w-[420px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
    {/* Browser chrome */}
    <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-3">
      <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
      <div className="h-2.5 w-2.5 rounded-full bg-yellow-300" />
      <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
      <div className="mx-2 flex h-[14px] flex-1 items-center rounded bg-gray-100 px-2">
        <span className="text-[9px] text-gray-400">Email Preview</span>
      </div>
    </div>
    {/* Email body */}
    <div className="p-4">
      <div className="mb-2.5 flex h-[90px] items-center justify-center rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 text-[11px] font-semibold text-purple-700">
        Hero Image Block
      </div>
      <div className="mb-2 h-2.5 w-4/5 rounded bg-gray-100" />
      <div className="mb-2 h-2.5 w-2/3 rounded bg-gray-100" />
      <div className="mb-2 h-2.5 w-3/4 rounded bg-gray-100" />
      <div className="mt-3 flex h-8 items-center justify-center rounded-md bg-blue-600 text-[11px] font-semibold text-white">
        Shop Now →
      </div>
    </div>
  </div>
)

// ── Main component ──────────────────────────────────────────
export const CanvasEditor: React.FC = () => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<Canvas | null>(null)

  const {
    mode, selectedLayer,
    setSelectedLayer, setFabricCanvas, pushUndo,
  } = useCanvasStore()

  // Toolbar position derived from selected object's bounding rect
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 })

  // ── Init Fabric (canvas mode only) ─────────────────────────
  useEffect(() => {
    // Always clean up any existing canvas first to avoid double-init
    if (fabricRef.current) {
      disposeCanvas(fabricRef.current)
      fabricRef.current = null
      setFabricCanvas(null)
      setSelectedLayer(null)
    }

    if (mode !== 'canvas') return
    if (!canvasElRef.current || !containerRef.current) return

    const { offsetWidth: w, offsetHeight: h } = containerRef.current
    let cancelled = false

    initFabricCanvas({
      canvasEl: canvasElRef.current,
      width: w,
      height: h,
      onSelect: (obj) => {
        setSelectedLayer(obj)
        if (obj) {
          const br = obj.getBoundingRect()
          setToolbarPos({ x: br.left, y: br.top })
        }
      },
      onModified: (snapshot) => pushUndo(snapshot),
    }).then((c) => {
      if (cancelled) { disposeCanvas(c); return }
      fabricRef.current = c
      setFabricCanvas(c)
    })

    return () => {
      cancelled = true
      if (fabricRef.current) {
        disposeCanvas(fabricRef.current)
        fabricRef.current = null
        setFabricCanvas(null)
        setSelectedLayer(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Resize observer — keep canvas filling its container ────
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      fabricRef.current?.setDimensions({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const handleAgentSubmit = useCallback((cmd: string) => {
    // TODO: stream to LangGraph agent harness via /api/agent
    console.log('[AgentPill] command:', cmd)
  }, [])

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FDFDFD]">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <ToolbarLeft />

        {/* ── Canvas surface ───────────────────────────────── */}
        <main
          ref={containerRef}
          className="relative flex-1 overflow-hidden"
          style={{
            // Spec: #FDFDFD bg + dot grid overlay
            backgroundColor: '#FDFDFD',
            backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Fabric.js canvas — canvas mode only */}
          {mode === 'canvas' && (
            <canvas
              ref={canvasElRef}
              className="absolute inset-0"
            />
          )}

          {/* Email mode — viewport + MJML card */}
          {mode === 'email' && (
            <>
              <EmailViewport />
              <FloatMjmlCard />
            </>
          )}

          {/* Floating typography toolbar — shown when a layer is selected */}
          {mode === 'canvas' && selectedLayer && (
            <FloatToolbar
              position={toolbarPos}
            />
          )}

          {/* Floating properties card — shown when a layer is selected */}
          {mode === 'canvas' && selectedLayer && (
            <FloatPropertiesCard
              selectedLayer={selectedLayer}
            />
          )}

          {/* Agent pill — always present in canvas + email mode */}
          {mode !== 'feeds' && (
            <AgentPill onSubmit={handleAgentSubmit} />
          )}
        </main>
      </div>
    </div>
  )
}
