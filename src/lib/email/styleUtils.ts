/**
 * styleUtils.ts — pure helpers for converting email type primitives to
 * inline CSS objects used by react-email renderers.
 *
 * No React dependencies — importable in both browser and Node compile context.
 */

import type { Border, Padding, SectionLayout } from '@/types/email'

// ─── CSS helpers ────────────────────────────────────────────────────────────

/** Converts a Padding object to React inline style keys */
export function paddingToInline(p: Padding): Record<string, string> {
  return {
    paddingTop: `${p.top}px`,
    paddingRight: `${p.right}px`,
    paddingBottom: `${p.bottom}px`,
    paddingLeft: `${p.left}px`,
  }
}

/** Converts a Border object to a border shorthand + optional borderRadius */
export function borderToInline(b?: Border): Record<string, string> {
  if (!b || b.style === 'none' || b.width === 0) return {}
  return {
    border: `${b.width}px ${b.style} ${b.color}`,
    ...(b.radius !== undefined ? { borderRadius: `${b.radius}px` } : {}),
  }
}

/**
 * Builds an email-safe font stack.
 * Puts the requested family first, falls back to the global default,
 * then safe web-safe fonts.
 */
export function buildFontStack(primary: string, globalFallback: string): string {
  const quote = (f: string) => (f.includes(' ') ? `'${f}'` : f)
  const seen = new Set<string>()
  const stack: string[] = []
  for (const f of [primary, globalFallback, 'Arial', 'Helvetica', 'sans-serif']) {
    const trimmed = f.trim()
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed)
      stack.push(quote(trimmed))
    }
  }
  return stack.join(', ')
}

// ─── Layout helpers ──────────────────────────────────────────────────────────

/**
 * Returns the column width percentages for a given SectionLayout.
 * Values always sum to 100.
 */
export function layoutToColumnWidths(layout: SectionLayout): number[] {
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

// ─── Default values ──────────────────────────────────────────────────────────

import type { Padding as PaddingType } from '@/types/email'

export const DEFAULT_SECTION_PADDING: PaddingType = { top: 20, right: 20, bottom: 20, left: 20 }
export const DEFAULT_TEXT_PADDING: PaddingType    = { top: 8,  right: 16, bottom: 8,  left: 16 }
export const DEFAULT_BUTTON_PADDING: PaddingType  = { top: 14, right: 32, bottom: 14, left: 32 }
export const DEFAULT_IMAGE_PADDING: PaddingType   = { top: 0,  right: 0,  bottom: 0,  left: 0  }
