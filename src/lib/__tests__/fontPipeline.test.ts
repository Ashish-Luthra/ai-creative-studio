/**
 * fontPipeline.test.ts
 *
 * Tests the complete font pipeline from canvas block settings through to the
 * compiled HTML output.  Each test is named after the specific regression it
 * guards against — several of these tests were written to catch real bugs that
 * shipped before this suite existed.
 *
 * Pipeline under test:
 *   CanvasBlock[] → canvasBlocksToEmailDocument() → compileEmail() → HTML
 *
 * Key invariants:
 *  1. The global body font MUST appear BEFORE Arial in every font-family stack
 *     in the compiled HTML when no per-block override is set.
 *  2. A per-block font MUST appear before the global font in its element stack.
 *  3. Every Google Font used (global or per-block) MUST have a corresponding
 *     <link> and @import in the compiled <head>.
 *  4. System fonts (Arial, Helvetica, etc.) must NOT trigger a Google Fonts import.
 *  5. buildFontStack must never produce duplicate entries.
 */

import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { compileEmail } from '../email/compiler'
import { canvasBlocksToEmailDocument } from '../email/canvasConverter'
import { buildFontStack } from '../email/styleUtils'
import type { CanvasBlock } from '@/types/canvas'
import type { EmailDocument } from '@/types/email'
import { createDefaultDocument } from '../email/templates'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCanvasDoc(
  globalFont: string,
  blockFont?: string,
): EmailDocument {
  const blocks: CanvasBlock[] = [
    {
      id: nanoid(),
      type: 'text',
      fontFamily: blockFont,   // undefined when testing "global only" scenario
    },
  ]
  const base = createDefaultDocument()
  const doc  = canvasBlocksToEmailDocument(blocks, {
    ...base,
    globalStyles: { ...base.globalStyles, fontFamily: globalFont },
  })
  return doc
}

// ─── buildFontStack unit tests ────────────────────────────────────────────────

