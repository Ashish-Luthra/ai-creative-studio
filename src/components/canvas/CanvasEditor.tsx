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
import { type RailTool } from './ToolbarLeft'
import { CanvasFloatingToolbar } from './CanvasFloatingToolbar'
import { OuterLeftNav } from './OuterLeftNav'
import { CanvasTopHeader } from './CanvasTopHeader'
import { CanvasTextRightPanel } from './CanvasTextRightPanel'
import { CanvasShapeRightPanel } from './CanvasShapeRightPanel'
import { CanvasFrameRightPanel } from './CanvasFrameRightPanel'
import { CanvasImageRightPanel } from './CanvasImageRightPanel'
import { FrameActionsToolbar } from './FrameActionsToolbar'
import { ShapesPanel, type ShapeKind } from './ShapesPanel'
import { DrawSettingsPanel } from './DrawSettingsPanel'
import { AgentPill } from './AgentPill'
import { AllyvateAssistant } from '@/components/ai/AllyvateAssistant'
import { CanvasAllyDock } from './CanvasAllyDock'
import { EmailEditorPanel } from '@/components/email/EmailEditorPanel'
import { ApprovedImagesPanel } from './ApprovedImagesPanel'
import { RightStudioPanel } from './RightStudioPanel'
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
  const [drawSettings, setDrawSettings] = useState({ color: '#1B51B3', thickness: 4 })
  const [showApprovedImages, setShowApprovedImages] = useState(false)
  const [agentPillVisible, setAgentPillVisible] = useState(false)
  const [allyVisible, setAllyVisible] = useState(false)
  const [allyAnchorX, setAllyAnchorX] = useState(0)
  const [allyAnchorY, setAllyAnchorY] = useState(0)
  const [allyTarget, setAllyTarget] = useState<FabricObject | null>(null)
  const [allyExpandedPos, setAllyExpandedPos] = useState<{ left: number; top: number } | null>(null)
  const [frameHoverRect, setFrameHoverRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
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
    undo, redo,
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

          const objData = (obj as FabricObject & { data?: { kind?: string; creativeId?: string } } | null)?.data
          const isTextOnFrame =
            !!obj &&
            obj.type === 'textbox' &&
            objData?.kind === 'creative-text' &&
            !!objData?.creativeId

          if (isTextOnFrame && obj) {
            const containerRect = containerRef.current?.getBoundingClientRect()
            const tbRect = obj.getBoundingRect()
            // Find the enclosing frame to position the expanded card relative to.
            const cid = objData?.creativeId
            const frame = c.getObjects().find((o) => {
              const d = (o as FabricObject & { data?: { kind?: string; creativeId?: string } }).data
              return d?.kind === 'creative-frame' && d?.creativeId === cid
            }) as FabricObject | undefined
            const frameRect = frame?.getBoundingRect()
            if (containerRect) {
              setAllyAnchorX(containerRect.left + tbRect.left + tbRect.width / 2)
              setAllyAnchorY(containerRect.top + tbRect.top)
              // Place expanded card to the right of the frame if room, else below, else fall back.
              if (frameRect) {
                const CARD_W = 320
                const CARD_H = 460
                const GAP = 12
                const vpW = window.innerWidth
                const vpH = window.innerHeight
                const frameRightVp = containerRect.left + frameRect.left + frameRect.width
                const frameBottomVp = containerRect.top + frameRect.top + frameRect.height
                const frameLeftVp = containerRect.left + frameRect.left
                const frameTopVp = containerRect.top + frameRect.top
                let pos: { left: number; top: number } | null = null
                if (frameRightVp + GAP + CARD_W <= vpW) {
                  pos = {
                    left: frameRightVp + GAP,
                    top: Math.max(8, Math.min(vpH - CARD_H - 8, frameTopVp)),
                  }
                } else if (frameBottomVp + GAP + CARD_H <= vpH) {
                  pos = {
                    left: Math.max(8, Math.min(vpW - CARD_W - 8, frameLeftVp)),
                    top: frameBottomVp + GAP,
                  }
                }
                setAllyExpandedPos(pos)
              } else {
                setAllyExpandedPos(null)
              }
            }
            setAllyTarget(obj)
            setAllyVisible(true)
          } else {
            setAllyVisible(false)
            setAllyTarget(null)
            setAllyExpandedPos(null)
          }
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
        // Auto-dismiss tool-driven right-side pickers (Shapes / Layout /
        // Projects / Settings) the moment the user starts interacting with
        // the canvas. Selection-based panels (text colour, shape colour,
        // image-selection toolbar) stay because they're driven by
        // selectedLayer, not activeTool.
        if (activeToolRef.current && activeToolRef.current !== 'hand') {
          setActiveTool(null)
        }
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
      // Tag every free-drawn stroke as creative-shape so the user can
      // re-select it later and the colour panel works on it. Strokes are
      // loose (no creativeId) — they live above the frames at the moment.
      c.on('path:created', (e: { path?: FabricObject }) => {
        const p = e.path
        if (!p) return
        ;(p as FabricObject & { data?: Record<string, unknown> }).data = {
          kind: 'creative-shape',
          creativeId: '',
          role: 'shape',
        }
        p.set({
          borderColor: '#2563EB',
          cornerColor: '#2563EB',
          cornerStrokeColor: '#ffffff',
          cornerStyle: 'rect',
          cornerSize: 8,
          transparentCorners: false,
        })
        saveSnapshot()
      })
      c.on('mouse:dblclick', (event) => {
        const target = event.target
        if (!target) return
        const data = (target as FabricObject & { data?: { kind?: string } }).data
        // Double-click a frame → unlock its sibling image to re-edit (drag/scale
        // within the clipPath). The image enters edit mode with cropPending: true.
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
      // Hover hint: when the cursor is over a creative-frame (or its inner
      // image), surface a small "Double-click to change" overlay positioned at
      // the frame's screen rect. Mirrors the email image-slot affordance.
      const updateFrameHover = (target: FabricObject | undefined) => {
        if (!target) { setFrameHoverRect(null); return }
        const data = (target as FabricObject & { data?: { kind?: string; creativeId?: string } }).data
        let frame: FabricObject | undefined
        if (data?.kind === 'creative-frame') {
          frame = target
        } else if (data?.kind === 'creative-image') {
          const cid = getCreativeIdFromObject(target)
          if (cid) {
            frame = c.getObjects().find((o) => {
              const d = (o as FabricObject & { data?: { kind?: string; creativeId?: string } }).data
              return d?.kind === 'creative-frame' && d?.creativeId === cid
            }) as FabricObject | undefined
          }
        }
        if (!frame) { setFrameHoverRect(null); return }
        const br = frame.getBoundingRect()
        setFrameHoverRect({ left: br.left, top: br.top, width: br.width, height: br.height })
      }
      c.on('mouse:over', (event) => updateFrameHover(event.target ?? undefined))
      c.on('mouse:out',  ()      => setFrameHoverRect(null))
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

  // ── Global Cmd/Ctrl+Z (undo) and Cmd/Ctrl+Shift+Z / Cmd/Ctrl+Y (redo) ──
  // Active in canvas mode. Skipped while typing in form fields, contentEditable,
  // or while a Fabric Textbox is in edit mode (so typing into a textbox doesn't
  // get hijacked).
  useEffect(() => {
    if (mode !== 'canvas') return
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== 'z' && e.key.toLowerCase() !== 'y') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
      const active = fabricRef.current?.getActiveObject() as (FabricObject & { isEditing?: boolean }) | null
      if (active?.isEditing) return
      const isRedo = (e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y'
      e.preventDefault()
      if (isRedo) void redo()
      else void undo()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, undo, redo])

  // ── Exit Draw mode on Escape or click outside the canvas ──
  // While in draw mode, fabric intercepts every pointer event on the canvas
  // itself, so the user can't easily exit without going to another tool.
  // Listen on the document for clicks anywhere outside the canvas wrapper
  // (left rail, top header, right panel, page background) and Escape — both
  // turn off drawing mode and switch the tool back to Cursor so the strokes
  // become selectable.
  useEffect(() => {
    if (mode !== 'canvas' || activeTool !== 'draw') return
    const exit = () => {
      const c = fabricRef.current
      if (c) c.isDrawingMode = false
      setActiveTool('hand')
    }
    const onPointerDown = (e: PointerEvent) => {
      const container = containerRef.current
      if (!container) return
      if (!container.contains(e.target as Node)) exit()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exit()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [mode, activeTool])

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

  const openAllyFromDock = useCallback(() => {
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      setAllyAnchorX(containerRect.left + containerRect.width / 2)
      setAllyAnchorY(containerRect.bottom - 80)
    }
    setAllyTarget(null)
    setAllyVisible(true)
  }, [])

  const handleAllyInsert = useCallback((text: string) => {
    if (!allyTarget) return
    const tb = allyTarget as FabricObject & { set?: (k: string, v: unknown) => void }
    tb.set?.('text', text)
    fabricRef.current?.requestRenderAll()
    saveSnapshot()
  }, [allyTarget, saveSnapshot])

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

        // Replicate produces blank frames — the user adds image / text / shapes
        // per frame afterwards. Seeding default image+copy was the previous
        // behaviour; intentionally removed.
        await addBlankCreativeFrame(canvas, {
          preset,
          frameBounds: { left, top, width: frameWidth, height: frameHeight },
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
  }, [generatedKey, resetHistory, saveSnapshot, selectedPresetId, setSelectedLayer, updateCampaignMeta])

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

    // Switching away from Draw turns off free-drawing mode. Fabric stays put
    // — the strokes the user already laid down remain on canvas.
    if (tool !== 'draw') {
      canvas.isDrawingMode = false
    }

    if (tool === 'frame') {
      await handleAddFrame()
    } else if (tool === 'image') {
      setShowApprovedImages(true)
    } else if (tool === 'draw') {
      const { PencilBrush } = await import('fabric')
      const brush = new PencilBrush(canvas)
      brush.color = drawSettings.color
      brush.width = drawSettings.thickness
      canvas.freeDrawingBrush = brush
      canvas.isDrawingMode = true
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

  // Duplicate an entire creative block (frame + image + scrim + text + shapes)
  // into the nearest vacant space. New creativeId so the copy is independent.
  // The image clipPath is *deep-cloned* (not just shifted) — fabric v6's
  // obj.clone(['clipPath']) shares the reference, which previously caused
  // the original's clip to migrate and the image to disappear after a few
  // lock/unlock toggles.
  const handleDuplicateFrame = useCallback(async (frame: FabricObject) => {
    const canvas = fabricRef.current
    if (!canvas) return
    const cid = getCreativeIdFromObject(frame)
    if (!cid) return
    const members = getCreativeObjects(canvas, cid)
    if (members.length === 0) return

    // ── Step 1: find a vacant position ───────────────────────────────────
    const src = frame.getBoundingRect()
    const gap = 24
    const overlaps = (a: { left: number; top: number; width: number; height: number },
                      b: { left: number; top: number; width: number; height: number }) =>
      a.left < b.left + b.width && a.left + a.width > b.left &&
      a.top  < b.top  + b.height && a.top  + a.height > b.top

    const otherFrames = canvas.getObjects().filter((o) => {
      const d = (o as FabricObject & { data?: { kind?: string } }).data
      return d?.kind === 'creative-frame' && o !== frame
    }).map((o) => o.getBoundingRect())

    let candidate = { left: src.left + src.width + gap, top: src.top, width: src.width, height: src.height }
    const cw = canvas.getWidth()
    let collisions = 0
    let rowAttempts = 0
    while (otherFrames.some((f) => overlaps(candidate, f))) {
      collisions++
      if (collisions > 20) break
      // Move right by the source frame's stride.
      candidate = { ...candidate, left: candidate.left + src.width + gap }
      // If we've run off the right edge, wrap to a new row.
      if (candidate.left + candidate.width > cw) {
        rowAttempts++
        if (rowAttempts > 4) break
        candidate = { left: src.left, top: candidate.top + src.height + gap, width: src.width, height: src.height }
      }
    }
    const dx = candidate.left - src.left
    const dy = candidate.top - src.top

    // ── Step 2: clone every member, deep-clone clipPath, retag ──────────
    const newId = `creative-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const { Rect } = await import('fabric')

    const isFrameLabel = (o: FabricObject) => {
      const d = (o as FabricObject & { data?: { kind?: string; moveHandle?: boolean } }).data
      return d?.kind === 'creative-text' && d?.moveHandle === true
    }

    const clones: FabricObject[] = []
    for (const obj of members) {
      const cloned = await obj.clone(['data'])
      cloned.set({
        left: (cloned.left ?? 0) + dx,
        top: (cloned.top ?? 0) + dy,
      })

      // Deep-clone clipPath — reconstruct from the original's geometry +
      // dx/dy. This severs the shared reference that fabric v6 leaves intact
      // when 'clipPath' is in propertiesToInclude.
      const origClip = (obj as FabricObject & { clipPath?: { left?: number; top?: number; width?: number; height?: number; rx?: number; ry?: number } }).clipPath
      if (origClip) {
        ;(cloned as FabricObject & { clipPath?: object }).clipPath = new Rect({
          left: (origClip.left ?? 0) + dx,
          top:  (origClip.top  ?? 0) + dy,
          width: origClip.width ?? 0,
          height: origClip.height ?? 0,
          rx: origClip.rx ?? 0,
          ry: origClip.ry ?? 0,
          absolutePositioned: true,
        })
      }

      // Retag with the new creativeId so move-block, delete-block, lock and
      // pairedFrame/pairedImage all resolve to the clone (not the source).
      const data = (cloned as FabricObject & { data?: Record<string, unknown> }).data
      if (data && typeof data === 'object') {
        ;(cloned as FabricObject & { data?: Record<string, unknown> }).data = {
          ...data,
          creativeId: newId,
        }
      }

      // Frame-label gets " copy" appended so the duplicate is identifiable.
      if (isFrameLabel(obj)) {
        const srcText = ((obj as FabricObject & { text?: string }).text ?? '') as string
        const m = srcText.match(/^(.*?)( copy(?: (\d+))?)?$/)
        let nextText: string
        if (m && m[2]) {
          // Already a copy — increment.
          const n = m[3] ? Number(m[3]) + 1 : 2
          nextText = `${m[1]} copy ${n}`
        } else {
          nextText = `${srcText} copy`
        }
        ;(cloned as FabricObject & { text?: string; initDimensions?: () => void }).text = nextText
        ;(cloned as FabricObject & { initDimensions?: () => void }).initDimensions?.()
      }

      clones.push(cloned)
      canvas.add(cloned)
    }

    // ── Step 3: activate the duplicated frame ────────────────────────────
    const newFrame = clones.find(
      (c) => (c as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-frame',
    )
    if (newFrame) {
      canvas.setActiveObject(newFrame)
      setSelectedLayer(newFrame)
    }
    canvas.requestRenderAll()
    saveSnapshot()
  }, [saveSnapshot, setSelectedLayer])

  // Unlock the framed image so the user can drag/scale it inside the clipPath.
  // Counterpart to handleSaveImageCrop. Driven from the FrameActionsToolbar.
  const handleUnlockImage = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return
    const cid = getCreativeIdFromObject(selectedLayer)
    if (!cid) return
    const image = getCreativeObjects(canvas, cid).find(
      (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-image',
    )
    if (!image) return
    unlockCreativeImage(image)
    const data = (image as FabricObject & { data?: Record<string, unknown> }).data ?? {}
    ;(image as FabricObject & { data?: Record<string, unknown> }).data = { ...data, cropPending: true }
    canvas.setActiveObject(image)
    setSelectedLayer(image)
    canvas.requestRenderAll()
  }, [selectedLayer, setSelectedLayer])

  // Resolve the paired creative-image only when the user has the image
  // itself or its frame selected. Selecting text or shapes inside the same
  // creative block must NOT trigger the image toolbar — those layers have
  // their own right-panel UIs (text colour panel, shape colour panel).
  const pairedImage: FabricObject | null = (() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return null
    if (selectedLayer.type === 'image') return selectedLayer
    const selKind = (selectedLayer as FabricObject & { data?: { kind?: string } }).data?.kind
    if (selKind !== 'creative-frame') return null
    const cid = getCreativeIdFromObject(selectedLayer)
    if (!cid) return null
    return (
      getCreativeObjects(canvas, cid).find(
        (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-image',
      ) ?? null
    )
  })()

  // Resolve the paired frame for the FrameActionsToolbar — same gate as
  // pairedImage but returning the frame object so we can pin the toolbar to
  // its top-right corner.
  const pairedFrame: FabricObject | null = (() => {
    const canvas = fabricRef.current
    if (!canvas || !selectedLayer) return null
    const selKind = (selectedLayer as FabricObject & { data?: { kind?: string } }).data?.kind
    if (selKind === 'creative-frame') return selectedLayer
    if (selectedLayer.type !== 'image' && selKind !== 'creative-image') return null
    const cid = getCreativeIdFromObject(selectedLayer)
    if (!cid) return null
    return (
      getCreativeObjects(canvas, cid).find(
        (o) => (o as FabricObject & { data?: { kind?: string } }).data?.kind === 'creative-frame',
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

  // Selected image (loose or frame-bound) — shows the lightweight Arrange panel.
  // Excludes shapes (which already have their own panel) and frames (Frame panel).
  const isImageSelected = (() => {
    const obj = selectedLayer
    if (!obj) return false
    const data = (obj as FabricObject & { data?: { kind?: string } }).data
    if (data?.kind === 'creative-frame' || data?.kind === 'creative-shape') return false
    return obj.type === 'image' || data?.kind === 'creative-image'
  })()

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#FDFDFD]">
      <div className="flex flex-1 overflow-hidden">
        <OuterLeftNav />

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
          {mode === 'canvas' && (
            <CanvasFloatingToolbar
              activeTool={activeTool}
              onToolAction={handleToolAction}
              onReplicateAll={() => { void handleReplicateToAll() }}
            />
          )}
          {/* Always in DOM — Fabric owns the wrapper div, removing it causes removeChild errors */}
          <canvas
            ref={canvasElRef}
            className="absolute inset-0"
            style={{ display: mode === 'canvas' ? 'block' : 'none' }}
          />

          {mode === 'canvas' && frameHoverRect && (
            <div
              className="pointer-events-none absolute z-[60] flex items-center justify-center"
              style={{
                left: frameHoverRect.left,
                top: frameHoverRect.top,
                width: frameHoverRect.width,
                height: frameHoverRect.height,
              }}
            >
              <span className="rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                Double-click to change
              </span>
            </div>
          )}

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
              ) : activeTool === 'draw' ? (
                <DrawSettingsPanel
                  color={drawSettings.color}
                  thickness={drawSettings.thickness}
                  onChange={(patch) => {
                    setDrawSettings((s) => {
                      const next = { ...s, ...patch }
                      const c = fabricRef.current
                      if (c?.freeDrawingBrush) {
                        if (patch.color !== undefined) c.freeDrawingBrush.color = patch.color
                        if (patch.thickness !== undefined) c.freeDrawingBrush.width = patch.thickness
                      }
                      return next
                    })
                  }}
                />
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
              onAfterReplace={(next) => setSelectedLayer(next)}
            />
          )}

          {mode === 'canvas' && pairedFrame && selectedLayer === pairedFrame && (
            <CanvasFrameRightPanel
              canvas={fabricRef.current}
              frame={pairedFrame}
              selectedPresetId={selectedPresetId}
              onPresetChange={(id) => { void handlePresetChange(id) }}
              onReplicateAll={() => { void handleReplicateToAll() }}
              onCommit={saveSnapshot}
            />
          )}

          {mode === 'canvas' && pairedFrame && (
            <FrameActionsToolbar
              canvas={fabricRef.current}
              frame={pairedFrame}
              imageLocked={!imageCropPending}
              onToggleLock={() => {
                if (imageCropPending) handleSaveImageCrop()
                else handleUnlockImage()
              }}
              onReplicate={() => { void handleDuplicateFrame(pairedFrame) }}
            />
          )}

          <ApprovedImagesPanel
            open={showApprovedImages}
            onClose={() => setShowApprovedImages(false)}
            onSelect={(src) => {
              void handleImageSelect(src)
            }}
          />

          {mode === 'canvas' && agentPillVisible && (
            <AgentPill onSubmit={handleAgentSubmit} />
          )}

          {mode === 'canvas' && (
            <>
              <AllyvateAssistant
                visible={allyVisible}
                context="text"
                anchorX={allyAnchorX}
                anchorY={allyAnchorY}
                expandedSide="left"
                expandedPosition={allyExpandedPos}
                seedText={(allyTarget as (FabricObject & { text?: string }) | null)?.text ?? ''}
                onClose={() => { setAllyVisible(false); setAllyTarget(null); setAllyExpandedPos(null) }}
                onInsert={handleAllyInsert}
              />
              <CanvasAllyDock
                visible={!allyVisible}
                onClick={openAllyFromDock}
              />
            </>
          )}

          {mode === 'canvas' && isTextSelected && (
            <CanvasTextRightPanel
              canvas={fabricRef.current}
              selected={selectedLayer}
              position={toolbarPos}
              onCommit={saveSnapshot}
            />
          )}

          {mode === 'canvas' && isImageSelected && (
            <CanvasImageRightPanel
              canvas={fabricRef.current}
              onCommit={saveSnapshot}
            />
          )}

          </div>
        </main>
      </div>
    </div>
  )
}
