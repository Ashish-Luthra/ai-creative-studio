// fabricInit.ts — canvas setup helpers
// Always import Fabric dynamically (client-side only, never SSR).

import type { Canvas, FabricObject } from 'fabric'

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

export function disposeCanvas(canvas: Canvas) {
  canvas.dispose()
}
