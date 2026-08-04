/**
 * page.ts — types for the Landing Page / Case Study block editor.
 *
 * Design contract:
 *  - Every block has an `id`, `type`, and `content` map
 *  - `content` keys are editable slots — text slots use contenteditable, image slots use image picker
 *  - The compiler outputs clean HTML/CSS — no MJML, no table layout
 *  - Inline editing mutates content in place via pageStore
 */

// ─── Block types ─────────────────────────────────────────────────────────────

export type PageBlockType =
  | 'page-hero'
  | 'page-executive-summary'
  | 'page-problem'
  | 'page-solution'
  | 'page-results'
  | 'page-quote'
  | 'page-cta'
  | 'page-image'
  | 'page-divider'

// ─── Content slot types ───────────────────────────────────────────────────────

export interface TextSlot {
  type: 'text'
  value: string
}

export interface ImageSlot {
  type: 'image'
  src: string
  alt: string
}

export type ContentSlot = TextSlot | ImageSlot

// ─── Block definitions ────────────────────────────────────────────────────────

export interface PageBlock {
  id: string
  type: PageBlockType
  /** All editable content slots keyed by slot name */
  content: Record<string, ContentSlot>
  /** Optional background color override */
  bgColor?: string
}

// ─── Page document ────────────────────────────────────────────────────────────

export type PageMode = 'landing-page' | 'case-study'

export interface PageDocument {
  id: string
  mode: PageMode
  title: string
  blocks: PageBlock[]
  globalStyles: {
    fontFamily: string
    primaryColor: string
    textColor: string
    bgColor: string
  }
}

// ─── Store action payloads ────────────────────────────────────────────────────

export interface UpdateSlotPayload {
  blockId: string
  slotKey: string
  value: string
}
