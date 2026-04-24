/**
 * emailStore.ts — Zustand store for the email block editor.
 *
 * Domain:
 *  - document: the live EmailDocument being edited
 *  - selectedBlockId / selectedSectionId: editor selection state
 *  - history / future: 50-step undo/redo
 *  - compiledHtml: last successful compile output (updated after every mutation)
 *  - previewMode: 'desktop' | 'mobile'
 *
 * Constraints enforced here (mirror the compiler constraints):
 *  - Unsubscribe block cannot be removed via store actions
 *  - History capped at 50 snapshots
 */

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  EmailDocument, EmailSection, EmailColumn, EmailBlock,
  SectionLayout, AddSectionPayload, AddBlockPayload,
  UpdateBlockPayload, MoveBlockPayload,
} from '@/types/email'
import { compileEmail } from './compiler'
import { createDefaultDocument, makeSection, makeUnsubscribeBlock } from './templates'
import { layoutToColumnWidths } from './styleUtils'

// ─── State shape ──────────────────────────────────────────────────────────────

type PreviewMode = 'desktop' | 'mobile'

interface EmailEditorState {
  // Document
  document: EmailDocument
  compiledHtml: string
  compileErrors: string[]

  // Selection
  selectedBlockId: string | null
  selectedSectionId: string | null

  // Preview
  previewMode: PreviewMode

  // Undo / redo
  history: EmailDocument[]
  future: EmailDocument[]

  // ── Selection actions ──
  setSelectedBlock: (id: string | null) => void
  setSelectedSection: (id: string | null) => void
  setPreviewMode: (mode: PreviewMode) => void

  // ── Document mutations (all push to history) ──
  addSection: (payload: AddSectionPayload) => void
  insertSection: (section: EmailSection, afterSectionId?: string | null) => void
  removeSection: (sectionId: string) => void
  moveSection: (sectionId: string, direction: 'up' | 'down') => void
  addBlock: (payload: AddBlockPayload) => void
  removeBlock: (sectionId: string, columnId: string, blockId: string) => void
  moveBlock: (payload: MoveBlockPayload) => void
  updateBlock: (payload: UpdateBlockPayload) => void
  updateSectionStyles: (sectionId: string, styles: Partial<EmailSection['styles']>) => void
  updateGlobalStyles: (patch: Partial<EmailDocument['globalStyles']>) => void
  updateSubject: (subject: string) => void
  updatePreheader: (preheader: string) => void
  resetDocument: () => void

  // ── Undo / redo ──
  undo: () => void
  redo: () => void

  // ── Compiler ──
  recompile: () => Promise<void>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50

function cloneDoc(doc: EmailDocument): EmailDocument {
  return JSON.parse(JSON.stringify(doc)) as EmailDocument
}

function pushHistory(
  history: EmailDocument[],
  current: EmailDocument,
): EmailDocument[] {
  return [...history, cloneDoc(current)].slice(-MAX_HISTORY)
}

function updateBlockInDoc(
  doc: EmailDocument,
  sectionId: string,
  columnId: string,
  blockId: string,
  updater: (b: EmailBlock) => EmailBlock,
): EmailDocument {
  return {
    ...doc,
    sections: doc.sections.map((s) =>
      s.id !== sectionId ? s : {
        ...s,
        columns: s.columns.map((c) =>
          c.id !== columnId ? c : {
            ...c,
            blocks: c.blocks.map((b) => b.id === blockId ? updater(b) : b),
          },
        ),
      },
    ),
  }
}

function buildColumns(layout: SectionLayout): EmailColumn[] {
  return layoutToColumnWidths(layout).map((w) => ({
    id: nanoid(),
    widthPct: w,
    blocks: [],
  }))
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialDoc = createDefaultDocument()

export const useEmailStore = create<EmailEditorState>((set, get) => ({
  document: initialDoc,
  compiledHtml: '',
  compileErrors: [],
  selectedBlockId: null,
  selectedSectionId: null,
  previewMode: 'desktop',
  history: [],
  future: [],

  // ── Selection ──────────────────────────────────────────────────────────────
  setSelectedBlock: (id) => set({ selectedBlockId: id }),
  setSelectedSection: (id) => set({ selectedSectionId: id }),
  setPreviewMode: (mode) => set({ previewMode: mode }),

  // ── Sections ───────────────────────────────────────────────────────────────
  addSection: ({ layout, afterSectionId }) => {
    const { document: doc, history } = get()
    const columns = buildColumns(layout)
    const newSection: EmailSection = {
      id: nanoid(),
      layout,
      columns,
      styles: {
        backgroundColor: '#FFFFFF',
        padding: { top: 20, right: 20, bottom: 20, left: 20 },
      },
    }
    const sections = [...doc.sections]
    const idx = afterSectionId ? sections.findIndex((s) => s.id === afterSectionId) : -1
    if (idx >= 0) sections.splice(idx + 1, 0, newSection)
    else sections.push(newSection)

    const next = { ...doc, sections }
    set({ document: next, history: pushHistory(history, doc), future: [], selectedSectionId: newSection.id })
    void get().recompile()
  },

  insertSection: (section, afterSectionId) => {
    const { document: doc, history } = get()
    const sections = [...doc.sections]
    const idx = afterSectionId ? sections.findIndex((s) => s.id === afterSectionId) : -1
    if (idx >= 0) sections.splice(idx + 1, 0, section)
    else sections.push(section)
    const next = { ...doc, sections }
    set({ document: next, history: pushHistory(history, doc), future: [], selectedSectionId: section.id })
    void get().recompile()
  },

  removeSection: (sectionId) => {
    const { document: doc, history } = get()
    const next = { ...doc, sections: doc.sections.filter((s) => s.id !== sectionId) }
    set({ document: next, history: pushHistory(history, doc), future: [], selectedSectionId: null })
    void get().recompile()
  },

  moveSection: (sectionId, direction) => {
    const { document: doc, history } = get()
    const sections = [...doc.sections]
    const idx = sections.findIndex((s) => s.id === sectionId)
    if (idx < 0) return
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sections.length) return
    ;[sections[idx], sections[swapIdx]] = [sections[swapIdx], sections[idx]]
    const next = { ...doc, sections }
    set({ document: next, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  // ── Blocks ─────────────────────────────────────────────────────────────────
  addBlock: ({ sectionId, columnId, block, afterBlockId }) => {
    const { document: doc, history } = get()
    const next: EmailDocument = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== sectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== columnId) return c
            const blocks = [...c.blocks]
            const idx = afterBlockId ? blocks.findIndex((b) => b.id === afterBlockId) : -1
            if (idx >= 0) blocks.splice(idx + 1, 0, block)
            else blocks.push(block)
            return { ...c, blocks }
          }),
        },
      ),
    }
    set({ document: next, history: pushHistory(history, doc), future: [], selectedBlockId: block.id })
    void get().recompile()
  },

