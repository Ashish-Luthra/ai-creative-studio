/**
 * templates.ts — factory functions for default EmailDocument and preset sections.
 *
 * All values here are design defaults only — user is always free to override
 * in the editor. The unsubscribe block is always included in createDefaultDocument().
 */

import { nanoid } from 'nanoid'
import type {
  EmailDocument, EmailSection, EmailColumn, EmailBlock,
  TextBlock, ImageBlock, ButtonBlock, SpacerBlock, LogoBlock,
  UnsubscribeBlock, GlobalEmailStyles,
  TextStyles, ButtonStyles, ImageStyles,
  SectionLayout, SectionStyles,
} from '@/types/email'
import {
  DEFAULT_SECTION_PADDING,
  DEFAULT_TEXT_PADDING,
  DEFAULT_BUTTON_PADDING,
  DEFAULT_IMAGE_PADDING,
} from './styleUtils'

// ─── Global style defaults ────────────────────────────────────────────────────

export const DEFAULT_GLOBAL_STYLES: GlobalEmailStyles = {
  backgroundColor: '#F9FAFB',
  contentWidth: 600,
  fontFamily: 'Arial',
  linkColor: '#2563EB',
  unsubscribeText: 'You received this email because you signed up. [[unsubscribe]]',
  unsubscribeHref: '{{unsubscribe_url}}',
}

// ─── Block factories ──────────────────────────────────────────────────────────

export function makeTextBlock(overrides: Partial<TextBlock> = {}): TextBlock {
  const defaultStyles: TextStyles = {
    fontFamily: 'Arial',
    fontSize: 16,
    fontWeight: 'normal',
    lineHeight: 1.6,
    color: '#111827',
    textAlign: 'left',
    padding: DEFAULT_TEXT_PADDING,
  }
  return {
    id: nanoid(),
    type: 'text',
    content: '<p>Edit this text</p>',
    styles: defaultStyles,
    ...overrides,
  }
}

export function makeHeadingBlock(text: string): TextBlock {
  return makeTextBlock({
    content: `<h2 style="margin:0">${text}</h2>`,
    styles: {
      fontFamily: 'Arial',
      fontSize: 28,
      fontWeight: 'bold',
      lineHeight: 1.3,
      color: '#111827',
      textAlign: 'center',
      padding: { top: 0, right: 16, bottom: 12, left: 16 },
    },
  })
}

export function makeBodyBlock(text: string): TextBlock {
  return makeTextBlock({
    content: `<p style="margin:0">${text}</p>`,
    styles: {
      fontFamily: 'Arial',
      fontSize: 15,
      fontWeight: 'normal',
      lineHeight: 1.6,
      color: '#374151',
      textAlign: 'center',
      padding: { top: 0, right: 16, bottom: 16, left: 16 },
    },
  })
}

export function makeButtonBlock(label: string, href = '#'): ButtonBlock {
  const defaultStyles: ButtonStyles = {
    backgroundColor: '#111827',
    color: '#FFFFFF',
    fontFamily: 'Arial',
    fontSize: 14,
    fontWeight: '600',
    padding: DEFAULT_BUTTON_PADDING,
    borderRadius: 6,
    align: 'center',
    width: 'auto',
  }
  return {
    id: nanoid(),
    type: 'button',
    label,
    href,
    newTab: true,
    styles: defaultStyles,
  }
}

export function makeImageBlock(src: string, alt = ''): ImageBlock {
  const defaultStyles: ImageStyles = {
    width: 'full',
    align: 'center',
    padding: DEFAULT_IMAGE_PADDING,
  }
  return {
    id: nanoid(),
    type: 'image',
    src,
    alt,
    styles: defaultStyles,
  }
}

export function makeSpacerBlock(height = 24): SpacerBlock {
  return { id: nanoid(), type: 'spacer', height }
}

export function makeLogoBlock(opts: {
  src?: string; alt?: string; width?: number; isGlobal?: boolean
} = {}): LogoBlock {
  return {
    id: nanoid(),
    type: 'logo',
    src: opts.src ?? '',
    alt: opts.alt ?? 'Logo',
    width: opts.width ?? 120,
    meta: { isGlobal: opts.isGlobal ?? true },
  }
}