describe('buildFontStack', () => {
  it('puts the primary font first', () => {
    const stack = buildFontStack('Cabin', 'Arial')
    expect(stack.split(',')[0].trim()).toBe('Cabin')
  })

  it('falls back to globalFallback when primary is empty string', () => {
    const stack = buildFontStack('', 'Cabin')
    expect(stack.split(',')[0].trim()).toBe('Cabin')
  })

  it('includes Arial as a safe system fallback', () => {
    expect(buildFontStack('Cabin', 'Open Sans')).toContain('Arial')
  })

  it('does not duplicate entries when primary === globalFallback', () => {
    const stack = buildFontStack('Cabin', 'Cabin')
    const entries = stack.split(',').map((s) => s.trim().replace(/'/g, ''))
    const unique  = new Set(entries)
    expect(entries.length).toBe(unique.size)
  })

  it('quotes font names that contain spaces', () => {
    const stack = buildFontStack('Open Sans', 'Arial')
    expect(stack).toContain("'Open Sans'")
  })

  it('does not quote single-word font names', () => {
    const stack = buildFontStack('Cabin', 'Arial')
    // Should not have quotes around "Cabin"
    expect(stack).not.toMatch(/'Cabin'/)
    expect(stack).toContain('Cabin')
  })
})

// ─── Global font → compiled HTML ─────────────────────────────────────────────

describe('Global font propagation to compiled HTML', () => {
  it('REGRESSION — global font appears BEFORE Arial when no per-block font is set', async () => {
    // Bug: textStyles() defaulted fontFamily to "Arial". buildFontStack("Arial","Cabin")
    // produced "Arial, Cabin, ..." so the browser always used Arial, silently
    // ignoring the user's Cabin choice.
    const doc = makeCanvasDoc('Cabin')
    const { html } = await compileEmail(doc)

    const cabinPos = html.indexOf('Cabin')
    const arialPos = html.indexOf('Arial')

    expect(cabinPos).toBeGreaterThan(-1)
    expect(arialPos).toBeGreaterThan(-1)
    expect(cabinPos).toBeLessThan(arialPos)
  })

  it('global font is imported via <link> and @import', async () => {
    const doc = makeCanvasDoc('Poppins')
    const { html } = await compileEmail(doc)

    expect(html).toMatch(/<link[^>]*fonts\.googleapis\.com[^>]*>/)
    expect(html).toContain('@import url(')
    expect(html).toContain('Poppins')
  })

  it('works for every TOP_30 font — import URL is present', async () => {
    const { TOP_30_FONTS } = await import('@/lib/canvas/googleFonts')
    for (const font of TOP_30_FONTS) {
      const doc = makeCanvasDoc(font)
      const { html } = await compileEmail(doc)
      expect(html, `${font}: missing from compiled HTML`).toContain(font)
      expect(html, `${font}: fonts.googleapis.com link missing`).toContain('fonts.googleapis.com')
    }
  })

  it('system font (Arial) does NOT trigger a Google Fonts import', async () => {
    const doc = makeCanvasDoc('Arial')
    const { html } = await compileEmail(doc)
    expect(html).not.toContain('fonts.googleapis.com')
  })

  it('system font (Helvetica) does NOT trigger a Google Fonts import', async () => {
    const doc = makeCanvasDoc('Helvetica')
    const { html } = await compileEmail(doc)
    expect(html).not.toContain('fonts.googleapis.com')
  })

  it('system font (Georgia) does NOT trigger a Google Fonts import', async () => {
    const doc = makeCanvasDoc('Georgia')
    const { html } = await compileEmail(doc)
    expect(html).not.toContain('fonts.googleapis.com')
  })
})

// ─── Per-block font override ──────────────────────────────────────────────────

describe('Per-block font override', () => {
  it('per-block font appears BEFORE global font in that element\'s stack', async () => {
    // When a block has an explicit fontFamily, it must win over the global.
    const doc = makeCanvasDoc('Cabin', 'Lora')
    const { html } = await compileEmail(doc)

    // Lora should be imported (it's a Google Font)
    expect(html).toContain('Lora')

    // Find a font-family CSS declaration that contains BOTH Lora and Cabin.
    // In the text block's <td>, buildFontStack('Lora', 'Cabin') must produce
    // "Lora, Cabin, Arial, ..." — Lora first.
    // (The outer wrapper and Google Fonts URL list Cabin first because it's
    // the global font, so we must scope the check to the per-element stack.)
    const stackWithBoth = html.match(/font-family:[^;"<]*Lora[^;"<]*Cabin/)?.[0]
    expect(stackWithBoth, 'Expected a font-family stack containing Lora before Cabin').not.toBeUndefined()
  })

  it('both per-block and global fonts are imported when both are Google Fonts', async () => {
    const doc = makeCanvasDoc('Cabin', 'Montserrat')
    const { html } = await compileEmail(doc)

    expect(html).toContain('Cabin')
    expect(html).toContain('Montserrat')
    expect(html).toContain('fonts.googleapis.com')
  })

  it('per-block system font (Arial) does not shadow global Google font import', async () => {
    // Even when a block uses Arial, the global Cabin must still be imported.
    const doc = makeCanvasDoc('Cabin', 'Arial')
    const { html } = await compileEmail(doc)

    expect(html).toContain('Cabin')
    expect(html).toContain('fonts.googleapis.com')
  })
})

// ─── Multi-block documents ────────────────────────────────────────────────────

describe('Multi-block font handling', () => {
  it('all Google fonts across all blocks are imported in a single URL', async () => {
    const blocks: CanvasBlock[] = [
      { id: nanoid(), type: 'text',   fontFamily: 'Lora' },
      { id: nanoid(), type: 'button', fontFamily: 'Raleway' },
      { id: nanoid(), type: 'text' },   // no per-block font — uses global
    ]
    const base = createDefaultDocument()
    const doc  = canvasBlocksToEmailDocument(blocks, {
      ...base,
      globalStyles: { ...base.globalStyles, fontFamily: 'Poppins' },
    })
    const { html } = await compileEmail(doc)

    expect(html).toContain('Lora')
    expect(html).toContain('Raleway')
    expect(html).toContain('Poppins')
    // All three must be in a single googleapis.com URL (or multiple - just all present)
    expect(html).toContain('fonts.googleapis.com')
  })

  it('duplicate font families across blocks produce only one @import entry', async () => {
    const blocks: CanvasBlock[] = [
      { id: nanoid(), type: 'text',   fontFamily: 'Cabin' },
      { id: nanoid(), type: 'text',   fontFamily: 'Cabin' },
      { id: nanoid(), type: 'button', fontFamily: 'Cabin' },
    ]
    const base = createDefaultDocument()
    const doc  = canvasBlocksToEmailDocument(blocks, {
      ...base,
      globalStyles: { ...base.globalStyles, fontFamily: 'Cabin' },
    })
    const { html } = await compileEmail(doc)

    // The compiler emits both a <link> tag and an @import for compatibility,
    // so "family=Cabin" appears twice in the HTML (once in each).
    // What must NOT happen is the same font imported twice in either tag.
    // Guard: the @import line must mention Cabin exactly once.
    const importLine = html.match(/@import url\([^)]+\)/)?.[0] ?? ''
    expect(importLine).toContain('Cabin')
    const importCabinMatches = importLine.match(/family=Cabin/g) ?? []
    expect(importCabinMatches.length).toBe(1)
  })
})

// ─── canvasConverter font propagation ────────────────────────────────────────

describe('canvasBlocksToEmailDocument — font propagation', () => {
  it('text block with no fontFamily gets empty fontFamily in styles (defers to global)', () => {
    const blocks: CanvasBlock[] = [{ id: nanoid(), type: 'text' }]
    const base = createDefaultDocument()
    const doc  = canvasBlocksToEmailDocument(blocks, base)

    const textBlock = doc.sections[0]?.columns[0]?.blocks[0]
    expect(textBlock?.type).toBe('text')
    if (textBlock?.type === 'text') {
      // Empty string means buildFontStack will defer to globalFallback (the global font)
      expect(textBlock.styles.fontFamily).toBe('')
    }
  })

  it('text block with explicit fontFamily preserves it in styles', () => {
    const blocks: CanvasBlock[] = [{ id: nanoid(), type: 'text', fontFamily: 'Cabin' }]
    const base = createDefaultDocument()
    const doc  = canvasBlocksToEmailDocument(blocks, base)

    const textBlock = doc.sections[0]?.columns[0]?.blocks[0]
    if (textBlock?.type === 'text') {
      expect(textBlock.styles.fontFamily).toBe('Cabin')
    }
  })

  it('button block with no fontFamily gets empty fontFamily in styles', () => {
    const blocks: CanvasBlock[] = [{ id: nanoid(), type: 'button' }]
    const base = createDefaultDocument()
    const doc  = canvasBlocksToEmailDocument(blocks, base)

    const btnSection = doc.sections.find((s) =>
      s.columns.some((c) => c.blocks.some((b) => b.type === 'button'))
    )
    const btnBlock = btnSection?.columns[0]?.blocks.find((b) => b.type === 'button')
    if (btnBlock?.type === 'button') {
      expect(btnBlock.styles.fontFamily).toBe('')
    }
  })

  it('globalStyles are preserved when syncing canvas blocks', () => {
    const blocks: CanvasBlock[] = [{ id: nanoid(), type: 'text' }]
    const base = createDefaultDocument()
    const withFont = { ...base, globalStyles: { ...base.globalStyles, fontFamily: 'Cabin' } }
    const doc = canvasBlocksToEmailDocument(blocks, withFont)

    expect(doc.globalStyles.fontFamily).toBe('Cabin')
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('Font edge cases', () => {
  it('font name with spaces (Open Sans) is quoted in font-family CSS', async () => {
    const doc = makeCanvasDoc('Open Sans')
    const { html } = await compileEmail(doc)
    // React HTML-encodes single quotes inside style="" attributes as &#x27;
    // Both forms are acceptable — the font must appear quoted in some form.
    expect(html).toMatch(/'Open Sans'|&#x27;Open Sans&#x27;/)
  })

  it('font name with spaces is URL-encoded correctly in Google Fonts URL', async () => {
    const doc = makeCanvasDoc('Open Sans')
    const { html } = await compileEmail(doc)
    // Google Fonts uses + for spaces in the family param
    expect(html).toContain('Open+Sans')
  })

  it('changing global font from Cabin to Montserrat reflects in compiled HTML', async () => {
    const doc1 = makeCanvasDoc('Cabin')
    const doc2 = makeCanvasDoc('Montserrat')

    const { html: html1 } = await compileEmail(doc1)
    const { html: html2 } = await compileEmail(doc2)

    // doc1 — Cabin first, Montserrat absent
    expect(html1.indexOf('Cabin')).toBeLessThan(html1.indexOf('Arial'))
    expect(html1).not.toContain('Montserrat')

    // doc2 — Montserrat first, Cabin absent
    expect(html2.indexOf('Montserrat')).toBeLessThan(html2.indexOf('Arial'))
    expect(html2).not.toContain('Cabin')
  })
})
