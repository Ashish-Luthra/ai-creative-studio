import { create } from 'zustand'
import type { Canvas, FabricObject } from 'fabric'

export type CanvasMode = 'canvas' | 'email' | 'feeds'

interface CanvasState {
  mode: CanvasMode
  selectedLayer: FabricObject | null
  zoom: number
  undoStack: FabricObject[][]
  redoStack: FabricObject[][]
  fabricCanvas: Canvas | null

  // Actions
  setMode: (mode: CanvasMode) => void
  setSelectedLayer: (obj: FabricObject | null) => void
  setZoom: (zoom: number) => void
  setFabricCanvas: (canvas: Canvas | null) => void
  pushUndo: (snapshot: FabricObject[]) => void
  undo: () => void
  redo: () => void
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  mode: 'canvas',
  selectedLayer: null,
  zoom: 1,
  undoStack: [],
  redoStack: [],
  fabricCanvas: null,

  setMode: (mode) => set({ mode, selectedLayer: null }),
  setSelectedLayer: (obj) => set({ selectedLayer: obj }),
  setZoom: (zoom) => set({ zoom }),
  setFabricCanvas: (canvas) => set({ fabricCanvas: canvas }),

  pushUndo: (snapshot) =>
    set((s) => ({
      undoStack: [...s.undoStack, snapshot].slice(-50),
      redoStack: [],
    })),

  undo: () => {
    const { undoStack, redoStack, fabricCanvas } = get()
    if (!undoStack.length || !fabricCanvas) return
    const prev = undoStack[undoStack.length - 1]
    const current = fabricCanvas.getObjects() as FabricObject[]
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, current],
    })
    fabricCanvas.clear()
    prev.forEach((obj) => fabricCanvas.add(obj))
    fabricCanvas.renderAll()
  },

  redo: () => {
    const { redoStack, undoStack, fabricCanvas } = get()
    if (!redoStack.length || !fabricCanvas) return
    const next = redoStack[redoStack.length - 1]
    const current = fabricCanvas.getObjects() as FabricObject[]
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, current],
    })
    fabricCanvas.clear()
    next.forEach((obj) => fabricCanvas.add(obj))
    fabricCanvas.renderAll()
  },
}))