export function makeUnsubscribeBlock(
  g: Pick<GlobalEmailStyles, 'unsubscribeText' | 'unsubscribeHref' | 'fontFamily'>,
): UnsubscribeBlock {
  return {
    id: nanoid(),
    type: 'unsubscribe',
    text: g.unsubscribeText,
    href: g.unsubscribeHref,
    styles: {
      fontFamily: g.fontFamily,
      fontSize: 12,
      fontWeight: 'normal',
      lineHeight: 1.5,
      color: '#9CA3AF',
      textAlign: 'center',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    meta: { locked: true },
  }
}

// ─── Section factory ───────────────────────────────────────────────────────────

export function makeSection(
  layout: SectionLayout,
  blocksByColumn: EmailBlock[][],
  opts: { label?: string; styles?: Partial<SectionStyles> } = {},
): EmailSection {
  const widths = layoutToWidths(layout)
  const columns: EmailColumn[] = widths.map((w, i) => ({
    id: nanoid(),
    widthPct: w,
    blocks: blocksByColumn[i] ?? [],
  }))

  const defaultStyles: SectionStyles = {
    backgroundColor: '#FFFFFF',
    padding: DEFAULT_SECTION_PADDING,
  }

  return {
    id: nanoid(),
    layout,
    columns,
    styles: { ...defaultStyles, ...opts.styles },
    label: opts.label,
  }
}

function layoutToWidths(layout: SectionLayout): number[] {
  switch (layout) {
    case 'full':         return [100]
    case 'two-col':      return [50, 50]
    case 'left-heavy':   return [60, 40]
    case 'right-heavy':  return [40, 60]
    case 'three-col':    return [33, 34, 33]
    case 'image-left':   return [40, 60]
    case 'image-right':  return [60, 40]
    default:             return [100]
  }
}

// ─── Preset section templates (Flodesk-style cards) ───────────────────────────

export function presetHero(): EmailSection {
  return makeSection(
    'full',
    [[
      makeLogoBlock({ isGlobal: true }),
      makeSpacerBlock(16),
      makeHeadingBlock('Your headline here'),
      makeBodyBlock('Supporting copy that tells your reader exactly what they get.'),
      makeSpacerBlock(8),
      makeButtonBlock('Shop Now', '#'),
    ]],
    {
      label: 'Hero',
      styles: { backgroundColor: '#F9FAFB', padding: { top: 40, right: 32, bottom: 40, left: 32 } },
    },
  )
}

export function presetImageText(): EmailSection {
  return makeSection(
    'image-left',
    [
      [makeImageBlock('/placeholder-image.png', 'Feature image')],
      [
        makeSpacerBlock(16),
        makeHeadingBlock('Feature headline'),
        makeBodyBlock('Short description of the feature or product benefit.'),
        makeButtonBlock('Learn More', '#'),
      ],
    ],
    { label: 'Image + Text' },
  )
}

export function presetTwoColumn(): EmailSection {
  return makeSection(
    'two-col',
    [
      [
        makeImageBlock('/placeholder-image.png', 'Product A'),
        makeBodyBlock('Product A'),
        makeButtonBlock('Buy Now', '#'),
      ],
      [
        makeImageBlock('/placeholder-image.png', 'Product B'),
        makeBodyBlock('Product B'),
        makeButtonBlock('Buy Now', '#'),
      ],
    ],
    { label: '2-Column Products' },
  )
}

export function presetBodyText(): EmailSection {
  return makeSection(
    'full',
    [[
      makeHeadingBlock('Section title'),
      makeBodyBlock('Add your body copy here. Keep it concise and focused on one idea.'),
    ]],
    { label: 'Body Text' },
  )
}

// ─── Default document ─────────────────────────────────────────────────────────

export function createDefaultDocument(): EmailDocument {
  const g = DEFAULT_GLOBAL_STYLES
  return {
    id: nanoid(),
    subject: 'Your email subject',
    preheader: 'Preview text shown in inbox',
    sections: [presetHero(), presetBodyText()],
    unsubscribe: makeUnsubscribeBlock(g),
    globalStyles: g,
  }
}
