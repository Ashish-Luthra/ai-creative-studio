/**
 * canvasConverter.test.ts
 *
 * Structural tests for every prebuilt block converter.
 * Each test verifies the exact shape, layout split, colours, and font sizes
 * that the canvas preview shows — ensuring the compiled email output always
 * matches the editor.
 *
 * These tests were the missing safety net that allowed layout/colour/font-size
 * divergences to ship silently.  Every assertion here is driven by the same
 * SPECS constants that both the canvas renderer and the converter now read from,
 * so a single number change in blockSpecs.ts is immediately caught here if either
 * renderer is accidentally skipped.
 *
 * Pipeline: CanvasBlock[] → canvasBlocksToEmailDocument() → EmailDocument
 * (compile to HTML is tested separately in fontPipeline.test.ts and outlook.test.ts)
 */

import { describe, it, expect } from 'vitest'
import { nanoid } from 'nanoid'
import { canvasBlocksToEmailDocument } from '../email/canvasConverter'
import { createDefaultDocument } from '../email/templates'
import { SPECS } from '../email/blockSpecs'
import type { CanvasBlock } from '@studio/types/canvas'
import type { EmailSection, TextBlock, ButtonBlock } from '@studio/types/email'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function convert(type: string, extra: Partial<CanvasBlock> = {}): EmailSection[] {
  const blocks: CanvasBlock[] = [{ id: nanoid(), type, ...extra }]
  const doc = canvasBlocksToEmailDocument(blocks, createDefaultDocument())
  // Strip the always-appended unsubscribe section so assertions see only block output
  return doc.sections.filter((s) =>
    s.columns.some((c) => c.blocks.some((b) => b.type !== 'unsubscribe')),
  )
}

function firstTextContent(sections: EmailSection[]): string {
  for (const s of sections) {
    for (const c of s.columns) {
      for (const b of c.blocks) {
        if (b.type === 'text') return (b as TextBlock).content
      }
    }
  }
  return ''
}

function allTextBlocks(sections: EmailSection[]): TextBlock[] {
  const out: TextBlock[] = []
  for (const s of sections) for (const c of s.columns) for (const b of c.blocks)
    if (b.type === 'text') out.push(b as TextBlock)
  return out
}

function allButtonBlocks(sections: EmailSection[]): ButtonBlock[] {
  const out: ButtonBlock[] = []
  for (const s of sections) for (const c of s.columns) for (const b of c.blocks)
    if (b.type === 'button') out.push(b as ButtonBlock)
  return out
}

// ─── image-left-text-right ("gram block") ────────────────────────────────────

describe('image-left-text-right', () => {
  const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
  const sections = convert('image-left-text-right')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it('uses two-col layout', () => {
    expect(sections[0].layout).toBe('two-col')
  })

  it(`image column is ${S.imageColPct}% (spec.imageColPct)`, () => {
    expect(sections[0].columns[0].widthPct).toBe(S.imageColPct)
  })

  it(`text column is ${S.textColPct}% (spec.textColPct)`, () => {
    expect(sections[0].columns[1].widthPct).toBe(S.textColPct)
  })

  it(`heading uses spec headingFontSize (${S.headingFontSize}px)`, () => {
    const headingBlock = allTextBlocks(sections).find((b) =>
      b.content.includes('The Post That Got Everyone Talking'),
    )
    expect(headingBlock?.styles.fontSize).toBe(S.headingFontSize)
    expect(headingBlock?.content).toContain(`${S.headingFontSize}px`)
  })

  it(`tagline uses spec taglineColor (${S.taglineColor})`, () => {
    const taglineBlock = allTextBlocks(sections).find((b) =>
      b.content.includes('Gram'),
    )
    expect(taglineBlock?.content).toContain(S.taglineColor)
    expect(taglineBlock?.styles.color).toBe(S.taglineColor)
  })

  it(`divider uses spec dividerColor (${S.dividerColor})`, () => {
    const divBlock = allTextBlocks(sections).find((b) =>
      b.content.includes('background-color:') && b.content.includes(S.dividerColor),
    )
    expect(divBlock, 'divider block with spec dividerColor').toBeDefined()
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })

  it(`button align is "${S.buttonAlign}"`, () => {
    expect(allButtonBlocks(sections)[0]?.styles.align).toBe(S.buttonAlign)
  })
})

// ─── centered-content ────────────────────────────────────────────────────────

