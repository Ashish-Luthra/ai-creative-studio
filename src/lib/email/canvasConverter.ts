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
import { SPECS } from './blockSpecs'

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
    fontFamily: cb.buttonFontFamily ?? cb.fontFamily ?? '',
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
  const linkColor = cb.fontColor ?? '#4B5563'   // matches canvas text-gray-600 default
  const linkHtml = links
    .map((l) => `<a href="${l.url || '#'}" style="color:${linkColor};text-decoration:none;margin:0 8px">${l.label}</a>`)
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
  // All supported platforms with brand-coloured circular SVG icons
  const ALL_SOCIAL_ICONS: { key: string; name: string; svg: string }[] = [
    { key: 'facebook',  name: 'Facebook',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1877F2"/><path d="M21 16h-3v9h-4v-9h-2v-3h2v-2c0-2.2 1.3-4 4-4h3v3h-2c-.6 0-1 .4-1 1v2h3l-.5 3z" fill="#fff"/></svg>` },
    { key: 'instagram', name: 'Instagram', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0%" stop-color="#ffd600"/><stop offset="50%" stop-color="#ff0069"/><stop offset="100%" stop-color="#7638fa"/></radialGradient></defs><circle cx="16" cy="16" r="16" fill="url(#ig)"/><rect x="9" y="9" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="16" cy="16" r="3.5" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="20.5" cy="11.5" r="1" fill="#fff"/></svg>` },
    { key: 'pinterest', name: 'Pinterest', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#E60023"/><path d="M16 6C10.5 6 6 10.5 6 16c0 4.2 2.6 7.8 6.3 9.3-.1-.8-.1-2 .2-2.9l1.3-5.5s-.3-.7-.3-1.7c0-1.6.9-2.8 2.3-2.8 1.1 0 1.6.8 1.6 1.8 0 1.1-.7 2.7-1.1 4.2-.3 1.2.6 2.2 1.8 2.2 2.2 0 3.7-2.8 3.7-6.2 0-2.6-1.8-4.5-4.4-4.5-3 0-4.8 2.3-4.8 4.6 0 .9.4 1.9.8 2.4.1.1.1.2.1.3l-.3 1.3c-.1.3-.3.4-.6.3-1.7-.8-2.7-3.2-2.7-5.2 0-4.2 3-8 8.7-8 4.6 0 8.1 3.3 8.1 7.6 0 4.6-2.9 8.2-6.8 8.2-1.4 0-2.6-.7-3-1.5l-.8 3c-.3 1.1-1 2.5-1.5 3.3.8.3 1.6.4 2.5.4 5.5 0 10-4.5 10-10S21.5 6 16 6z" fill="#fff"/></svg>` },
    { key: 'twitter',   name: 'X',         svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M18.2 14.8L23.5 9h-1.3l-4.5 5.2L14 9H9.5l5.6 8.1-5.6 6.4H11l4.8-5.5L19.7 23H24l-5.8-8.2zm-1.7 2l-.6-.8-4.6-6.6h2l3.7 5.3.6.8 4.8 6.8h-2l-3.9-5.5z" fill="#fff"/></svg>` },
    { key: 'youtube',   name: 'YouTube',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#FF0000"/><path d="M23.5 11.5s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C18.2 8.4 16 8.4 16 8.4s-2.2 0-4.7.2c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S8.3 13.1 8.3 14.6v1.4c0 1.5.2 3 .2 3s.2 1.4.8 2c.8.8 1.8.8 2.2.9 1.6.2 6.5.2 6.5.2s2.2 0 4.7-.2c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.5.2-3v-1.4c0-1.5-.2-3-.2-3zm-9.2 6.1v-5.3l5.4 2.7-5.4 2.6z" fill="#fff"/></svg>` },
    { key: 'linkedin',  name: 'LinkedIn',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#0A66C2"/><path d="M10.5 13h-3v9h3v-9zm-1.5-1.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm16 10.5h-3v-4.5c0-1.1-.4-1.9-1.5-1.9-1.5 0-1.8 1.1-1.8 1.9V22h-3v-9h3v1.3c.4-.8 1.4-1.3 2.6-1.3 2 0 3.7 1.3 3.7 4.2V22z" fill="#fff"/></svg>` },
    { key: 'tiktok',    name: 'TikTok',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M21.5 9.5c-.8-.5-1.4-1.3-1.7-2.2h-2.3v10.1c-.1 1.1-1 2-2.2 2a2.2 2.2 0 0 1-2.2-2.2c0-1.2 1-2.2 2.2-2.2.2 0 .4 0 .6.1v-2.4c-.2 0-.4-.1-.6-.1-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5V12c.9.6 2 1 3.2 1V10.8c-.6 0-1.1-.6-1.5-1.3z" fill="#fff"/></svg>` },
    { key: 'twitter_x', name: 'X',        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M18.2 14.8L23.5 9h-1.3l-4.5 5.2L14 9H9.5l5.6 8.1-5.6 6.4H11l4.8-5.5L19.7 23H24l-5.8-8.2zm-1.7 2l-.6-.8-4.6-6.6h2l3.7 5.3.6.8 4.8 6.8h-2l-3.9-5.5z" fill="#fff"/></svg>` },
    { key: 'spotify',   name: 'Spotify',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#1DB954"/><path d="M22 18.5c-3-1.8-6.7-2-9.3-1.1-.4.1-.6-.1-.7-.5-.1-.4.1-.6.5-.7 3-.9 7.1-.7 10.4 1.2.3.2.4.6.2.9-.2.4-.7.5-1.1.2zm1-2.8c-3.4-2-8.5-2.5-12.2-1.4-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 4.1-1.2 9.7-.6 13.5 1.6.4.2.5.7.3 1.1-.2.4-.7.5-1.1.2zm.1-2.9C18.8 10.6 11.8 10.4 8 11.6c-.5.2-1-.1-1.2-.6-.2-.5.1-1 .6-1.2 4.3-1.3 11.9-1 16.5 1.5.5.3.6.9.4 1.4-.3.4-.9.6-1.4.3z" fill="#fff"/></svg>` },
    { key: 'github',    name: 'GitHub',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#24292e"/><path d="M16 7.5C11.3 7.5 7.5 11.3 7.5 16c0 3.8 2.4 7 5.8 8.1.4.1.6-.2.6-.4v-1.4c-2.4.5-2.9-1.2-2.9-1.2-.4-1-1-1.3-1-1.3-.8-.5.1-.5.1-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-2-.2-4-1-4-4.4 0-1 .4-1.8.9-2.4-.1-.2-.4-1.1.1-2.3 0 0 .8-.2 2.5.9.7-.2 1.5-.3 2.3-.3s1.6.1 2.3.3c1.7-1.1 2.5-.9 2.5-.9.5 1.2.2 2.1.1 2.3.6.6.9 1.4.9 2.4 0 3.4-2 4.2-4 4.4.3.3.6.8.6 1.7v2.5c0 .2.2.5.6.4 3.4-1.1 5.8-4.3 5.8-8.1 0-4.7-3.8-8.5-8.5-8.5z" fill="#fff"/></svg>` },
    { key: 'telegram',  name: 'Telegram',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#26A5E4"/><path d="M22.8 10.2l-2.7 12.7c-.2.9-.7 1.1-1.4.7l-3.9-2.9-1.9 1.8c-.2.2-.4.3-.8.3l.3-4 7.3-6.6c.3-.3-.1-.4-.5-.2L9.6 18l-3.8-1.2c-.8-.3-.8-.8.2-1.2l14.7-5.7c.7-.2 1.4.2 1.1 1.3z" fill="#fff"/></svg>` },
    { key: 'discord',   name: 'Discord',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#5865F2"/><path d="M21.6 11.5c-1.1-.5-2.3-.9-3.5-1.1l-.2.4c1.1.3 2.1.7 3 1.3-1.3-.7-2.7-1.2-4.9-1.2s-3.6.5-4.9 1.2c.9-.6 1.9-1 3-1.3l-.2-.4c-1.2.2-2.4.6-3.5 1.1-2.5 3.8-3.2 7.4-2.9 11 1.3 1 2.9 1.8 4.7 2.4l.7-.9c-.8-.3-1.6-.7-2.3-1.2.2.1.4.2.5.3l.5-.5c-1.5-.7-2.2-1.6-2.2-1.6s2.9 1.4 7 1.4 7-1.4 7-1.4-.7.9-2.2 1.6l.5.5c.2-.1.3-.2.5-.3-.7.5-1.5.9-2.3 1.2l.7.9c1.8-.6 3.4-1.4 4.7-2.4.3-3.6-.5-7.2-2.9-11zm-8.1 9.3c-.9 0-1.7-.8-1.7-1.9s.7-1.9 1.7-1.9 1.7.8 1.7 1.9-.7 1.9-1.7 1.9zm5 0c-.9 0-1.7-.8-1.7-1.9s.7-1.9 1.7-1.9 1.7.8 1.7 1.9-.8 1.9-1.7 1.9z" fill="#fff"/></svg>` },
    { key: 'threads',   name: 'Threads',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M20.8 15.4c-.1-.1-.3-.1-.4-.2-.6-2.8-2.3-4.4-4.8-4.4-1.6 0-3 .7-3.8 1.9l1.4.9c.6-.9 1.5-1.4 2.4-1.4 1.1 0 2.1.7 2.5 1.8-.7-.1-1.4-.1-2.2 0-2.1.1-3.5 1.3-3.4 3 0 .8.4 1.5.9 2 .6.5 1.4.8 2.2.8.5 0 1.1-.1 1.6-.3.6-.3 1.1-.7 1.4-1.2.3.3.5.6.6.9.1.3.2.7.2 1.1 0 .6-.1 1.1-.4 1.5-.3.5-.8.8-1.4 1-.7.2-1.4.3-2.2.3-1.8 0-3.1-.6-4-1.7-.9-1.1-1.3-2.6-1.3-4.4 0-1.8.5-3.3 1.4-4.4.9-1.1 2.3-1.7 4-1.7 1.7 0 3.1.5 4 1.5.6.6 1 1.4 1.2 2.3l1.7-.5c-.3-1.2-.8-2.2-1.6-3-.5-.5-1.1-.9-1.7-1.2-.6-.3-1.3-.5-2-.6-.7-.1-1.1-.1-1.6-.1-2.3 0-4.1.8-5.4 2.3-1.2 1.5-1.9 3.5-1.9 5.9 0 2.4.6 4.4 1.9 5.9 1.3 1.5 3.1 2.3 5.4 2.3 1 0 2-.2 2.9-.5 1-.4 1.7-.9 2.2-1.7.5-.8.8-1.7.8-2.7 0-.9-.2-1.7-.5-2.3-.3-.6-.7-1.1-1.2-1.4zm-4.2 2.5c-.8.5-1.6.5-2 .2-.3-.2-.5-.5-.5-.9-.1-.8.6-1.3 1.8-1.3.6 0 1.2 0 1.7.1-.1.8-.4 1.5-1 1.9z" fill="#fff"/></svg>` },
    { key: 'medium',    name: 'Medium',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#000"/><path d="M9.5 11.5l-.9-.9v-.1h3.1l2.4 5.3 2.1-5.3h3v.1l-.8.8c-.1.1-.1.2-.1.3v7.8c0 .1 0 .2.1.3l.8.8v.1h-3.9v-.1l.8-.8c.1-.1.1-.1.1-.3v-6.3l-2.4 6.2h-.2l-2.8-6.2v4.1c0 .2 0 .5.2.6l1 1.2v.1H9.3v-.1l1-1.2c.2-.2.2-.4.2-.6v-4.7c0-.1 0-.3-.2-.4zm11.6-.1l-1 .8c-.1.1-.1.2-.1.3v5.7c0 .1 0 .2.1.3l1 .8v.1h-3.9v-.1l1-.8c.1-.1.1-.1.1-.3v-5.8c0-.1 0-.2-.1-.3l-1-.8v-.1h3.9v.2z" fill="#fff"/></svg>` },
    { key: 'substack',  name: 'Substack',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#FF6719"/><path d="M8 11.5h16v2H8zm0 4.5h16v2H8zM8 21l8 3.5 8-3.5v-3H8z" fill="#fff"/></svg>` },
    { key: 'website',   name: 'Website',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#374151"/><path d="M16 8a8 8 0 1 0 0 16A8 8 0 0 0 16 8zm-1 13.9c-2.4-.5-4.3-2.4-4.8-4.9H14v4.9zm2 0V17h3.8c-.5 2.5-2.4 4.4-3.8 4.9zm4-6.9H17V11.1c1.4.5 3.3 2.4 3.8 4.9H21zm-6 0H11c.5-2.5 2.4-4.4 3.8-4.9V15h.2z" fill="#fff"/></svg>` },
    { key: 'linktree',  name: 'Linktree',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="16" fill="#43E660"/><path d="M16 8l4 4h-3v3h4l-2 2 2 2H17v5h-2v-5h-4l2-2-2-2h4v-3h-3l4-4z" fill="#fff"/></svg>` },
  ]

  const links = cb.socialLinks ?? {}
  const linkedKeys = Object.keys(links).filter((k) => links[k])

  // Use linked platforms if any, otherwise show default set
  const DEFAULT_KEYS = ['facebook', 'instagram', 'pinterest', 'twitter']
  const iconsToRender = linkedKeys.length > 0
    ? ALL_SOCIAL_ICONS.filter((icon) => links[icon.key])
    : ALL_SOCIAL_ICONS.filter((icon) => DEFAULT_KEYS.includes(icon.key))

  const iconCells = iconsToRender.map(({ key, name, svg }) => {
    const url = links[key] || '#'
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    return `<td align="center" style="padding:0 6px">` +
      `<a href="${url}" style="text-decoration:none;display:inline-block" title="${name}">` +
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
  const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? ''
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()

  const tagline = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.taglineColor};text-align:center">From The &apos;Gram</p>`,
    styles: textStyles(cb, { fontSize: S.taglineFontSize, color: S.taglineColor, textAlign: 'center' }),
  })
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};text-align:center">The Post That Got Everyone Talking</p>`,
    styles: textStyles(cb, { fontSize: S.headingFontSize, fontWeight: S.headingWeight, textAlign: 'center' }),
  })
  const dividerBlock = makeTextBlock({
    content: narrowLine(S.dividerColor),
    styles: textStyles(cb, { textAlign: 'center', fontSize: 1 }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textPaddingV), tagline, heading, dividerBlock, btn, makeSpacerBlock(S.textPaddingV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding),
  }
}

function convertCenteredContent(cb: CanvasBlock): EmailSection {
  const S = SPECS.CENTERED_CONTENT
  // White card as a nested HTML table — gives the white-on-gray effect without
  // CSS box-shadows (which email clients strip). Font-family is NOT set on the
  // inner <p> tags so the <td> wrapper's buildFontStack cascade applies.
  const bodyColor = cb.fontColor ?? S.bodyColor

  const cardHtml =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" ` +
    `style="background-color:${S.cardBg};border-radius:${S.cardBorderRadius}px;margin:0 auto;width:100%">` +
    `<tr><td style="padding:${S.cardPadding}px;text-align:center">` +
    `<p style="margin:0;font-size:${S.numberFontSize}px;font-weight:700;color:${S.numberColor};line-height:${S.numberLineHeight}">6</p>` +
    `<p style="margin:8px 0 0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight}">Tips to Photograph Food</p>` +
    `<p style="margin:12px auto 0;font-size:${S.bodyFontSize}px;color:${bodyColor};max-width:${S.bodyMaxWidthPx}px;line-height:${S.bodyLineHeight}">` +
    `I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.</p>` +
    `<p style="margin:16px 0 0;font-size:${S.labelFontSize}px;color:${S.labelColor}">001</p>` +
    `</td></tr></table>`

  const cardBlock = makeTextBlock({
    content: cardHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.bodyFontSize }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign })

  return makeSection('full', [[cardBlock, btn]], {
    styles: sectionStyles(cb, S.outerPadding, S.outerBg),
  })
}

function convertTextOverImage(cb: CanvasBlock): EmailSection {
  const S = SPECS.TEXT_OVER_IMAGE
  const headingHtml =
    narrowLine(S.dividerColor) +
    `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};` +
    `letter-spacing:${S.headingTracking};text-align:center;text-transform:uppercase">` +
    `A Little Gift of Thanks for Joining the List.</p>` +
    narrowLine(S.dividerColor)

  const heading = makeTextBlock({
    content: headingHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.headingFontSize, fontWeight: S.headingWeight }),
  })
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: S.buttonPadding })

  return makeSection('full', [[heading, btn, makeSpacerBlock(16), imgBlock]], {
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  })
}

function convertTextLeftImageRight(cb: CanvasBlock): EmailSection {
  const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};line-height:${S.headingLineHeight}">WEL&mdash;COME</p>`,
    styles: textStyles(cb, { fontSize: S.headingFontSize, fontWeight: S.headingWeight, lineHeight: S.headingLineHeight }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign })

  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Welcome image')
  imgBlock.styles = imageStyles()

  return {
    id: nanoid(),
    layout: 'image-right',
    columns: [
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textPaddingV), heading, makeSpacerBlock(16), btn, makeSpacerBlock(S.textPaddingV)],
      },
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
    ],
    styles: sectionStyles(cb, S.sectionPadding),
  }
}

function convertRecipeCard(cb: CanvasBlock): EmailSection {
  const S = SPECS.RECIPE_CARD
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Recipe image')
  imgBlock.styles = imageStyles()

  const label = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.labelColor}">One</p>`,
    styles: textStyles(cb, { fontSize: S.labelFontSize, color: S.labelColor }),
  })
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight}">Click here for my creamy butternut squash soup</p>`,
    styles: textStyles(cb, { fontSize: S.headingFontSize, fontWeight: S.headingWeight }),
  })
  const description = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.descColor}">A warming recipe perfect for fall evenings.</p>`,
    styles: textStyles(cb, { fontSize: S.descFontSize, color: S.descColor }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      { id: nanoid(), widthPct: S.imageColPct, blocks: [imgBlock] },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.textInnerSpacerV), label, heading, description, btn, makeSpacerBlock(S.textInnerSpacerV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  }
}

