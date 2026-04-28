/**
 * compiler.tsx — JSON EmailDocument → email-safe HTML
 *
 * Enforced constraints (non-negotiable per spec):
 *  - No flexbox, grid, or JS in output — table-based layout only
 *  - All CSS is inlined
 *  - Unsubscribe block always appended last
 *  - Max 2 ButtonBlocks per section → CompilerError MAX_CTA_EXCEEDED
 *  - Logo with meta.isGlobal resolved from globalStyles.logo
 *  - Text never baked into images
 *
 * Outlook fixes applied (all 8 known breakage points):
 *  1. VML Bulletproof Button — <v:roundrect> so background+radius survive Outlook
 *  2. Column HTML width="Xpx" — Outlook's Word renderer ignores CSS width on <td>
 *  3. Section padding on <td> not <table> — Outlook 2007–2013 ignores table padding
 *  4. MSO head block injected via post-processing — Office namespace + table reset
 *  5. Container width="600" attribute — fixes email expanding to full width in Outlook
 *  6. mso-table-lspace/rspace:0pt — removes phantom 2px inter-cell gaps
 *  7. mso-line-height-rule:exactly — prevents Outlook adding extra line height
 *  8. Spacer <td height="X"> — spacers collapse without explicit HTML height attr
 */

import * as React from 'react'
import {
  Html, Head, Body, Preview, Container,
  Section, Row, Column, Text, Img, Hr, Link,
} from '@react-email/components'
import { render } from '@react-email/render'
import type {
  EmailDocument, EmailSection, EmailColumn, EmailBlock,
  TextBlock, ImageBlock, ButtonBlock, DividerBlock, SpacerBlock,
  LogoBlock, UnsubscribeBlock,
  CompileResult, CompilerOptions, CompilerError, CompilerWarning,
  GlobalEmailStyles,
} from '@/types/email'
import { buildFontStack, layoutToColumnWidths } from './styleUtils'
import { getEmailFontImportUrl } from '@/lib/canvas/googleFonts'

// ─── Font collection ──────────────────────────────────────────────────────────

/**
 * Walks an EmailDocument and returns every unique font family referenced —
 * globalStyles + per-block TextStyles + ButtonStyles.
 * The compiler uses this to build a targeted Google Fonts @import URL so only
 * the fonts that are actually used get loaded in the email.
 */
function collectUsedFonts(doc: EmailDocument): string[] {
  const families = new Set<string>()

  // Global body font
  if (doc.globalStyles.fontFamily) {
    families.add(doc.globalStyles.fontFamily)
  }

  for (const section of doc.sections) {
    for (const column of section.columns) {
      for (const block of column.blocks) {
        if (block.type === 'text' || block.type === 'unsubscribe') {
          const b = block as TextBlock | UnsubscribeBlock
          if ('styles' in b && b.styles && 'fontFamily' in b.styles) {
            families.add((b.styles as { fontFamily: string }).fontFamily)
          }
        }
        if (block.type === 'button') {
          const b = block as ButtonBlock
          if (b.styles?.fontFamily) families.add(b.styles.fontFamily)
        }
      }
    }
  }

  return [...families].filter(Boolean)
}

// ─── Validation pass ─────────────────────────────────────────────────────────