  removeBlock: (sectionId, columnId, blockId) => {
    const { document: doc, history } = get()
    const next = updateBlockInDoc(doc, sectionId, columnId, blockId, () => null as unknown as EmailBlock)
    // Actually filter nulls
    const filtered: EmailDocument = {
      ...next,
      sections: next.sections.map((s) => ({
        ...s,
        columns: s.columns.map((c) => ({
          ...c,
          blocks: c.blocks.filter((b) => b !== null),
        })),
      })),
    }
    set({ document: filtered, history: pushHistory(history, doc), future: [], selectedBlockId: null })
    void get().recompile()
  },

  moveBlock: ({ fromSectionId, fromColumnId, toSectionId, toColumnId, blockId, afterBlockId }) => {
    const { document: doc, history } = get()
    let movedBlock: EmailBlock | null = null

    // Remove from source
    let next: EmailDocument = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== fromSectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== fromColumnId) return c
            const block = c.blocks.find((b) => b.id === blockId)
            if (block) movedBlock = block
            return { ...c, blocks: c.blocks.filter((b) => b.id !== blockId) }
          }),
        },
      ),
    }
    if (!movedBlock) return

    // Insert into destination
    next = {
      ...next,
      sections: next.sections.map((s) =>
        s.id !== toSectionId ? s : {
          ...s,
          columns: s.columns.map((c) => {
            if (c.id !== toColumnId) return c
            const blocks = [...c.blocks]
            const idx = afterBlockId ? blocks.findIndex((b) => b.id === afterBlockId) : -1
            if (idx >= 0) blocks.splice(idx + 1, 0, movedBlock!)
            else blocks.push(movedBlock!)
            return { ...c, blocks }
          }),
        },
      ),
    }
    set({ document: next, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  updateBlock: ({ sectionId, columnId, blockId, patch }) => {
    const { document: doc, history } = get()
    const next = updateBlockInDoc(doc, sectionId, columnId, blockId, (b) => ({
      ...b,
      ...patch,
    } as EmailBlock))
    set({ document: next, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  // ── Styles ─────────────────────────────────────────────────────────────────
  updateSectionStyles: (sectionId, styles) => {
    const { document: doc, history } = get()
    const next: EmailDocument = {
      ...doc,
      sections: doc.sections.map((s) =>
        s.id !== sectionId ? s : { ...s, styles: { ...s.styles, ...styles } },
      ),
    }
    set({ document: next, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  updateGlobalStyles: (patch) => {
    const { document: doc, history } = get()
    const next: EmailDocument = {
      ...doc,
      globalStyles: { ...doc.globalStyles, ...patch },
      // Re-derive unsubscribe text/href if global values changed
      unsubscribe: {
        ...doc.unsubscribe,
        ...(patch.unsubscribeText ? { text: patch.unsubscribeText } : {}),
        ...(patch.unsubscribeHref ? { href: patch.unsubscribeHref } : {}),
      },
    }
    set({ document: next, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  updateSubject: (subject) => {
    const { document: doc } = get()
    set({ document: { ...doc, subject } })
  },

  updatePreheader: (preheader) => {
    const { document: doc, history } = get()
    set({ document: { ...doc, preheader }, history: pushHistory(history, doc), future: [] })
    void get().recompile()
  },

  resetDocument: () => {
    const doc = createDefaultDocument()
    set({ document: doc, history: [], future: [], selectedBlockId: null, selectedSectionId: null })
    void get().recompile()
  },

  // ── Undo / redo ────────────────────────────────────────────────────────────
  undo: () => {
    const { history, future, document: doc } = get()
    if (!history.length) return
    const prev = history[history.length - 1]
    set({
      document: prev,
      history: history.slice(0, -1),
      future: [cloneDoc(doc), ...future].slice(0, MAX_HISTORY),
    })
    void get().recompile()
  },

  redo: () => {
    const { history, future, document: doc } = get()
    if (!future.length) return
    const [next, ...rest] = future
    set({
      document: next,
      history: pushHistory(history, doc),
      future: rest,
    })
    void get().recompile()
  },

  // ── Compiler ───────────────────────────────────────────────────────────────
  recompile: async () => {
    const result = await compileEmail(get().document)
    set({
      compiledHtml: result.html,
      compileErrors: result.errors.map((e) => e.message),
    })
  },
}))

// Kick off initial compile
void useEmailStore.getState().recompile()
