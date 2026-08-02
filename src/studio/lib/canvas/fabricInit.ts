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

type CreativeRole = 'frame' | 'image' | 'scrim' | 'text' | 'shape'

interface CreativeData {
  kind: 'creative-frame' | 'creative-image' | 'creative-scrim' | 'creative-text' | 'creative-shape'
  creativeId: string
  role: CreativeRole
  frame?: CreativeFrame
  cropPending?: boolean
  moveHandle?: boolean
}

export interface CreativeFrameBounds {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Brand-derived styling for a seeded creative (agentic generation). Every
 * field optional — omitted fields keep the original hard-coded defaults so
 * manual flows are unchanged.
 */
export interface CreativeSeedStyle {
  textColor?: string
  fontFamily?: string
  fontPx?: number
  fontWeight?: number | string
  scrimFrom?: string
  scrimTo?: string
  frameColor?: string
  /**
   * Two brand hexes painted top→bottom across the frame instead of a photo.
   * Ignored when an image URL is supplied.
   */
  backgroundGradient?: { from: string; to: string }
  /** Supporting line under the headline. */
  subhead?: string
  /** Short rule above the headline, in the brand accent. */
  accentColor?: string
  /** Brand wordmark for the top-left corner (light/dark variant per background). */
  logoUrl?: string
  /** Optional CTA pill rendered under the headline (from brand ctaSpecs). */
  cta?: { label: string; background?: string; color?: string }
}

interface BlankCreativeFrameOptions {
  frameBounds?: CreativeFrameBounds
  preset?: CreativePreset
}

export interface FabricInitOptions {
  canvasEl: HTMLCanvasElement
  width: number
  height: number
  onSelect: (obj: FabricObject | null) => void
  onModified: (target?: FabricObject) => void
}

const createCreativeId = () => `creative-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

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
  if (kind === 'creative-shape') return 'shape'
  return null
}

export const ensureCreativeMetadata = (canvas: Canvas) => {
  const creativeObjects = canvas.getObjects().filter((obj) => {
    const kind = asCreativeData(obj)?.kind
    return kind === 'creative-frame' || kind === 'creative-image' || kind === 'creative-scrim' || kind === 'creative-text' || kind === 'creative-shape'
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
    backgroundColor: '#F5F5F5',
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

// Image is "saved into" the frame — frame becomes the primary handle.
// Clicks fall through to the frame underneath, no chrome draws on the image.
export const lockCreativeImage = (img: FabricObject) => {
  img.set({
    selectable: false,
    evented: false,
    hoverCursor: 'default',
    hasControls: false,
    hasBorders: false,
  })
}

// Image is being re-cropped — user can drag/scale within the clipPath.
export const unlockCreativeImage = (img: FabricObject) => {
  img.set({
    selectable: true,
    evented: true,
    hoverCursor: 'move',
    hasControls: true,
    hasBorders: true,
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

/**
 * Block until `family` is actually usable by canvas text.
 *
 * The kit's @font-face rules are injected by StudioScreen, but `font-display`
 * only fetches the file when something *uses* the family — and canvas drawing
 * doesn't count as use. `document.fonts.load` forces the fetch; the timeout
 * keeps a slow or missing font from stalling the whole seed.
 */
async function ensureFontReady(family?: string, weight?: number | string): Promise<void> {
  if (!family || typeof document === 'undefined' || !document.fonts) return
  const spec = `${typeof weight === 'number' ? weight : 700} 16px '${family}'`
  if (document.fonts.check(spec)) return
  try {
    await Promise.race([
      document.fonts.load(spec),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  } catch {
    /* unavailable font → Fabric falls back, which is the old behaviour */
  }
}

/**
 * Load a brand wordmark as a Fabric object.
 *
 * Kit logos are captured as inline SVG with a viewBox but NO width/height
 * attributes. Loaded through `FabricImage` (an <img> under the hood) such an
 * SVG gets the browser's 300×150 default intrinsic size instead of its real
 * 300×55, so height-based scaling renders the mark undersized inside a tall
 * transparent box — the stray blocks in the corner of a creative. Parsing the
 * SVG instead honours the viewBox.
 */
async function loadLogoObject(url: string): Promise<FabricObject | null> {
  const { FabricImage, loadSVGFromString, util } = await import('fabric')
  const isSvg = url.startsWith('data:image/svg+xml')
  if (!isSvg) return FabricImage.fromURL(url, { crossOrigin: 'anonymous' })

  const [, payload = ''] = url.split(',')
  const markup = url.includes(';base64,') ? atob(payload) : decodeURIComponent(payload)
  const { objects } = await loadSVGFromString(markup)
  const shapes = objects.filter((o): o is FabricObject => Boolean(o))
  if (shapes.length === 0) return null
  return util.groupSVGElements(shapes, {})
}

// ── Seed the canvas with creative frame (image + editable text) ──
export async function seedDefaultCreative(
  canvas: Canvas,
  /** null → the frame is filled from the brand palette instead of a photo. */
  imageUrl: string | null,
  copyText: string,
  preset: CreativePreset,
  frameBounds?: CreativeFrameBounds,
  style?: CreativeSeedStyle,
) {
  const { FabricImage, Textbox, Rect, Shadow, Gradient } = await import('fabric')

  // Fabric measures and rasterises text immediately, and nothing re-renders the
  // canvas when a webfont arrives later — so a creative seeded before the brand
  // face is ready silently paints in the fallback serif and stays that way.
  await ensureFontReady(style?.fontFamily, style?.fontWeight)

  const { width: FRAME_W, height: FRAME_H, left: fx, top: fy } = frameBounds ?? getFrameBounds(canvas, preset)
  const creativeId = createCreativeId()
  const frameState: CreativeFrame = { left: fx, top: fy, width: FRAME_W, height: FRAME_H, rx: 0, ry: 0 }

  // ── Background frame (square light-gray frame) ──────────
  const frame = new Rect({
    left: fx,
    top: fy,
    width: FRAME_W,
    height: FRAME_H,
    rx: 0,
    ry: 0,
    fill: style?.frameColor ?? '#D1D5DB',
    // Frame is the primary click target — drag moves the whole creative block.
    selectable: true,
    evented: true,
    hoverCursor: 'move',
    data: { kind: 'creative-frame', creativeId, role: 'frame' } satisfies CreativeData,
  })
  canvas.add(frame)

  // Bold type on a brand color is the default treatment; a photo is opt-in.
  const paintGradient = (from: string, to: string) => {
    frame.set({
      fill: new Gradient({
        type: 'linear',
        gradientUnits: 'pixels',
        coords: { x1: 0, y1: 0, x2: 0, y2: FRAME_H },
        colorStops: [
          { offset: 0, color: from },
          { offset: 1, color: to },
        ],
      }),
    })
  }

  // ── Background: photo, brand gradient, or flat brand color ─
  const brandGradient = style?.backgroundGradient
  if (!imageUrl) {
    // No photo — the frame keeps its flat `frameColor` fill unless a brand
    // gradient was specified.
    if (brandGradient) paintGradient(brandGradient.from, brandGradient.to)
  } else {
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
        rx: 0,
        ry: 0,
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
        data: {
          kind: 'creative-image',
          creativeId,
          role: 'image',
          frame: frameState,
          cropPending: true,
        } satisfies CreativeData,
      })
      applySelectionStyle(img)
      unlockCreativeImage(img)
      canvas.add(img)
    } catch {
      // Image failed to load — fall back to the brand gradient when we have
      // one, otherwise the neutral placeholder.
      if (brandGradient) paintGradient(brandGradient.from, brandGradient.to)
      else paintGradient('#4a3728', '#1a0f0a')
    }
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
        { offset: 0, color: style?.scrimFrom ?? 'rgba(0,0,0,0)' },
        { offset: 1, color: style?.scrimTo ?? 'rgba(0,0,0,0.65)' },
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
      rx: 0,
      ry: 0,
      absolutePositioned: true,
    }),
    data: { kind: 'creative-scrim', creativeId, role: 'scrim' } satisfies CreativeData,
  })
  canvas.add(scrim)

  // ── Layout grid ──────────────────────────────────────────
  // Everything below is proportional to the frame: creatives are tiled at ~1/4
  // size in the brief view and shown full-size when applied, and a layout built
  // from fixed pixel offsets falls apart at one of those two scales.
  const pad = Math.round(FRAME_W * 0.075)
  const contentW = FRAME_W - pad * 2
  const textColor = style?.textColor ?? '#FFFFFF'
  const fontFamily = style?.fontFamily ?? 'Georgia'
  // Photography needs the shadow to lift copy off a busy background; on flat
  // brand color it just smudges the type.
  const copyShadow = imageUrl ? new Shadow({ color: 'rgba(0,0,0,0.55)', blur: 10, offsetX: 0, offsetY: 2 }) : undefined

  // Stack from the bottom up: CTA, subhead, headline, accent rule.
  let cursorY = fy + FRAME_H - pad

  // ── Optional CTA pill (brand ctaSpecs) ───────────────────
  if (style?.cta?.label) {
    const ctaFontSize = Math.max(9, Math.min(17, Math.round(FRAME_H * 0.032)))
    const ctaH = Math.round(ctaFontSize * 2.6)
    const ctaW = Math.min(contentW, Math.round(style.cta.label.length * ctaFontSize * 0.62 + ctaFontSize * 2.8))
    const ctaLeft = fx + pad
    const ctaTop = cursorY - ctaH
    const pill = new Rect({
      left: ctaLeft,
      top: ctaTop,
      width: ctaW,
      height: ctaH,
      rx: ctaH / 2,
      ry: ctaH / 2,
      fill: style.cta.background ?? '#111111',
      selectable: true,
      data: { kind: 'creative-shape', creativeId, role: 'shape' } satisfies CreativeData,
    })
    const pillText = new Textbox(style.cta.label, {
      left: ctaLeft,
      top: ctaTop + (ctaH - ctaFontSize * 1.16) / 2,
      width: ctaW,
      fontFamily,
      fontSize: ctaFontSize,
      fill: style.cta.color ?? '#ffffff',
      textAlign: 'center',
      fontWeight: 600,
      editable: true,
      selectable: true,
      data: { kind: 'creative-text', creativeId, role: 'text' } satisfies CreativeData,
    })
    canvas.add(pill)
    canvas.add(pillText)
    cursorY = ctaTop - Math.round(FRAME_H * 0.045)
  }

  // ── Optional subhead ─────────────────────────────────────
  // The agent has always written one; until now it was dropped on the floor,
  // which is most of why brand-color creatives read as empty.
  if (style?.subhead) {
    const subFontSize = Math.max(9, Math.min(22, Math.round(FRAME_H * 0.032)))
    const sub = new Textbox(style.subhead, {
      left: fx + pad,
      top: cursorY,
      width: contentW,
      fontFamily,
      fontSize: subFontSize,
      lineHeight: 1.3,
      fill: textColor,
      opacity: 0.82,
      textAlign: 'left',
      fontWeight: 400,
      shadow: copyShadow,
      editable: true,
      selectable: true,
      data: { kind: 'creative-text', creativeId, role: 'text' } satisfies CreativeData,
    })
    sub.set({ top: cursorY - sub.height })
    sub.setCoords()
    applySelectionStyle(sub)
    applyTextboxResizeBehavior(sub)
    canvas.add(sub)
    cursorY = sub.top - Math.round(FRAME_H * 0.03)
  }

  // ── Headline ─────────────────────────────────────────────
  // Copy is LLM-authored, so its length (and the requested fontPx) vary per
  // creative. Fabric wraps to `width` and grows downward without bound, so a
  // fixed top pushes long headlines out of the frame. Shrink to the space that
  // is actually left above the stack, then bottom-anchor so it grows upward.
  const headlineTopLimit = fy + Math.round(FRAME_H * 0.28)
  const availableH = cursorY - headlineTopLimit
  const txt = new Textbox(copyText, {
    left: fx + pad,
    top: headlineTopLimit,
    width: contentW,
    fontFamily,
    // Cap against the frame as well as the model's request — 64px type on a
    // tile 300px wide is three words per line.
    fontSize: Math.min(style?.fontPx ?? 40, Math.round(FRAME_W * 0.125)),
    lineHeight: 1.08,
    fill: textColor,
    textAlign: 'left',
    fontWeight: style?.fontWeight ?? 'bold',
    shadow: copyShadow,
    editable: true,
    selectable: true,
    data: { kind: 'creative-text', creativeId, role: 'text' } satisfies CreativeData,
  })
  for (let size = txt.fontSize; txt.height > availableH && size > 12; size -= 2) {
    txt.set({ fontSize: size - 2 })
    txt.initDimensions()
  }
  txt.set({ top: cursorY - txt.height })
  txt.setCoords()

  applySelectionStyle(txt)
  applyTextboxResizeBehavior(txt)
  canvas.add(txt)

  // ── Accent rule above the headline ───────────────────────
  // A short bar in the accent color: cheap, but it turns "text floating on a
  // rectangle" into something that reads as composed.
  if (style?.accentColor) {
    const ruleH = Math.max(2, Math.round(FRAME_H * 0.008))
    const ruleTop = txt.top - Math.round(FRAME_H * 0.035)
    if (ruleTop > fy + pad) {
      canvas.add(
        new Rect({
          left: fx + pad,
          top: ruleTop,
          width: Math.round(FRAME_W * 0.14),
          height: ruleH,
          fill: style.accentColor,
          selectable: true,
          data: { kind: 'creative-shape', creativeId, role: 'shape' } satisfies CreativeData,
        })
      )
    }
  }

  // ── Brand logo, top-left ─────────────────────────────────
  if (style?.logoUrl) {
    try {
      const logo = await loadLogoObject(style.logoUrl)
      if (logo) {
        const targetH = Math.max(10, Math.round(FRAME_H * 0.05))
        const logoScale = targetH / Math.max(logo.height ?? targetH, 1)
        // Wordmarks are wide; never let one run past the content column.
        const cappedScale = Math.min(logoScale, (contentW * 0.45) / Math.max(logo.width ?? 1, 1))
        logo.set({
          left: fx + pad,
          top: fy + pad,
          scaleX: cappedScale,
          scaleY: cappedScale,
          selectable: true,
          data: { kind: 'creative-shape', creativeId, role: 'shape' } satisfies CreativeData,
        })
        applySelectionStyle(logo)
        canvas.add(logo)
      }
    } catch {
      /* logo is decoration — a creative without it still reads fine */
    }
  }

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

export async function addBlankCreativeFrame(canvas: Canvas, options: BlankCreativeFrameOptions = {}) {
  const { Rect, Textbox } = await import('fabric')
  const preset = options.preset ?? getPresetById('instagram-1-1')
  const bounds = options.frameBounds ?? getFrameBounds(canvas, preset)
  const creativeId = createCreativeId()

  const frameLabel = new Textbox(`Frame ${preset.ratioLabel}`, {
    left: bounds.left,
    top: Math.max(12, bounds.top - 24),
    width: Math.max(120, bounds.width),
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: 500,
    fill: '#6B7280',
    editable: true,
    selectable: true,
    hoverCursor: 'move',
    data: {
      kind: 'creative-text',
      creativeId,
      role: 'text',
      moveHandle: true,
    } satisfies CreativeData,
  })
  applySelectionStyle(frameLabel)

  const frame = new Rect({
    left: bounds.left,
    top: bounds.top,
    width: bounds.width,
    height: bounds.height,
    rx: 0,
    ry: 0,
    fill: '#FFFFFF',
    stroke: '#D1D5DB',
    strokeWidth: 1,
    selectable: true,
    evented: true,
    hoverCursor: 'move',
    data: { kind: 'creative-frame', creativeId, role: 'frame' } satisfies CreativeData,
  })
  canvas.add(frameLabel)
  applySelectionStyle(frame)
  canvas.add(frame)
  canvas.setActiveObject(frame)
  canvas.renderAll()
}

export async function replaceOrAddImageLayer(canvas: Canvas, imageUrl: string, selected?: FabricObject | null) {
  const { FabricImage, Rect } = await import('fabric')
  const img = await FabricImage.fromURL(imageUrl, { crossOrigin: 'anonymous' })
  const target = selected?.type === 'image' ? selected : null

  /**
   * The frame the user actually has selected.
   *
   * Only an existing *image* used to count as a drop target, so selecting a
   * blank frame and picking a library image fell through to `fallbackFrame()`
   * — which returns the FIRST frame on the canvas. With more than one frame the
   * picture silently landed in the wrong one, which reads as "I can't put an
   * image on a blank frame".
   */
  const selectedFrame: FabricObject | null = (() => {
    if (!selected) return null
    if (asCreativeData(selected)?.kind === 'creative-frame') return selected
    // Something inside a creative (its text, its scrim) means that creative.
    const creativeId = getCreativeIdFromObject(selected)
    if (!creativeId) return null
    return (
      canvas
        .getObjects()
        .find(
          (o) => asCreativeData(o)?.kind === 'creative-frame' && asCreativeData(o)?.creativeId === creativeId
        ) ?? null
    )
  })()

  const boundsOfFrame = (frameObj: FabricObject): CreativeFrame => {
    const b = frameObj.getBoundingRect()
    return { left: b.left, top: b.top, width: b.width, height: b.height, rx: 12, ry: 12 }
  }

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
    // Prefer whatever the user selected — replacing an image, or dropping into
    // a blank frame — before falling back to the first creative on the canvas.
    const selectedId = getCreativeIdFromObject(target ?? selectedFrame ?? undefined)
    if (selectedId) return selectedId
    const existing = canvas
      .getObjects()
      .find((obj) => (asCreativeData(obj)?.kind === 'creative-frame' || asCreativeData(obj)?.kind === 'creative-image'))
    return getCreativeIdFromObject(existing) ?? createCreativeId()
  }

  // Where the picture goes, in order of how explicit the user was about it.
  const frame = target
    ? getFrameFromImage(target)
    : selectedFrame
      ? boundsOfFrame(selectedFrame)
      : fallbackFrame()
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
    data: { kind: 'creative-image', creativeId, role: 'image', frame, cropPending: true } satisfies CreativeData,
  })
  // Replacing an existing image swaps it out; dropping onto a frame adds.
  if (target) canvas.remove(target)

  applySelectionStyle(img)
  unlockCreativeImage(img)
  canvas.add(img)
  // Image lands unlocked so the user can drag/scale it inside the clipPath
  // immediately. The frame still wins the click-target competition for
  // empty-area clicks because the image is constrained to the frame's bounds.
  const hostFrame = canvas
    .getObjects()
    .find((o) => asCreativeData(o)?.kind === 'creative-frame' && asCreativeData(o)?.creativeId === creativeId)
  if (hostFrame) {
    canvas.setActiveObject(hostFrame)
  } else {
    canvas.discardActiveObject()
  }
  canvas.renderAll()
}

// ───────────────────────────────────────────────────────────────────────────────
// Shape primitives — rectangle / oval / line / arrow / triangle / star / polygon
// Inserted at frame center (frame-aware) or canvas center; tagged as
// `creative-shape` so moveCreativeBlock + delete-block include them.

export type ShapeKind = 'rectangle' | 'oval' | 'line' | 'arrow' | 'triangle' | 'star' | 'polygon'

export type LinearHead = 'none' | 'line' | 'triangle' | 'triangle-reversed' | 'circle' | 'diamond'

export interface LinearConfig {
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  headSize: number
  startHead: LinearHead
  endHead: LinearHead
}

const DEFAULT_SHAPE_FILL = '#1B51B3'
const DEFAULT_SHAPE_STROKE = '#1B51B3'

// Build an SVG path d-string for a line with optional arrowheads on either
// end. Closed head shapes (triangle, diamond, circle) are appended as
// subpaths; the parent fabric Path renders them filled because both stroke
// and fill are set to the same colour. Open heads (line) draw via stroke
// only and don't enclose an area.
export const buildLinearPath = (cfg: LinearConfig): string => {
  const { x1, y1, x2, y2, headSize, startHead, endHead } = cfg
  let d = `M ${x1} ${y1} L ${x2} ${y2}`

  // Append a head at endpoint (px, py) pointing away from anchor (ax, ay).
  const head = (px: number, py: number, ax: number, ay: number, kind: LinearHead) => {
    if (kind === 'none') return
    const dx = px - ax, dy = py - ay
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len // unit vector along line, toward endpoint
    const nx = -uy, ny = ux             // perpendicular
    const h = headSize
    const half = h * 0.5

    // Anchor point of the head — `h` units back from the endpoint.
    const bx = px - ux * h
    const by = py - uy * h

    if (kind === 'line') {
      // Two open chevron strokes — no fill needed.
      d += ` M ${bx + nx * half} ${by + ny * half} L ${px} ${py} L ${bx - nx * half} ${by - ny * half}`
      return
    }
    if (kind === 'triangle') {
      // Closed triangle pointing toward endpoint.
      d += ` M ${px} ${py} L ${bx + nx * half} ${by + ny * half} L ${bx - nx * half} ${by - ny * half} Z`
      return
    }
    if (kind === 'triangle-reversed') {
      // Closed triangle pointing back toward the line.
      const fx = px + ux * h
      const fy = py + uy * h
      d += ` M ${fx} ${fy} L ${px + nx * half} ${py + ny * half} L ${px - nx * half} ${py - ny * half} Z`
      return
    }
    if (kind === 'diamond') {
      // Closed diamond centred on the endpoint.
      d += ` M ${px + ux * half} ${py + uy * half}`
      d += ` L ${px + nx * half} ${py + ny * half}`
      d += ` L ${px - ux * half} ${py - uy * half}`
      d += ` L ${px - nx * half} ${py - ny * half} Z`
      return
    }
    if (kind === 'circle') {
      // Closed circle centred on the endpoint, radius = headSize/2.
      const r = half
      d += ` M ${px - r} ${py} a ${r} ${r} 0 1 1 ${r * 2} 0 a ${r} ${r} 0 1 1 ${-r * 2} 0 Z`
      return
    }
  }

  head(x2, y2, x1, y1, endHead)
  head(x1, y1, x2, y2, startHead)
  return d
}

const starPoints = (cx: number, cy: number, outerR: number, innerR: number, points = 5) => {
  const out: { x: number; y: number }[] = []
  const step = Math.PI / points
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = i * step - Math.PI / 2
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

const polygonPoints = (cx: number, cy: number, r: number, sides = 6) => {
  const out: { x: number; y: number }[] = []
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) })
  }
  return out
}

export async function insertShape(
  canvas: Canvas,
  kind: ShapeKind,
  options: { creativeId?: string; cx?: number; cy?: number; size?: number } = {},
): Promise<FabricObject> {
  const { Rect, Ellipse, Triangle, Polygon, Path } = await import('fabric')
  const cx = options.cx ?? canvas.getWidth() / 2
  const cy = options.cy ?? canvas.getHeight() / 2
  const s = options.size ?? Math.min(canvas.getWidth(), canvas.getHeight()) * 0.18

  const tagData = (obj: FabricObject) => {
    // Always tag the kind so the shape colour panel shows; creativeId only
    // when the shape is part of a creative block (so moveCreativeBlock and
    // delete-block include it).
    ;(obj as FabricObject & { data?: CreativeData }).data = {
      kind: 'creative-shape',
      creativeId: options.creativeId ?? '',
      role: 'shape',
    }
    applySelectionStyle(obj)
  }

  let obj: FabricObject
  switch (kind) {
    case 'rectangle':
      obj = new Rect({
        left: cx, top: cy, originX: 'center', originY: 'center',
        width: s * 1.4, height: s, rx: 4, ry: 4,
        fill: DEFAULT_SHAPE_FILL,
      })
      break
    case 'oval':
      obj = new Ellipse({
        left: cx, top: cy, originX: 'center', originY: 'center',
        rx: s * 0.7, ry: s * 0.5,
        fill: DEFAULT_SHAPE_FILL,
      })
      break
    case 'line':
    case 'arrow': {
      // Path-based linear shape — one coherent fabric object so colour,
      // thickness, and arrowhead toggles all act uniformly. Stored config
      // on `data.linear` so the Shape panel can rebuild the path when any
      // setting changes.
      const half = s
      const linear: LinearConfig = {
        x1: -half, y1: 0, x2: half, y2: 0,
        thickness: 4, headSize: 18,
        startHead: 'none',
        endHead: kind === 'arrow' ? 'triangle' : 'none',
      }
      const d = buildLinearPath(linear)
      const path = new Path(d, {
        left: cx, top: cy, originX: 'center', originY: 'center',
        stroke: DEFAULT_SHAPE_STROKE,
        // Closed head subpaths (triangle / diamond / circle) render filled
        // when fill matches stroke. Open heads (line) and the open shaft
        // contribute no enclosed area, so fill is invisible there.
        fill: DEFAULT_SHAPE_STROKE,
        strokeWidth: linear.thickness,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      })
      ;(path as FabricObject & { data?: CreativeData & { linear?: LinearConfig } }).data = {
        kind: 'creative-shape',
        creativeId: options.creativeId ?? '',
        role: 'shape',
        linear,
      } as unknown as CreativeData
      applySelectionStyle(path)
      canvas.add(path)
      canvas.setActiveObject(path)
      canvas.requestRenderAll()
      return path
    }
    case 'triangle':
      obj = new Triangle({
        left: cx, top: cy, originX: 'center', originY: 'center',
        width: s, height: s,
        fill: DEFAULT_SHAPE_FILL,
      })
      break
    case 'star': {
      const pts = starPoints(0, 0, s / 2, s / 4, 5)
      obj = new Polygon(pts, {
        left: cx, top: cy, originX: 'center', originY: 'center',
        fill: DEFAULT_SHAPE_FILL,
      })
      break
    }
    case 'polygon': {
      const pts = polygonPoints(0, 0, s / 2, 6)
      obj = new Polygon(pts, {
        left: cx, top: cy, originX: 'center', originY: 'center',
        fill: DEFAULT_SHAPE_FILL,
      })
      break
    }
  }

  tagData(obj)
  canvas.add(obj)
  canvas.setActiveObject(obj)
  canvas.requestRenderAll()
  return obj
}

// Patch a linear shape's config (thickness / start head / end head) and
// regenerate its path string. Recreates the fabric Path because Path doesn't
// always re-tokenize via `set('path', ...)`. Position and selection state are
// preserved.
export async function updateLinearShape(
  canvas: Canvas,
  current: FabricObject,
  patch: Partial<LinearConfig>,
): Promise<FabricObject | null> {
  const data = (current as FabricObject & { data?: CreativeData & { linear?: LinearConfig } }).data
  if (!data?.linear) return null
  const next: LinearConfig = { ...data.linear, ...patch }
  const { Path } = await import('fabric')
  const d = buildLinearPath(next)
  const stroke = (current as FabricObject & { stroke?: string }).stroke ?? DEFAULT_SHAPE_STROKE
  const left = current.left ?? 0
  const top = current.top ?? 0
  const angle = current.angle ?? 0
  const scaleX = current.scaleX ?? 1
  const scaleY = current.scaleY ?? 1

  const replacement = new Path(d, {
    left, top, originX: 'center', originY: 'center', angle, scaleX, scaleY,
    stroke,
    fill: stroke,
    strokeWidth: next.thickness,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
  })
  ;(replacement as FabricObject & { data?: CreativeData & { linear?: LinearConfig } }).data = {
    ...data,
    linear: next,
  }
  applySelectionStyle(replacement)
  canvas.remove(current)
  canvas.add(replacement)
  canvas.setActiveObject(replacement)
  canvas.requestRenderAll()
  return replacement
}
