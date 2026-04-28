/**
 * canvasConverter.ts
 *
 * Converts a CanvasBlock[] (the visual canvas editor model) into a valid
 * EmailDocument that can be compiled to email-safe HTML.
 *
 * Design notes:
 *  - Each CanvasBlock maps to one or more EmailSections (some prebuilt blocks
 *    need two sections to replicate their split background treatment).
 *  - Font/colour/spacing settings from the canvas block are forwarded faithfully
 *    so the compiled HTML matches what the user designed in the canvas.
 *  - Tailwind class equivalents used in this file:
 *      text-sm  = 14px    text-xl   = 20px    text-2xl  = 24px
 *      text-3xl = 30px    text-4xl  = 36px    text-5xl  = 48px
 *      p-8  = 32px    p-12 = 48px
 *      bg-gray-50  = #F9FAFB    bg-gray-100 = #F3F4F6
 *      text-gray-400 = #9CA3AF   text-gray-500 = #6B7280
 *      text-gray-600 = #4B5563   text-gray-700 = #374151
 */

import { nanoid } from 'nanoid'
import type { CanvasBlock } from '@/types/canvas'
import type {
  EmailDocument, EmailSection, EmailBlock,
  TextStyles, ButtonStyles, ImageStyles, SectionStyles,
} from '@/types/email'
import {
  makeTextBlock, makeImageBlock, makeButtonBlock, makeSpacerBlock,
  makeLogoBlock, makeSection, makeUnsubscribeBlock,
  DEFAULT_GLOBAL_STYLES,
} from './templates'

// ─── Style helpers ─────────────────────────────────────────────────────────────

/**
 * Section-level styles. `defaultBg` lets prebuilt blocks specify their
 * canvas-hardcoded background colour (e.g. bg-gray-50) as a default, while
 * still respecting any explicit background the user set in the right nav.
 */
function sectionStyles(
  cb: CanvasBlock,
  overridePadding?: SectionStyles['padding'],
  defaultBg = '#FFFFFF',
): SectionStyles {
  return {
    backgroundColor: cb.backgroundColor ?? defaultBg,
    padding: overridePadding ?? { top: 16, right: 24, bottom: 16, left: 24 },
  }
}

function textStyles(cb: CanvasBlock, overrides: Partial<TextStyles> = {}): TextStyles {
  return {
    // Use the block's explicit font if set; otherwise empty string so
    // buildFontStack() defers to the document's global font family instead
    // of hard-coding Arial and accidentally overriding the global choice.
    fontFamily: cb.fontFamily ?? '',
    fontSize: cb.fontSize ?? 16,
    fontWeight: cb.fontBold ? 'bold' : 'normal',
    lineHeight: cb.lineHeight ?? 1.6,
    color: cb.fontColor ?? '#111827',
    textAlign: cb.textAlign ?? 'left',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides,
  }
}

function buttonStyles(cb: CanvasBlock, overrides: Partial<ButtonStyles> = {}): ButtonStyles {
  return {
    backgroundColor: cb.buttonFillColor ?? '#111827',
    color: '#FFFFFF',
    fontFamily: cb.fontFamily ?? '',
    fontSize: cb.fontSize ?? 14,
    fontWeight: '600',
    padding: { top: 12, right: 24, bottom: 12, left: 24 },
    borderRadius: typeof cb.buttonShapeVariant === 'number' ? cb.buttonShapeVariant : 6,
    border: cb.buttonBorderColor
      ? { width: cb.buttonBorderWidth ?? 1, style: 'solid', color: cb.buttonBorderColor }
      : undefined,
    align: cb.buttonPosition ?? 'center',
    width: 'auto',
    ...overrides,
  }
}

function imageStyles(overrides: Partial<ImageStyles> = {}): ImageStyles {
  return {
    width: 'full',
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    ...overrides,
  }
}

function firstImageSrc(cb: CanvasBlock, fallback = ''): string {
  if (!cb.imageSrcs) return fallback
  const keys = Object.keys(cb.imageSrcs)
  return keys.length ? (cb.imageSrcs[keys[0]] ?? fallback) : fallback
}

/**
 * Build a narrow centred decorative line matching the canvas `h-px w-16 bg-{color}`.
 * Returns an HTML string safe for use inside a dangerouslySetInnerHTML text block.
 */
function narrowLine(color = '#9CA3AF'): string {
  return `<p style="margin:8px 0;text-align:center">` +
    `<span style="display:inline-block;width:64px;height:1px;` +
    `background-color:${color};line-height:1px;font-size:1px">&nbsp;</span></p>`
}