describe('centered-content', () => {
  const S = SPECS.CENTERED_CONTENT
  const sections = convert('centered-content')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it(`section background is spec.outerBg (${S.outerBg})`, () => {
    expect(sections[0].styles.backgroundColor).toBe(S.outerBg)
  })

  it(`section padding matches spec.outerPadding (${S.outerPadding.top}px)`, () => {
    expect(sections[0].styles.padding.top).toBe(S.outerPadding.top)
  })

  it(`card HTML uses spec.cardBg (${S.cardBg})`, () => {
    expect(firstTextContent(sections)).toContain(`background-color:${S.cardBg}`)
  })

  it(`card border-radius matches spec (${S.cardBorderRadius}px)`, () => {
    expect(firstTextContent(sections)).toContain(`border-radius:${S.cardBorderRadius}px`)
  })

  it(`card padding matches spec (${S.cardPadding}px)`, () => {
    expect(firstTextContent(sections)).toContain(`padding:${S.cardPadding}px`)
  })

  it(`number font-size matches spec (${S.numberFontSize}px)`, () => {
    expect(firstTextContent(sections)).toContain(`font-size:${S.numberFontSize}px`)
  })

  it(`number color matches spec (${S.numberColor})`, () => {
    expect(firstTextContent(sections)).toContain(`color:${S.numberColor}`)
  })

  it(`heading font-size matches spec (${S.headingFontSize}px)`, () => {
    expect(firstTextContent(sections)).toContain(`font-size:${S.headingFontSize}px`)
  })

  it(`body max-width matches spec (${S.bodyMaxWidthPx}px)`, () => {
    expect(firstTextContent(sections)).toContain(`max-width:${S.bodyMaxWidthPx}px`)
  })

  it(`label color matches spec (${S.labelColor})`, () => {
    expect(firstTextContent(sections)).toContain(`color:${S.labelColor}`)
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })
})

// ─── text-over-image ─────────────────────────────────────────────────────────

describe('text-over-image', () => {
  const S = SPECS.TEXT_OVER_IMAGE
  const sections = convert('text-over-image')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it(`section padding top matches spec (${S.sectionPadding.top}px)`, () => {
    expect(sections[0].styles.padding.top).toBe(S.sectionPadding.top)
  })

  it(`heading font-size matches spec (${S.headingFontSize}px)`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('Gift of Thanks'))
    expect(h?.styles.fontSize).toBe(S.headingFontSize)
    expect(h?.content).toContain(`${S.headingFontSize}px`)
  })

  it(`divider color matches spec (${S.dividerColor})`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('Gift of Thanks'))
    expect(h?.content).toContain(S.dividerColor)
  })

  it(`heading has letter-spacing from spec (${S.headingTracking})`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('Gift of Thanks'))
    expect(h?.content).toContain(S.headingTracking)
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })

  it(`button padding matches spec`, () => {
    const btn = allButtonBlocks(sections)[0]
    expect(btn?.styles.padding.top).toBe(S.buttonPadding.top)
    expect(btn?.styles.padding.right).toBe(S.buttonPadding.right)
  })
})

// ─── text-left-image-right ────────────────────────────────────────────────────

describe('text-left-image-right', () => {
  const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
  const sections = convert('text-left-image-right')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it(`text column is ${S.textColPct}% (spec.textColPct)`, () => {
    expect(sections[0].columns[0].widthPct).toBe(S.textColPct)
  })

  it(`image column is ${S.imageColPct}% (spec.imageColPct)`, () => {
    expect(sections[0].columns[1].widthPct).toBe(S.imageColPct)
  })

  it(`heading font-size matches spec (${S.headingFontSize}px)`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('COME'))
    expect(h?.styles.fontSize).toBe(S.headingFontSize)
    expect(h?.content).toContain(`${S.headingFontSize}px`)
  })

  it(`heading line-height matches spec (${S.headingLineHeight})`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('COME'))
    expect(h?.content).toContain(`line-height:${S.headingLineHeight}`)
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })

  it(`button align is "${S.buttonAlign}"`, () => {
    expect(allButtonBlocks(sections)[0]?.styles.align).toBe(S.buttonAlign)
  })
})

// ─── recipe-card ─────────────────────────────────────────────────────────────

describe('recipe-card', () => {
  const S = SPECS.RECIPE_CARD
  const sections = convert('recipe-card')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it('uses two-col layout', () => {
    expect(sections[0].layout).toBe('two-col')
  })

  it(`image column is ${S.imageColPct}%`, () => {
    expect(sections[0].columns[0].widthPct).toBe(S.imageColPct)
  })

  it(`text column is ${S.textColPct}%`, () => {
    expect(sections[0].columns[1].widthPct).toBe(S.textColPct)
  })

  it(`label color matches spec (${S.labelColor})`, () => {
    const lb = allTextBlocks(sections).find((b) => b.content.includes('>One<'))
    expect(lb?.content).toContain(S.labelColor)
    expect(lb?.styles.color).toBe(S.labelColor)
  })

  it(`heading font-size matches spec (${S.headingFontSize}px)`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('butternut squash'))
    expect(h?.styles.fontSize).toBe(S.headingFontSize)
    expect(h?.content).toContain(`${S.headingFontSize}px`)
  })

  it(`description color matches spec (${S.descColor})`, () => {
    const d = allTextBlocks(sections).find((b) => b.content.includes('warming recipe'))
    expect(d?.content).toContain(S.descColor)
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })

  it(`button align is "${S.buttonAlign}"`, () => {
    expect(allButtonBlocks(sections)[0]?.styles.align).toBe(S.buttonAlign)
  })
})

// ─── image-top-text-bottom ────────────────────────────────────────────────────