function convertImageTopTextBottom(cb: CanvasBlock): EmailSection[] {
  const S = SPECS.IMAGE_TOP_TEXT_BOTTOM

  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const imageSection = makeSection('full', [[imgBlock]], {
    styles: { backgroundColor: S.imageSectionBg, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
  })

  const heading = makeTextBlock({
    content: `<p style="margin:0 0 ${S.headingBottomMargin}px;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};text-align:center">Get 25% off when you book my services</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.headingFontSize, fontWeight: S.headingWeight }),
  })
  const body = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.bodyColor};text-align:center">for the next 24 hours only.</p>`,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.bodyFontSize, color: S.bodyColor }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: S.buttonPadding })

  const textSection = makeSection('full', [[heading, body, makeSpacerBlock(S.buttonSpacerV), btn]], {
    styles: { backgroundColor: cb.backgroundColor ?? S.textBg, padding: S.textPadding },
  })

  return [imageSection, textSection]
}

function convertTestimonial(cb: CanvasBlock): EmailSection {
  const S = SPECS.TESTIMONIAL
  const avatarSrc = cb.imageSrcs?.[S.avatarKey] ?? ''
  const avatarBlock = makeImageBlock(avatarSrc, 'Testimonial avatar')
  avatarBlock.styles = {
    width: S.avatarWidth,
    align: 'center',
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderRadius: S.avatarBorderRadius,
  }

  const name = makeTextBlock({
    content: `<p style="margin:0;font-weight:${S.nameWeight};font-size:${S.nameFontSize}px;letter-spacing:${S.nameTracking};text-transform:uppercase">TESTIMONIAL NAME</p>`,
    styles: textStyles(cb, { fontSize: S.nameFontSize, fontWeight: S.nameWeight }),
  })
  const quote = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.quoteFontSize}px;color:${S.quoteColor};line-height:${S.quoteLineHeight}">Since joining, my email list has grown 4x and I&apos;ve finally found a system that works for my creative business.</p>`,
    styles: textStyles(cb, { fontSize: S.quoteFontSize, color: S.quoteColor, lineHeight: S.quoteLineHeight }),
  })
  const stars = makeTextBlock({
    content: `<p style="margin:8px 0 0;font-size:${S.starFontSize}px;color:${S.starColor}">${S.starsHtml}</p>`,
    styles: textStyles(cb, { fontSize: S.starFontSize, color: S.starColor }),
  })

  return {
    id: nanoid(),
    layout: 'two-col',
    columns: [
      {
        id: nanoid(), widthPct: S.avatarColPct,
        blocks: [makeSpacerBlock(S.innerSpacerV), avatarBlock, makeSpacerBlock(S.innerSpacerV)],
      },
      {
        id: nanoid(), widthPct: S.textColPct,
        blocks: [makeSpacerBlock(S.innerSpacerV), name, makeSpacerBlock(S.innerSpacerV), quote, stars, makeSpacerBlock(S.innerSpacerV)],
      },
    ],
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
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
