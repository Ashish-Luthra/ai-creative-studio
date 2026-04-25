// fabricInit.ts — canvas setup helpers
// Always import Fabric dynamically (client-side only, never SSR).

import type { Canvas, FabricObject } from 'fabric'
import { getPresetById, type CreativePreset } from './presets'

// Tracks live Canvas instances by their host element so we can dispose before reinit.
const canvasRegistry = new WeakMap<HTMLCanvasElement, Canvas>()

interface CreativeFrame {
  left: number
  top: number
  width: number
  height: number
  rx?: number
  ry?: number
}

type CreativeRole = 'frame' | 'image' | 'scrim' | 'text'

interface CreativeData {
  kind: 'creative-frame' | 'creative-image' | 'creative-scrim' | 'creative-text'
  creativeId: string
  role: CreativeRole
  frame?: CreativeFrame
  cropPending?: boolean
}

interface CreativeFrameBounds {
  left: number
  top: number
  width: number
  height: number
}

export interface FabricInitOptions {
  canvasEl: HTMLCanvasElement
  width: number
  height: number
  onSelect: (obj: FabricObject | null) => void
  onModified: (target?: FabricObject) => void
}

const createCreativeId = () => `creative-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const BLANK_PIXEL_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='

const asCreativeData = (obj?: FabricObject | null): CreativeData | undefined => {
  if (!obj) return undefined
  return (obj as FabricObject & { data?: CreativeData }).data
}

export const getCreativeIdFromObject = (obj?: FabricObject | null) => asCreativeData(obj)?.creativeId

export const getCreativeObjects = (canvas: Canvas, creativeId: string) =>
  canvas.getObjects().filter((obj) => asCreativeData(obj)?.creativeId === creativeId)

const updateImageFrameState = (obj: FabricObject, frame: CreativeFrame) => {
  const image = obj as FabricObject & { clipPath?: FabricObject & { left?: number; top?: number; width?: number; height?: number; rx?: number; ry?: number } }
  if (image.clipPath) {
    image.clipPath.set({
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
      rx: frame.rx ?? 12,
      ry: frame.ry ?? 12,
    })
  }
  const data = asCreativeData(obj)
  if (data?.kind === 'creative-image') {
    ;(obj as FabricObject & { data?: CreativeData }).data = {
      ...data,
      frame,
    }
  }
}

export const moveCreativeBlock = (
  canvas: Canvas,
  creativeId: string,
  dx: number,
  dy: number,
  exclude?: FabricObject | null,
) => {
  if (!dx && !dy) return
  const group = getCreativeObjects(canvas, creativeId)
  for (const obj of group) {
    if (exclude && obj === exclude) {
      const data = asCreativeData(obj)
      if (data?.kind === 'creative-image' && data.frame) {
        updateImageFrameState(obj, {
          ...data.frame,
          left: data.frame.left + dx,
          top: data.frame.top + dy,
        })
      }
      continue
    }
    obj.set({
      left: (obj.left ?? 0) + dx,
      top: (obj.top ?? 0) + dy,
    })
    const data = asCreativeData(obj)
    if (data?.kind === 'creative-image' && data.frame) {
      updateImageFrameState(obj, {
        ...data.frame,
        left: data.frame.left + dx,
        top: data.frame.top + dy,
      })
    }
  }
}

const roleFromKind = (kind?: CreativeData['kind']): CreativeRole | null => {
  if (!kind) return null
  if (kind === 'creative-frame') return 'frame'
  if (kind === 'creative-image') return 'image'
  if (kind === 'creative-scrim') return 'scrim'
  if (kind === 'creative-text') return 'text'
  return null
}

export const ensureCreativeMetadata = (canvas: Canvas) => {
  const creativeObjects = canvas.getObjects().filter((obj) => {
    const kind = asCreativeData(obj)?.kind
    return kind === 'creative-frame' || kind === 'creative-image' || kind === 'creative-scrim' || kind === 'creative-text'
  })
  if (!creativeObjects.length) return

  const existingId = creativeObjects
    .map((obj) => asCreativeData(obj)?.creativeId)
    .find((id): id is string => typeof id === 'string' && id.length > 0)
  const creativeId = existingId ?? createCreativeId()

  for (const obj of creativeObjects) {
    const data = asCreativeData(obj)
    if (!data) continue
    const role = roleFromKind(data.kind)
    if (!role) continue
    ;(obj as FabricObject & { data?: CreativeData }).data = {
      ...data,
      creativeId: data.creativeId ?? creativeId,
      role: data.role ?? role,
    }
  }
}

export async function initFabricCanvas({
  canvasEl,
  width,
  height,
  onSelect,
  onModified,
}: FabricInitOptions): Promise<Canvas> {
  const { Canvas: FabricCanvas } = await import('fabric')

  const existing = canvasRegistry.get(canvasEl)
  if (existing) {
    existing.dispose()
    canvasRegistry.delete(canvasEl)
  }

  const canvas = new FabricCanvas(canvasEl, {
    width,
    height,
    backgroundColor: '#FDFDFD',
    selection: true,
    preserveObjectStacking: true,
  })

  // Selection styling — spec: 2px solid #2563EB
  canvas.on('selection:created', (e) => {
    const obj = e.selected?.[0] ?? null
    if (obj) applySelectionStyle(obj)
    onSelect(obj)
  })
  canvas.on('selection:updated', (e) => {
    const obj = e.selected?.[0] ?? null
    if (obj) applySelectionStyle(obj)
    onSelect(obj)
  })
  canvas.on('selection:cleared', () => onSelect(null))

  canvas.on('object:modified', (e) => {
    onModified(e.target as FabricObject | undefined)
  })

  canvasRegistry.set(canvasEl, canvas)
  return canvas
}

export function applySelectionStyle(obj: FabricObject) {
  obj.set({
    borderColor: '#2563EB',
    borderScaleFactor: 2,
    cornerColor: '#2563EB',
    cornerStrokeColor: '#ffffff',
    cornerStyle: 'rect',
    cornerSize: 8,
    transparentCorners: false,
  })
}

const applyTextboxResizeBehavior = (obj: FabricObject) => {
  if (obj.type !== 'textbox' && obj.type !== 'i-text') return
  obj.set({
    lockScalingY: true,
    lockSkewingX: true,
    lockSkewingY: true,
  })
  obj.setControlsVisibility({
    mt: false,
    mb: false,
    tl: false,
    tr: false,
    bl: false,
    br: false,
  })
}

export function disposeCanvas(canvas: Canvas, canvasEl?: HTMLCanvasElement) {
  if (canvasEl) {
    canvasRegistry.delete(canvasEl)
  } else {
    const el = (canvas as unknown as { getElement?: () => HTMLCanvasElement }).getElement?.()
    if (el) canvasRegistry.delete(el)
  }
  try {
    canvas.dispose()
  } catch {
    // Fabric wraps <canvas> in its own div; if React has already moved the node
    // during unmount the removeChild call throws — safe to ignore.
  }
}

function getFrameBounds(canvas: Canvas, preset: CreativePreset) {
  const cw = canvas.getWidth()
  const ch = canvas.getHeight()
  const ratio = preset.width / preset.height
  const maxW = cw * 0.62
  const maxH = ch * 0.78

  let frameW = maxW
  let frameH = frameW / ratio
  if (frameH > maxH) {
    frameH = maxH
    frameW = frameH * ratio
  }

  return {
    width: frameW,
    height: frameH,
    left: (cw - frameW) / 2,
    top: (ch - frameH) / 2,
  }
}

// ── Seed the canvas with creative frame (image + editable text) ──
export async function seedDefaultCreative(
  canvas: Canvas,
  imageUrl: string,
  copyText: string,
  preset: CreativePreset,
  frameBounds?: CreativeFrameBounds,
) {
  const { FabricImage, Textbox, Rect, Shadow, Gradient } = await import('fabric')

  const { width: FRAME_W, height: FRAME_H, left: fx, top: fy } = frameBounds ?? getFrameBounds(canvas, preset)
  const creativeId = createCreativeId()
  const frameState: CreativeFrame = { left: fx, top: fy, width: FRAME_W, height: FRAME_H, rx: 12, ry: 12 }

  // ── Background frame (rounded rect) ─────────────────────
  const frame = new Rect({
    left: fx,
    top: fy,
    width: FRAME_W,
    height: FRAME_H,
    rx: 12,
    ry: 12,
    fill: '#1a1a2e',
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    data: { kind: 'creative-frame', creativeId, role: 'frame' } satisfies CreativeData,
  })
  canvas.add(frame)

  // ── Image ────────────────────────────────────────────────
  try {
    const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
    const scaleX = FRAME_W / (img.width ?? 1)
    const scaleY = FRAME_H / (img.height ?? 1)
    const scale = Math.max(scaleX, scaleY)

    // absolutePositioned:true → clip uses canvas screen coords, not object local space
    const clip = new Rect({
      left: fx,
      top: fy,
      width: FRAME_W,
      height: FRAME_H,
      rx: 12,
      ry: 12,
      absolutePositioned: true,
    })
    img.clipPath = clip
    img.set({
      left: fx + FRAME_W / 2,
      top: fy + FRAME_H / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      selectable: true,
      data: {
        kind: 'creative-image',
        creativeId,
        role: 'image',
        frame: frameState,
        cropPending: false,
      } satisfies CreativeData,
    })
    applySelectionStyle(img)
    canvas.add(img)
  } catch {
    // Fallback: gradient placeholder when image isn't available yet
    const grad = new Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: { x1: 0, y1: 0, x2: 0, y2: FRAME_H },
      colorStops: [
        { offset: 0, color: '#4a3728' },
        { offset: 1, color: '#1a0f0a' },
      ],
    })
    frame.set({ fill: grad })
  }

  // ── Dark gradient scrim at bottom so text is readable ───
  const scrim = new Rect({
    left: fx,
    top: fy + FRAME_H * 0.55,
    width: FRAME_W,
    height: FRAME_H * 0.45,
    fill: new Gradient({
      type: 'linear',
      gradientUnits: 'pixels',
      coords: { x1: 0, y1: 0, x2: 0, y2: FRAME_H * 0.45 },
      colorStops: [
        { offset: 0, color: 'rgba(0,0,0,0)' },
        { offset: 1, color: 'rgba(0,0,0,0.65)' },
      ],
    }),
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    clipPath: new Rect({
      left: fx,
      top: fy + FRAME_H * 0.55,
      width: FRAME_W,
      height: FRAME_H * 0.45,
      rx: 12,
      ry: 12,
      absolutePositioned: true,
    }),
    data: { kind: 'creative-scrim', creativeId, role: 'scrim' } satisfies CreativeData,
  })
  canvas.add(scrim)

  // ── Editable copy text ───────────────────────────────────
  const txt = new Textbox(copyText, {
    left: fx + 28,
    top: fy + FRAME_H - 110,
    width: FRAME_W - 56,
    fontFamily: 'Georgia',
    fontSize: 40,
    fill: '#FFFFFF',
    textAlign: 'center',
    fontWeight: 'bold',
    shadow: new Shadow({ color: 'rgba(0,0,0,0.55)', blur: 10, offsetX: 0, offsetY: 2 }),
    editable: true,
    selectable: true,
    data: { kind: 'creative-text', creativeId, role: 'text' } satisfies CreativeData,
  })
  applySelectionStyle(txt)
  applyTextboxResizeBehavior(txt)
  canvas.add(txt)

  canvas.renderAll()
}

export async function addTextLayer(canvas: Canvas, text = 'Headline text') {
  const { Textbox, Shadow } = await import('fabric')
  const textbox = new Textbox(text, {
    left: canvas.getWidth() * 0.25,
    top: canvas.getHeight() * 0.2,
    width: canvas.getWidth() * 0.5,
    fontFamily: 'Inter',
    fontSize: 48,
    fontWeight: 'bold',
    fill: '#FFFFFF',
    textAlign: 'center',
    shadow: new Shadow({ color: 'rgba(0,0,0,0.45)', blur: 8, offsetX: 0, offsetY: 1 }),
    editable: true,
    data: { kind: 'creative-text' },
  })
  applySelectionStyle(textbox)
  applyTextboxResizeBehavior(textbox)
  canvas.add(textbox)
  canvas.setActiveObject(textbox)
  canvas.renderAll()
}

export async function addShapeLayer(canvas: Canvas) {
  const { Rect } = await import('fabric')
  const rect = new Rect({
    left: canvas.getWidth() * 0.32,
    top: canvas.getHeight() * 0.3,
    width: 220,
    height: 120,
    fill: '#2563EB',
    opacity: 0.85,
    rx: 12,
    ry: 12,
    data: { kind: 'shape' },
  })
  applySelectionStyle(rect)
  canvas.add(rect)
  canvas.setActiveObject(rect)
  canvas.renderAll()
}

export async function addBlankCreativeFrame(canvas: Canvas, frameBounds?: CreativeFrameBounds) {
  const preset = getPresetById('instagram-1-1')
  await seedDefaultCreative(canvas, BLANK_PIXEL_DATA_URL, '', preset, frameBounds)
}

export async function replaceOrAddImageLayer(canvas: Canvas, imageUrl: string, selected?: FabricObject | null) {
  const { FabricImage, Rect } = await import('fabric')
  const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
  const target = selected?.type === 'image' ? selected : null

  const fallbackFrame = (): CreativeFrame => {
    const frameObj = canvas
      .getObjects()
      .find((obj) => (obj as { data?: { kind?: string } }).data?.kind === 'creative-frame')
    if (!frameObj) {
      return {
        left: canvas.getWidth() * 0.2,
        top: canvas.getHeight() * 0.12,
        width: canvas.getWidth() * 0.6,
        height: canvas.getHeight() * 0.76,
        rx: 12,
        ry: 12,
      }
    }
    const frameBounds = frameObj.getBoundingRect()
    return {
      left: frameBounds.left,
      top: frameBounds.top,
      width: frameBounds.width,
      height: frameBounds.height,
      rx: 12,
      ry: 12,
    }
  }

  const getFrameFromImage = (object: FabricObject) => {
    const data = (object as { data?: { frame?: CreativeFrame } }).data
    if (data?.frame) {
      return {
        left: data.frame.left,
        top: data.frame.top,
        width: data.frame.width,
        height: data.frame.height,
        rx: data.frame.rx ?? 12,
        ry: data.frame.ry ?? 12,
      }
    }
    const clip = (object as { clipPath?: { left?: number; top?: number; width?: number; height?: number; rx?: number; ry?: number } }).clipPath
    if (clip?.left != null && clip?.top != null && clip?.width != null && clip?.height != null) {
      return {
        left: clip.left,
        top: clip.top,
        width: clip.width,
        height: clip.height,
        rx: clip.rx ?? 12,
        ry: clip.ry ?? 12,
      }
    }
    return fallbackFrame()
  }

  const resolveCreativeId = () => {
    const selectedId = getCreativeIdFromObject(target ?? undefined)
    if (selectedId) return selectedId
    const existing = canvas
      .getObjects()
      .find((obj) => (asCreativeData(obj)?.kind === 'creative-frame' || asCreativeData(obj)?.kind === 'creative-image'))
    return getCreativeIdFromObject(existing) ?? createCreativeId()
  }

  if (target) {
    const frame = getFrameFromImage(target)
    const creativeId = resolveCreativeId()
    const scale = Math.max(frame.width / (img.width ?? 1), frame.height / (img.height ?? 1))
    img.clipPath = new Rect({
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
      rx: frame.rx,
      ry: frame.ry,
      absolutePositioned: true,
    })
    img.set({
      left: frame.left + frame.width / 2,
      top: frame.top + frame.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      data: { kind: 'creative-image', creativeId, role: 'image', frame, cropPending: false } satisfies CreativeData,
    })
    canvas.remove(target)
  } else {
    const frame = fallbackFrame()
    const creativeId = resolveCreativeId()
    const scale = Math.max(frame.width / (img.width ?? 1), frame.height / (img.height ?? 1))
    img.clipPath = new Rect({
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
      rx: frame.rx,
      ry: frame.ry,
      absolutePositioned: true,
    })
    img.set({
      left: frame.left + frame.width / 2,
      top: frame.top + frame.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      data: { kind: 'creative-image', creativeId, role: 'image', frame, cropPending: false } satisfies CreativeData,
    })
  }

  applySelectionStyle(img)
  canvas.add(img)
  canvas.setActiveObject(img)
  canvas.renderAll()
}
