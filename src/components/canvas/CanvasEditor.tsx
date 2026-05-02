'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Canvas, FabricObject } from 'fabric'
import { useCanvasStore } from '@/lib/canvas/canvasStore'
import {
  addBlankCreativeFrame,
  disposeCanvas,
  ensureCreativeMetadata,
  getCreativeIdFromObject,
  getCreativeObjects,
  insertShape,
  lockCreativeImage,
  unlockCreativeImage,
  initFabricCanvas,
  moveCreativeBlock,
  replaceOrAddImageLayer,
  seedDefaultCreative,
} from '@/lib/canvas/fabricInit'
import { CREATIVE_PRESETS, getPresetById, isPresetId } from '@/lib/canvas/presets'
import { ToolbarLeft, type RailTool } from './ToolbarLeft'
import { OuterLeftNav } from './OuterLeftNav'
import { CanvasTopHeader } from './CanvasTopHeader'
import { CanvasTextRightPanel } from './CanvasTextRightPanel'
import { CanvasShapeRightPanel } from './CanvasShapeRightPanel'
import { ShapesPanel, type ShapeKind } from './ShapesPanel'
import { AgentPill } from './AgentPill'
import { EmailEditorPanel } from '@/components/email/EmailEditorPanel'
import { ApprovedImagesPanel } from './ApprovedImagesPanel'
import { RightStudioPanel } from './RightStudioPanel'
import { ImageSelectionToolbar } from './ImageSelectionToolbar'
import { ProjectsAssetsPanel } from './ProjectsAssetsPanel'
import type { CanvasVariant } from './VariantsPanel'
import type { PublishResult } from './PublishPanel'

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
const normalizeTextboxScale = (obj: FabricObject | undefined | null) => {
  if (!obj) return false
  if (obj.type !== 'textbox' && obj.type !== 'i-text') return false
  const scaled = obj as FabricObject & { width?: number; scaleX?: number; scaleY?: number; setCoords?: () => void }
  const nextScaleX = scaled.scaleX ?? 1
  const nextScaleY = scaled.scaleY ?? 1
  if (nextScaleX === 1 && nextScaleY === 1) return false

  const currentWidth = scaled.width ?? 0
  const nextWidth = currentWidth * nextScaleX
  if (Number.isFinite(nextWidth) && nextWidth > 1) {
    scaled.set({ width: nextWidth })
  }
  scaled.set({
    scaleX: 1,
    scaleY: 1,
  })
  scaled.setCoords?.()
  return true
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
  const [agentPillVisible, setAgentPillVisible] = useState(false)
  const [generatedPresetIds, setGeneratedPresetIds] = useState<string[]>([])
  const [variants, setVariants] = useState<CanvasVariant[]>([])
  const [campaign, setCampaign] = useState<CampaignMeta>({
    briefId,
    name: 'Untitled',
    updatedAt: null,
    activePresetId: 'instagram-1-1',
  })
  const [recentCampaigns, setRecentCampaigns] = useState<CampaignMeta[]>([])

  const {
    mode, selectedLayer, selectedPresetId, zoom,
    setSelectedLayer, setFabricCanvas, setSelectedPresetId, setZoom, pushUndo, resetHistory, setMode,
  } = useCanvasStore()

  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 })
  const [tbState, setTbState] = useState<TbState>(DEFAULT_TB)
  const tbStateRef = useRef<TbState>(DEFAULT_TB)
  tbStateRef.current = tbState
  const activeToolRef = useRef<RailTool | null>(null)
  activeToolRef.current = activeTool
  const groupMoveRef = useRef<{
    creativeId: string | null
    lastLeft: number
    lastTop: number
    moved: boolean
  }>({
    creativeId: null,
    lastLeft: 0,
    lastTop: 0,
    moved: false,
  })

  const storageKey = `creative-canvas:${briefId}`
  const presetStorageKey = `${storageKey}:preset`
  const generatedKey = `${storageKey}:generated-presets`
  const variantsKey = `${storageKey}:variants`
  const campaignKey = `${storageKey}:campaign`
  const savedFlagKey = `${storageKey}:saved`
  const recentCampaignsKey = 'creative-canvas:recent-campaigns'

  const saveSnapshot = useCallback(() => {
    const fc = fabricRef.current
    if (!fc || restoringRef.current) return
    const snapshot = JSON.stringify(fc.toJSON())
    pushUndo(snapshot)
    try {
      localStorage.setItem(storageKey, snapshot)
    } catch (err) {
      // localStorage quota (~5MB) exceeded — typically because the canvas has
      // embedded image data URLs. Undo history still works in-memory; only the
      // cross-reload restore is lost. Real fix is to upload images to MinIO and
      // store URLs instead of data URLs.
      console.warn('[saveSnapshot] localStorage quota exceeded — snapshot kept in memory only', err)
    }
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

  const isTextLikeObject = useCallback((obj: FabricObject | null | undefined) => {
    if (!obj) return false
    if (obj.type === 'textbox' || obj.type === 'i-text') return true
    const dataKind = (obj as FabricObject & { data?: { kind?: string } }).data?.kind
    return dataKind === 'creative-text'
  }, [])

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
          setAgentPillVisible(isTextLikeObject(obj))
          if (obj) { syncPos(obj); syncToolbar(obj) }
        },
        onModified: (target) => {
          const textNormalized = normalizeTextboxScale(target)
          if (textNormalized) {
            c.requestRenderAll()
          }
          const targetData = (
            target as { data?: { kind?: string; cropPending?: boolean; creativeId?: string } } | undefined
          )?.data
          const isGroupMoveTarget =
            Boolean(groupMoveRef.current.moved) &&
            Boolean(groupMoveRef.current.creativeId) &&
            groupMoveRef.current.creativeId === targetData?.creativeId

          if (isGroupMoveTarget) return

          if (targetData?.kind === 'creative-image') {
            ;(target as { data?: { kind?: string; cropPending?: boolean } }).data = {
              ...targetData,
              cropPending: true,
            }
            c.renderAll()
            return
          }
          saveSnapshot()
        },
      })

      if (cancelled) { disposeCanvas(c); return }

      fabricRef.current = c
      setFabricCanvas(c)

      c.on('object:scaling', (e) => {
        if (!e.target) return
        const normalized = normalizeTextboxScale(e.target)
        if (normalized) {
          c.requestRenderAll()
        }
        syncPos(e.target)
      })
      c.on('mouse:down', (event) => {
        const target = event.target
        if (!target) return
        ensureCreativeMetadata(c)
        const creativeId = getCreativeIdFromObject(target)
        if (!creativeId) return
        const data = (target as FabricObject & { data?: { kind?: string; moveHandle?: boolean } }).data
        const handMode = activeToolRef.current === 'hand'
        const directMoveEnabled = data?.kind === 'creative-frame' || data?.moveHandle === true
        if (!handMode && !directMoveEnabled) return

        if (process.env.NODE_ENV !== 'production') {
          console.debug('[HandMove] drag start', {
            creativeId,
            handMode,
            directMoveEnabled,
            kind: data?.kind ?? null,
          })
        }

        groupMoveRef.current = {
          creativeId,
          lastLeft: target.left ?? 0,
          lastTop: target.top ?? 0,
          moved: false,
        }
      })
      c.on('object:moving', (event) => {
        const target = event.target
        if (!target) return
        const creativeId = getCreativeIdFromObject(target)
        if (!creativeId) return

        const data = (target as FabricObject & { data?: { kind?: string; moveHandle?: boolean } }).data
        const handMode = activeToolRef.current === 'hand'
        const directMoveEnabled = data?.kind === 'creative-frame' || data?.moveHandle === true
        if (!handMode && !directMoveEnabled) return

        if (groupMoveRef.current.creativeId !== creativeId) {
          groupMoveRef.current = {
            creativeId,
            lastLeft: target.left ?? 0,
            lastTop: target.top ?? 0,
            moved: false,
          }
          return
        }

        const nextLeft = target.left ?? 0
        const nextTop = target.top ?? 0
        const dx = nextLeft - groupMoveRef.current.lastLeft
        const dy = nextTop - groupMoveRef.current.lastTop
        if (!dx && !dy) return

        moveCreativeBlock(c, creativeId, dx, dy, target)
        if (process.env.NODE_ENV !== 'production') {
          console.debug('[HandMove] drag delta', { creativeId, dx, dy })
        }
        groupMoveRef.current.lastLeft = nextLeft
        groupMoveRef.current.lastTop = nextTop
        groupMoveRef.current.moved = true
        syncPos(target)
      })
      c.on('mouse:up', () => {
        if (groupMoveRef.current.creativeId && groupMoveRef.current.moved) {
          saveSnapshot()
        }
        groupMoveRef.current = {
          creativeId: null,
          lastLeft: 0,
          lastTop: 0,
          moved: false,
        }
      })
      c.on('mouse:dblclick', (event) => {
        const target = event.target
        if (!target) return
        const data = (target as FabricObject & { data?: { kind?: string } }).data
        // Double-click a frame → unlock its sibling image to re-edit (drag/scale
        // within the clipPath). The image enters edit mode with cropPending: true,
        // and the existing ImageSelectionToolbar appears.
        if (data?.kind === 'creative-frame') {
          const cid = getCreativeIdFromObject(target)
          if (!cid) return
          const image = getCreativeObjects(c, cid).find(
            (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-image',
          )
          if (!image) return
          unlockCreativeImage(image)
          const imgData = (image as FabricObject & { data?: Record<string, unknown> }).data ?? {}
          ;(image as FabricObject & { data?: Record<string, unknown> }).data = {
            ...imgData,
            cropPending: true,
          }
          c.setActiveObject(image)
          setSelectedLayer(image)
          syncPos(image)
          c.requestRenderAll()
          return
        }
        // Direct double-click on the image (already unlocked / loose image)
        // — keep legacy behaviour: open the image picker.
        if (target.type === 'image') {
          c.setActiveObject(target)
          setSelectedLayer(target)
          syncPos(target)
          setShowApprovedImages(true)
        }
      })
      const storedPresetId = localStorage.getItem(presetStorageKey)
      const resolvedPresetId =
        (initialPresetId && isPresetId(initialPresetId) ? initialPresetId : null)
        ?? storedPresetId
        ?? selectedPresetId
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
          name: 'Untitled',
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
      const hasSavedSnapshot = localStorage.getItem(savedFlagKey) === '1'
      if (savedJson && hasSavedSnapshot) {
        restoringRef.current = true
        try {
          if (cancelled || fabricRef.current !== c) return
          // Fabric’s loadFromJSON calls clear() which needs a live 2D context — wait two frames so
          // layout + GPU context are ready (avoids clearRect on undefined on some Safari/Turbo setups).
          await new Promise<void>((r) => {
            requestAnimationFrame(() => requestAnimationFrame(() => r()))
          })
          if (cancelled || fabricRef.current !== c) return
          if (!c.getContext()) {
            throw new Error('Canvas 2D context not ready')
          }
          await c.loadFromJSON(savedJson)
          if (cancelled || fabricRef.current !== c) return
          ensureCreativeMetadata(c)
          c.renderAll()
        } catch (err) {
          console.warn('[CanvasEditor] Failed to restore draft from localStorage — starting fresh.', err)
          localStorage.removeItem(storageKey)
          if (!cancelled && fabricRef.current === c) c.renderAll()
        } finally {
          restoringRef.current = false
        }
      } else {
        localStorage.removeItem(storageKey)
      }

      if (cancelled || fabricRef.current !== c) return

      resetHistory()
      saveSnapshot()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      if (fabricRef.current) {
        disposeCanvas(fabricRef.current, canvasElRef.current ?? undefined)
        fabricRef.current = null
        setFabricCanvas(null)
        setSelectedLayer(null)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [briefId, campaignKey, generatedKey, initialPresetId, isTextLikeObject, mode, recentCampaignsKey, resetHistory, saveSnapshot, selectedPresetId, setSelectedPresetId, storageKey, presetStorageKey, savedFlagKey, setSelectedLayer, setFabricCanvas, syncPos, syncToolbar, variantsKey])

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

      // Collect every object to remove. If a creative-frame is in the
      // selection (single or multi), expand it to the entire creative block
      // (frame + image + scrim + text) so deleting a frame deletes its
      // contents too. Non-frame layers are removed individually.
      const seeds: FabricObject[] =
        active.type === 'activeSelection'
          ? ((active as FabricObject & { _objects?: FabricObject[] })._objects ?? [])
          : [active]

      const targets = new Set<FabricObject>()
      const expandedCreativeIds = new Set<string>()

      for (const obj of seeds) {
        const data = (obj as FabricObject & { data?: { kind?: string } }).data
        if (data?.kind === 'creative-frame') {
          const cid = getCreativeIdFromObject(obj)
          if (cid && !expandedCreativeIds.has(cid)) {
            expandedCreativeIds.add(cid)
            for (const member of getCreativeObjects(canvas, cid)) targets.add(member)
          }
        } else {
          targets.add(obj)
        }
      }

      if (targets.size === 0) return

      canvas.discardActiveObject()
      for (const obj of targets) canvas.remove(obj)
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

  // ── Apply zoom to Fabric canvas ────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    const w = canvas.getWidth()
    const h = canvas.getHeight()
    canvas.zoomToPoint({ x: w / 2, y: h / 2 }, zoom)
    canvas.requestRenderAll()
  }, [zoom])

  // Guard against stale selection references when canvas objects are cleared/replaced.
  useEffect(() => {
    if (mode !== 'canvas') return
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return
    const stillPresent = canvas.getObjects().includes(selectedLayer)
    if (!stillPresent) {
      setSelectedLayer(null)
    }
  }, [mode, selectedLayer, setSelectedLayer])

  useEffect(() => {
    if (mode !== 'canvas') {
      setAgentPillVisible(false)
    }
  }, [mode])

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

  const handleCanvasMultiExport = useCallback(async (format: 'png' | 'pdf' | 'html') => {
    const canvas = fabricRef.current
    if (!canvas) return
    const slug = (campaign.name || briefId || 'untitled-campaign')
      .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled-campaign'
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
    const w = canvas.getWidth() * 2
    const h = canvas.getHeight() * 2

    const triggerDownload = (href: string, filename: string) => {
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
    }

    if (format === 'png') {
      triggerDownload(dataUrl, `${slug}.png`)
      return
    }
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: w >= h ? 'l' : 'p', unit: 'px', format: [w, h] })
      pdf.addImage(dataUrl, 'PNG', 0, 0, w, h)
      pdf.save(`${slug}.pdf`)
      return
    }
    // HTML
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${campaign.name || slug}</title></head><body style="margin:0;padding:0"><img src="${dataUrl}" alt="${campaign.name || slug}" style="display:block;max-width:100%;height:auto"/></body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `${slug}.html`)
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }, [campaign.name, briefId])

  const handlePresetChange = useCallback(async (presetId: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    setSelectedPresetId(presetId)
    localStorage.setItem(presetStorageKey, presetId)

    restoringRef.current = true
    try {
      canvas.clear()
      await addBlankCreativeFrame(canvas, { preset: getPresetById(presetId) })
      ensureCreativeMetadata(canvas)
      canvas.renderAll()
    } finally {
      restoringRef.current = false
    }
    resetHistory()
    saveSnapshot()
    setGeneratedPresetIds((prev) => {
      const next = Array.from(new Set([...prev, presetId]))
      localStorage.setItem(generatedKey, JSON.stringify(next))
      return next
    })
    updateCampaignMeta({ activePresetId: presetId })
  }, [generatedKey, presetStorageKey, resetHistory, saveSnapshot, setSelectedPresetId, updateCampaignMeta])

  const handleReplicateToAll = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const shouldReplaceAll = window.confirm('Replicate to all sizes will replace all current creatives on canvas. Continue?')
    if (!shouldReplaceAll) return
    const { copyText, imageUrl } = extractCreativeInputs()
    const canvasWidth = canvas.getWidth()
    const canvasHeight = canvas.getHeight()
    const gap = 24
    const outerPadding = 24
    const itemCount = CREATIVE_PRESETS.length
    const columns = Math.max(1, Math.ceil(Math.sqrt(itemCount)))
    const rows = Math.max(1, Math.ceil(itemCount / columns))
    const availableWidth = canvasWidth - outerPadding * 2 - gap * (columns - 1)
    const availableHeight = canvasHeight - outerPadding * 2 - gap * (rows - 1)
    const cellWidth = Math.max(80, availableWidth / columns)
    const cellHeight = Math.max(80, availableHeight / rows)

    restoringRef.current = true
    try {
      canvas.clear()
      setSelectedLayer(null)
      for (let index = 0; index < CREATIVE_PRESETS.length; index += 1) {
        const preset = CREATIVE_PRESETS[index]
        const col = index % columns
        const row = Math.floor(index / columns)
        const ratio = preset.width / preset.height

        let frameWidth = cellWidth
        let frameHeight = frameWidth / ratio
        if (frameHeight > cellHeight) {
          frameHeight = cellHeight
          frameWidth = frameHeight * ratio
        }

        const left = outerPadding + col * (cellWidth + gap) + (cellWidth - frameWidth) / 2
        const top = outerPadding + row * (cellHeight + gap) + (cellHeight - frameHeight) / 2

        await seedDefaultCreative(canvas, imageUrl, copyText, preset, {
          left,
          top,
          width: frameWidth,
          height: frameHeight,
        })
      }
    } finally {
      restoringRef.current = false
    }
    canvas.renderAll()

    const allIds = CREATIVE_PRESETS.map((preset) => preset.id)
    setGeneratedPresetIds(allIds)
    localStorage.setItem(generatedKey, JSON.stringify(allIds))
    updateCampaignMeta({ activePresetId: selectedPresetId })
    resetHistory()
    saveSnapshot()
  }, [extractCreativeInputs, generatedKey, resetHistory, saveSnapshot, selectedPresetId, setSelectedLayer, updateCampaignMeta])

  const handleInsertShape = useCallback(async (kind: ShapeKind) => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Frame-aware: drop the shape at the active frame's centre and tag it with
    // that frame's creativeId so it travels with the block. If no frame is
    // active, fall back to canvas centre and an untagged loose shape.
    const active = canvas.getActiveObject() as FabricObject | null
    const activeData = (active as FabricObject & { data?: { kind?: string } } | null)?.data
    let frame: FabricObject | null = null
    if (active && activeData?.kind === 'creative-frame') {
      frame = active
    } else if (active) {
      const cid = getCreativeIdFromObject(active)
      if (cid) {
        frame = canvas.getObjects().find((o) => {
          const d = (o as FabricObject & { data?: { kind?: string; creativeId?: string } }).data
          return d?.kind === 'creative-frame' && d?.creativeId === cid
        }) ?? null
      }
    }
    let cx = canvas.getWidth() / 2
    let cy = canvas.getHeight() / 2
    let size = Math.min(canvas.getWidth(), canvas.getHeight()) * 0.18
    let creativeId: string | undefined
    if (frame) {
      const br = frame.getBoundingRect()
      cx = br.left + br.width / 2
      cy = br.top + br.height / 2
      size = Math.min(br.width, br.height) * 0.45
      const cid = getCreativeIdFromObject(frame)
      if (cid) creativeId = cid
    }
    const obj = await insertShape(canvas, kind, { cx, cy, size, creativeId })
    setSelectedLayer(obj)
    saveSnapshot()
  }, [saveSnapshot, setSelectedLayer])

  const handleAddFrame = useCallback(async () => {
    const canvas = fabricRef.current
    if (!canvas) return
    const frameCount = canvas
      .getObjects()
      .filter((obj) => (obj as { data?: { kind?: string } }).data?.kind === 'creative-frame')
      .length
    const offsetStep = 36
    const maxOffset = 180
    const nextOffset = Math.min(maxOffset, frameCount * offsetStep)
    const base = Math.max(20, canvas.getWidth() * 0.08)
    const size = Math.max(160, Math.min(canvas.getWidth() * 0.28, canvas.getHeight() * 0.38))

    restoringRef.current = true
    try {
      await addBlankCreativeFrame(canvas, {
        frameBounds: {
          left: base + nextOffset,
          top: base + nextOffset,
          width: size,
          height: size,
        },
      })
      ensureCreativeMetadata(canvas)
      canvas.renderAll()
    } finally {
      restoringRef.current = false
    }
    saveSnapshot()
  }, [saveSnapshot])

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

    if (tool === 'frame') {
      await handleAddFrame()
    } else if (tool === 'image') {
      setShowApprovedImages(true)
    } else if (tool === 'layout') {
      // open right panel only
    } else if (tool === 'projects') {
      // projects panel view
    } else if (tool === 'text') {
      const { Textbox } = await import('fabric')

      // Frame-aware insert: if a creative-frame is currently active (or the
      // selection sits inside one), place the textbox at that frame's centre
      // and stamp `data.zoneId` (the creativeId) for downstream zone-locking.
      let cx = canvas.getWidth() / 2
      let cy = canvas.getHeight() / 2
      let boxWidth = Math.max(180, canvas.getWidth() * 0.3)
      let zoneId: string | null = null

      const active = canvas.getActiveObject() as FabricObject | null
      const activeData = (active as FabricObject & { data?: { kind?: string } } | null)?.data
      let frame: FabricObject | null = null
      if (active && activeData?.kind === 'creative-frame') {
        frame = active
      } else if (active) {
        const cid = getCreativeIdFromObject(active)
        if (cid) {
          frame = canvas.getObjects().find((o) => {
            const d = (o as FabricObject & { data?: { kind?: string; creativeId?: string } }).data
            return d?.kind === 'creative-frame' && d?.creativeId === cid
          }) ?? null
        }
      }
      if (frame) {
        const br = frame.getBoundingRect()
        cx = br.left + br.width / 2
        cy = br.top + br.height / 2
        boxWidth = Math.max(120, br.width * 0.7)
        const fid = (frame as FabricObject & { data?: { creativeId?: string } }).data?.creativeId
        zoneId = fid ?? null
      }

      const tb = new Textbox('Add your text', {
        left: cx,
        top: cy,
        originX: 'center',
        originY: 'center',
        width: boxWidth,
        fontSize: 28,
        fontFamily: 'Arial',
        fill: '#111827',
        textAlign: 'left',
      })
      if (zoneId) {
        // Tag with the canonical creative-block shape so moveCreativeBlock,
        // delete-block, and getCreativeObjects all include this text. The
        // earlier `{ zoneId }` shape was off — `getCreativeObjects` looks for
        // `data.creativeId`, so the text was orphaned from its frame.
        ;(tb as FabricObject & { data?: Record<string, unknown> }).data = {
          kind: 'creative-text',
          creativeId: zoneId,
          role: 'text',
        }
      }
      canvas.add(tb)
      canvas.setActiveObject(tb)
      // Enter editing immediately so the user can type without an extra click.
      const editable = tb as unknown as { enterEditing?: () => void; selectAll?: () => void }
      editable.enterEditing?.()
      editable.selectAll?.()
      canvas.requestRenderAll()
      saveSnapshot()
    }
  }, [mode, saveSnapshot, handleCanvasExport, handleAddFrame])

  const handleImageSelect = useCallback(async (src: string) => {
    const canvas = fabricRef.current
    if (!canvas) return
    await replaceOrAddImageLayer(canvas, src, selectedLayer)
    setShowApprovedImages(false)
    saveSnapshot()
  }, [selectedLayer, saveSnapshot])

  const handleSaveImageCrop = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    // Resolve the active image — it's either selectedLayer (in edit mode) or
    // the sibling image of a selected frame (rare, but handled).
    let imageLayer: FabricObject | null = null
    if (selectedLayer?.type === 'image') {
      imageLayer = selectedLayer
    } else if (selectedLayer) {
      const cid = getCreativeIdFromObject(selectedLayer)
      if (cid) {
        imageLayer = getCreativeObjects(canvas, cid).find(
          (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-image',
        ) ?? null
      }
    }
    if (!imageLayer) return

    const withData = imageLayer as FabricObject & {
      data?: { kind?: string; cropPending?: boolean; frame?: unknown }
    }
    withData.data = {
      ...withData.data,
      kind: 'creative-image',
      cropPending: false,
    }
    lockCreativeImage(imageLayer)

    // Snap focus to the frame so the user sees frame chrome, not image chrome.
    const cid = getCreativeIdFromObject(imageLayer)
    const frame = cid
      ? getCreativeObjects(canvas, cid).find(
          (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-frame',
        )
      : null
    if (frame) {
      canvas.setActiveObject(frame)
      setSelectedLayer(frame)
    } else {
      canvas.discardActiveObject()
      setSelectedLayer(null)
    }
    canvas.renderAll()
    saveSnapshot()
  }, [selectedLayer, saveSnapshot, setSelectedLayer])

  // Resolve the paired creative-image when the user has either the image
  // (edit mode) or the frame (saved mode) selected. This drives the existing
  // ImageSelectionToolbar UI without forcing the user into image-edit mode.
  const pairedImage: FabricObject | null = (() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return null
    if (selectedLayer.type === 'image') return selectedLayer
    const cid = getCreativeIdFromObject(selectedLayer)
    if (!cid) return null
    return (
      getCreativeObjects(canvas, cid).find(
        (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-image',
      ) ?? null
    )
  })()

  const imageCropPending = pairedImage
    ? Boolean(
        (pairedImage as FabricObject & { data?: { cropPending?: boolean } }).data
          ?.cropPending,
      )
    : false

  const handlePublish = useCallback(async (args: {
    platform: 'instagram' | 'linkedin'
    placement: string
    caption: string
  }): Promise<PublishResult> => {
    const { copyText, imageUrl } = extractCreativeInputs()
    const response = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        briefId,
        presetId: selectedPresetId,
        platform: args.platform,
        placement: args.placement,
        caption: args.caption,
        copyText,
        imageUrl,
      }),
    })

    const data = (await response.json()) as PublishResult
    if (!response.ok) {
      return {
        status: 'failed',
        message: data.message || 'Publish failed',
      }
    }
    return data
  }, [briefId, extractCreativeInputs, selectedPresetId])

  // Show FloatToolbar only when a text object is selected
  const isTextSelected =
    selectedLayer?.type === 'textbox' || selectedLayer?.type === 'i-text'
  // Show the ImageSelectionToolbar whenever the active selection is part of a
  // creative block that has an image — whether the user picked the image
  // directly (edit mode) or the frame (saved mode).
  const isImageSelected = !!pairedImage

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FDFDFD]">
      <div className="flex flex-1 overflow-hidden">
        <OuterLeftNav />
        {mode === 'canvas' && <ToolbarLeft onToolAction={handleToolAction} />}

        {/* ── Canvas surface ───────────────────────────────── */}
        <main className="relative flex flex-1 flex-col overflow-hidden">
          {mode === 'canvas' && (
            <CanvasTopHeader
              fileName={campaign.name}
              onRename={(next) => updateCampaignMeta({ name: next })}
              recentCampaigns={recentCampaigns.map((c) => ({
                briefId: c.briefId,
                name: c.name,
                updatedAt: c.updatedAt,
              }))}
              onOpenRecent={(nextBriefId) => {
                window.location.href = `/studio/${nextBriefId}/canvas?preset=${selectedPresetId}`
              }}
              onExport={handleCanvasMultiExport}
            />
          )}
          <div
            ref={containerRef}
            className="relative flex-1 overflow-hidden"
            style={{ backgroundColor: '#F5F5F5' }}
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

          {mode === 'assets' && (
            <ApprovedImagesPanel
              open
              onClose={() => setMode('canvas')}
              onSelect={() => { /* browse-only from outer Assets nav */ }}
            />
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
              ) : activeTool === 'shapes' ? (
                <ShapesPanel onInsert={(kind) => { void handleInsertShape(kind) }} />
              ) : (
                <RightStudioPanel
                  activeTool={activeTool}
                  selectedPresetId={selectedPresetId}
                  onPresetChange={handlePresetChange}
                  onAddFrame={() => {
                    void handleAddFrame()
                  }}
                  onConvertToAll={() => {
                    void handleReplicateToAll()
                  }}
                />
              )}
            </>
          )}

          {mode === 'canvas' && (
            <CanvasShapeRightPanel
              canvas={fabricRef.current}
              selected={selectedLayer}
              onCommit={saveSnapshot}
            />
          )}

          <ApprovedImagesPanel
            open={showApprovedImages}
            onClose={() => setShowApprovedImages(false)}
            onSelect={(src) => {
              void handleImageSelect(src)
            }}
          />

          {mode === 'canvas' && isImageSelected && selectedLayer && (
            <ImageSelectionToolbar
              position={toolbarPos}
              selectedPresetId={selectedPresetId}
              onPresetChange={(presetId) => {
                void handlePresetChange(presetId)
              }}
              onOpenMedia={() => setShowApprovedImages(true)}
              onConvertToAll={() => {
                void handleReplicateToAll()
              }}
              onSaveCrop={handleSaveImageCrop}
              cropPending={imageCropPending}
            />
          )}

          {mode === 'canvas' && agentPillVisible && (
            <AgentPill onSubmit={handleAgentSubmit} />
          )}

          {mode === 'canvas' && isTextSelected && (
            <CanvasTextRightPanel
              canvas={fabricRef.current}
              selected={selectedLayer}
              position={toolbarPos}
              onCommit={saveSnapshot}
            />
          )}

          </div>
        </main>
      </div>
    </div>
  )
}
