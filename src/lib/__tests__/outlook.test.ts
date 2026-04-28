import { describe, it, expect } from 'vitest'
import { compileEmail } from '/Users/ashishluthra/ai-creative-studio/src/lib/email/compiler'
import { createDefaultDocument } from '/Users/ashishluthra/ai-creative-studio/src/lib/email/templates'
import { nanoid } from 'nanoid'
import type { EmailDocument, EmailSection } from '/Users/ashishluthra/ai-creative-studio/src/types/email'

function makeDoc(): EmailDocument {
  const doc = createDefaultDocument()
  // Add a button section and a two-column section to exercise all paths
  const btn: EmailSection = {
    id: nanoid(), layout: 'full',
    columns: [{ id: nanoid(), widthPct: 100, blocks: [{
      id: nanoid(), type: 'button', label: 'Click Me', href: 'https://example.com',
      styles: { backgroundColor: '#1B51B3', color: '#fff', fontFamily: 'Arial', fontSize: 14,
        fontWeight: '600', padding: { top: 12, right: 24, bottom: 12, left: 24 },
        borderRadius: 6, align: 'center', width: 'auto' }
    }]}],
    styles: { backgroundColor: '#fff', padding: { top: 20, right: 20, bottom: 20, left: 20 } }
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
    styles: { backgroundColor: '#fff', padding: { top: 0, right: 0, bottom: 0, left: 0 } }
  }
  const spacer: EmailSection = {
    id: nanoid(), layout: 'full',
    columns: [{ id: nanoid(), widthPct: 100, blocks: [{ id: nanoid(), type: 'spacer', height: 32 }] }],
    styles: { backgroundColor: '#fff', padding: { top: 0, right: 0, bottom: 0, left: 0 } }
  }
  doc.sections = [btn, twoCol, spacer]
  return doc
}

describe('Outlook compatibility', () => {
  it('FIX #1: VML roundrect button is present', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toContain('v:roundrect')
    expect(r.html).toContain('w:anchorlock')
    expect(r.html).toContain('[if mso]')
    expect(r.html).toContain('[if !mso]')
  })

  it('FIX #2: Column has pixel width HTML attribute', async () => {
    const r = await compileEmail(makeDoc())
    // two-col at 600px wide → each column 300px
    expect(r.html).toMatch(/width="300"/)
  })

  it('FIX #3: Section padding is on <td> not <table>', async () => {
    // A section with non-zero padding should wrap in a <td> with paddingTop/etc
    const doc = makeDoc()
    const r = await compileEmail(doc)
    // Should have padding-top:20px on a td (not on a table)
    expect(r.html).toMatch(/<td[^>]*padding-top:20px[^>]*>/)
  })

  it('FIX #4: MSO head block is injected', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toContain('OfficeDocumentSettings')
    expect(r.html).toContain('o:AllowPNG')
    expect(r.html).toContain('o:PixelsPerInch')
    expect(r.html).toContain('mso-table-lspace:0pt')
  })

  it('FIX #5: Container has pixel width attribute (not 100%)', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toMatch(/width="600"/)
    // Ensure width="100%" is NOT present on the max-width container
    const containerLine = r.html.match(/<table[^>]*max-width:600px[^>]*>/)?.[0] ?? ''
    expect(containerLine).not.toContain('width="100%"')
  })

  it('FIX #5: VML namespaces on <html> tag', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toContain('xmlns:v="urn:schemas-microsoft-com:vml"')
    expect(r.html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"')
  })

  it('FIX #6: mso-table-lspace on custom tables', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toContain('mso-table-lspace:0pt')
    expect(r.html).toContain('mso-table-rspace:0pt')
  })

  it('FIX #7: mso-line-height-rule:exactly on text cells', async () => {
    const r = await compileEmail(makeDoc())
    expect(r.html).toContain('mso-line-height-rule:exactly')
  })

  it('FIX #8: Spacer <td> has height HTML attribute', async () => {
    const r = await compileEmail(makeDoc())
    // height="32" as HTML attribute on the spacer td
    expect(r.html).toMatch(/<td[^>]*height="32"[^>]*>/)
  })
})
