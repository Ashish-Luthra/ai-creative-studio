/**
 * canvasConverter.ts
 *
 * Converts a CanvasBlock[] (the visual canvas editor model) into a valid
 * EmailDocument that can be compiled to email-safe HTML.
 *
 * Design notes:
 *  - Each CanvasBlock maps to one EmailSection with a single full-width column.
 *  - Multi-column prebuilt blocks (image-left-text-right, etc.) map to
 *    two-column sections using the 'image-left' or 'image-right' layouts.
 *  - Font/colour settings from the canvas block are forwarded to the block's
 *    styles object so the compiled HTML faithfully reflects what the user sees.
 *  - An existing EmailDocument can be passed in; when supplied, its
 *    globalStyles, subject, preheader, and unsubscribe block are preserved.
 */

import { nanoid } from 'nanoid'
import type { CanvasBlock } from '@/types/canvas'
import type {
  EmailDocument, EmailSection, EmailBlock,
  TextStyles, ButtonStyles, ImageStyles, SectionStyles,
} from '@/types/email'
import {
  makeTextBlock, makeImageBlock, makeButtonBlock, makeSpacerBlock,
  makeLogoBlock, makeDividerBlock, makeSection, makeUnsubscribeBlock,
  DEFAULT_GLOBAL_STYLES,
} from './templates'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sectionStyles(cb: CanvasBlock, overridePadding?: SectionStyles['padding']): SectionStyles {
  return {
    backgroundColor: cb.backgroundColor ?? '#FFFFFF',
    padding: overridePadding ?? { top: 16, right: 24, bottom: 16, left: 24 },
  }
}

function textStyles(cb: CanvasBlock, overrides: Partial<TextStyles> = {}): TextStyles {
  return {
    fontFamily: cb.fontFamily ?? 'Arial',
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
    fontFamily: cb.fontFamily ?? 'Arial',
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
    { label: 'Home', url: '#' },
    { label: 'About', url: '#' },
    { label: 'Shop', url: '#' },
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
  const block = makeTextBlock({
    styles: textStyles(cb),
  })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertButton(cb: CanvasBlock): EmailSection {
  const block = makeButtonBlock('Click Here', cb.linkUrl ?? '#')
  block.styles = buttonStyles(cb)
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertSpacer(cb: CanvasBlock): EmailSection {
  const block = makeSpacerBlock(cb.spacerHeight ?? 32)
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 0, right: 0, bottom: 0, left: 0 }),
  })
}

function convertSocial(cb: CanvasBlock): EmailSection {
  // Use inline SVG icons embedded as data-URIs so they work in all email clients
  // without requiring external image hosting. Each icon is a 32×32 circle with
  // the platform logo inside, matching the canvas block's visual style.
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
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertFooter(cb: CanvasBlock): EmailSection {
  const DEFAULT_FOOTER_LINKS = [
    { label: 'Privacy Policy', url: '#' },
    { label: 'Unsubscribe', url: '#' },
    { label: 'View in Browser', url: '#' },
    { label: 'Contact Us', url: '#' },
  ]
  const fLinks = cb.footerLinks && cb.footerLinks.length > 0 ? cb.footerLinks : DEFAULT_FOOTER_LINKS
  const linkHtml = fLinks
    .map((l) => `<a href="${l.url || '#'}" style="color:#9CA3AF;text-decoration:none">${l.label}</a>`)
    .join('<span style="color:#D1D5DB"> · </span>')
  const block = makeTextBlock({
    content: `<p style="margin:0 0 8px 0;text-align:center">${linkHtml}</p><p style="margin:0;text-align:center;color:#9CA3AF">© ${new Date().getFullYear()} Your Company Name. All rights reserved.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#9CA3AF' }),
  })
  return makeSection('full', [[block]], {
    styles: sectionStyles(cb, { top: 24, right: 24, bottom: 24, left: 24 }),
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
    if (cb.contentButton) {
      blocks.push(makeButtonBlock(btnLabel, '#'))
    }
    return makeSection('full', [blocks], { styles: sectionStyles(cb) })
  }

  if (layout === 'image-text') {
    const heading = makeTextBlock({
      content: '<p style="margin:0;font-size:22px;font-weight:700">Featured Content</p>',
      styles: textStyles(cb, { fontSize: 22, fontWeight: 'bold' }),
    })
    const body = makeTextBlock({
      content: '<p style="margin:0">Add your content copy here.</p>',
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
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column One</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Content for the first column.</p>', styles: textStyles(cb) }),
    ]
    const col2 = [
      makeTextBlock({ content: '<p style="margin:0;font-weight:700">Column Two</p>', styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Content for the second column.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('two-col', [col1, col2], { styles: sectionStyles(cb) })
  }

  if (layout === '3col-text') {
    const col = (label: string) => [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${label}</p>`, styles: textStyles(cb) }),
      makeTextBlock({ content: '<p style="margin:0">Short description here.</p>', styles: textStyles(cb) }),
    ]
    return makeSection('three-col', [col('Column 1'), col('Column 2'), col('Column 3')], { styles: sectionStyles(cb) })
  }

  // Fallback
  return makeSection('full', [[makeTextBlock()]], { styles: sectionStyles(cb) })
}