// ─── Per-block-type converters ────────────────────────────────────────────────

function convertLogo(cb: CanvasBlock): EmailSection {
  const src = firstImageSrc(cb) || (cb.imageSrcs?.['logo'] ?? '')
  const logo = makeLogoBlock({ src, alt: 'Logo', isGlobal: !src })
  return makeSection('full', [[logo]], {
    styles: sectionStyles(cb, { top: 16, right: 24, bottom: 16, left: 24 }),
  })
}

function convertLinkBar(cb: CanvasBlock): EmailSection {
  const DEFAULT_LINKS = [
    { label: 'Home',     url: '#' },
    { label: 'About',    url: '#' },
    { label: 'Products', url: '#' },
    { label: 'Blog',     url: '#' },
    { label: 'Contact',  url: '#' },
  ]
  const links = cb.linkBarItems && cb.linkBarItems.length > 0 ? cb.linkBarItems : DEFAULT_LINKS
  const linkHtml = links
    .map((l) => `<a href="${l.url || '#'}" style="color:#2563EB;text-decoration:none;margin:0 8px">${l.label}</a>`)
    .join('<span style="color:#D1D5DB"> | </span>')
  const block = makeTextBlock({
    content: `<p style="margin:0;text-align:center">${linkHtml}</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 13 }),
  })
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 8, right: 24, bottom: 8, left: 24 }),
  })
}

function convertText(cb: CanvasBlock): EmailSection {
  const block = makeTextBlock({ styles: textStyles(cb) })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertButton(cb: CanvasBlock): EmailSection {
  const block = makeButtonBlock('Click Here', cb.linkUrl ?? '#')
  block.styles = buttonStyles(cb)
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertSpacer(cb: CanvasBlock): EmailSection {
  // Canvas defaults spacer height to 64 px; match that here.
  const block = makeSpacerBlock(cb.spacerHeight ?? 64)
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  })
}

function convertSocial(cb: CanvasBlock): EmailSection {
  const SOCIAL_ICONS: { name: string; svg: string }[] = [
    {
      name: 'Facebook',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1877F2"/><path d="M21 16h-3v9h-4v-9h-2v-3h2v-2c0-2.2 1.3-4 4-4h3v3h-2c-.6 0-1 .4-1 1v2h3l-.5 3z" fill="#fff"/></svg>`,
    },
    {
      name: 'Instagram',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#ffd600"/><stop offset="50%" stop-color="#ff0069"/><stop offset="100%" stop-color="#7638fa"/></radialGradient></defs><circle cx="16" cy="16" r="16" fill="url(#ig)"/><rect x="9" y="9" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="16" cy="16" r="3.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="20.5" cy="11.5" r="1" fill="#fff"/></svg>`,
    },
    {
      name: 'Pinterest',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#E60023"/><path d="M16 6C10.5 6 6 10.5 6 16c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.1-2 .2-2.9l1.3-5.5s-.3-.7-.3-1.7c0-1.6.9-2.8 2.3-2.8 1.1 0 1.6.8 1.6 1.8 0 1.1-.7 2.7-1.1 4.2-.3 1.2.6 2.2 1.8 2.2 2.2 0 3.7-2.8 3.7-6.2 0-2.6-1.8-4.5-4.4-4.5-3 0-4.8 2.3-4.8 4.6 0 .9.4 1.9.8 2.4.1.1.1.2.1.3l-.3 1.3c-.1.3-.3.4-.6.3-1.7-.8-2.7-3.2-2.7-5.2 0-4.2 3-8 8.7-8 4.6 0 8.1 3.3 8.1 7.6 0 4.6-2.9 8.2-6.8 8.2-1.4 0-2.6-.7-3-1.5l-.8 3c-.3 1.1-1 2.5-1.5 3.3.8.3 1.6.4 2.5.4 5.5 0 10-4.5 10-10S21.5 6 16 6z" fill="#fff"/></svg>`,
    },
    {
      name: 'X',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M18.2 14.8L23.5 9h-1.3l-4.5 5.2L14 9H9.5l5.6 8.1-5.6 6.4H11l4.8-5.5L19.7 23H24l-5.8-8.2zm-1.7 2l-.6-.8-4.6-6.6h2l3.7 5.3.6.8 4.8 6.8h-2l-3.9-5.5z" fill="#fff"/></svg>`,
    },
  ]

  const iconCells = SOCIAL_ICONS.map(({ name, svg }) => {
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    return `<td align="center" style="padding:0 6px">` +
      `<a href="#" style="text-decoration:none;display:inline-block" title="${name}">` +
      `<img src="${dataUri}" width="32" height="32" alt="${name}" style="display:block;border:none;width:32px;height:32px">` +
      `</a></td>`
  }).join('')

  const block = makeTextBlock({
    content: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tbody><tr>${iconCells}</tr></tbody></table>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 0 }),
  })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertAddress(cb: CanvasBlock): EmailSection {
  const block = makeTextBlock({
    content: `<p style="margin:0;text-align:center;color:#6B7280">123 Main Street, Suite 100 · City, State 12345 · United States</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
  })
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 8, right: 24, bottom: 8, left: 24 }),
  })
}

function convertFooter(cb: CanvasBlock): EmailSection {
  // Canvas: bg-gray-50 px-12 py-6 → #F9FAFB background, 48px horiz padding, 24px vert
  const DEFAULT_FOOTER_LINKS = [
    { label: 'Privacy Policy', url: '#' },
    { label: 'Unsubscribe',    url: '#' },
    { label: 'View in Browser', url: '#' },
    { label: 'Contact Us',     url: '#' },
  ]
  const fLinks = cb.footerLinks && cb.footerLinks.length > 0 ? cb.footerLinks : DEFAULT_FOOTER_LINKS
  const linkHtml = fLinks
    .map((l) => `<a href="${l.url || '#'}" style="color:#6B7280;text-decoration:none">${l.label}</a>`)
    .join('<span style="color:#D1D5DB"> · </span>')
  const block = makeTextBlock({
    content: `<p style="margin:0 0 12px 0;text-align:center">${linkHtml}</p>` +
      `<p style="margin:0;text-align:center;color:#9CA3AF;font-size:10px">` +
      `© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
  })
  return makeSection('full', [[block]], {
    // bg-gray-50 = #F9FAFB  ·  px-12 py-6 → 24px vert, 48px horiz
    styles: sectionStyles(cb, { top: 24, right: 48, bottom: 24, left: 48 }, '#F9FAFB'),
  })
}

