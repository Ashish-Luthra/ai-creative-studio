import { create } from 'zustand'
import type { Canvas, FabricObject } from 'fabric'
import { DEFAULT_CANVAS_ZOOM } from '@/lib/canvas/canvasDefaults'

export type CanvasMode = 'canvas' | 'email' | 'feeds'

interface CanvasState {
  mode: CanvasMode
  selectedLayer: FabricObject | null
  zoom: number
  undoStack: string[]
  redoStack: string[]
  fabricCanvas: Canvas | null
  selectedPresetId: string

  // Actions
  setMode: (mode: CanvasMode) => void
  setSelectedLayer: (obj: FabricObject | null) => void
  setZoom: (zoom: number) => void
  setFabricCanvas: (canvas: Canvas | null) => void
  setSelectedPresetId: (presetId: string) => void
  pushUndo: (snapshot: string) => void
  resetHistory: () => void
  undo: () => Promise<void>
  redo: () => Promise<void>
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mode: 'canvas',
  selectedLayer: null,
  zoom: DEFAULT_CANVAS_ZOOM,
  undoStack: [],
  redoStack: [],
  fabricCanvas: null,
  selectedPresetId: 'instagram-4-5',

  setMode: (mode) => set({ mode, selectedLayer: null }),
  setSelectedLayer: (obj) => set({ selectedLayer: obj }),
  setZoom: (zoom) => set({ zoom }),
  setFabricCanvas: (canvas) => set({ fabricCanvas: canvas }),
  setSelectedPresetId: (presetId) => set({ selectedPresetId: presetId }),

  pushUndo: (snapshot) =>
    set((s) => ({
      undoStack: [...s.undoStack, snapshot].slice(-50),
      redoStack: [],
    })),
  resetHistory: () => set({ undoStack: [], redoStack: [] }),

  undo: async () => {
    const { undoStack, redoStack, fabricCanvas } = get()
    if (!undoStack.length || !fabricCanvas) return
    const prev = undoStack[undoStack.length - 1]
    const current = JSON.stringify(fabricCanvas.toJSON())
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
    })
    await fabricCanvas.loadFromJSON(prev)
    fabricCanvas.renderAll()
  },

  redo: async () => {
    const { redoStack, undoStack, fabricCanvas } = get()
    if (!redoStack.length || !fabricCanvas) return
    const next = redoStack[redoStack.length - 1]
    const current = JSON.stringify(fabricCanvas.toJSON())
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
    })
    await fabricCanvas.loadFromJSON(next)
    fabricCanvas.renderAll()
  },
}))
