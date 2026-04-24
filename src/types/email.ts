/**
 * email.ts — canonical types for the email block editor and compiler.
 *
 * Design contract (non-negotiable):
 *  - Unsubscribe block: always last, cannot be deleted or hidden
 *  - Logo block:        supports meta.isGlobal — compiler pulls from globalStyles at render
 *  - Max 2 CTAs per section: enforced in compiler, not just UI
 *  - No flexbox / grid / JS in compiled HTML output
 *  - Text is never baked into images
 */

// ─── Block type discriminant ────────────────────────────────────────────────

export type BlockType =
  | 'text'
  | 'image'
  | 'button'
  | 'divider'
  | 'spacer'
  | 'logo'
  | 'unsubscribe'

// ─── Section layout presets ─────────────────────────────────────────────────
// Drives column count + width ratios in the compiler.

export type SectionLayout =
  | 'full'            // 1 col, 100%
  | 'two-col'         // 2 cols, 50/50
  | 'left-heavy'      // 2 cols, 60/40
  | 'right-heavy'     // 2 cols, 40/60
  | 'three-col'       // 3 cols, 33/33/33
  | 'image-left'      // 2 cols, 40/60 — intended for image + text
  | 'image-right'     // 2 cols, 60/40 — intended for text + image

// ─── Shared style primitives ────────────────────────────────────────────────

export interface Padding {
  top: number
  right: number
  bottom: number
  left: number
}

export interface Border {
  width: number
  style: 'solid' | 'dashed' | 'dotted' | 'none'
  color: string
  radius?: number
}

// ─── Per-block style interfaces ─────────────────────────────────────────────

export interface TextStyles {
  fontFamily: string
  fontSize: number          // px
  fontWeight: 'normal' | 'bold' | '300' | '400' | '500' | '600' | '700'
  lineHeight: number        // unitless multiplier
  color: string             // hex
  textAlign: 'left' | 'center' | 'right'
  padding: Padding
}

export interface ImageStyles {
  width: number | 'full'    // px or 'full' (100% of column)
  align: 'left' | 'center' | 'right'
  padding: Padding
  border?: Border
  borderRadius?: number
}

export interface ButtonStyles {
  backgroundColor: string
  color: string
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold' | '600' | '700'
  padding: Padding
  border?: Border
  borderRadius: number
  align: 'left' | 'center' | 'right'
  width: 'auto' | 'full'
}

export interface DividerStyles {
  color: string
  height: number            // px — rendered as border-top
  margin: Pick<Padding, 'top' | 'bottom'>
  style: 'solid' | 'dashed' | 'dotted'
}

export interface SectionStyles {
  backgroundColor: string
  padding: Padding
  border?: Border
}

export interface GlobalEmailStyles {
  backgroundColor: string   // email body bg
  contentWidth: number      // px, default 600
  fontFamily: string        // fallback font stack
  logo?: {
    src: string
    alt: string
    width: number
    href?: string
  }
  linkColor: string
  unsubscribeText: string
  unsubscribeHref: string
}

// ─── Block interfaces ────────────────────────────────────────────────────────

interface BaseBlock {
  id: string
  type: BlockType
}

export interface TextBlock extends BaseBlock {
  type: 'text'
  /** Raw HTML string — headings, paragraphs, lists. Never baked into an image. */
  content: string
  styles: TextStyles
}

export interface ImageBlock extends BaseBlock {
  type: 'image'
  src: string
  alt: string
  /** Optional click-through URL */
  href?: string
  styles: ImageStyles
}

export interface ButtonBlock extends BaseBlock {
  type: 'button'
  label: string
  href: string
  /** Opens in new tab */
  newTab?: boolean
  styles: ButtonStyles
}

export interface DividerBlock extends BaseBlock {
  type: 'divider'
  styles: DividerStyles
}

export interface SpacerBlock extends BaseBlock {
  type: 'spacer'
  /** Height in px */
  height: number
}

export interface LogoBlock extends BaseBlock {
  type: 'logo'
  /** When true the compiler substitutes from globalStyles.logo at render time */
  src: string
  alt: string
  width: number
  href?: string
  meta: {
    /** If true, src/alt/width are inherited from globalStyles.logo */
    isGlobal: boolean
  }
}

/** Unsubscribe is structurally locked — always the last rendered block. */
export interface UnsubscribeBlock extends BaseBlock {
  type: 'unsubscribe'
  /** Supports merge tags e.g. {{unsubscribe_url}} */
  text: string
  href: string
  styles: TextStyles
  meta: {
    /** Always true — compiler refuses to position this block anywhere else */
    locked: true
  }
}

export type EmailBlock =
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | LogoBlock
  | UnsubscribeBlock

// ─── Structure types ─────────────────────────────────────────────────────────

export interface EmailColumn {
  id: string
  /** Width expressed as integer percentage (must sum to 100 within section) */
  widthPct: number
  blocks: EmailBlock[]
}

export interface EmailSection {
  id: string
  layout: SectionLayout
  columns: EmailColumn[]
  styles: SectionStyles
  /** Human-readable label shown in the structure panel */
  label?: string
}

export interface EmailDocument {
  id: string
  subject: string
  preheader: string
  /** Ordered list of sections. Compiler appends unsubscribe after the last section. */
  sections: EmailSection[]
  /** Always rendered last. Cannot be reordered, deleted, or hidden. */
  unsubscribe: UnsubscribeBlock
  globalStyles: GlobalEmailStyles
}

// ─── Compiler types ───────────────────────────────────────────────────────────

export type CompilerErrorCode =
  | 'MAX_CTA_EXCEEDED'       // > 2 ButtonBlocks in a single section
  | 'MISSING_UNSUBSCRIBE'    // unsubscribe block missing or malformed
  | 'INVALID_COLUMN_WIDTHS'  // column widths in a section do not sum to 100
  | 'EMPTY_BUTTON_HREF'      // ButtonBlock href is empty
  | 'INVALID_IMAGE_SRC'      // ImageBlock src is empty

export type CompilerWarningCode =
  | 'MISSING_ALT_TEXT'       // ImageBlock or LogoBlock has empty alt
  | 'MISSING_PREHEADER'      // EmailDocument.preheader is empty
  | 'EMPTY_SECTION'          // Section has no blocks in any column
  | 'INVALID_IMAGE_SRC'      // ImageBlock src is empty — preview shows placeholder

export interface CompilerError {
  code: CompilerErrorCode
  message: string
  sectionId?: string
  blockId?: string
}

export interface CompilerWarning {
  code: CompilerWarningCode
  message: string
  sectionId?: string
  blockId?: string
}

export interface CompilerOptions {
  /** Output width in px. Defaults to globalStyles.contentWidth or 600. */
  width?: number
  /** 'html' = full document with doctype. 'preview' = inner body only (for live preview). */
  mode?: 'html' | 'preview'
}

export interface CompileResult {
  html: string
  errors: CompilerError[]
  warnings: CompilerWarning[]
}

// ─── Store action payload types ───────────────────────────────────────────────

export interface AddSectionPayload {
  layout: SectionLayout
  afterSectionId?: string   // insert after this section; append if omitted
}

export interface AddBlockPayload {
  sectionId: string
  columnId: string
  block: EmailBlock
  afterBlockId?: string
}

export interface UpdateBlockPayload {
  sectionId: string
  columnId: string
  blockId: string
  patch: Partial<EmailBlock>
}

export interface MoveBlockPayload {
  fromSectionId: string
  fromColumnId: string
  toSectionId: string
  toColumnId: string
  blockId: string
  afterBlockId?: string
}
