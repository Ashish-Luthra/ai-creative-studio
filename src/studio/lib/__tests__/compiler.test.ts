/**
 * compiler.test.ts
 * Tests for the email HTML compiler — validates output structure,
 * compliance rules, and error/warning conditions.
 */

import { describe, it, expect } from 'vitest'
import { compileEmail } from '../email/compiler'
import type {
  EmailDocument, EmailSection, GlobalEmailStyles,
  TextBlock, ImageBlock, ButtonBlock, DividerBlock, SpacerBlock, UnsubscribeBlock,
  TextStyles, ImageStyles, ButtonStyles, DividerStyles, SectionStyles,
} from '@studio/types/email'

// ── Shared style fixtures ─────────────────────────────────────────────────────

const DEFAULT_TEXT_STYLES: TextStyles = {
  fontFamily: 'Arial',
  fontSize: 16,
  fontWeight: 'normal',
  lineHeight: 1.6,
  color: '#374151',
  textAlign: 'left',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
}

const DEFAULT_IMAGE_STYLES: ImageStyles = {
  width: 'full',
  align: 'center',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
}

const DEFAULT_BUTTON_STYLES: ButtonStyles = {
  backgroundColor: '#1B51B3',
  color: '#ffffff',
  fontFamily: 'Arial',
  fontSize: 16,
  fontWeight: '600',
  padding: { top: 12, right: 24, bottom: 12, left: 24 },
  borderRadius: 4,
  align: 'center',
  width: 'auto',
}

const DEFAULT_DIVIDER_STYLES: DividerStyles = {
  color: '#E5E7EB',
  height: 1,
  margin: { top: 16, bottom: 16 },
  style: 'solid',
}

const DEFAULT_SECTION_STYLES: SectionStyles = {
  backgroundColor: '#ffffff',
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
}

const GLOBAL: GlobalEmailStyles = {
  fontFamily: 'Arial',
  backgroundColor: '#ffffff',
  contentWidth: 600,
  linkColor: '#1B51B3',
  unsubscribeText: 'Unsubscribe',
  unsubscribeHref: 'https://example.com/unsubscribe',
}

const UNSUBSCRIBE_BLOCK: UnsubscribeBlock = {
  id: 'unsub',
  type: 'unsubscribe',
  text: 'Unsubscribe',
  href: 'https://example.com/unsubscribe',
  styles: DEFAULT_TEXT_STYLES,
  meta: { locked: true },
}

// ── Helper factories ──────────────────────────────────────────────────────────

function makeDoc(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: 'doc-1',
    subject: 'Test Subject',
    preheader: 'Test preheader',
    globalStyles: GLOBAL,
    sections: [],
    unsubscribe: UNSUBSCRIBE_BLOCK,
    ...overrides,
  }
}

function makeSection(
  blocks: EmailSection['columns'][0]['blocks'],
  id = 's1',
): EmailSection {
  return {
    id,
    layout: 'full',
    columns: [{ id: 'c1', widthPct: 100, blocks }],
    styles: DEFAULT_SECTION_STYLES,
  }
}

function makeTwoColSection(
  leftBlocks: EmailSection['columns'][0]['blocks'],
  rightBlocks: EmailSection['columns'][0]['blocks'],
): EmailSection {
  return {
    id: 's-two-col',
    layout: 'two-col',
    columns: [
      { id: 'c1', widthPct: 50, blocks: leftBlocks },
      { id: 'c2', widthPct: 50, blocks: rightBlocks },
    ],
    styles: DEFAULT_SECTION_STYLES,
  }
}

function textBlock(id = 'tb1'): TextBlock {
  return {
    id,
    type: 'text',
    content: '<p>Hello World</p>',
    styles: DEFAULT_TEXT_STYLES,
  }
}

function imageBlock(id = 'img1'): ImageBlock {
  return {
    id,
    type: 'image',
    src: 'https://example.com/image.jpg',
    alt: 'A test image',
    styles: DEFAULT_IMAGE_STYLES,
  }
}

function buttonBlock(id = 'btn1'): ButtonBlock {
  return {
    id,
    type: 'button',
    label: 'Click me',
    href: 'https://example.com',
    styles: DEFAULT_BUTTON_STYLES,
  }
}

function spacerBlock(id = 'sp1'): SpacerBlock {
  return { id, type: 'spacer', height: 32 }
}

function dividerBlock(id = 'd1'): DividerBlock {
  return { id, type: 'divider', styles: DEFAULT_DIVIDER_STYLES }
}

// ── Compiler: happy path ──────────────────────────────────────────────────────

