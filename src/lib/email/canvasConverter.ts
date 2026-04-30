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

type FontWeightValue = TextStyles['fontWeight']
const VALID_WEIGHTS = new Set(['100','200','300','400','500','600','700','800','900'])
function toFontWeight(n: number): FontWeightValue {
  const s = String(n)
  return VALID_WEIGHTS.has(s) ? s as FontWeightValue : 'normal'
}

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
    fontWeight: cb.fontWeight ? toFontWeight(cb.fontWeight) : (cb.fontBold ? 'bold' : 'normal'),
    lineHeight: cb.lineHeight ?? 1.6,
    color: cb.fontColor ?? '#111827',
    textAlign: cb.textAlign ?? 'left',
    textTransform: cb.fontCase === 'lowercase' || cb.fontCase === 'uppercase' ? cb.fontCase : 'none',
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

/**
 * Merge a per-field textStyles override (from cb.textStyles[key]) on top of the
 * block-level defaults. Field-level props win over block-level; caller overrides win last.
 */
/**
 * `overrides` are spec defaults (e.g. hardcoded font sizes for a prebuilt block).
 * Per-field user edits in cb.textStyles[fieldKey] take final precedence.
 */
function fieldTextStyles(
  cb: CanvasBlock,
  fieldKey: string,
  overrides: Partial<TextStyles> = {},
): TextStyles {
  const f = cb.textStyles?.[fieldKey]
  return textStyles(cb, {
    ...overrides,
    ...(f && {
      ...(f.fontFamily  !== undefined && { fontFamily: f.fontFamily }),
      ...(f.fontSize    !== undefined && { fontSize:   f.fontSize }),
      ...(f.fontWeight  !== undefined && { fontWeight: toFontWeight(f.fontWeight) }),
      ...(f.fontWeight === undefined && f.fontBold !== undefined && { fontWeight: f.fontBold ? 'bold' : 'normal' }),
      ...(f.lineHeight  !== undefined && { lineHeight: f.lineHeight }),
      ...(f.fontColor   !== undefined && { color:         f.fontColor }),
      ...(f.textAlign   !== undefined && { textAlign:     f.textAlign }),
      ...(f.fontCase    !== undefined && { textTransform: f.fontCase === 'none' ? 'none' : f.fontCase }),
    }),
  })
}

/** Return user-edited text for a field, falling back to the design default. */
function t(cb: CanvasBlock, key: string, defaultText: string): string {
  return cb.texts?.[key] ?? defaultText
}

