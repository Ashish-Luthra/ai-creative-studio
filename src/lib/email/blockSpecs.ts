/**
 * blockSpecs.ts — Single source of truth for every prebuilt block's visual constants.
 *
 * PROBLEM THIS FILE SOLVES
 * ─────────────────────────
 * Every prebuilt block has two renderers that must produce identical visuals:
 *   1. EmailEditorPanel.tsx  — React/Tailwind canvas preview
 *   2. canvasConverter.ts    — table-based email HTML
 *
 * Before this file, each renderer hardcoded its own values independently.
 * A single typo (e.g. 40/60 column split instead of 25/75) caused the mismatch
 * the user sees as "editor and preview don't match."
 *
 * NOW: both renderers import from here.  Changing a value in one spec object
 * automatically updates BOTH the canvas preview AND the compiled email output.
 * A mismatch between the two is structurally impossible for any value defined here.
 *
 * USAGE
 * ─────
 * Canvas (EmailEditorPanel.tsx):
 *   import { SPECS } from '@/lib/email/blockSpecs'
 *   const S = SPECS.TESTIMONIAL
 *   <div style={{ backgroundColor: S.bgColor, padding: S.outerPaddingH }}>
 *
 * Converter (canvasConverter.ts):
 *   import { SPECS } from '@/lib/email/blockSpecs'
 *   const S = SPECS.TESTIMONIAL
 *   styles: sectionStyles(cb, { top: S.outerPaddingV, right: S.outerPaddingH, ... }, S.bgColor)
 *
 * ADDING NEW BLOCKS
 * ─────────────────
 * 1. Add a new key to SPECS below with all visual constants.
 * 2. Write the canvas component reading from the spec.
 * 3. Write the converter function reading from the spec.
 * 4. Add tests to canvasConverter.test.ts.
 * Never hardcode a visual value in either renderer — put it here first.
 *
 * TAILWIND REFERENCE (used as comments throughout)
 * ──────────────────────────────────────────────────
 *   text-sm   = 14px   text-xl  = 20px   text-2xl = 24px
 *   text-3xl  = 30px   text-4xl = 36px   text-5xl = 48px
 *   p-8 = 32px  p-12 = 48px  gap-8 = 32px
 *   bg-white     = #FFFFFF   bg-gray-50  = #F9FAFB
 *   bg-gray-100  = #F3F4F6   bg-gray-200 = #E5E7EB
 *   text-gray-400 = #9CA3AF  text-gray-500 = #6B7280
 *   text-gray-600 = #4B5563  text-yellow-400 = #FBBF24
 */

// ─── Padding helper ───────────────────────────────────────────────────────────

export type Pad4 = { top: number; right: number; bottom: number; left: number }

function pad(all: number): Pad4 { return { top: all, right: all, bottom: all, left: all } }
function padXY(h: number, v: number): Pad4 { return { top: v, right: h, bottom: v, left: h } }
function padTRBL(t: number, r: number, b: number, l: number): Pad4 { return { top: t, right: r, bottom: b, left: l } }

// ─── Block specs ─────────────────────────────────────────────────────────────