function convertContent(cb: CanvasBlock): EmailSection {
  const layout = cb.contentLayout ?? 'image'
  const imgSrc = firstImageSrc(cb, '')
  const btnLabel = cb.contentButton?.label ?? 'Shop Now'

  if (layout === 'image') {
    const img = makeImageBlock(imgSrc, 'Content image')
    img.styles = imageStyles()
    const blocks: EmailBlock[] = [img]
    if (cb.contentButton) blocks.push(makeButtonBlock(btnLabel, '#'))
    return makeSection('full', [blocks], { styles: sectionStyles(cb) })
  }

  if (layout === 'image-text') {
    const heading = makeTextBlock({
      content: '<p style="margin:0;font-size:22px;font-weight:700">Content Heading</p>',
      styles: textStyles(cb, { fontSize: 22, fontWeight: 'bold' }),
    })
    const body = makeTextBlock({
      content: '<p style="margin:0">Click to edit this text. Tell your story alongside the image.</p>',
      styles: textStyles(cb),
    })
    const imgBlock = makeImageBlock(imgSrc, 'Content image')
    imgBlock.styles = imageStyles()
    const contentBlocks: EmailBlock[] = [heading, body]
    if (cb.contentButton) contentBlocks.push(makeButtonBlock(btnLabel, '#'))
    return makeSection('image-left', [[imgBlock], contentBlocks], { styles: sectionStyles(cb) })
  }

  if (layout === '2col-text') {
    const col1 = [
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column One Heading</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Add your text here. Click to edit this column and tell your story.</p>', styles: textStyles(cb) }),
    ]
    const col2 = [
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column Two Heading</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Add your text here. Click to edit this column and share more details.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('two-col', [col1, col2], { styles: sectionStyles(cb) })
  }

  if (layout === '3col-text') {
    const col = (label: string) => [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">Column ${label}</p>`, styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Click to edit this column.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('three-col', [col('One'), col('Two'), col('Three')], { styles: sectionStyles(cb) })
  }

  return makeSection('full', [[makeTextBlock()]], { styles: sectionStyles(cb) })
}

// ── Prebuilt layout blocks ────────────────────────────────────────────────────

function convertImageLeftTextRight(cb: CanvasBlock): EmailSection {
  // Canvas: flex 50/50, image left (self-stretch), text right (p-12, items-center gap-4)
  // Text: tagline (14px italic gray-500), heading (30px bold), narrow line, button
  const imgSrc = cb.imageSrcs?.['main'] ?? ''
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()

  const tagline = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:#6B7280;text-align:center">From The &apos;Gram</p>`,
    styles: textStyles(cb, { fontSize: 14, color: '#6B7280', textAlign: 'center' }),
  })
  const heading = makeTextBlock({
    // text-3xl = 30px
    content: `<p style="margin:0;font-size:30px;font-weight:700;text-align:center">The Post That Got Everyone Talking</p>`,
    styles: textStyles(cb, { fontSize: 30, fontWeight: 'bold', textAlign: 'center' }),
  })
  // Narrow 64px centred decorative line (matches canvas h-px w-16 bg-gray-400)
  const dividerBlock = makeTextBlock({
    content: narrowLine('#9CA3AF'),
    styles: textStyles(cb, { textAlign: 'center', fontSize: 1 }),
  })
  const btn = makeButtonBlock('SEE IT', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })

  // two-col = 50/50, matching canvas w-1/2 on each side
  // No outer section padding so the image bleeds edge-to-edge; text has inner padding via block styles
  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: 50, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: 50,
        blocks: [makeSpacerBlock(24), tagline, heading, dividerBlock, btn, makeSpacerBlock(24)],
      },
    ],
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  }
}

