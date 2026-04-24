'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { useCanvasStore } from '@/lib/canvas/canvasStore'
import { addShapeLayer, addTextLayer, disposeCanvas, initFabricCanvas, replaceOrAddImageLayer, seedDefaultCreative } from '@/lib/canvas/fabricInit'
import { CREATIVE_PRESETS, getPresetById, isPresetId } from '@/lib/canvas/presets'
import { TopBar } from './TopBar'
import { ToolbarLeft, type RailTool } from './ToolbarLeft'
import { AgentPill } from './AgentPill'
import { FloatToolbar } from './FloatToolbar'
import { FloatPropertiesCard } from './FloatPropertiesCard'
import { EmailEditorPanel } from '@/components/email/EmailEditorPanel'
import { ApprovedImagesPanel } from './ApprovedImagesPanel'
import { RightStudioPanel } from './RightStudioPanel'
import { ImageSelectionToolbar } from './ImageSelectionToolbar'
import { ProjectsAssetsPanel } from './ProjectsAssetsPanel'
import { VariantsPanel, type CanvasVariant } from './VariantsPanel'
import { AIAssistPanel } from './AIAssistPanel'

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

interface CampaignMeta {
  briefId: string
  name: string
  updatedAt: string | null
  activePresetId: string
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
export interface CanvasEditorProps {
  briefId?: string
  initialPresetId?: string
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ briefId = 'dev-session', initialPresetId }) => {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fabricRef = useRef<Canvas | null>(null)
  const restoringRef = useRef(false)
  const [activeTool, setActiveTool] = useState<RailTool | null>(null)
  const [showApprovedImages, setShowApprovedImages] = useState(false)
  const [generatedPresetIds, setGeneratedPresetIds] = useState<string[]>([])
  const [variants, setVariants] = useState<CanvasVariant[]>([])
  const [campaign, setCampaign] = useState<CampaignMeta>({
    briefId,
    name: 'Creative Campaign',
    updatedAt: null,
    activePresetId: 'instagram-4-5',
  })
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignMeta[]>([])

  const {
    mode, selectedLayer, selectedPresetId,
    setSelectedLayer, setFabricCanvas, setSelectedPresetId, pushUndo, resetHistory,
  } = useCanvasStore()

  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 })
  const [tbState, setTbState] = useState<TbState>(DEFAULT_TB)
  const tbStateRef = useRef<TbState>(DEFAULT_TB)
  tbStateRef.current = tbState

  const storageKey = `creative-canvas:${briefId}`
  const presetStorageKey = `${storageKey}:preset`
  const generatedKey = `${storageKey}:generated-presets`
  const variantsKey = `${storageKey}:variants`
  const campaignKey = `${storageKey}:campaign`
  const recentCampaignsKey = 'creative-canvas:recent-campaigns'

  const saveSnapshot = useCallback(() => {
    const fc = fabricRef.current
    if (!fc || restoringRef.current) return
    pushUndo(JSON.stringify(fc.toJSON()))
    localStorage.setItem(storageKey, JSON.stringify(fc.toJSON()))
  }, [pushUndo, storageKey])

  const updateCampaignMeta = useCallback((patch: Partial<CampaignMeta> = {}) => {
    const next: CampaignMeta = {
      ...campaign,
      ...patch,
      updatedAt: new Date().toLocaleString(),
    }
    setCampaign(next)
    localStorage.setItem(campaignKey, JSON.stringify(next))
    const currentRecentsRaw = localStorage.getItem(recentCampaignsKey)
    const currentRecents = (currentRecentsRaw ? JSON.parse(currentRecentsRaw) : []) as CampaignMeta[]
    const nextRecents = [next, ...currentRecents.filter((item) => item.briefId !== next.briefId)].slice(0, 8)
    setRecentCampaigns(nextRecents)
    localStorage.setItem(recentCampaignsKey, JSON.stringify(nextRecents))
  }, [campaign, campaignKey, recentCampaignsKey])

  const extractCreativeInputs = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) {
      return { copyText: 'Enjoy Coffee', imageUrl: '/CoffeeInsta.png' }
    }
    const objects = canvas.getObjects()
    const textObject = objects.find((obj) => obj.type === 'textbox') as FabricObject | undefined
    const imageObject = objects.find((obj) => obj.type === 'image') as FabricObject | undefined
    const copyText = String((textObject as { text?: string } | undefined)?.text ?? 'Enjoy Coffee')
    const imageUrl = String((imageObject as { getSrc?: () => string } | undefined)?.getSrc?.() ?? '/CoffeeInsta.png')
    return { copyText, imageUrl }
  }, [])

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
      saveSnapshot()
    }
  }, [selectedLayer, saveSnapshot])

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
        onModified: () => saveSnapshot(),
      })

      if (cancelled) { disposeCanvas(c); return }

      fabricRef.current = c
      setFabricCanvas(c)

      c.on('object:moving', (e) => { if (e.target) syncPos(e.target) })
      c.on('object:scaling', (e) => { if (e.target) syncPos(e.target) })

      const storedPresetId = localStorage.getItem(presetStorageKey)
      const resolvedPresetId =
        (initialPresetId && isPresetId(initialPresetId) ? initialPresetId : null)
        ?? storedPresetId
        ?? selectedPresetId
      const initialPreset = getPresetById(resolvedPresetId)
      setSelectedPresetId(resolvedPresetId)
      localStorage.setItem(presetStorageKey, resolvedPresetId)

      const generatedRaw = localStorage.getItem(generatedKey)
      if (generatedRaw) {
        setGeneratedPresetIds(JSON.parse(generatedRaw) as string[])
      }
      const variantsRaw = localStorage.getItem(variantsKey)
      if (variantsRaw) {
        setVariants(JSON.parse(variantsRaw) as CanvasVariant[])
      }
      const campaignRaw = localStorage.getItem(campaignKey)
      const recentsRaw = localStorage.getItem(recentCampaignsKey)
      if (recentsRaw) {
        setRecentCampaigns(JSON.parse(recentsRaw) as CampaignMeta[])
      }
      if (campaignRaw) {
        const parsed = JSON.parse(campaignRaw) as CampaignMeta
        setCampaign(parsed)
      } else {
        const initialCampaign: CampaignMeta = {
          briefId,
          name: `Campaign ${briefId}`,
          updatedAt: new Date().toLocaleString(),
          activePresetId: resolvedPresetId,
        }
        setCampaign(initialCampaign)
        localStorage.setItem(campaignKey, JSON.stringify(initialCampaign))
        const currentRecentsRaw = localStorage.getItem(recentCampaignsKey)
        const currentRecents = (currentRecentsRaw ? JSON.parse(currentRecentsRaw) : []) as CampaignMeta[]
        const nextRecents = [initialCampaign, ...currentRecents.filter((item) => item.briefId !== initialCampaign.briefId)].slice(0, 8)
        setRecentCampaigns(nextRecents)
        localStorage.setItem(recentCampaignsKey, JSON.stringify(nextRecents))
      }

      const savedJson = localStorage.getItem(storageKey)
      if (savedJson) {
        restoringRef.current = true
        await c.loadFromJSON(savedJson)
        c.renderAll()
        restoringRef.current = false
      } else {
        await seedDefaultCreative(c, '/CoffeeInsta.png', 'Enjoy Coffee', initialPreset)
      }
      resetHistory()
      saveSnapshot()
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
  }, [briefId, campaignKey, generatedKey, initialPresetId, mode, recentCampaignsKey, resetHistory, saveSnapshot, selectedPresetId, setSelectedPresetId, storageKey, presetStorageKey, setSelectedLayer, setFabricCanvas, syncPos, syncToolbar, variantsKey])

  // ── Delete selected object on Delete / Backspace ──────────
  // Only fires when mode==='canvas', an object is selected, and the
  // Textbox is NOT in active-editing mode (cursor inside the box).
  useEffect(() => {
    if (mode !== 'canvas') return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return

      // If focus is inside an <input>, <textarea>, or contenteditable,
      // let the browser handle it normally — don't delete the layer.
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return

      const canvas = fabricRef.current
      if (!canvas) return

      const active = canvas.getActiveObject()
      if (!active) return

      // Textbox in text-editing mode — Fabric handles character deletion
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((active as any).isEditing) return

      canvas.remove(active)
      canvas.discardActiveObject()
      canvas.renderAll()
      setSelectedLayer(null)
      saveSnapshot()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, saveSnapshot, setSelectedLayer])

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

  const handleCanvasExport = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const url = canvas.toDataURL({ format: 'png', multiplier: 2 })
    const link = document.createElement('a')
    link.href = url
    link.download = `${briefId}-${selectedPresetId}.png`
    link.click()
  }, [briefId, selectedPresetId])

  const handlePresetChange = useCallback(async (presetId: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    setSelectedPresetId(presetId)
    localStorage.setItem(presetStorageKey, presetId)
    restoringRef.current = true
    canvas.clear()
    const { copyText, imageUrl } = extractCreativeInputs()
    await seedDefaultCreative(canvas, imageUrl, copyText, getPresetById(presetId))
    canvas.renderAll()
    restoringRef.current = false
    resetHistory()
    saveSnapshot()
    setGeneratedPresetIds((prev) => {
      const next = Array.from(new Set([...prev, presetId]))
      localStorage.setItem(generatedKey, JSON.stringify(next))
      return next
    })
    updateCampaignMeta({ activePresetId: presetId })
  }, [extractCreativeInputs, generatedKey, presetStorageKey, resetHistory, saveSnapshot, setSelectedPresetId, updateCampaignMeta])

  const handleConvertToAll = useCallback(async () => {
    const { copyText, imageUrl } = extractCreativeInputs()
    const { Canvas: FabricCanvas } = await import('fabric')

    for (const preset of CREATIVE_PRESETS) {
      const tempEl = document.createElement('canvas')
      const temp = new FabricCanvas(tempEl, { width: 1200, height: 1200, backgroundColor: '#FDFDFD' })
      await seedDefaultCreative(temp, imageUrl, copyText, preset)
      const url = temp.toDataURL({ format: 'png', multiplier: 2 })
      const link = document.createElement('a')
      link.href = url
      link.download = `${briefId}-${preset.id}.png`
      link.click()
      temp.dispose()
    }

    const allIds = CREATIVE_PRESETS.map((preset) => preset.id)
    setGeneratedPresetIds(allIds)
    localStorage.setItem(generatedKey, JSON.stringify(allIds))
    updateCampaignMeta({ activePresetId: selectedPresetId })
  }, [briefId, extractCreativeInputs, generatedKey, selectedPresetId, updateCampaignMeta])

  const handleGenerateVariants = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const baseThumbnail = canvas.toDataURL({ format: 'png', multiplier: 0.35 })
    const { copyText, imageUrl } = extractCreativeInputs()
    const templates = [
      { suffix: 'Urgency', text: `${copyText} — Limited Time` },
      { suffix: 'Benefit', text: `Why choose us: ${copyText}` },
      { suffix: 'Offer', text: `${copyText} | 30% OFF today` },
      { suffix: 'Social', text: `${copyText} • Loved by 10k+ users` },
      { suffix: 'Simple', text: copyText },
    ]
    const newVariants: CanvasVariant[] = templates.map((template, idx) => ({
      id: `variant-${Date.now()}-${idx}`,
      label: `${template.suffix} (${selectedPresetId})`,
      presetId: selectedPresetId,
      copyText: template.text,
      imageUrl,
      thumbnail: baseThumbnail,
    }))
    setVariants(newVariants)
    localStorage.setItem(variantsKey, JSON.stringify(newVariants))
  }, [extractCreativeInputs, selectedPresetId, variantsKey])

  const handleApplyVariant = useCallback(async (variantId: string) => {
    const variant = variants.find((item) => item.id === variantId)
    if (!variant || !fabricRef.current) return
    setSelectedPresetId(variant.presetId)
    localStorage.setItem(presetStorageKey, variant.presetId)
    restoringRef.current = true
    fabricRef.current.clear()
    await seedDefaultCreative(fabricRef.current, variant.imageUrl, variant.copyText, getPresetById(variant.presetId))
    fabricRef.current.renderAll()
    restoringRef.current = false
    resetHistory()
    saveSnapshot()
    updateCampaignMeta({ activePresetId: variant.presetId })
  }, [presetStorageKey, resetHistory, saveSnapshot, setSelectedPresetId, updateCampaignMeta, variants])

  const handleExportVariant = useCallback(async (variantId: string) => {
    const variant = variants.find((item) => item.id === variantId)
    if (!variant) return
    const { Canvas: FabricCanvas } = await import('fabric')
    const tempEl = document.createElement('canvas')
    const temp = new FabricCanvas(tempEl, { width: 1200, height: 1200, backgroundColor: '#FDFDFD' })
    await seedDefaultCreative(temp, variant.imageUrl, variant.copyText, getPresetById(variant.presetId))
    const url = temp.toDataURL({ format: 'png', multiplier: 2 })
    const link = document.createElement('a')
    link.href = url
    link.download = `${briefId}-${variant.id}.png`
    link.click()
    temp.dispose()
  }, [briefId, variants])

  const handleToolAction = useCallback(async (tool: RailTool) => {
    setActiveTool(tool)
    const canvas = fabricRef.current
    if (mode !== 'canvas' || !canvas) return

    if (tool === 'copy') {
      await addTextLayer(canvas, 'Add your headline')
      saveSnapshot()
    } else if (tool === 'media') {
      setShowApprovedImages(true)
    } else if (tool === 'preview' || tool === 'layout') {
      // open right panel only
    } else if (tool === 'export') {
      handleCanvasExport()
    } else if (tool === 'projects') {
      // projects panel view
    }
  }, [mode, saveSnapshot, handleCanvasExport])

  const handleImageSelect = useCallback(async (src: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    await replaceOrAddImageLayer(canvas, src, selectedLayer)
    setShowApprovedImages(false)
    saveSnapshot()
  }, [selectedLayer, saveSnapshot])

  const selectedText = selectedLayer && (selectedLayer.type === 'textbox' || selectedLayer.type === 'i-text')
    ? String((selectedLayer as { text?: string }).text ?? '')
    : null

  const handleApplyAICopy = useCallback((text: string) => {
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return
    if (selectedLayer.type !== 'textbox' && selectedLayer.type !== 'i-text') return
    ;(selectedLayer as { set: (payload: Record<string, unknown>) => void }).set({ text })
    canvas.renderAll()
    saveSnapshot()
  }, [selectedLayer, saveSnapshot])

  const handleSuggestLayout = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const objects = canvas.getObjects()
    const textObj = objects.find((obj) => obj.type === 'textbox' || obj.type === 'i-text')
    const imageObj = objects.find((obj) => obj.type === 'image')
    if (textObj) {
      const imgBounds = imageObj?.getBoundingRect()
      const fallbackY = canvas.getHeight() * 0.72
      const targetY = imgBounds ? imgBounds.top + imgBounds.height * 0.72 : fallbackY
      textObj.set({
        left: canvas.getWidth() * 0.15,
        width: canvas.getWidth() * 0.7,
        top: targetY,
      })
      canvas.setActiveObject(textObj)
    }
    canvas.renderAll()
    saveSnapshot()
  }, [saveSnapshot])

  // Show FloatToolbar only when a text object is selected
  const isTextSelected =
    selectedLayer?.type === 'textbox' || selectedLayer?.type === 'i-text'
  const isImageSelected = selectedLayer?.type === 'image'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FDFDFD]">
      <TopBar onExport={handleCanvasExport} />

      <div className="flex flex-1 overflow-hidden">
        <ToolbarLeft onToolAction={handleToolAction} />

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

          {mode === 'canvas' && (
            <>
              {activeTool === 'projects' ? (
                <ProjectsAssetsPanel
                  generatedPresetIds={generatedPresetIds}
                  selectedPresetId={selectedPresetId}
                  campaign={campaign}
                  recentCampaigns={recentCampaigns}
                  onCampaignRename={(nextName) => updateCampaignMeta({ name: nextName })}
                  onPresetOpen={(presetId) => {
                    void handlePresetChange(presetId)
                  }}
                  onRecentCampaignOpen={(nextBriefId, presetId) => {
                    window.location.href = `/studio/${nextBriefId}/canvas?preset=${presetId}`
                  }}
                />
              ) : activeTool === 'variants' ? (
                <VariantsPanel
                  variants={variants}
                  onGenerate={handleGenerateVariants}
                  onApply={(variantId) => {
                    void handleApplyVariant(variantId)
                  }}
                  onExport={(variantId) => {
                    void handleExportVariant(variantId)
                  }}
                />
              ) : activeTool === 'ai' ? (
                <AIAssistPanel
                  selectedText={selectedText}
                  onApplyCopy={handleApplyAICopy}
                  onSuggestLayout={handleSuggestLayout}
                />
              ) : (
                <RightStudioPanel
                  activeTool={activeTool}
                  selectedPresetId={selectedPresetId}
                  onPresetChange={handlePresetChange}
                  onAddText={() => {
                    if (!fabricRef.current) return
                    void addTextLayer(fabricRef.current).then(saveSnapshot)
                  }}
                  onAddShape={() => {
                    if (!fabricRef.current) return
                    void addShapeLayer(fabricRef.current).then(saveSnapshot)
                  }}
                  onOpenMedia={() => setShowApprovedImages(true)}
                />
              )}
            </>
          )}

          <ApprovedImagesPanel
            open={showApprovedImages}
            onClose={() => setShowApprovedImages(false)}
            onSelect={(src) => {
              void handleImageSelect(src)
            }}
          />

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

          {mode === 'canvas' && isImageSelected && selectedLayer && (
            <ImageSelectionToolbar
              position={toolbarPos}
              selectedPresetId={selectedPresetId}
              onPresetChange={(presetId) => {
                void handlePresetChange(presetId)
              }}
              onOpenMedia={() => setShowApprovedImages(true)}
              onConvertToAll={() => {
                void handleConvertToAll()
              }}
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