export const SPECS = {

  // ── "From The 'Gram" — image-left-text-right ─────────────────────────────
  // Canvas: flex min-h-[300px]; image w-1/2 self-stretch; text w-1/2 p-12 items-center gap-4
  IMAGE_LEFT_TEXT_RIGHT: {
    // Layout
    imageColPct:          50,          // w-1/2
    textColPct:           50,          // w-1/2
    textPaddingH:         48,          // p-12 horizontal
    textPaddingV:         24,          // inner top/bottom spacer inside the column
    sectionPadding:       pad(0),      // image bleeds edge-to-edge
    // Image
    imageKey:             'main',
    defaultImageSrc:      'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?w=400&h=500&fit=crop',
    // Tagline  — "From The 'Gram"
    taglineFontSize:      14,          // text-sm
    taglineColor:         '#6B7280',   // text-gray-500
    taglineItalic:        true,
    // Heading  — "The Post That Got Everyone Talking"
    headingFontSize:      30,          // text-3xl
    headingWeight:        '400',       // font-serif text-3xl (no font-bold in original)
    // Divider  — h-px w-16
    dividerColor:         '#9CA3AF',   // bg-gray-400
    // Button
    buttonLabel:          'SEE IT',
    buttonAlign:          'center' as const,
  },

  // ── Centered card — centered-content ─────────────────────────────────────
  // Canvas: outer bg-gray-100 p-12 text-center; inner white card rounded p-8 shadow-sm
  CENTERED_CONTENT: {
    // Section
    outerBg:              '#F3F4F6',   // bg-gray-100
    outerPadding:         pad(48),     // p-12
    // Card (white, rounded, inset)
    cardBg:               '#FFFFFF',
    cardBorderRadius:     8,           // rounded
    cardPadding:          32,          // p-8
    // Number  — "6"
    numberFontSize:       48,          // text-5xl
    numberColor:          '#4B5563',   // text-gray-600
    numberLineHeight:     1,
    // Heading — "Tips to Photograph Food"
    headingFontSize:      24,          // text-2xl
    headingWeight:        '400',       // font-serif text-2xl (no font-bold in original)
    // Body
    bodyFontSize:         14,          // text-sm
    bodyColor:            '#4B5563',   // text-gray-600
    bodyMaxWidthPx:       280,         // max-w-xs ≈ 280px at 600px container
    bodyLineHeight:       1.6,
    // Label  — "001"
    labelFontSize:        14,          // text-sm
    labelColor:           '#9CA3AF',   // text-gray-400
    // Button
    buttonLabel:          'READ IT',
    buttonAlign:          'center' as const,
  },

  // ── Text + decorative lines above image — text-over-image ─────────────────
  // Canvas: bg-white; text area p-12 text-center; image full-width below text
  TEXT_OVER_IMAGE: {
    // Section
    bgColor:              '#FFFFFF',
    sectionPadding:       padTRBL(48, 48, 0, 48),  // p-12 on text, 0 bottom so image bleeds
    // Dividers — h-px w-16 bg-black
    dividerColor:         '#000000',
    // Heading — "A Little Gift of Thanks…"
    headingFontSize:      24,          // text-2xl
    headingWeight:        '700',
    headingTracking:      '0.1em',     // tracking-widest
    headingUppercase:     true,
    // Button
    buttonLabel:          'CLAIM GIFT',
    buttonAlign:          'center' as const,
    buttonPadding:        padXY(32, 10),  // px-8 py-2.5
    // Image
    imageKey:             'bg',
    defaultImageSrc:      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=680&h=400&fit=crop',
    defaultImageHeight:   256,
  },

  // ── Welcome — text-left-image-right ──────────────────────────────────────
  // Canvas: flex min-h-[300px]; text w-1/3 p-12 items-center gap-6; image w-2/3
  TEXT_LEFT_IMAGE_RIGHT: {
    // Layout
    textColPct:           33,          // w-1/3
    imageColPct:          67,          // w-2/3
    textPaddingH:         48,          // p-12 horizontal
    textPaddingV:         24,          // inner spacer
    sectionPadding:       pad(0),
    // Heading — "WEL—COME"
    headingFontSize:      36,          // text-4xl
    headingWeight:        '700',
    headingLineHeight:    1.25,        // leading-tight
    // Button
    buttonLabel:          'EXPLORE',
    buttonAlign:          'left' as const,
    // Image
    imageKey:             'bg',
    defaultImageSrc:      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&h=400&fit=crop',
    defaultImageHeight:   300,
  },

  // ── Recipe — recipe-card ──────────────────────────────────────────────────
  // Canvas: flex min-h-[280px] gap-8 bg-white p-8; image w-1/2; text w-1/2 px-4
  RECIPE_CARD: {
    // Section
    bgColor:              '#FFFFFF',
    sectionPadding:       pad(0),      // padding handled inside columns
    // Layout
    imageColPct:          50,          // w-1/2
    textColPct:           50,          // w-1/2
    textInnerSpacerV:     16,          // top/bottom spacer inside text column
    // Image
    imageKey:             'main',
    defaultImageSrc:      'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&h=400&fit=crop',
    defaultImageHeight:   240,
    // Label  — "One"
    labelFontSize:        14,          // text-sm
    labelColor:           '#6B7280',   // text-gray-500
    labelItalic:          true,
    // Heading — "Click here for my creamy butternut squash soup"
    headingFontSize:      20,          // text-xl
    headingWeight:        '400',       // font-serif text-xl (no font-bold in original)
    // Description
    descFontSize:         14,          // text-sm
    descColor:            '#6B7280',   // text-gray-500
    descItalic:           true,
    // Button
    buttonLabel:          'GET RECIPE',
    buttonAlign:          'left' as const,
  },

  // ── Image + CTA — image-top-text-bottom ───────────────────────────────────
  // Canvas: full-width image on bg-white; text section bg-gray-100 p-12 text-center
  IMAGE_TOP_TEXT_BOTTOM: {
    // Image section
    imageSectionBg:       '#FFFFFF',
    imageKey:             'main',
    defaultImageSrc:      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=680&h=400&fit=crop',
    defaultImageHeight:   384,
    // Text section
    textBg:               '#F3F4F6',   // bg-gray-100
    textPadding:          pad(48),     // p-12
    // Heading — "Get 25% off when you book my services"
    headingFontSize:      24,          // text-2xl
    headingWeight:        '400',       // font-serif text-2xl (no font-bold in original)
    headingBottomMargin:  12,          // mb-3
    // Body
    bodyFontSize:         14,          // text-sm
    bodyColor:            '#6B7280',   // text-gray-500
    bodyItalic:           true,
    // Button
    buttonLabel:          'BOOK NOW',
    buttonAlign:          'center' as const,
    buttonPadding:        padXY(32, 10),  // px-8 py-2.5
    buttonSpacerV:        8,
  },

  // ── Social proof — testimonial ────────────────────────────────────────────
  // Canvas: flex min-h-[200px] gap-8 bg-gray-50 p-12; avatar w-32 shrink-0 circular
  TESTIMONIAL: {
    // Section
    bgColor:              '#F9FAFB',   // bg-gray-50
    sectionPadding:       padTRBL(32, 48, 32, 48),  // approx p-12 vertically smaller
    innerSpacerV:         8,           // spacer inside each column
    // Avatar column
    avatarKey:            'avatar',
    defaultAvatarSrc:     'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop',
    avatarWidth:          128,         // w-32
    avatarBorderRadius:   64,          // 50% → circular
    avatarColPct:         25,          // ~150px of 600px
    // Text column
    textColPct:           75,
    // Name  — "TESTIMONIAL NAME"
    nameFontSize:         14,          // text-sm
    nameWeight:           '700',
    nameTracking:         '0.1em',     // tracking-widest
    nameUppercase:        true,
    // Quote
    quoteFontSize:        14,          // text-sm
    quoteLineHeight:      1.6,         // leading-relaxed
    quoteColor:           '#4B5563',   // text-gray-600
    // Stars
    starFontSize:         20,          // text-xl  (canvas uses text-xl; converter uses 20px)
    starColor:            '#FBBF24',   // text-yellow-400
    starsHtml:            '&#9733;&#9733;&#9733;&#9733;&#9734;',
    starsText:            '★★★★☆',
  },

} as const

export type BlockSpecKey = keyof typeof SPECS