// ── Prebuilt layout blocks ────────────────────────────────────────────────────

function convertImageLeftTextRight(cb: CanvasBlock): EmailSection {
  const imgSrc = cb.imageSrcs?.['main'] ?? ''
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const tagline = makeTextBlock({
    content: '<p style="margin:0;font-style:italic;color:#9CA3AF">From The &lsquo;Gram</p>',
    styles: textStyles(cb, { fontSize: 13, color: '#9CA3AF', textAlign: 'center' }),
  })
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:24px;font-weight:700;text-align:center">The Post That Got Everyone Talking</p>',
    styles: textStyles(cb, { fontSize: 24, fontWeight: 'bold', textAlign: 'center' }),
  })
  const divider = makeDividerBlock()
  const btn = makeButtonBlock('SEE IT', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })
  return makeSection('image-left', [[imgBlock], [tagline, heading, divider, btn]], { styles: sectionStyles(cb) })
}

function convertCenteredContent(cb: CanvasBlock): EmailSection {
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:28px;font-weight:700;text-align:center">6</p><p style="margin:8px 0 0;font-size:20px;text-align:center">Tips to Photograph Food</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 20, fontWeight: 'bold' }),
  })
  const body = makeTextBlock({
    content: '<p style="margin:0;text-align:center">I created this guide to help you get started without making all the mistakes I did.</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 14, color: '#374151' }),
  })
  const btn = makeButtonBlock('READ IT', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })
  return makeSection('full', [[heading, body, btn]], { styles: sectionStyles(cb) })
}

function convertTextOverImage(cb: CanvasBlock): EmailSection {
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:18px;font-weight:700;letter-spacing:0.06em;text-align:center;text-transform:uppercase">A Little Gift of Thanks for Joining the List.</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 18, fontWeight: 'bold' }),
  })
  const imgSrc = firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const btn = makeButtonBlock('CLAIM GIFT', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })
  return makeSection('full', [[heading, btn, imgBlock]], { styles: sectionStyles(cb) })
}

function convertTextLeftImageRight(cb: CanvasBlock): EmailSection {
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:28px;font-weight:700;line-height:1.1">WEL—<br/>COME</p>',
    styles: textStyles(cb, { fontSize: 28, fontWeight: 'bold', lineHeight: 1.1 }),
  })
  const imgSrc = cb.imageSrcs?.['right'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Welcome image')
  imgBlock.styles = imageStyles()
  return makeSection('image-right', [[makeSpacerBlock(16), heading, makeSpacerBlock(16)], [imgBlock]], {
    styles: sectionStyles(cb),
  })
}

