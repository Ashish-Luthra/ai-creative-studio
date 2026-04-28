/**
 * outlook.test.ts
 * Validates all Outlook desktop + mobile/responsive fixes in the compiler.
 * Each test is named after the specific breakage it guards against.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { compileEmail } from '../email/compiler'
import { createDefaultDocument } from '../email/templates'
import { nanoid } from 'nanoid'
import type { EmailDocument, EmailSection } from '@/types/email'

// ─── Shared fixture ───────────────────────────────────────────────────────────

function makeDoc(): EmailDocument {
  const doc = createDefaultDocument()

  const btn: EmailSection = {
    id: nanoid(), layout: 'full',
    columns: [{ id: nanoid(), widthPct: 100, blocks: [{
      id: nanoid(), type: 'button', label: 'Click Me', href: 'https://example.com',
      styles: {
        backgroundColor: '#1B51B3', color: '#fff', fontFamily: 'Arial', fontSize: 14,
        fontWeight: '600', padding: { top: 12, right: 24, bottom: 12, left: 24 },
        borderRadius: 6, align: 'center', width: 'auto',
      },
    }]}],
    styles: { backgroundColor: '#fff', padding: { top: 20, right: 20, bottom: 20, left: 20 } },
  }

  const twoCol: EmailSection = {
    id: nanoid(), layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: 50, blocks: [{ id: nanoid(), type: 'text', content: '<p>Left</p>',
        styles: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', lineHeight: 1.5,
          color: '#111', textAlign: 'left', padding: { top: 0, right: 0, bottom: 0, left: 0 } } }] },
      { id: nanoid(), widthPct: 50, blocks: [{ id: nanoid(), type: 'text', content: '<p>Right</p>',
        styles: { fontFamily: 'Arial', fontSize: 14, fontWeight: 'normal', lineHeight: 1.5,
          color: '#111', textAlign: 'left', padding: { top: 0, right: 0, bottom: 0, left: 0 } } }] },
    ],
    styles: { backgroundColor: '#fff', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  }

  const imgSection: EmailSection = {
    id: nanoid(), layout: 'full',
    columns: [{ id: nanoid(), widthPct: 100, blocks: [{
      id: nanoid(), type: 'image',
      src: 'https://example.com/img.jpg', alt: 'Test',
      styles: { width: 'full', align: 'center', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    }]}],
    styles: { backgroundColor: '#fff', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  }

  const spacerSection: EmailSection = {
    id: nanoid(), layout: 'full',
    columns: [{ id: nanoid(), widthPct: 100, blocks: [{ id: nanoid(), type: 'spacer', height: 32 }] }],
    styles: { backgroundColor: '#fff', padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  }

  doc.sections = [btn, twoCol, imgSection, spacerSection]
  return doc
}

// Compile once and reuse across all assertions for speed
let html = ''
beforeAll(async () => {
  const r = await compileEmail(makeDoc())
  html = r.html
})

// ─── Outlook Desktop (Windows) fixes ─────────────────────────────────────────

describe('Outlook Desktop compatibility', () => {
  it('FIX #1 — VML roundrect button: background + border-radius survive Outlook', () => {
    expect(html).toContain('v:roundrect')
    expect(html).toContain('w:anchorlock')
    expect(html).toContain('[if mso]')
    // Non-Outlook <a> tag is hidden from Outlook via !mso conditional
    expect(html).toContain('[if !mso]')
  })

  it('FIX #1 — Button: non-Outlook <a> has btn-full class for mobile stacking', () => {
    expect(html).toMatch(/class="btn-full"/)
  })

  it('FIX #2 — Column: pixel width HTML attribute so Outlook respects multi-col', () => {
    // two-col at 600px default width → 300px per column
    expect(html).toMatch(/width="300"/)
    // CSS percentage is also present (used by non-Outlook clients)
    expect(html).toContain('width:50%')
  })

  it('FIX #3 — Section padding on <td> not <table> (Outlook 2007–2013 safe)', () => {
    // padding-top on a <td>, not inside a table's style
    expect(html).toMatch(/<td[^>]*padding-top:20px[^>]*>/)
  })

  it('FIX #4 — MSO head block: Office namespace + table reset injected', () => {
    expect(html).toContain('OfficeDocumentSettings')
    expect(html).toContain('o:AllowPNG')
    expect(html).toContain('o:PixelsPerInch')
    expect(html).toContain('mso-table-lspace:0pt')
  })

  it('FIX #5 — Container: pixel width attribute stops email expanding to full width', () => {
    expect(html).toMatch(/width="600"/)
    // Must NOT still have width="100%" on the max-width container
    const containerTag = html.match(/<table[^>]*max-width:600px[^>]*>/)?.[0] ?? ''
    expect(containerTag).not.toContain('width="100%"')
  })

  it('FIX #5 — Container: email-container class stamped for responsive @media targeting', () => {
    expect(html).toMatch(/class="email-container"/)
  })

  it('FIX #5 — VML namespaces on <html> tag so v:roundrect is valid', () => {
    expect(html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"')
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
  })

  it('FIX #6 — mso-table-lspace/rspace:0pt removes phantom 2px inter-cell gaps', () => {
    expect(html).toContain('mso-table-lspace:0pt')
    expect(html).toContain('mso-table-rspace:0pt')
  })

  it('FIX #7 — mso-line-height-rule:exactly prevents inflated line heights', () => {
    expect(html).toContain('mso-line-height-rule:exactly')
  })

  it('FIX #8 — Spacer <td> has HTML height attribute so it does not collapse', () => {
    expect(html).toMatch(/<td[^>]*height="32"[^>]*>/)
  })
})

// ─── Mobile / Responsive fixes ────────────────────────────────────────────────

describe('Mobile / responsive compatibility', () => {
  it('MOBILE #1 — Responsive <style> block is present (hidden from Outlook Windows)', () => {
    // Style block must be inside <!--[if !mso]> conditional so Outlook Windows ignores it
    expect(html).toContain('[if !mso]')
    expect(html).toContain('@media only screen and (max-width:620px)')
  })

  it('MOBILE #2 — .col-full class triggers multi-column stacking on small screens', () => {
    // Class is on the <Column> td
    expect(html).toMatch(/class="col-full"/)
    // @media rule provides the stacking behavior
    expect(html).toContain('.col-full')
    expect(html).toContain('display:block!important')
  })

  it('MOBILE #3 — .img-full class makes images 100% wide on mobile', () => {
    expect(html).toMatch(/class="img-full"/)
    expect(html).toContain('.img-full')
    expect(html).toContain('width:100%!important')
  })

  it('MOBILE #4 — .btn-full class stretches buttons for touch targets on mobile', () => {
    expect(html).toMatch(/class="btn-full"/)
    expect(html).toContain('.btn-full')
    // Must be inside !mso so Outlook Windows uses its VML button instead
    const responsiveBlock = html.match(/<!--\[if !mso\]><!-->([\s\S]*?)<!--<!\[endif\]-->/)?.[1] ?? ''
    expect(responsiveBlock).toContain('btn-full')
  })

  it('MOBILE #5 — .section-padding class reduces horizontal padding on narrow screens', () => {
    expect(html).toMatch(/class="section-padding"/)
    expect(html).toContain('.section-padding')
    expect(html).toContain('padding-left:16px!important')
    expect(html).toContain('padding-right:16px!important')
  })

  it('MOBILE #6 — email-container class enables full-width container on mobile', () => {
    expect(html).toContain('.email-container')
    // The @media rule should make it full-width on mobile
    expect(html).toMatch(/\.email-container\s*\{[^}]*width:100%!important/)
  })

  it('MOBILE #7 — no flexbox or CSS grid anywhere in output', () => {
    expect(html).not.toMatch(/display\s*:\s*flex/i)
    expect(html).not.toMatch(/display\s*:\s*grid/i)
  })

  it('MOBILE #8 — no <script> tags in output', () => {
    expect(html.toLowerCase()).not.toContain('<script')
  })
})

// ─── Google Fonts injection ───────────────────────────────────────────────────

describe('Google Fonts injection', () => {
  it('FONT #1 — no @import injected when only system fonts are used (avoids dead request)', async () => {
    // Default doc uses Arial throughout — no Google Fonts
    const r = await compileEmail(makeDoc())
    // Should NOT contain a fonts.googleapis.com @import
    expect(r.html).not.toContain('fonts.googleapis.com')
  })

  it('FONT #2 — both <link> and @import injected for a recognised Google Font', async () => {
    const doc = makeDoc()
    // Set a Google Font on the global style
    doc.globalStyles.fontFamily = 'Poppins'
    const r = await compileEmail(doc)
    expect(r.html).toContain('fonts.googleapis.com')
    expect(r.html).toContain('Poppins')
    // <link> tag for browser / iframe preview compatibility
    expect(r.html).toMatch(/<link[^>]*rel="stylesheet"[^>]*fonts\.googleapis\.com/)
    // @import for email clients that strip <link> (Apple Mail, Gmail web, etc.)
    expect(r.html).toContain('@import url(')
  })

  it('FONT #3 — @import includes multiple fonts when document uses several families', async () => {
    const doc = makeDoc()
    doc.globalStyles.fontFamily = 'Montserrat'
    // Add a text block with a different Google Font
    const section = doc.sections[0]
    section.columns[0].blocks.push({
      id: 'test-text', type: 'text', content: '<p>Hello</p>',
      styles: {
        fontFamily: 'Lora', fontSize: 16, fontWeight: 'normal', lineHeight: 1.5,
        color: '#111', textAlign: 'left', padding: { top: 0, right: 0, bottom: 0, left: 0 },
      },
    })
    const r = await compileEmail(doc)
    expect(r.html).toContain('Montserrat')
    expect(r.html).toContain('Lora')
  })

  it('FONT #3b — Barlow (top-30 font) gets both <link> and @import tags', async () => {
    const doc = makeDoc()
    doc.globalStyles.fontFamily = 'Barlow'
    const r = await compileEmail(doc)
    expect(r.html).toContain('Barlow')
    expect(r.html).toMatch(/<link[^>]*Barlow/)
    expect(r.html).toContain('@import url(')
  })

  it('FONT #4 — font link block appears before MSO conditional comment', async () => {
    const doc = makeDoc()
    doc.globalStyles.fontFamily = 'Roboto'
    const r = await compileEmail(doc)
    const linkPos   = r.html.indexOf('fonts.googleapis.com')
    const msoPos    = r.html.indexOf('[if mso]')
    expect(linkPos).toBeGreaterThan(-1)
    expect(linkPos).toBeLessThan(msoPos)
  })

  it('FONT #5 — top 30 fonts export contains exactly 31 entries and all are strings', async () => {
    const { TOP_30_FONTS } = await import('@/lib/canvas/googleFonts')
    expect(TOP_30_FONTS.length).toBe(31)
    TOP_30_FONTS.forEach((f) => expect(typeof f).toBe('string'))
  })

  it('FONT #6 — all top 30 fonts are present in the full GOOGLE_FONT_FAMILIES list', async () => {
    const { TOP_30_FONTS, GOOGLE_FONT_FAMILIES } = await import('@/lib/canvas/googleFonts')
    const set = new Set(GOOGLE_FONT_FAMILIES)
    TOP_30_FONTS.forEach((f) => {
      expect(set.has(f), `"${f}" missing from GOOGLE_FONT_FAMILIES`).toBe(true)
    })
  })
})