function convertCenteredContent(cb: CanvasBlock): EmailSection {
  // Canvas: outer bg-gray-100 p-12, inner white rounded card p-8
  //         "6" (text-5xl=48px, text-gray-600), heading (text-2xl=24px),
  //         body (text-sm=14px, text-gray-600, max-w-xs), "001" label + "READ IT" button

  // We embed the card as a nested HTML table inside a text block so the white-on-gray
  // effect works across email clients without requiring CSS box-shadows.
  // Do NOT set font-family on the inner <p> tags — the <td> wrapper's font-family
  // (set by buildFontStack via textStyles) cascades in, which correctly reflects
  // the global body font the user chose.
  const bodyColor = cb.fontColor ?? '#4B5563'

  const cardHtml =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" ` +
    `style="background-color:#ffffff;border-radius:8px;margin:0 auto;width:100%">` +
    `<tr><td style="padding:32px;text-align:center">` +
    `<p style="margin:0;font-size:48px;font-weight:700;color:#4B5563;line-height:1">6</p>` +
    `<p style="margin:8px 0 0;font-size:24px;font-weight:700">Tips to Photograph Food</p>` +
    `<p style="margin:12px auto 0;font-size:14px;color:${bodyColor};max-width:280px;line-height:1.6">` +
    `I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.</p>` +
    `<p style="margin:16px 0 0;font-size:14px;color:#9CA3AF">001</p>` +
    `</td></tr></table>`

  const cardBlock = makeTextBlock({
    content: cardHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 14 }),
  })
  const btn = makeButtonBlock('READ IT', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })

  return makeSection('full', [[cardBlock, btn]], {
    // bg-gray-100 = #F3F4F6 · p-12 = 48px padding
    styles: sectionStyles(cb, { top: 48, right: 48, bottom: 48, left: 48 }, '#F3F4F6'),
  })
}

function convertTextOverImage(cb: CanvasBlock): EmailSection {
  // Canvas: bg-white p-12 text-center
  //         narrow black line · heading (text-2xl=24px, bold, uppercase, tracking-widest)
  //         narrow black line · button (mt-6) · image

  const headingHtml =
    narrowLine('#000000') +
    `<p style="margin:0;font-size:24px;font-weight:700;letter-spacing:0.1em;` +
    `text-align:center;text-transform:uppercase">` +
    `A Little Gift of Thanks for Joining the List.</p>` +
    narrowLine('#000000')

  const heading = makeTextBlock({
    content: headingHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 24, fontWeight: 'bold' }),
  })
  const imgSrc = firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const btn = makeButtonBlock('CLAIM GIFT', '#')
  btn.styles = buttonStyles(cb, { align: 'center', padding: { top: 10, right: 32, bottom: 10, left: 32 } })

  return makeSection('full', [[heading, btn, makeSpacerBlock(16), imgBlock]], {
    // bg-white · p-12 but only on the text area; image gets no side padding
    styles: sectionStyles(cb, { top: 48, right: 48, bottom: 0, left: 48 }),
  })
}