function validate(doc: EmailDocument): {
  errors: CompilerError[]
  warnings: CompilerWarning[]
} {
  const errors: CompilerError[] = []
  const warnings: CompilerWarning[] = []

  if (!doc.unsubscribe || !doc.unsubscribe.href) {
    errors.push({
      code: 'MISSING_UNSUBSCRIBE',
      message: 'EmailDocument.unsubscribe is missing or has no href.',
    })
  }

  doc.sections.forEach((section) => {
    let ctaCount = 0
    let hasAnyBlock = false

    section.columns.forEach((col) => {
      col.blocks.forEach((block) => {
        hasAnyBlock = true

        if (block.type === 'button') {
          ctaCount++
          if (!(block as ButtonBlock).href) {
            errors.push({
              code: 'EMPTY_BUTTON_HREF',
              message: `Button block "${block.id}" has an empty href.`,
              sectionId: section.id,
              blockId: block.id,
            })
          }
        }

        if (block.type === 'image' && !(block as ImageBlock).src) {
          warnings.push({
            code: 'INVALID_IMAGE_SRC',
            message: `Image block "${block.id}" has no src — showing placeholder.`,
            sectionId: section.id,
            blockId: block.id,
          })
        }

        if (
          (block.type === 'image' && !(block as ImageBlock).alt) ||
          (block.type === 'logo'  && !(block as LogoBlock).alt)
        ) {
          warnings.push({
            code: 'MISSING_ALT_TEXT',
            message: `Block "${block.id}" has no alt text.`,
            sectionId: section.id,
            blockId: block.id,
          })
        }
      })
    })

    if (ctaCount > 2) {
      errors.push({
        code: 'MAX_CTA_EXCEEDED',
        message: `Section "${section.id}" has ${ctaCount} CTAs. Maximum is 2.`,
        sectionId: section.id,
      })
    }

    if (!hasAnyBlock) {
      warnings.push({
        code: 'EMPTY_SECTION',
        message: `Section "${section.id}" has no blocks in any column.`,
        sectionId: section.id,
      })
    }
  })

  doc.sections.forEach((section) => {
    const sum = section.columns.reduce((acc, c) => acc + c.widthPct, 0)
    if (Math.abs(sum - 100) > 1) {
      errors.push({
        code: 'INVALID_COLUMN_WIDTHS',
        message: `Section "${section.id}" column widths sum to ${sum}, expected 100.`,
        sectionId: section.id,
      })
    }
  })

  if (!doc.preheader) {
    warnings.push({ code: 'MISSING_PREHEADER', message: 'EmailDocument.preheader is empty.' })
  }

  return { errors, warnings }
}

// ─── Shared table style helper ────────────────────────────────────────────────
// FIX #6 — added to every custom <table> to remove Outlook's default 2px gap.

const TABLE_RESET: React.CSSProperties = {
  msoTableLspace: '0pt',
  msoTableRspace: '0pt',
} as React.CSSProperties

// ─── Block renderers ──────────────────────────────────────────────────────────

function BlockText({
  block, global: g,
}: { block: TextBlock; global: GlobalEmailStyles }) {
  const { styles, content } = block
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody><tr>
        <td
          style={{
            fontFamily: buildFontStack(styles.fontFamily, g.fontFamily),
            fontSize: `${styles.fontSize}px`,
            fontWeight: styles.fontWeight as React.CSSProperties['fontWeight'],
            lineHeight: String(styles.lineHeight),
            color: styles.color,
            textAlign: styles.textAlign,
            paddingTop: `${styles.padding.top}px`,
            paddingRight: `${styles.padding.right}px`,
            paddingBottom: `${styles.padding.bottom}px`,
            paddingLeft: `${styles.padding.left}px`,
            // FIX #7 — prevents Outlook from adding extra line-height
            msoLineHeightRule: 'exactly',
          } as React.CSSProperties}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </tr></tbody>
    </table>
  )
}

