'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { useCanvasStore } from '@/lib/canvas/canvasStore'
import { initFabricCanvas, disposeCanvas, seedDefaultCreative } from '@/lib/canvas/fabricInit'
import { TopBar } from './TopBar'
import { ToolbarLeft } from './ToolbarLeft'
import { AgentPill } from './AgentPill'
import { FloatToolbar } from './FloatToolbar'
import { FloatPropertiesCard } from './FloatPropertiesCard'
import { EmailEditorPanel } from '@/components/email/EmailEditorPanel'

// ── Toolbar state shape ──────────────────────────────────────
interface TbState {
  fontFamily: string
  fontSize: number
  isBold: boolean
  isItalic: boolean
  isUnderline: boolean
  textAlign: 'left' | 'center' | 'right'
  color: string
}

const DEFAULT_TB: TbState = {
  fontFamily: 'Georgia',
  fontSize: 40,
  isBold: true,
  isItalic: false,
  isUnderline: false,
  textAlign: 'center',
  color: '#FFFFFF',
}

// ── Main component ──────────────────────────────────────────
export const CanvasEditor: React.FC = () => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<Canvas | null>(null)

  const {
    mode, selectedLayer,
    setSelectedLayer, setFabricCanvas, pushUndo,
  } = useCanvasStore()

  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 })
  const [tbState, setTbState] = useState<TbState>(DEFAULT_TB)
  const tbStateRef = useRef<TbState>(DEFAULT_TB)
  tbStateRef.current = tbState

  // Read fabric text properties into toolbar state
  const syncToolbar = useCallback((obj: FabricObject | null) => {
    if (!obj) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = obj as any
    if (t.text !== undefined) {
      setTbState({
        fontFamily: t.fontFamily ?? 'Georgia',
        fontSize: typeof t.fontSize === 'number' ? t.fontSize : 40,
        isBold: t.fontWeight === 'bold' || t.fontWeight === 700,
        isItalic: t.fontStyle === 'italic',
        isUnderline: !!t.underline,
        textAlign: (['left', 'center', 'right'].includes(t.textAlign) ? t.textAlign : 'center') as TbState['textAlign'],
        color: typeof t.fill === 'string' ? t.fill : '#FFFFFF',
      })
    }
  }, [])

  // Sync toolbar position from object bounding rect
  const syncPos = useCallback((obj: FabricObject) => {
    const br = obj.getBoundingRect()
    setToolbarPos({ x: br.left, y: br.top })
  }, [])

  // Apply toolbar changes to the selected fabric object
  const applyToLayer = useCallback((changes: Partial<TbState>) => {
    const fc = fabricRef.current
    if (!fc || !selectedLayer) return
    const next = { ...tbStateRef.current, ...changes }
    setTbState(next)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = selectedLayer as any
    if (t.text !== undefined) {
      if ('fontFamily' in changes) t.set({ fontFamily: changes.fontFamily })
      if ('fontSize' in changes) t.set({ fontSize: changes.fontSize })
      if ('isBold' in changes) t.set({ fontWeight: next.isBold ? 'bold' : 'normal' })
      if ('isItalic' in changes) t.set({ fontStyle: next.isItalic ? 'italic' : 'normal' })
      if ('isUnderline' in changes) t.set({ underline: next.isUnderline })
      if ('textAlign' in changes) t.set({ textAlign: changes.textAlign })
      if ('color' in changes) t.set({ fill: changes.color })
      fc.renderAll()
      pushUndo(fc.getObjects() as FabricObject[])
    }
  }, [selectedLayer, pushUndo])

  // ── Init Fabric (canvas mode only) ─────────────────────────
  // Uses rAF so layout is complete before we read container dimensions.
  // The `cancelled` flag stops the async chain if the effect cleans up first
  // (e.g. React Strict Mode double-invoke).
  // We do NOT dispose Fabric on mode switch — the <canvas> stays in the DOM
  // (just hidden via CSS). Disposing while React has already removed the element
  // causes a removeChild NotFoundError because Fabric wraps the canvas in its own div.
  useEffect(() => {
    if (mode !== 'canvas') {
      setSelectedLayer(null)
      return
    }

    let cancelled = false
    let rafId: ReturnType<typeof requestAnimationFrame>

    rafId = requestAnimationFrame(async () => {
      if (cancelled || !canvasElRef.current || !containerRef.current) return
      const { offsetWidth: w, offsetHeight: h } = containerRef.current
      if (w === 0 || h === 0) return

      const c = await initFabricCanvas({
        canvasEl: canvasElRef.current,
        width: w,
        height: h,
        onSelect: (obj) => {
          setSelectedLayer(obj)
          if (obj) { syncPos(obj); syncToolbar(obj) }
        },
        onModified: (snapshot) => pushUndo(snapshot),
      })

      if (cancelled) { disposeCanvas(c); return }

      fabricRef.current = c
      setFabricCanvas(c)

      c.on('object:moving', (e) => { if (e.target) syncPos(e.target) })
      c.on('object:scaling', (e) => { if (e.target) syncPos(e.target) })

      seedDefaultCreative(c, '/CoffeeInsta.png', 'Enjoy Coffee')
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (fabricRef.current) {
        disposeCanvas(fabricRef.current)
        fabricRef.current = null
        setFabricCanvas(null)
        setSelectedLayer(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Resize observer ────────────────────────────────────────
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
    console.log('[AgentPill] command:', cmd)
  }, [])

  // Show FloatToolbar only when a text object is selected
  const isTextSelected =
    selectedLayer?.type === 'textbox' || selectedLayer?.type === 'i-text'

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
            backgroundColor: '#FDFDFD',
            backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Always in DOM — Fabric owns the wrapper div, removing it causes removeChild errors */}
          <canvas
            ref={canvasElRef}
            className="absolute inset-0"
            style={{ display: mode === 'canvas' ? 'block' : 'none' }}
          />

          {mode === 'email' && (
            <EmailEditorPanel />
          )}

          {/* Typography toolbar — shown only when a text layer is selected */}
          {mode === 'canvas' && isTextSelected && (
            <FloatToolbar
              position={toolbarPos}
              fontFamily={tbState.fontFamily}
              fontSize={tbState.fontSize}
              isBold={tbState.isBold}
              isItalic={tbState.isItalic}
              isUnderline={tbState.isUnderline}
              textAlign={tbState.textAlign}
              color={tbState.color}
              onFontChange={(f) => applyToLayer({ fontFamily: f })}
              onSizeChange={(s) => applyToLayer({ fontSize: s })}
              onBoldToggle={() => applyToLayer({ isBold: !tbState.isBold })}
              onItalicToggle={() => applyToLayer({ isItalic: !tbState.isItalic })}
              onUnderlineToggle={() => applyToLayer({ isUnderline: !tbState.isUnderline })}
              onAlignChange={(a) => applyToLayer({ textAlign: a })}
              onColorChange={(c) => applyToLayer({ color: c })}
            />
          )}

          {/* Properties card — shown for any selected layer */}
          {mode === 'canvas' && selectedLayer && (
            <FloatPropertiesCard selectedLayer={selectedLayer} />
          )}

          {mode !== 'feeds' && (
            <AgentPill onSubmit={handleAgentSubmit} />
          )}
        </main>
      </div>
    </div>
  )
}
