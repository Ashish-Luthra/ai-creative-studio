/**
 * pageStore.ts — Zustand store for the Landing Page / Case Study block editor.
 */

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import type {
  PageDocument, PageBlock, PageBlockType, PageMode, UpdateSlotPayload,
} from '@/types/page'
import { createDefaultDocument } from './templates'
import { compilePage } from './compiler'

const MAX_HISTORY = 50

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

function pushHist(history: PageDocument[], current: PageDocument): PageDocument[] {
  return [...history, clone(current)].slice(-MAX_HISTORY)
}

// ─── State ────────────────────────────────────────────────────────────────────

interface PageEditorState {
  document: PageDocument
  compiledHtml: string

  selectedBlockId: string | null
  history: PageDocument[]
  future: PageDocument[]

  // ── Actions ──
  setMode: (mode: PageMode) => void
  setSelectedBlock: (id: string | null) => void
  resetDocument: (mode: PageMode) => void

  addBlock: (type: PageBlockType, afterId?: string | null) => void
  removeBlock: (blockId: string) => void
  moveBlock: (blockId: string, direction: 'up' | 'down') => void
  updateSlot: (payload: UpdateSlotPayload) => void
  updateBgColor: (blockId: string, color: string) => void

  undo: () => void
  redo: () => void
  recompile: () => void
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const usePageStore = create<PageEditorState>((set, get) => {
  const initialDoc = createDefaultDocument('case-study')

  return {
    document: initialDoc,
    compiledHtml: compilePage(initialDoc),
    selectedBlockId: null,
    history: [],
    future: [],

    setMode: (mode) => {
      const doc = createDefaultDocument(mode)
      set({ document: doc, compiledHtml: compilePage(doc), history: [], future: [], selectedBlockId: null })
    },

    setSelectedBlock: (id) => set({ selectedBlockId: id }),

    resetDocument: (mode) => {
      const doc = createDefaultDocument(mode)
      set({ document: doc, compiledHtml: compilePage(doc), history: [], future: [], selectedBlockId: null })
    },

    addBlock: (type, afterId) => {
      const { document: doc, history } = get()
      const newBlock = makeDefaultBlock(type)
      const blocks = [...doc.blocks]
      const idx = afterId ? blocks.findIndex((b) => b.id === afterId) : -1
      if (idx >= 0) blocks.splice(idx + 1, 0, newBlock)
      else blocks.push(newBlock)
      const next = { ...doc, blocks }
      set({ document: next, history: pushHist(history, doc), future: [], selectedBlockId: newBlock.id })
      get().recompile()
    },

    removeBlock: (blockId) => {
      const { document: doc, history } = get()
      const next = { ...doc, blocks: doc.blocks.filter((b) => b.id !== blockId) }
      set({ document: next, history: pushHist(history, doc), future: [], selectedBlockId: null })
      get().recompile()
    },

    moveBlock: (blockId, direction) => {
      const { document: doc, history } = get()
      const blocks = [...doc.blocks]
      const idx = blocks.findIndex((b) => b.id === blockId)
      if (idx < 0) return
      const swap = direction === 'up' ? idx - 1 : idx + 1
      if (swap < 0 || swap >= blocks.length) return
      ;[blocks[idx], blocks[swap]] = [blocks[swap], blocks[idx]]
      const next = { ...doc, blocks }
      set({ document: next, history: pushHist(history, doc), future: [] })
      get().recompile()
    },

    updateSlot: ({ blockId, slotKey, value }) => {
      const { document: doc, history } = get()
      const blocks = doc.blocks.map((b) => {
        if (b.id !== blockId) return b
        const slot = b.content[slotKey]
        if (!slot) return b
        return {
          ...b,
          content: {
            ...b.content,
            [slotKey]: { ...slot, value },
          },
        }
      })
      const next = { ...doc, blocks }
      set({ document: next, history: pushHist(history, doc), future: [] })
      get().recompile()
    },

    updateBgColor: (blockId, color) => {
      const { document: doc, history } = get()
      const blocks = doc.blocks.map((b) => b.id !== blockId ? b : { ...b, bgColor: color })
      const next = { ...doc, blocks }
      set({ document: next, history: pushHist(history, doc), future: [] })
      get().recompile()
    },

    undo: () => {
      const { history, future, document: doc } = get()
      if (!history.length) return
      const prev = history[history.length - 1]
      set({
        document: prev,
        history: history.slice(0, -1),
        future: [clone(doc), ...future].slice(0, MAX_HISTORY),
        compiledHtml: compilePage(prev),
      })
    },

    redo: () => {
      const { history, future, document: doc } = get()
      if (!future.length) return
      const [next, ...rest] = future
      set({
        document: next,
        history: pushHist(history, doc),
        future: rest,
        compiledHtml: compilePage(next),
      })
    },

    recompile: () => {
      set({ compiledHtml: compilePage(get().document) })
    },
  }
})

// ─── Default block factory ────────────────────────────────────────────────────

export function makeDefaultBlock(type: PageBlockType): PageBlock {
  const id = nanoid()
  switch (type) {
    case 'page-hero':
      return {
        id, type,
        bgColor: '#0F172A',
        content: {
          tag:      { type: 'text', value: 'Case Study' },
          heading:  { type: 'text', value: 'How [Client] achieved [Result] with [Product]' },
          subtext:  { type: 'text', value: 'A short summary of the challenge, approach, and outcome in 2–3 sentences.' },
          image:    { type: 'image', src: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=600&fit=crop', alt: 'Hero image' },
        },
      }
    case 'page-executive-summary':
      return {
        id, type,
        bgColor: '#FFFFFF',
        content: {
          heading: { type: 'text', value: 'Executive Summary' },
          body:    { type: 'text', value: 'In one paragraph, describe who the client is, what problem they faced, what solution was implemented, and what measurable results were achieved. Keep it to 3–5 sentences.' },
          stat1:   { type: 'text', value: '3×' },
          stat1label: { type: 'text', value: 'Revenue Growth' },
          stat2:   { type: 'text', value: '60%' },
          stat2label: { type: 'text', value: 'Cost Reduction' },
          stat3:   { type: 'text', value: '12 wks' },
          stat3label: { type: 'text', value: 'Time to Results' },
        },
      }
    case 'page-problem':
      return {
        id, type,
        bgColor: '#F8FAFC',
        content: {
          label:   { type: 'text', value: 'The Challenge' },
          heading: { type: 'text', value: 'What was holding them back?' },
          body:    { type: 'text', value: 'Describe the core problem in detail. What was the client trying to do? What was failing? What had they already tried? What were the consequences of inaction?' },
          image:   { type: 'image', src: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=500&fit=crop', alt: 'Challenge illustration' },
        },
      }
    case 'page-solution':
      return {
        id, type,
        bgColor: '#FFFFFF',
        content: {
          label:   { type: 'text', value: 'The Solution' },
          heading: { type: 'text', value: 'How we solved it' },
          body:    { type: 'text', value: 'Describe your approach. What did you build or implement? Why was this the right solution? Walk through the key steps or phases of the engagement.' },
          image:   { type: 'image', src: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&h=500&fit=crop', alt: 'Solution illustration' },
        },
      }
    case 'page-results':
      return {
        id, type,
        bgColor: '#0F172A',
        content: {
          heading:    { type: 'text', value: 'The Results' },
          subtext:    { type: 'text', value: 'Measurable outcomes achieved within the engagement period.' },
          stat1:      { type: 'text', value: '247%' },
          stat1label: { type: 'text', value: 'Increase in Conversions' },
          stat1desc:  { type: 'text', value: 'vs. prior 12-month baseline' },
          stat2:      { type: 'text', value: '$2.4M' },
          stat2label: { type: 'text', value: 'Additional Revenue' },
          stat2desc:  { type: 'text', value: 'in first 6 months post-launch' },
          stat3:      { type: 'text', value: '4.8★' },
          stat3label: { type: 'text', value: 'Customer Satisfaction' },
          stat3desc:  { type: 'text', value: 'up from 3.2 before engagement' },
        },
      }
    case 'page-quote':
      return {
        id, type,
        bgColor: '#F0F9FF',
        content: {
          quote:    { type: 'text', value: '"This was the most impactful partnership we\'ve had. The results speak for themselves — we wish we\'d done this two years earlier."' },
          name:     { type: 'text', value: 'Jane Smith' },
          title:    { type: 'text', value: 'CEO, Acme Corp' },
          avatar:   { type: 'image', src: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face', alt: 'Jane Smith' },
        },
      }
    case 'page-cta':
      return {
        id, type,
        bgColor: '#2563EB',
        content: {
          heading: { type: 'text', value: 'Ready to achieve the same results?' },
          subtext: { type: 'text', value: 'Book a 30-minute call to see if we\'re a good fit for your business.' },
          btnText: { type: 'text', value: 'Book a Call →' },
          btnUrl:  { type: 'text', value: 'https://calendly.com' },
        },
      }
    case 'page-image':
      return {
        id, type,
        bgColor: '#FFFFFF',
        content: {
          image:   { type: 'image', src: 'https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&h=600&fit=crop', alt: 'Full width image' },
          caption: { type: 'text', value: 'Caption text (optional)' },
        },
      }
    case 'page-divider':
      return {
        id, type,
        bgColor: '#FFFFFF',
        content: {},
      }
  }
}