function BlockImage({
  block, colPx,
}: { block: ImageBlock; colPx: number }) {
  const { styles, src, alt, href } = block
  const w = styles.width === 'full' ? colPx : Math.min(styles.width, colPx)

  if (!src) {
    const placeholderH = Math.round((w * 3) / 4)
    return (
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
        style={{
          width: '100%',
          ...TABLE_RESET,
          paddingTop: `${styles.padding.top}px`,
          paddingRight: `${styles.padding.right}px`,
          paddingBottom: `${styles.padding.bottom}px`,
          paddingLeft: `${styles.padding.left}px`,
        }}
      >
        <tbody><tr>
          <td align="center" style={{
            backgroundColor: '#F0F0F0',
            width: `${w}px`,
            height: `${placeholderH}px`,
            fontFamily: 'Arial, sans-serif',
            fontSize: '11px',
            letterSpacing: '0.08em',
            color: '#BBBBBB',
            textAlign: 'center',
            verticalAlign: 'middle',
          }}>
            IMAGE
          </td>
        </tr></tbody>
      </table>
    )
  }

  const imgEl = (
    <Img
      src={src}
      alt={alt}
      width={w}
      // MOBILE — img-full makes images 100% wide on small screens via @media query
      className="img-full"
      style={{
        display: 'block',
        border: 'none',
        outline: 'none',
        textDecoration: 'none',
        maxWidth: '100%',
        ...(styles.borderRadius ? { borderRadius: `${styles.borderRadius}px` } : {}),
        ...(styles.border?.style !== 'none' && styles.border
          ? { border: `${styles.border.width}px ${styles.border.style} ${styles.border.color}` }
          : {}),
      }}
    />
  )

  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{
        width: '100%',
        ...TABLE_RESET,
        paddingTop: `${styles.padding.top}px`,
        paddingRight: `${styles.padding.right}px`,
        paddingBottom: `${styles.padding.bottom}px`,
        paddingLeft: `${styles.padding.left}px`,
      }}
    >
      <tbody><tr>
        <td align={styles.align}>
          {href ? <Link href={href}>{imgEl}</Link> : imgEl}
        </td>
      </tr></tbody>
    </table>
  )
}