function convertTextLeftImageRight(cb: CanvasBlock): EmailSection {
  // Canvas: flex, text w-1/3 (p-12, items-center gap-6), image w-2/3
  //         heading: text-4xl=36px, font-bold, "WEL—COME"
  //         button: "EXPLORE"
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:36px;font-weight:700;line-height:1.25">WEL&mdash;COME</p>`,
    styles: textStyles(cb, { fontSize: 36, fontWeight: 'bold', lineHeight: 1.25 }),
  })
  const btn = makeButtonBlock('EXPLORE', '#')
  btn.styles = buttonStyles(cb, { align: 'left' })

  // Canvas uses imageSrcs['bg'] for the right image
  const imgSrc = cb.imageSrcs?.['bg'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Welcome image')
  imgBlock.styles = imageStyles()

  // 33/67 split matching canvas w-1/3 / w-2/3 — constructed manually
  return {
    id: nanoid(),
    layout: 'image-right',
    columns: [
      {
        id: nanoid(), widthPct: 33,
        blocks: [makeSpacerBlock(24), heading, makeSpacerBlock(16), btn, makeSpacerBlock(24)],
      },
      { id: nanoid(), widthPct: 67, blocks: [imgBlock] },
    ],
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  }
}

function convertRecipeCard(cb: CanvasBlock): EmailSection {
  // Canvas: flex 50/50, gap-8, p-8 bg-white
  //         Left: image (w-1/2, imgClip)
  //         Right: "One" (14px italic gray-500), heading (20px), description (14px italic gray-500), button
  const imgSrc = cb.imageSrcs?.['main'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Recipe image')
  imgBlock.styles = imageStyles()

  const label = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:#6B7280">One</p>`,
    styles: textStyles(cb, { fontSize: 14, color: '#6B7280' }),
  })
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:20px;font-weight:700">Click here for my creamy butternut squash soup</p>`,
    styles: textStyles(cb, { fontSize: 20, fontWeight: 'bold' }),
  })
  const description = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:#6B7280">A warming recipe perfect for fall evenings.</p>`,
    styles: textStyles(cb, { fontSize: 14, color: '#6B7280' }),
  })
  const btn = makeButtonBlock('GET RECIPE', '#')
  btn.styles = buttonStyles(cb, { align: 'left' })

  // two-col = 50/50 matching canvas w-1/2 on each side · p-8 = 32px padding
  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: 50, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: 50,
        blocks: [makeSpacerBlock(16), label, heading, description, btn, makeSpacerBlock(16)],
      },
    ],
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  }
}

function convertImageTopTextBottom(cb: CanvasBlock): EmailSection[] {
  // Canvas: image full-width (bg-white), then bg-gray-100 p-12 text-center below:
  //         heading (text-2xl=24px, font-serif), italic body text (gray-500), button (mt-6)
  // Two separate sections so each gets its own background colour.

  const imgSrc = cb.imageSrcs?.['main'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()

  const imageSection = makeSection('full', [[imgBlock]], {
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  })

  const heading = makeTextBlock({
    content: `<p style="margin:0 0 12px;font-size:24px;font-weight:700;text-align:center">Get 25% off when you book my services</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 24, fontWeight: 'bold' }),
  })
  const body = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:#6B7280;text-align:center">for the next 24 hours only.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 14, color: '#6B7280' }),
  })
  const btn = makeButtonBlock('BOOK NOW', '#')
  btn.styles = buttonStyles(cb, { align: 'center', padding: { top: 10, right: 32, bottom: 10, left: 32 } })

  const textSection = makeSection('full', [[heading, body, makeSpacerBlock(8), btn]], {
    // bg-gray-100 = #F3F4F6 · p-12 = 48px
    styles: { backgroundColor: cb.backgroundColor ?? '#F3F4F6', padding: { top: 48, right: 48, bottom: 48, left: 48 } },
  })

  return [imageSection, textSection]
}

function convertTestimonial(cb: CanvasBlock): EmailSection {
  // Canvas: flex min-h-[200px] gap-8 bg-gray-50 p-12
  //         Left: avatar image w-32 (128px fixed), circular, shrink-0
  //         Right: flex-1 — name (14px bold tracking-widest uppercase),
  //                quote (14px leading-relaxed gray-600), stars (20px yellow)
  //
  // The canvas left column is FIXED at 128px.  Using `image-left` (40/60) gave a
  // 240px avatar column — nearly double the image width and visually distorted.
  // We manually construct a 25 / 75 split so the avatar column (~150px) fits the
  // 128px image without wasted space, matching the canvas proportions.

  const avatarSrc = cb.imageSrcs?.['avatar'] ?? ''
  const avatarBlock = makeImageBlock(avatarSrc, 'Testimonial avatar')
  avatarBlock.styles = {
    width: 128,       // canvas: w-32 = 128px
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 64, // circular (supported in Apple Mail, iOS, Gmail web)
  }

  const name = makeTextBlock({
    content: `<p style="margin:0;font-weight:700;font-size:14px;letter-spacing:0.1em;text-transform:uppercase">TESTIMONIAL NAME</p>`,
    styles: textStyles(cb, { fontSize: 14, fontWeight: 'bold' }),
  })
  const quote = makeTextBlock({
    content: `<p style="margin:0;font-size:14px;color:#4B5563;line-height:1.6">Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.</p>`,
    styles: textStyles(cb, { fontSize: 14, color: '#4B5563', lineHeight: 1.6 }),
  })
  // Star rating: ★★★★☆ in yellow (text-yellow-400 = #FBBF24)
  const stars = makeTextBlock({
    content: `<p style="margin:8px 0 0;font-size:20px;color:#FBBF24">&#9733;&#9733;&#9733;&#9733;&#9734;</p>`,
    styles: textStyles(cb, { fontSize: 20, color: '#FBBF24' }),
  })

  // 25 / 75 manual split — matches the canvas's fixed-128px-left / flex-1-right layout.
  // bg-gray-50 = #F9FAFB · p-12 = 48px outer padding
  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      {
        id: nanoid(), widthPct: 25,
        blocks: [makeSpacerBlock(8), avatarBlock, makeSpacerBlock(8)],
      },
      {
        id: nanoid(), widthPct: 75,
        blocks: [makeSpacerBlock(8), name, makeSpacerBlock(8), quote, stars, makeSpacerBlock(8)],
      },
    ],
    styles: sectionStyles(cb, { top: 32, right: 48, bottom: 32, left: 48 }, '#F9FAFB'),
  }
}