function convertRecipeCard(cb: CanvasBlock): EmailSection {
  const imgSrc = cb.imageSrcs?.['recipe'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Recipe image')
  imgBlock.styles = imageStyles()
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:20px;font-weight:700;text-align:center">Recipe Title</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 20, fontWeight: 'bold' }),
  })
  const details = makeTextBlock({
    content: '<p style="margin:0;text-align:center;color:#6B7280;font-size:12px">Prep: 20 min · Cook: 30 min · Servings: 4</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 12, color: '#6B7280' }),
  })
  const btn = makeButtonBlock('GET RECIPE', '#')
  btn.styles = buttonStyles(cb, { align: 'center' })
  return makeSection('full', [[imgBlock, heading, details, btn]], { styles: sectionStyles(cb) })
}

function convertImageTopTextBottom(cb: CanvasBlock): EmailSection {
  const imgSrc = cb.imageSrcs?.['top'] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const heading = makeTextBlock({
    content: '<p style="margin:0;font-size:20px;font-weight:700;text-align:center">This Week\'s Highlight</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 20, fontWeight: 'bold' }),
  })
  const body = makeTextBlock({
    content: '<p style="margin:0;text-align:center">Your caption or description goes here.</p>',
    styles: textStyles(cb, { textAlign: 'center', fontSize: 14, color: '#374151' }),
  })
  return makeSection('full', [[imgBlock, heading, body]], { styles: sectionStyles(cb) })
}

function convertTestimonial(cb: CanvasBlock): EmailSection {
  const avatarSrc = cb.imageSrcs?.['avatar'] ?? ''
  const avatarBlock = makeImageBlock(avatarSrc, 'Testimonial avatar')
  avatarBlock.styles = {
    width: 96,
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: 48,
  }
  const name = makeTextBlock({
    content: '<p style="margin:0;font-weight:700;font-size:13px;letter-spacing:0.08em;text-transform:uppercase">TESTIMONIAL NAME</p>',
    styles: textStyles(cb, { fontSize: 13, fontWeight: 'bold' }),
  })
  const quote = makeTextBlock({
    content: '<p style="margin:0;font-size:14px;color:#374151;line-height:1.6">Since joining, my email list has grown 4x and I\'ve finally found a system that works for my creative business.</p>',
    styles: textStyles(cb, { fontSize: 14, color: '#374151', lineHeight: 1.6 }),
  })
  return makeSection('image-left', [[avatarBlock], [name, quote]], { styles: sectionStyles(cb) })
}

// ─── Main converter ───────────────────────────────────────────────────────────

function canvasBlockToSection(cb: CanvasBlock): EmailSection | null {
  switch (cb.type) {
    case 'logo':                  return convertLogo(cb)
    case 'link-bar':              return convertLinkBar(cb)
    case 'text':                  return convertText(cb)
    case 'button':                return convertButton(cb)
    case 'spacer':                return convertSpacer(cb)
    case 'social':                return convertSocial(cb)
    case 'address':               return convertAddress(cb)
    case 'footer':                return convertFooter(cb)
    case 'content':               return convertContent(cb)
    case 'image-left-text-right': return convertImageLeftTextRight(cb)
    case 'centered-content':      return convertCenteredContent(cb)
    case 'text-over-image':       return convertTextOverImage(cb)
    case 'text-left-image-right': return convertTextLeftImageRight(cb)
    case 'recipe-card':           return convertRecipeCard(cb)
    case 'image-top-text-bottom': return convertImageTopTextBottom(cb)
    case 'testimonial':           return convertTestimonial(cb)
    default: {
      // Unknown block type — emit a placeholder so something renders
      const placeholder = makeTextBlock({
        content: `<p style="margin:0;color:#9CA3AF;font-size:11px;text-align:center">[${cb.type}]</p>`,
        styles: textStyles(cb, { textAlign: 'center', fontSize: 11, color: '#9CA3AF' }),
      })
      return makeSection('full', [[placeholder]], { styles: sectionStyles(cb) })
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

  const sections = canvasBlocks
    .map(canvasBlockToSection)
    .filter((s): s is EmailSection => s !== null)

  return {
    id: existingDoc?.id ?? nanoid(),
    subject: existingDoc?.subject ?? 'Your email subject',
    preheader: existingDoc?.preheader ?? '',
    sections,
    unsubscribe: existingDoc?.unsubscribe ?? makeUnsubscribeBlock(g),
    globalStyles: g,
  }
}