// FIX #1 — VML Bulletproof Button
// react-email's <Button> renders only an <a> tag. In Outlook 2007–2019 (Word
// rendering engine) <a> tags cannot have background-color or border-radius.
// The industry-standard fix is a <v:roundrect> VML element surrounded by
// <!--[if mso]> conditionals, with the regular <a> hidden from Outlook via
// <!--[if !mso]><!-->.
function BlockButton({
  block, global: g,
}: { block: ButtonBlock; global: GlobalEmailStyles }) {
  const { styles, label, href, newTab } = block

  // Compute button pixel height for VML (padding + line height)
  const btnH = styles.padding.top + styles.padding.bottom + Math.round(styles.fontSize * 1.5)
  // VML arcsize is expressed as a percentage of half the button height
  const arcPct = styles.borderRadius > 0
    ? Math.min(50, Math.round((styles.borderRadius / Math.max(1, btnH / 2)) * 100))
    : 0
  const fontStack = buildFontStack(styles.fontFamily, g.fontFamily)
  const target = newTab ? '_blank' : '_self'

  // Inline style string for the non-Outlook <a> tag (hidden from Outlook via !mso)
  const paddingStyle = `${styles.padding.top}px ${styles.padding.right}px ${styles.padding.bottom}px ${styles.padding.left}px`
  const borderStyle = styles.border?.style !== 'none' && styles.border
    ? `border:${styles.border.width}px ${styles.border.style} ${styles.border.color};`
    : ''
  const widthStyle = styles.width === 'full' ? 'width:100%;' : ''

  const aInlineStyle = [
    'display:inline-block',
    `background-color:${styles.backgroundColor}`,
    `color:${styles.color}`,
    `font-family:${fontStack}`,
    `font-size:${styles.fontSize}px`,
    `font-weight:${styles.fontWeight}`,
    'text-decoration:none',
    'text-align:center',
    `-webkit-text-size-adjust:none`,
    `border-radius:${styles.borderRadius}px`,
    `padding:${paddingStyle}`,
    borderStyle,
    widthStyle,
  ].filter(Boolean).join(';')

  // The complete button HTML: VML for Outlook, <a> for everything else
  const buttonHtml = [
    // Outlook-only VML button
    `<!--[if mso]>`,
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"`,
    ` href="${href}" style="height:${btnH}px;v-text-anchor:middle;width:200px;"`,
    ` arcsize="${arcPct}%" strokecolor="${styles.backgroundColor}" fillcolor="${styles.backgroundColor}">`,
    `<w:anchorlock/>`,
    `<center style="color:${styles.color};font-family:Arial,sans-serif;font-size:${styles.fontSize}px;font-weight:${styles.fontWeight}">`,
    `${label}`,
    `</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
    // Non-Outlook (hidden from Outlook via !mso conditional)
    // MOBILE — btn-full class allows @media query to stretch button on small screens
    `<!--[if !mso]><!--><a href="${href}" target="${target}" class="btn-full" style="${aInlineStyle}">${label}</a><!--<![endif]-->`,
  ].join('')

  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody><tr>
        <td align={styles.align} style={{ padding: '8px 0' }}>
          {/* Inner table centres the button without affecting its intrinsic size */}
          <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
            style={{ ...TABLE_RESET }}
          >
            <tbody><tr>
              {/* dangerouslySetInnerHTML is required here — MSO conditionals must
                  be raw HTML strings; JSX would escape the comment delimiters. */}
              <td dangerouslySetInnerHTML={{ __html: buttonHtml }} />
            </tr></tbody>
          </table>
        </td>
      </tr></tbody>
    </table>
  )
}

function BlockDivider({ block }: { block: DividerBlock }) {
  const { styles } = block
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody>
        <tr>
          <td style={{ paddingTop: `${styles.margin.top}px`, paddingBottom: `${styles.margin.bottom}px` }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
              style={{ width: '100%', ...TABLE_RESET }}
            >
              <tbody><tr>
                <td style={{
                  borderTop: `${styles.height}px ${styles.style} ${styles.color}`,
                  fontSize: '0', lineHeight: '0', height: '0',
                }} />
              </tr></tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

// FIX #8 — Spacer: add explicit HTML height attribute so Outlook doesn't collapse it
function BlockSpacer({ block }: { block: SpacerBlock }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody><tr>
        {/* height attr (not just CSS) required for Outlook 2016+ */}
        <td
          height={block.height}
          style={{ height: `${block.height}px`, fontSize: '0', lineHeight: '0' }}
        >
          &nbsp;
        </td>
      </tr></tbody>
    </table>
  )
}

function BlockLogo({ block, global: g }: { block: LogoBlock; global: GlobalEmailStyles }) {
  const src  = block.meta.isGlobal ? (g.logo?.src  ?? block.src)  : block.src
  const alt  = block.meta.isGlobal ? (g.logo?.alt  ?? block.alt)  : block.alt
  const w    = block.meta.isGlobal ? (g.logo?.width ?? block.width) : block.width
  const href = block.meta.isGlobal ? (g.logo?.href ?? block.href) : block.href

  if (!src) {
    return (
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
        style={{ width: '100%', ...TABLE_RESET }}
      >
        <tbody><tr>
          <td align="center" style={{ padding: '16px 0', fontSize: '11px', color: '#9CA3AF', fontFamily: 'Arial, sans-serif' }}>
            [ Logo — add URL in Styles ]
          </td>
        </tr></tbody>
      </table>
    )
  }

  const imgEl = (
    <Img src={src} alt={alt} width={w}
      // MOBILE — img-full makes the logo scale down on narrow screens
      className="img-full"
      style={{ display: 'block', border: 'none', maxWidth: '100%' }}
    />
  )
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody><tr>
        <td align="center" style={{ padding: '16px 0' }}>
          {href ? <Link href={href}>{imgEl}</Link> : imgEl}
        </td>
      </tr></tbody>
    </table>
  )
}

function BlockUnsubscribe({
  block, global: g,
}: { block: UnsubscribeBlock; global: GlobalEmailStyles }) {
  const { styles, text, href } = block
  const parts = text.split('[[unsubscribe]]')
  const hasPlaceholder = parts.length === 2
  const linkEl = (
    <Link href={href} style={{ color: g.linkColor, textDecoration: 'underline' }}>
      {hasPlaceholder ? 'Unsubscribe' : text}
    </Link>
  )
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%', ...TABLE_RESET }}
    >
      <tbody><tr>
        <td align="center" style={{ padding: '24px 16px 16px' }}>
          <Text style={{
            fontFamily: buildFontStack(styles.fontFamily, g.fontFamily),
            fontSize: `${styles.fontSize}px`,
            color: styles.color,
            textAlign: 'center',
            margin: '0',
            // FIX #7
            msoLineHeightRule: 'exactly',
          } as React.CSSProperties}>
            {hasPlaceholder ? <>{parts[0]}{linkEl}{parts[1]}</> : linkEl}
          </Text>
        </td>
      </tr></tbody>
    </table>
  )
}

// ─── Block dispatcher ─────────────────────────────────────────────────────────

function RenderBlock({
  block, colPx, global: g,
}: {
  block: EmailBlock
  colPx: number
  global: GlobalEmailStyles
}) {
  switch (block.type) {
    case 'text':        return <BlockText        block={block} global={g} />
    case 'image':       return <BlockImage       block={block} colPx={colPx} />
    case 'button':      return <BlockButton      block={block} global={g} />
    case 'divider':     return <BlockDivider     block={block} />
    case 'spacer':      return <BlockSpacer      block={block} />
    case 'logo':        return <BlockLogo        block={block} global={g} />
    case 'unsubscribe': return <BlockUnsubscribe block={block} global={g} />
  }
}

// ─── Column renderer ──────────────────────────────────────────────────────────

function RenderColumn({
  col, totalWidth, global: g,
}: {
  col: EmailColumn
  totalWidth: number
  global: GlobalEmailStyles
}) {
  const colPx = Math.round((col.widthPct / 100) * totalWidth)
  return (
    // FIX #2 — width={colPx} adds a pixel HTML width attribute.
    // Outlook's Word engine ignores CSS width on <td> but respects the width attr.
    // MOBILE — col-full class triggers the column stacking @media rule on small screens.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Column width={colPx as any} className="col-full" style={{ width: `${col.widthPct}%`, verticalAlign: 'top' }}>
      {col.blocks.map((block) => (
        <RenderBlock key={block.id} block={block} colPx={colPx} global={g} />
      ))}
    </Column>
  )
}

// ─── Section renderer ─────────────────────────────────────────────────────────

function RenderSection({
  section, totalWidth, global: g,
}: {
  section: EmailSection
  totalWidth: number
  global: GlobalEmailStyles
}) {
  const isMultiCol = section.columns.length > 1

  // FIX #3 — padding must live on a <td>, not on the <Section> (<table>).
  // Outlook 2007–2013 ignores padding set on <table> tags.
  // We keep only background-color on Section and delegate spacing to an inner <td>.
  const { padding } = section.styles
  const hasPadding = padding.top || padding.right || padding.bottom || padding.left

  const innerContent = isMultiCol ? (
    <Row>
      {section.columns.map((col) => (
        <RenderColumn key={col.id} col={col} totalWidth={totalWidth} global={g} />
      ))}
    </Row>
  ) : (
    section.columns[0]?.blocks.map((block) => (
      <RenderBlock key={block.id} block={block} colPx={totalWidth} global={g} />
    ))
  )

  return (
    <Section style={{
      backgroundColor: section.styles.backgroundColor,
      // Border (if any) stays on the Section
      ...(section.styles.border
        ? { border: `${section.styles.border.width}px ${section.styles.border.style} ${section.styles.border.color}` }
        : {}),
    }}>
      {hasPadding ? (
        // Wrap in a table so padding is on a <td> — reliable in all Outlook versions
        <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
          style={{ width: '100%', ...TABLE_RESET }}
        >
          <tbody><tr>
            {/* MOBILE — section-padding reduces horizontal gutters on narrow screens */}
            <td className="section-padding" style={{
              paddingTop: `${padding.top}px`,
              paddingRight: `${padding.right}px`,
              paddingBottom: `${padding.bottom}px`,
              paddingLeft: `${padding.left}px`,
            }}>
              {innerContent}
            </td>
          </tr></tbody>
        </table>
      ) : (
        innerContent
      )}
    </Section>
  )
}

// ─── Document template ────────────────────────────────────────────────────────

function EmailTemplate({ doc, width }: { doc: EmailDocument; width: number }) {
  const g = doc.globalStyles

  return (
    <Html>
      <Head />
      <Preview>{doc.preheader}</Preview>
      <Body style={{
        margin: '0',
        padding: '0',
        backgroundColor: g.backgroundColor,
        fontFamily: buildFontStack(g.fontFamily, 'Arial'),
        WebkitTextSizeAdjust: '100%',
      }}>
        <Container style={{
          maxWidth: `${width}px`,
          width: '100%',
          margin: '0 auto',
        }}>
          {doc.sections.map((section) => (
            <RenderSection
              key={section.id}
              section={section}
              totalWidth={width}
              global={g}
            />
          ))}

          {/* Unsubscribe — always last, non-negotiable */}
          <Section style={{ backgroundColor: g.backgroundColor }}>
            <BlockUnsubscribe block={doc.unsubscribe} global={g} />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Post-processing: Outlook + mobile fixes that can't be done in JSX ────────
//
// Some fixes require raw HTML string manipulation because:
//  - MSO conditional comments can't be expressed in JSX
//  - Responsive <style> block must be hidden from Outlook Windows via !mso conditional
//  - react-email's Container renders width="100%" which Outlook ignores
//  - class="email-container" must be stamped on the Container table element

// RESPONSIVE CSS
// Wrapped in <!--[if !mso]> so Outlook Windows (desktop) NEVER sees it and
// keeps its fixed pixel layout. Outlook iOS/Android, Gmail, Apple Mail, Yahoo
// Mail all process @media queries and will stack columns on small screens.
const RESPONSIVE_STYLE = `
<!--[if !mso]><!-->
<style type="text/css">
/* ─── Mobile: max-width 620px ─────────────────────────────────────────────── */
@media only screen and (max-width:620px){

  /* 1. Container goes full-width — stops email zooming out to fit 600px */
  .email-container{
    width:100%!important;
    max-width:100%!important;
  }

  /* 2. Multi-column stacks vertically.
        display:block + width:100% overrides the HTML width="Xpx" attribute
        that Outlook Desktop needs — on mobile it's overridden by !important. */
  .col-full{
    width:100%!important;
    display:block!important;
    -webkit-box-sizing:border-box!important;
    box-sizing:border-box!important;
  }

  /* 3. Images fill column width, height auto to preserve aspect ratio.
        Also overrides the HTML width="Xpx" attribute. */
  .img-full{
    width:100%!important;
    max-width:100%!important;
    height:auto!important;
  }

  /* 4. Buttons stretch full-width for easier tapping (≥44px touch target) */
  .btn-full{
    display:block!important;
    width:100%!important;
    -webkit-box-sizing:border-box!important;
    box-sizing:border-box!important;
    text-align:center!important;
  }

  /* 5. Reduce horizontal section padding on narrow screens */
  .section-padding{
    padding-left:16px!important;
    padding-right:16px!important;
  }
}
</style>
<!--<![endif]-->
`.trim()

function applyOutlookFixes(html: string, contentWidth: number, fontImportUrl: string): string {
  // ── FIX #4 — MSO head block ─────────────────────────────────────────────────
  // Office document settings + VML namespace + table reset for Outlook Windows.
  const msoHeadBlock = [
    `<!--[if mso]><xml>`,
    `<o:OfficeDocumentSettings>`,
    `<o:AllowPNG/>`,
    `<o:PixelsPerInch>96</o:PixelsPerInch>`,
    `</o:OfficeDocumentSettings>`,
    `</xml><![endif]-->`,
    `<!--[if (gte mso 9)|(IE)]><style type="text/css">`,
    `table{border-collapse:collapse!important;mso-table-lspace:0pt!important;mso-table-rspace:0pt!important;}`,
    `td{mso-line-height-rule:exactly;}`,
    `a{color:inherit;}`,
    `</style><![endif]-->`,
  ].join('')

  // ── Google Fonts injection ──────────────────────────────────────────────────
  // Two tags for maximum compatibility:
  //
  //  1. <link rel="stylesheet"> — used by browsers (iframe preview, Chrome, Safari,
  //     Firefox, Outlook iOS/Android, Samsung Mail). Loads reliably in any normal
  //     browser context including srcDoc iframes.
  //
  //  2. <style>@import url();</style> — used by email clients that support web
  //     fonts but strip <link> tags (Apple Mail, Gmail web, Yahoo Mail).
  //
  // Outlook Windows ignores both and falls back to the CSS font-family stack.
  // The blocks are placed OUTSIDE any MSO conditional so all other clients see them.
  const fontBlock = fontImportUrl
    ? [
        `<link rel="stylesheet" href="${fontImportUrl}">`,
        `<style type="text/css">@import url('${fontImportUrl}');</style>`,
      ].join('')
    : ''

  // Inject font block + MSO block + responsive styles before </head>
  html = html.replace('</head>', `${fontBlock}${msoHeadBlock}${RESPONSIVE_STYLE}</head>`)

  // ── FIX #5 — VML namespaces on <html> ──────────────────────────────────────
  html = html.replace(
    /<html([^>]*)>/,
    '<html$1 xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">',
  )

  // ── FIX #5 — Container: width="100%" → width="${contentWidth}" ─────────────
  // react-email renders Container as <table width="100%" style="max-width:Xpx;...">
  // Outlook's Word engine ignores CSS max-width so the email fills the window.
  // The HTML width attribute is respected by Outlook; other clients use CSS.
  // We also stamp class="email-container" so the responsive @media can target it.
  const patchContainer = (match: string) =>
    match
      .replace('width="100%"', `width="${contentWidth}"`)
      .replace('<table ', '<table class="email-container" ')

  html = html.replace(
    /(<table\b[^>]*\bwidth="100%"[^>]*style="[^"]*max-width:\d+px[^"]*"[^>]*>)/g,
    patchContainer,
  )
  // Handle reversed attribute order (style before width)
  html = html.replace(
    /(<table\b[^>]*style="[^"]*max-width:\d+px[^"]*"[^>]*\bwidth="100%"[^>]*>)/g,
    patchContainer,
  )

  return html
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compiles an EmailDocument to inbox-safe HTML.
 *
 * Returns a CompileResult with the HTML string, any errors, and any warnings.
 * If errors are present the html field will be an empty string — callers must
 * check errors before using the output.
 */
export async function compileEmail(
  doc: EmailDocument,
  opts: CompilerOptions = {},
): Promise<CompileResult> {
  const { errors, warnings } = validate(doc)

  if (errors.length > 0) {
    return { html: '', errors, warnings }
  }

  const width = opts.width ?? doc.globalStyles.contentWidth ?? 600

  // Collect font families used in this document and build a targeted @import URL.
  // Only Google Fonts are imported; system fonts (Arial, Helvetica, etc.) are skipped.
  const usedFonts = collectUsedFonts(doc)
  const fontImportUrl = getEmailFontImportUrl(usedFonts)

  try {
    const rawHtml = await render(<EmailTemplate doc={doc} width={width} />, {
      pretty: opts.pretty === true,
    })

    const html = applyOutlookFixes(rawHtml, width, fontImportUrl)

    return { html, errors: [], warnings }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      html: '',
      errors: [
        {
          code: 'RENDER_FAILED',
          message: `Email render failed: ${message}`,
        },
      ],
      warnings,
    }
  }
}
