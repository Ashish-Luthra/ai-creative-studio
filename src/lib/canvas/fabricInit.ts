// fabricInit.ts — canvas setup helpers
// Always import Fabric dynamically (client-side only, never SSR).

import type { Canvas, FabricObject } from 'fabric'
import type { CreativePreset } from './presets'

// Tracks live Canvas instances by their host element so we can dispose before reinit.
const canvasRegistry = new WeakMap<HTMLCanvasElement, Canvas>()

export interface FabricInitOptions {
  canvasEl: HTMLCanvasElement
  width: number
  height: number
  onSelect: (obj: FabricObject | null) => void
  onModified: () => void
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

  canvas.on('object:modified', () => {
    onModified()
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

export function disposeCanvas(canvas: Canvas, canvasEl?: HTMLCanvasElement) {
  if (canvasEl) canvasRegistry.delete(canvasEl)
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
) {
  const { FabricImage, Textbox, Rect, Shadow, Gradient } = await import('fabric')

  const { width: FRAME_W, height: FRAME_H, left: fx, top: fy } = getFrameBounds(canvas, preset)

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
      data: { kind: 'creative-image' },
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
    data: { kind: 'creative-text' },
  })
  applySelectionStyle(txt)
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

export async function replaceOrAddImageLayer(canvas: Canvas, imageUrl: string, selected?: FabricObject | null) {
  const { FabricImage } = await import('fabric')
  const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
  const target = selected?.type === 'image' ? selected : null

  if (target) {
    const bounds = target.getBoundingRect()
    const scale = Math.max(bounds.width / (img.width ?? 1), bounds.height / (img.height ?? 1))
    img.set({
      left: bounds.left + bounds.width / 2,
      top: bounds.top + bounds.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale,
      scaleY: scale,
      data: { kind: 'creative-image' },
    })
    canvas.remove(target)
  } else {
    const scale = Math.max((canvas.getWidth() * 0.4) / (img.width ?? 1), (canvas.getHeight() * 0.4) / (img.height ?? 1))
    img.set({
      left: canvas.getWidth() * 0.3,
      top: canvas.getHeight() * 0.2,
      scaleX: scale,
      scaleY: scale,
      data: { kind: 'creative-image' },
    })
  }

  applySelectionStyle(img)
  canvas.add(img)
  canvas.setActiveObject(img)
  canvas.renderAll()
}