describe('compileEmail — valid documents', () => {
  it('returns html for a minimal valid document', async () => {
    const result = await compileEmail(makeDoc())
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('<!DOCTYPE html')
  })

  it('includes the preheader text', async () => {
    const result = await compileEmail(makeDoc({ preheader: 'My preheader text' }))
    expect(result.html).toContain('My preheader text')
  })

  it('includes the unsubscribe link', async () => {
    const result = await compileEmail(makeDoc())
    expect(result.html).toContain('https://example.com/unsubscribe')
  })

  it('renders a text block', async () => {
    const doc = makeDoc({ sections: [makeSection([textBlock()])] })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('Hello World')
  })

  it('renders an image block', async () => {
    const doc = makeDoc({ sections: [makeSection([imageBlock()])] })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('https://example.com/image.jpg')
  })

  it('renders a button block with correct href and label', async () => {
    const doc = makeDoc({ sections: [makeSection([buttonBlock()])] })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('https://example.com')
    expect(result.html).toContain('Click me')
  })

  it('renders a spacer block without errors', async () => {
    const doc = makeDoc({ sections: [makeSection([spacerBlock()])] })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
  })

  it('renders a divider block without errors', async () => {
    const doc = makeDoc({ sections: [makeSection([dividerBlock()])] })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
  })

  it('output does not contain flexbox', async () => {
    const doc = makeDoc({ sections: [makeSection([textBlock(), imageBlock()])] })
    const result = await compileEmail(doc)
    expect(result.html).not.toMatch(/display\s*:\s*flex/i)
  })

  it('output does not contain CSS grid', async () => {
    const doc = makeDoc({ sections: [makeSection([textBlock()])] })
    const result = await compileEmail(doc)
    expect(result.html).not.toMatch(/display\s*:\s*grid/i)
  })

  it('output does not contain <script> tags', async () => {
    const doc = makeDoc({ sections: [makeSection([textBlock()])] })
    const result = await compileEmail(doc)
    expect(result.html.toLowerCase()).not.toContain('<script')
  })

  it('respects custom width option', async () => {
    const result = await compileEmail(makeDoc(), { width: 480 })
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('480')
  })

  it('respects the pretty option (produces valid output in both modes)', async () => {
    const compact = await compileEmail(makeDoc(), { pretty: false })
    const pretty  = await compileEmail(makeDoc(), { pretty: true })
    expect(compact.errors).toHaveLength(0)
    expect(pretty.errors).toHaveLength(0)
    expect(compact.html.length).toBeGreaterThan(0)
    expect(pretty.html.length).toBeGreaterThan(0)
  })

  it('handles multiple sections', async () => {
    const doc = makeDoc({
      sections: [
        makeSection([textBlock('t1')], 's1'),
        makeSection([imageBlock('i1')], 's2'),
        makeSection([buttonBlock('b1')], 's3'),
      ],
    })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('Hello World')
    expect(result.html).toContain('example.com/image.jpg')
    expect(result.html).toContain('Click me')
  })

  it('handles a two-column section', async () => {
    const doc = makeDoc({
      sections: [makeTwoColSection([textBlock('t1')], [imageBlock('i1')])],
    })
    const result = await compileEmail(doc)
    expect(result.errors).toHaveLength(0)
    expect(result.html).toContain('Hello World')
    expect(result.html).toContain('example.com/image.jpg')
  })
})

// ── Compiler: validation errors ───────────────────────────────────────────────

describe('compileEmail — validation errors', () => {
  it('returns MISSING_UNSUBSCRIBE when unsubscribe href is empty', async () => {
    const doc = makeDoc({
      unsubscribe: { ...UNSUBSCRIBE_BLOCK, href: '' },
    })
    const result = await compileEmail(doc)
    expect(result.errors.some((e) => e.code === 'MISSING_UNSUBSCRIBE')).toBe(true)
    expect(result.html).toBe('')
  })

  it('returns EMPTY_BUTTON_HREF for button without href', async () => {
    const btn: ButtonBlock = { ...buttonBlock(), href: '' }
    const doc = makeDoc({ sections: [makeSection([btn])] })
    const result = await compileEmail(doc)
    expect(result.errors.some((e) => e.code === 'EMPTY_BUTTON_HREF')).toBe(true)
    expect(result.html).toBe('')
  })

  it('returns MAX_CTA_EXCEEDED when more than 2 buttons in a section', async () => {
    const doc = makeDoc({
      sections: [makeSection([buttonBlock('b1'), buttonBlock('b2'), buttonBlock('b3')])],
    })
    const result = await compileEmail(doc)
    expect(result.errors.some((e) => e.code === 'MAX_CTA_EXCEEDED')).toBe(true)
  })
})

// ── Compiler: warnings ────────────────────────────────────────────────────────

describe('compileEmail — warnings', () => {
  it('warns INVALID_IMAGE_SRC for image with no src', async () => {
    const img: ImageBlock = { ...imageBlock(), src: '' }
    const doc = makeDoc({ sections: [makeSection([img])] })
    const result = await compileEmail(doc)
    expect(result.warnings.some((w) => w.code === 'INVALID_IMAGE_SRC')).toBe(true)
    // Warnings don't block compilation
    expect(result.errors).toHaveLength(0)
    expect(result.html.length).toBeGreaterThan(0)
  })

  it('warns MISSING_ALT_TEXT for image with no alt', async () => {
    const img: ImageBlock = { ...imageBlock(), alt: '' }
    const doc = makeDoc({ sections: [makeSection([img])] })
    const result = await compileEmail(doc)
    expect(result.warnings.some((w) => w.code === 'MISSING_ALT_TEXT')).toBe(true)
  })

  it('warns MISSING_PREHEADER when preheader is empty', async () => {
    const doc = makeDoc({ preheader: '' })
    const result = await compileEmail(doc)
    expect(result.warnings.some((w) => w.code === 'MISSING_PREHEADER')).toBe(true)
  })
})
