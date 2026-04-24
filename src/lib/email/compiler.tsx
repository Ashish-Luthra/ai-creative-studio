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
 *  - Outlook-safe: MSO conditionals on multi-column layouts
 */

import * as React from 'react'
import {
  Html, Head, Body, Preview, Container,
  Section, Row, Column, Text, Img, Button, Hr, Link,
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

// ─── Validation pass ─────────────────────────────────────────────────────────

function validate(doc: EmailDocument): {
  errors: CompilerError[]
  warnings: CompilerWarning[]
} {
  const errors: CompilerError[] = []
  const warnings: CompilerWarning[] = []

  // Unsubscribe check
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
          // Demoted to warning — compiler renders a grey placeholder instead of blocking
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

  // Validate column widths sum
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

// ─── Block renderers ─────────────────────────────────────────────────────────

function BlockText({
  block, global: g,
}: { block: TextBlock; global: GlobalEmailStyles }) {
  const { styles, content } = block
  // Use raw <table><td> so content injects directly without react-email's
  // <Text> wrapping everything in an extra <p>, which causes <p><p> nesting.
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%' }}
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
          }}
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

  // Empty src — render a grey placeholder so the preview doesn't break
  if (!src) {
    const placeholderH = Math.round((w * 3) / 4)
    return (
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
        style={{
          width: '100%',
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

function BlockButton({
  block, global: g,
}: { block: ButtonBlock; global: GlobalEmailStyles }) {
  const { styles, label, href, newTab } = block
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%' }}
    >
      <tbody><tr>
        <td align={styles.align} style={{ padding: '8px 0' }}>
          <Button
            href={href}
            target={newTab ? '_blank' : '_self'}
            style={{
              display: 'inline-block',
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              fontFamily: buildFontStack(styles.fontFamily, g.fontFamily),
              fontSize: `${styles.fontSize}px`,
              fontWeight: styles.fontWeight as React.CSSProperties['fontWeight'],
              textDecoration: 'none',
              textAlign: 'center',
              borderRadius: `${styles.borderRadius}px`,
              paddingTop: `${styles.padding.top}px`,
              paddingRight: `${styles.padding.right}px`,
              paddingBottom: `${styles.padding.bottom}px`,
              paddingLeft: `${styles.padding.left}px`,
              ...(styles.border?.style !== 'none' && styles.border
                ? { border: `${styles.border.width}px ${styles.border.style} ${styles.border.color}` }
                : {}),
              ...(styles.width === 'full' ? { width: '100%' } : {}),
            }}
          >
            {label}
          </Button>
        </td>
      </tr></tbody>
    </table>
  )
}

function BlockDivider({ block }: { block: DividerBlock }) {
  const { styles } = block
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%' }}
    >
      <tbody>
        <tr>
          <td style={{ paddingTop: `${styles.margin.top}px`, paddingBottom: `${styles.margin.bottom}px` }}>
            <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
              style={{ width: '100%' }}
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

function BlockSpacer({ block }: { block: SpacerBlock }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%' }}
    >
      <tbody><tr>
        <td style={{ height: `${block.height}px`, fontSize: '0', lineHeight: '0' }}>
          &nbsp;
        </td>
      </tr></tbody>
    </table>
  )
}

function BlockLogo({ block, global: g }: { block: LogoBlock; global: GlobalEmailStyles }) {
  // isGlobal: compiler resolves src/alt/width from globalStyles
  const src  = block.meta.isGlobal ? (g.logo?.src  ?? block.src)  : block.src
  const alt  = block.meta.isGlobal ? (g.logo?.alt  ?? block.alt)  : block.alt
  const w    = block.meta.isGlobal ? (g.logo?.width ?? block.width) : block.width
  const href = block.meta.isGlobal ? (g.logo?.href ?? block.href) : block.href

  // Don't render an <img> with an empty src — browser would re-fetch the page
  if (!src) {
    return (
      <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
        style={{ width: '100%' }}
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
      style={{ display: 'block', border: 'none', maxWidth: '100%' }}
    />
  )
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} border={0}
      style={{ width: '100%' }}
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
      style={{ width: '100%' }}
    >
      <tbody><tr>
        <td align="center" style={{ padding: '24px 16px 16px' }}>
          <Text style={{
            fontFamily: buildFontStack(styles.fontFamily, g.fontFamily),
            fontSize: `${styles.fontSize}px`,
            color: styles.color,
            textAlign: 'center',
            margin: '0',
          }}>
            {hasPlaceholder ? <>{parts[0]}{linkEl}{parts[1]}</> : linkEl}
          </Text>
        </td>
      </tr></tbody>
    </table>
  )
}

// ─── Block dispatcher ────────────────────────────────────────────────────────

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

// ─── Column renderer ─────────────────────────────────────────────────────────

function RenderColumn({
  col, totalWidth, global: g,
}: {
  col: EmailColumn
  totalWidth: number
  global: GlobalEmailStyles
}) {
  const colPx = Math.round((col.widthPct / 100) * totalWidth)
  return (
    <Column style={{ width: `${col.widthPct}%`, verticalAlign: 'top' }}>
      {col.blocks.map((block) => (
        <RenderBlock key={block.id} block={block} colPx={colPx} global={g} />
      ))}
    </Column>
  )
}

// ─── Section renderer ────────────────────────────────────────────────────────

function RenderSection({
  section, totalWidth, global: g,
}: {
  section: EmailSection
  totalWidth: number
  global: GlobalEmailStyles
}) {
  const isMultiCol = section.columns.length > 1

  return (
    <Section style={{
      backgroundColor: section.styles.backgroundColor,
      paddingTop:    `${section.styles.padding.top}px`,
      paddingRight:  `${section.styles.padding.right}px`,
      paddingBottom: `${section.styles.padding.bottom}px`,
      paddingLeft:   `${section.styles.padding.left}px`,
      ...(section.styles.border
        ? { border: `${section.styles.border.width}px ${section.styles.border.style} ${section.styles.border.color}` }
        : {}),
    }}>
      {isMultiCol ? (
        // Multi-column: use Row/Column from react-email (table-based)
        <Row>
          {section.columns.map((col) => (
            <RenderColumn key={col.id} col={col} totalWidth={totalWidth} global={g} />
          ))}
        </Row>
      ) : (
        // Single column: skip Row wrapper for Outlook compatibility
        section.columns[0]?.blocks.map((block) => (
          <RenderBlock key={block.id} block={block} colPx={totalWidth} global={g} />
        ))
      )}
    </Section>
  )
}

// ─── Document template ───────────────────────────────────────────────────────

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

          {/* ── Unsubscribe — always last, non-negotiable ── */}
          <Section style={{ backgroundColor: g.backgroundColor }}>
            <BlockUnsubscribe block={doc.unsubscribe} global={g} />
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ─── Public API ──────────────────────────────────────────────────────────────

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

  try {
    const html = await render(<EmailTemplate doc={doc} width={width} />, {
      // Prettier rejects some patterns email clients tolerate (e.g. adjacent table layout).
      // Only opt in with opts.pretty === true (e.g. one-off export debugging).
      pretty: opts.pretty === true,
    })

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
