// fabricInit.ts — canvas setup helpers
// Always import Fabric dynamically (client-side only, never SSR).

import type { Canvas, FabricObject } from 'fabric'

// Tracks live Canvas instances by their host element so we can dispose before reinit.
const canvasRegistry = new WeakMap<HTMLCanvasElement, Canvas>()

export interface FabricInitOptions {
  canvasEl: HTMLCanvasElement
  width: number
  height: number
  onSelect: (obj: FabricObject | null) => void
  onModified: (snapshot: FabricObject[]) => void
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
    const snapshot = canvas.getObjects() as FabricObject[]
    onModified(snapshot)
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

// ── Seed the canvas with a 4:5 Instagram creative (image + editable text) ──
export async function seedDefaultCreative(
  canvas: Canvas,
  imageUrl: string,
  copyText: string,
) {
  const { FabricImage, Textbox, Rect, Shadow, Gradient } = await import('fabric')

  const cw = canvas.getWidth()
  const ch = canvas.getHeight()

  // 4:5 frame centered on canvas
  const FRAME_W = Math.min(cw * 0.62, 480)
  const FRAME_H = FRAME_W * (5 / 4)
  const fx = (cw - FRAME_W) / 2
  const fy = (ch - FRAME_H) / 2

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
  })
  applySelectionStyle(txt)
  canvas.add(txt)

  canvas.renderAll()
}