// ─── Main converter ───────────────────────────────────────────────────────────

/**
 * Converts one CanvasBlock to one or more EmailSections.
 * Most blocks produce one section; image-top-text-bottom produces two (split bg).
 */
function canvasBlockToSections(cb: CanvasBlock): EmailSection[] {
  switch (cb.type) {
    case 'logo':                  return [convertLogo(cb)]
    case 'link-bar':              return [convertLinkBar(cb)]
    case 'text':                  return [convertText(cb)]
    case 'button':                return [convertButton(cb)]
    case 'spacer':                return [convertSpacer(cb)]
    case 'social':                return [convertSocial(cb)]
    case 'address':               return [convertAddress(cb)]
    case 'footer':                return [convertFooter(cb)]
    case 'content':               return [convertContent(cb)]
    case 'image-left-text-right': return [convertImageLeftTextRight(cb)]
    case 'centered-content':      return [convertCenteredContent(cb)]
    case 'text-over-image':       return [convertTextOverImage(cb)]
    case 'text-left-image-right': return [convertTextLeftImageRight(cb)]
    case 'recipe-card':           return [convertRecipeCard(cb)]
    case 'image-top-text-bottom': return convertImageTopTextBottom(cb)   // returns 2
    case 'testimonial':           return [convertTestimonial(cb)]
    default: {
      const placeholder = makeTextBlock({
        content: `<p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center">[${cb.type}]</p>`,
        styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#9CA3AF' }),
      })
      return [makeSection('full', [[placeholder]], { styles: sectionStyles(cb) })]
    }
  }
}

/**
 * Convert a CanvasBlock[] into an EmailDocument ready for compilation.
 *
 * @param canvasBlocks  The current canvas state from EmailEditorPanel
 * @param existingDoc   Optional: when provided, preserves subject, preheader,
 *                      globalStyles, and the unsubscribe block from the existing
 *                      document so user-configured values aren't lost on re-sync.
 */
export function canvasBlocksToEmailDocument(
  canvasBlocks: CanvasBlock[],
  existingDoc?: EmailDocument,
): EmailDocument {
  const g = existingDoc?.globalStyles ?? DEFAULT_GLOBAL_STYLES

  // Flatten — most blocks yield one section, image-top-text-bottom yields two
  const sections = canvasBlocks.flatMap(canvasBlockToSections)

  return {
    id: existingDoc?.id ?? nanoid(),
    subject: existingDoc?.subject ?? 'Your email subject',
    preheader: existingDoc?.preheader ?? '',
    sections,
    unsubscribe: existingDoc?.unsubscribe ?? makeUnsubscribeBlock(g),
    globalStyles: g,
  }
}