/** Convert a resolved TextStyles object to an inline CSS string for use inside raw HTML. */
function stylesToInline(s: TextStyles): string {
  const parts: string[] = []
  if (s.fontFamily) parts.push(`font-family:${s.fontFamily}`)
  parts.push(`font-size:${s.fontSize}px`)
  if (s.fontWeight !== 'normal') parts.push(`font-weight:${s.fontWeight}`)
  parts.push(`color:${s.color}`)
  parts.push(`line-height:${s.lineHeight}`)
  if (s.textTransform && s.textTransform !== 'none') parts.push(`text-transform:${s.textTransform}`)
  return parts.join(';')
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
  // width:200 matches canvas max-w-[200px]; section padding 8px top/bottom + BlockLogo's
  // own 16px td padding = 24px total, matching canvas py-6
  const logo = makeLogoBlock({ src, alt: 'Logo', width: 200, isGlobal: !src })
  return makeSection('full', [[logo]], {
    styles: sectionStyles(cb, { top: 8, right: 24, bottom: 8, left: 24 }),
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
  const block = makeTextBlock({
    content: `<p style="margin:0">${t(cb, 'body', 'Your text content here. Click to edit this paragraph and add your own copy.')}</p>`,
    styles: fieldTextStyles(cb, 'body'),
  })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertButton(cb: CanvasBlock): EmailSection {
  const block = makeButtonBlock(t(cb, 'button', 'Click Here'), cb.linkUrl ?? '#')
  const f = cb.textStyles?.['button']
  block.styles = buttonStyles(cb, {
    ...(f?.fontFamily  !== undefined && { fontFamily: f.fontFamily }),
    ...(f?.fontSize    !== undefined && { fontSize:   f.fontSize }),
    ...(f?.fontWeight  !== undefined && { fontWeight: toFontWeight(f.fontWeight) }),
    ...(f?.fontWeight === undefined && f?.fontBold !== undefined && { fontWeight: f.fontBold ? 'bold' : '600' }),
  })
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
  // All supported platforms with simple outline SVGs (no background circle)
  const ALL_SOCIAL_ICONS: { key: string; name: string; svg: string }[] = [
    { key: 'facebook',  name: 'Facebook',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M21 16h-3v9h-4v-9h-2v-3h2v-2c0-2.2 1.3-4 4-4h3v3h-2c-.6 0-1 .4-1 1v2h3l-.5 3z" fill="currentColor"/></svg>` },
    { key: 'instagram', name: 'Instagram', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>` },
    { key: 'pinterest', name: 'Pinterest', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" fill="currentColor"/></svg>` },
    { key: 'twitter',   name: 'X',         svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/></svg>` },
    { key: 'youtube',   name: 'YouTube',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z" fill="currentColor"/></svg>` },
    { key: 'linkedin',  name: 'LinkedIn',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="currentColor"/></svg>` },
    { key: 'tiktok',    name: 'TikTok',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="currentColor"/></svg>` },
    { key: 'twitter_x', name: 'X',        svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/></svg>` },
    { key: 'spotify',   name: 'Spotify',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" fill="currentColor"/></svg>` },
    { key: 'github',    name: 'GitHub',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" fill="currentColor"/></svg>` },
    { key: 'telegram',  name: 'Telegram',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" fill="currentColor"/></svg>` },
    { key: 'discord',   name: 'Discord',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.1.128 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="currentColor"/></svg>` },
    { key: 'threads',   name: 'Threads',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.868 1.205 8.617.024 12.197 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.371-.887h-.018c-.934 0-1.686.317-2.302 1.088L8.92 8.492c.81-1.051 2.019-1.606 3.496-1.606h.028c2.97.016 4.741 1.895 4.762 5.202l.004.067-.053.009c.816.345 1.489.834 2 1.447 1.058 1.274 1.313 2.945 1.096 4.462-.288 2.042-1.286 3.759-2.818 4.978-1.535 1.22-3.509 1.939-5.92 1.949h-.009z" fill="currentColor"/></svg>` },
    { key: 'medium',    name: 'Medium',    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" fill="currentColor"/></svg>` },
    { key: 'substack',  name: 'Substack',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" fill="currentColor"/></svg>` },
    { key: 'website',   name: 'Website',   svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>` },
    { key: 'linktree',  name: 'Linktree',  svg: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><path d="M13.511 5.853l4.005-4.117 2.394 2.393-4.2 4.2h5.784v3.348h-5.765l4.201 4.201-2.394 2.393-5.54-5.634-5.54 5.634-2.394-2.393 4.201-4.2H2.505V8.329h5.784l-4.2-4.2 2.393-2.393 4.005 4.117V0h3.024v5.853zM10.508 24v-8.82h3.024V24h-3.024z" fill="currentColor"/></svg>` },
  ]

  const links = cb.socialLinks ?? {}
  const linkedKeys = Object.keys(links).filter((k) => links[k])

  // Use linked platforms if any, otherwise show default set
  const DEFAULT_KEYS = ['facebook', 'instagram', 'pinterest', 'twitter']
  const iconsToRender = linkedKeys.length > 0
    ? ALL_SOCIAL_ICONS.filter((icon) => links[icon.key])
    : ALL_SOCIAL_ICONS.filter((icon) => DEFAULT_KEYS.includes(icon.key))

  // Icon styling options
  const iconStyle = cb.socialIconStyle ?? 'outline'
  const iconColor = cb.socialIconColor ?? '#1F2937'
  const iconSize = cb.socialIconSize ?? 'M'
  const iconPosition = cb.socialIconPosition ?? 'center'
  const iconSpacing = cb.socialIconSpacing ?? 12

  // Size mapping
  const sizeMap = { S: 24, M: 32, L: 40 }
  const iconPx = sizeMap[iconSize]
  const borderWidth = iconStyle === 'filled' ? 0 : 1

  // Alignment mapping for table
  const alignMap: Record<string, 'left' | 'center' | 'right'> = { left: 'left', center: 'center', right: 'right' }
  const tableAlign = alignMap[iconPosition] ?? 'center'

  const iconCells = iconsToRender.map(({ key, name, svg }) => {
    const url = links[key] || '#'

    // For outline style: use transparent bg with border
    // For filled style: use icon color as bg with white icon
    const bgColor = iconStyle === 'filled' ? iconColor : 'transparent'
    const iconColor_ = iconStyle === 'filled' ? '#ffffff' : iconColor
    const borderColor = iconStyle === 'filled' ? 'none' : iconColor
    const borderStyle = iconStyle === 'filled' ? 'none' : `solid 1px ${borderColor}`

    // Replace currentColor in SVG with actual color
    const styledSvg = svg.replace(/currentColor/g, iconColor_)
    const dataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(styledSvg)}`

    const paddingPx = iconSpacing / 2
    return `<td align="center" style="padding:0 ${paddingPx}px">` +
      `<a href="${url}" style="display:inline-block;text-decoration:none" title="${name}">` +
      `<span style="display:inline-flex;align-items:center;justify-content:center;width:${iconPx}px;height:${iconPx}px;background-color:${bgColor};border:${borderStyle};border-radius:50%;line-height:0">` +
      `<img src="${dataUri}" width="${iconPx}" height="${iconPx}" alt="${name}" style="display:block;border:none;width:${iconPx}px;height:${iconPx}px">` +
      `</span></a></td>`
  }).join('')

  const block = makeTextBlock({
    content: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tbody><tr style="text-align:${tableAlign}">${iconCells}</tr></tbody></table>`,
    styles: textStyles(cb, { textAlign: tableAlign, fontSize: 0 }),
  })
  return makeSection('full', [[block]], { styles: sectionStyles(cb) })
}

function convertAddress(cb: CanvasBlock): EmailSection {
  const block = makeTextBlock({
    content: `<p style="margin:0;text-align:center;color:#6B7280">${t(cb, 'address', '123 Main Street, Suite 100 · City, State 12345 · United States')}</p>`,
    styles: fieldTextStyles(cb, 'address', { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
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
      `${t(cb, 'copyright', `© ${new Date().getFullYear()} Your Company Name. All rights reserved.`)}</p>`,
    styles: fieldTextStyles(cb, 'copyright', { textAlign: 'center', fontSize: 11, color: '#6B7280' }),
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
      content: `<p style="margin:0;font-size:22px;font-weight:700">${t(cb, 'heading', 'Content Heading')}</p>`,
      styles: fieldTextStyles(cb, 'heading', { fontSize: 22, fontWeight: 'bold' }),
    })
    const body = makeTextBlock({
      content: `<p style="margin:0">${t(cb, 'body', 'Click to edit this text. Tell your story alongside the image.')}</p>`,
      styles: fieldTextStyles(cb, 'body'),
    })
    const imgBlock = makeImageBlock(imgSrc, 'Content image')
    imgBlock.styles = imageStyles()
    const contentBlocks: EmailBlock[] = [heading, body]
    if (cb.contentButton) contentBlocks.push(makeButtonBlock(btnLabel, '#'))
    return makeSection('image-left', [[imgBlock], contentBlocks], { styles: sectionStyles(cb) })
  }

  if (layout === '2col-text') {
    const col1 = [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${t(cb, 'col1-heading', 'Column One Heading')}</p>`, styles: fieldTextStyles(cb, 'col1-heading') }),
      makeTextBlock({ content: `<p style="margin:0">${t(cb, 'col1-body', 'Add your text here. Click to edit this column and tell your story.')}</p>`, styles: fieldTextStyles(cb, 'col1-body') }),
    ]
    const col2 = [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${t(cb, 'col2-heading', 'Column Two Heading')}</p>`, styles: fieldTextStyles(cb, 'col2-heading') }),
      makeTextBlock({ content: `<p style="margin:0">${t(cb, 'col2-body', 'Add your text here. Click to edit this column and share more details.')}</p>`, styles: fieldTextStyles(cb, 'col2-body') }),
    ]
    return makeSection('two-col', [col1, col2], { styles: sectionStyles(cb) })
  }

  if (layout === '3col-text') {
    const col1 = [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${t(cb, 'col1-heading', 'Column One')}</p>`, styles: fieldTextStyles(cb, 'col1-heading') }),
      makeTextBlock({ content: `<p style="margin:0">${t(cb, 'col1-body', 'Click to edit this column.')}</p>`, styles: fieldTextStyles(cb, 'col1-body') }),
    ]
    const col2 = [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${t(cb, 'col2-heading', 'Column Two')}</p>`, styles: fieldTextStyles(cb, 'col2-heading') }),
      makeTextBlock({ content: `<p style="margin:0">${t(cb, 'col2-body', 'Click to edit this column.')}</p>`, styles: fieldTextStyles(cb, 'col2-body') }),
    ]
    const col3 = [
      makeTextBlock({ content: `<p style="margin:0;font-weight:700">${t(cb, 'col3-heading', 'Column Three')}</p>`, styles: fieldTextStyles(cb, 'col3-heading') }),
      makeTextBlock({ content: `<p style="margin:0">${t(cb, 'col3-body', 'Click to edit this column.')}</p>`, styles: fieldTextStyles(cb, 'col3-body') }),
    ]
    return makeSection('three-col', [col1, col2, col3], { styles: sectionStyles(cb) })
  }

  return makeSection('full', [[makeTextBlock()]], { styles: sectionStyles(cb) })
}

// ── Prebuilt layout blocks ────────────────────────────────────────────────────

function convertImageLeftTextRight(cb: CanvasBlock): EmailSection {
  const S = SPECS.IMAGE_LEFT_TEXT_RIGHT
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? ''
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()

  const hPad = { top: 0, right: S.textPaddingH, bottom: 0, left: S.textPaddingH }
  const tagline = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.taglineColor};text-align:center">${t(cb, 'tagline', "From The 'Gram")}</p>`,
    styles: fieldTextStyles(cb, 'tagline', { fontSize: S.taglineFontSize, color: S.taglineColor, textAlign: 'center', padding: hPad }),
  })
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};text-align:center">${t(cb, 'heading', 'The Post That Got Everyone Talking')}</p>`,
    styles: fieldTextStyles(cb, 'heading', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, textAlign: 'center', padding: hPad }),
  })
  const dividerBlock = makeTextBlock({
    content: narrowLine(S.dividerColor),
    styles: textStyles(cb, { textAlign: 'center', fontSize: 1 }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

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

  const numStyle  = stylesToInline(fieldTextStyles(cb, 'number',  { fontSize: S.numberFontSize,  color: S.numberColor,  lineHeight: S.numberLineHeight,  fontWeight: '700',            textAlign: 'center' }))
  const headStyle = stylesToInline(fieldTextStyles(cb, 'heading', { fontSize: S.headingFontSize, fontWeight: S.headingWeight,                                                           textAlign: 'center' }))
  const bodyStyle = stylesToInline(fieldTextStyles(cb, 'body',    { fontSize: S.bodyFontSize,    color: S.bodyColor,    lineHeight: S.bodyLineHeight,                                   textAlign: 'center' }))
  const lblStyle  = stylesToInline(fieldTextStyles(cb, 'label',   { fontSize: S.labelFontSize,   color: S.labelColor,                                                                   textAlign: 'center' }))

  const cardHtml =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" ` +
    `style="background-color:${S.cardBg};border-radius:${S.cardBorderRadius}px;margin:0 auto;width:100%">` +
    `<tr><td style="padding:${S.cardPadding}px;text-align:center">` +
    `<p style="margin:0;${numStyle}">${t(cb, 'number', '6')}</p>` +
    `<p style="margin:8px 0 0;${headStyle}">${t(cb, 'heading', 'Tips to Photograph Food')}</p>` +
    `<p style="margin:12px auto 0;max-width:${S.bodyMaxWidthPx}px;${bodyStyle}">${t(cb, 'body', 'I remember my first try at food photography. I created this guide to help you get started without making all the mistakes I did.')}</p>` +
    `<p style="margin:16px 0 0;${lblStyle}">${t(cb, 'label', '001')}</p>` +
    `</td></tr></table>`

  const cardBlock = makeTextBlock({
    content: cardHtml,
    styles: textStyles(cb, { textAlign: 'center', fontSize: S.bodyFontSize }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

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
    `${t(cb, 'heading', 'A Little Gift of Thanks for Joining the List.')}</p>` +
    narrowLine(S.dividerColor)

  const heading = makeTextBlock({
    content: headingHtml,
    styles: fieldTextStyles(cb, 'heading', { textAlign: 'center', fontSize: S.headingFontSize, fontWeight: S.headingWeight }),
  })
  const imgSrc = cb.imageSrcs?.[S.imageKey] ?? firstImageSrc(cb, '')
  const imgBlock = makeImageBlock(imgSrc, 'Feature image')
  imgBlock.styles = imageStyles()
  const btn = makeButtonBlock(t(cb, 'button', S.buttonLabel), '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: S.buttonPadding })

  return makeSection('full', [[heading, btn, makeSpacerBlock(16), imgBlock]], {
    styles: sectionStyles(cb, S.sectionPadding, S.bgColor),
  })
}

function convertTextLeftImageRight(cb: CanvasBlock): EmailSection {
  const S = SPECS.TEXT_LEFT_IMAGE_RIGHT
  const hPad = { top: 0, right: S.textPaddingH, bottom: 0, left: S.textPaddingH }
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};line-height:${S.headingLineHeight}">${t(cb, 'heading', 'WEL—COME')}</p>`,
    styles: fieldTextStyles(cb, 'heading', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, lineHeight: S.headingLineHeight, padding: hPad }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

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

  // Canvas text column uses px-4 (16px) horizontal padding
  const hPad = { top: 0, right: 16, bottom: 0, left: 16 }
  const label = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.labelColor}">${t(cb, 'label', 'One')}</p>`,
    styles: fieldTextStyles(cb, 'label', { fontSize: S.labelFontSize, color: S.labelColor, padding: hPad }),
  })
  const heading = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight}">${t(cb, 'heading', 'Click here for my creamy butternut squash soup')}</p>`,
    styles: fieldTextStyles(cb, 'heading', { fontSize: S.headingFontSize, fontWeight: S.headingWeight, padding: hPad }),
  })
  const description = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.descColor}">${t(cb, 'description', 'A warming recipe perfect for fall evenings.')}</p>`,
    styles: fieldTextStyles(cb, 'description', { fontSize: S.descFontSize, color: S.descColor, padding: hPad }),
  })
  const btn = makeButtonBlock(S.buttonLabel, '#')
  btn.styles = buttonStyles(cb, { align: S.buttonAlign, padding: { top: 8, right: 24, bottom: 8, left: 24 } })

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
    content: `<p style="margin:0 0 ${S.headingBottomMargin}px;font-size:${S.headingFontSize}px;font-weight:${S.headingWeight};text-align:center">${t(cb, 'heading', 'Get 25% off when you book my services')}</p>`,
    styles: fieldTextStyles(cb, 'heading', { textAlign: 'center', fontSize: S.headingFontSize, fontWeight: S.headingWeight }),
  })
  const body = makeTextBlock({
    content: `<p style="margin:0;font-style:italic;color:${S.bodyColor};text-align:center">${t(cb, 'body', 'for the next 24 hours only.')}</p>`,
    styles: fieldTextStyles(cb, 'body', { textAlign: 'center', fontSize: S.bodyFontSize, color: S.bodyColor }),
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
    content: `<p style="margin:0;font-weight:${S.nameWeight};font-size:${S.nameFontSize}px;letter-spacing:${S.nameTracking};text-transform:uppercase">${t(cb, 'name', 'TESTIMONIAL NAME')}</p>`,
    styles: fieldTextStyles(cb, 'name', { fontSize: S.nameFontSize, fontWeight: S.nameWeight }),
  })
  const quote = makeTextBlock({
    content: `<p style="margin:0;font-size:${S.quoteFontSize}px;color:${S.quoteColor};line-height:${S.quoteLineHeight}">${t(cb, 'quote', "Since joining, my email list has grown 4x and I've finally found a system that works for my creative business.")}</p>`,
    styles: fieldTextStyles(cb, 'quote', { fontSize: S.quoteFontSize, color: S.quoteColor, lineHeight: S.quoteLineHeight }),
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