describe('image-top-text-bottom', () => {
  const S = SPECS.IMAGE_TOP_TEXT_BOTTOM
  const sections = convert('image-top-text-bottom')

  it('produces exactly TWO sections (split background)', () => {
    expect(sections).toHaveLength(2)
  })

  it(`image section background is spec.imageSectionBg (${S.imageSectionBg})`, () => {
    expect(sections[0].styles.backgroundColor).toBe(S.imageSectionBg)
  })

  it(`text section background is spec.textBg (${S.textBg})`, () => {
    expect(sections[1].styles.backgroundColor).toBe(S.textBg)
  })

  it(`text section padding matches spec (${S.textPadding.top}px)`, () => {
    expect(sections[1].styles.padding.top).toBe(S.textPadding.top)
  })

  it(`heading font-size matches spec (${S.headingFontSize}px)`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('25% off'))
    expect(h?.styles.fontSize).toBe(S.headingFontSize)
    expect(h?.content).toContain(`${S.headingFontSize}px`)
  })

  it(`heading bottom-margin matches spec (${S.headingBottomMargin}px)`, () => {
    const h = allTextBlocks(sections).find((b) => b.content.includes('25% off'))
    expect(h?.content).toContain(`${S.headingBottomMargin}px`)
  })

  it(`body color matches spec (${S.bodyColor})`, () => {
    const b = allTextBlocks(sections).find((b) => b.content.includes('24 hours'))
    expect(b?.content).toContain(S.bodyColor)
  })

  it(`button label is "${S.buttonLabel}"`, () => {
    expect(allButtonBlocks(sections)[0]?.label).toBe(S.buttonLabel)
  })

  it(`button padding matches spec`, () => {
    const btn = allButtonBlocks(sections)[0]
    expect(btn?.styles.padding.top).toBe(S.buttonPadding.top)
    expect(btn?.styles.padding.right).toBe(S.buttonPadding.right)
  })
})

// ─── testimonial ─────────────────────────────────────────────────────────────

describe('testimonial', () => {
  const S = SPECS.TESTIMONIAL
  const sections = convert('testimonial')

  it('produces exactly one section', () => {
    expect(sections).toHaveLength(1)
  })

  it('uses two-col layout', () => {
    expect(sections[0].layout).toBe('two-col')
  })

  it(`section background is spec.bgColor (${S.bgColor})`, () => {
    expect(sections[0].styles.backgroundColor).toBe(S.bgColor)
  })

  it(`avatar column is ${S.avatarColPct}% (spec.avatarColPct)`, () => {
    expect(sections[0].columns[0].widthPct).toBe(S.avatarColPct)
  })

  it(`text column is ${S.textColPct}% (spec.textColPct)`, () => {
    expect(sections[0].columns[1].widthPct).toBe(S.textColPct)
  })

  it(`avatar image width matches spec (${S.avatarWidth}px)`, () => {
    const imgBlock = sections[0].columns[0].blocks.find((b) => b.type === 'image')
    expect(imgBlock?.type === 'image' && (imgBlock as { styles: { width: number } }).styles.width).toBe(S.avatarWidth)
  })

  it(`avatar border-radius matches spec (${S.avatarBorderRadius})`, () => {
    const imgBlock = sections[0].columns[0].blocks.find((b) => b.type === 'image')
    expect(imgBlock?.type === 'image' && (imgBlock as { styles: { borderRadius: number } }).styles.borderRadius).toBe(S.avatarBorderRadius)
  })

  it(`name font-size matches spec (${S.nameFontSize}px)`, () => {
    const nameBlock = allTextBlocks(sections).find((b) => b.content.includes('TESTIMONIAL NAME'))
    expect(nameBlock?.styles.fontSize).toBe(S.nameFontSize)
    expect(nameBlock?.content).toContain(`${S.nameFontSize}px`)
  })

  it(`name letter-spacing matches spec (${S.nameTracking})`, () => {
    const nameBlock = allTextBlocks(sections).find((b) => b.content.includes('TESTIMONIAL NAME'))
    expect(nameBlock?.content).toContain(S.nameTracking)
  })

  it(`quote color matches spec (${S.quoteColor})`, () => {
    const quoteBlock = allTextBlocks(sections).find((b) => b.content.includes('email list'))
    expect(quoteBlock?.styles.color).toBe(S.quoteColor)
    expect(quoteBlock?.content).toContain(S.quoteColor)
  })

  it(`quote line-height matches spec (${S.quoteLineHeight})`, () => {
    const quoteBlock = allTextBlocks(sections).find((b) => b.content.includes('email list'))
    expect(quoteBlock?.styles.lineHeight).toBe(S.quoteLineHeight)
  })

  it(`star font-size matches spec (${S.starFontSize}px)`, () => {
    const starBlock = allTextBlocks(sections).find((b) => b.content.includes('9733'))
    expect(starBlock?.styles.fontSize).toBe(S.starFontSize)
    expect(starBlock?.content).toContain(`${S.starFontSize}px`)
  })

  it(`star color matches spec (${S.starColor})`, () => {
    const starBlock = allTextBlocks(sections).find((b) => b.content.includes('9733'))
    expect(starBlock?.styles.color).toBe(S.starColor)
    expect(starBlock?.content).toContain(S.starColor)
  })
})
