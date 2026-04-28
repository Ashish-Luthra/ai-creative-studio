/**
 * Google Fonts registry for the canvas font picker and email compiler.
 *
 * GOOGLE_FONT_FAMILIES — full catalogue loaded in the browser UI.
 * TOP_30_FONTS          — the 30 most popular families (2024 Google Fonts stats).
 *
 * Both lists are sorted alphabetically so the font picker is easy to navigate.
 * Fonts are loaded in the root layout via batched CSS URLs (URL length limits).
 */

// ─── Top 30 by popularity ─────────────────────────────────────────────────────
// Source: fonts.google.com analytics (2024 ranking). These are the fonts
// most likely to render correctly across email clients that support web fonts
// (Apple Mail, Gmail web, Outlook iOS/Android, Yahoo Mail).

export const TOP_30_FONTS: readonly string[] = [
  'Barlow',
  'Cabin',
  'DM Sans',
  'Dancing Script',
  'EB Garamond',
  'Fira Sans',
  'Inter',
  'Josefin Sans',
  'Karla',
  'Lato',
  'Libre Baskerville',
  'Lora',
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Noto Sans',
  'Noto Serif',
  'Nunito',
  'Nunito Sans',
  'Open Sans',
  'Oswald',
  'PT Sans',
  'Playfair Display',
  'Poppins',
  'PT Serif',
  'Raleway',
  'Roboto',
  'Roboto Condensed',
  'Roboto Slab',
  'Rubik',
  'Work Sans',
].sort((a, b) => a.localeCompare(b))

// ─── Full catalogue ───────────────────────────────────────────────────────────
// Canvas font picker shows all families. Any family used in an email document
// will be @import-ed into the compiled HTML automatically.

export const GOOGLE_FONT_FAMILIES: readonly string[] = [
  // ── Core / top 30 ──────────────────────────────────────────────────────────
  'Barlow',
  'Cabin',
  'DM Sans',
  'Dancing Script',
  'EB Garamond',
  'Fira Sans',
  'Inter',
  'Josefin Sans',
  'Karla',
  'Lato',
  'Libre Baskerville',
  'Lora',
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Noto Sans',
  'Noto Serif',
  'Nunito',
  'Nunito Sans',
  'Open Sans',
  'Oswald',
  'PT Sans',
  'PT Serif',
  'Playfair Display',
  'Poppins',
  'Raleway',
  'Roboto',
  'Roboto Condensed',
  'Roboto Slab',
  'Rubik',
  'Work Sans',
  // ── Extended catalogue ──────────────────────────────────────────────────────
  'Archivo',
  'Archivo Black',
  'Arvo',
  'Barlow Condensed',
  'Bebas Neue',
  'Bitter',
  'Catamaran',
  'Comfortaa',
  'Cormorant Garamond',
  'Crimson Text',
  'Domine',
  'Exo 2',
  'Figtree',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Kanit',
  'Lexend',
  'Libre Franklin',
  'Lobster',
  'Manrope',
  'Outfit',
  'Oxygen',
  'Pacifico',
  'Plus Jakarta Sans',
  'Quicksand',
  'Sora',
  'Source Sans 3',
  'Source Serif 4',
  'Space Grotesk',
  'Spectral',
  'Teko',
  'Titillium Web',
  'Ubuntu',
  'Zilla Slab',
].sort((a, b) => a.localeCompare(b))

// ─── URL builders ─────────────────────────────────────────────────────────────

function familyQueryParam(name: string): string {
  const slug = name.replace(/\s+/g, '+')
  return `family=${slug}:wght@300;400;500;600;700`
}

/** Split into batches so each stylesheet URL stays within practical limits. */
function chunkFamilies(families: readonly string[], maxParamChars = 1700): string[][] {
  const batches: string[][] = []
  let batch: string[] = []
  let paramLen = 0

  for (const name of families) {
    const piece = familyQueryParam(name).length + 1
    if (batch.length > 0 && paramLen + piece > maxParamChars) {
      batches.push(batch)
      batch = []
      paramLen = 0
    }
    batch.push(name)
    paramLen += piece
  }
  if (batch.length) batches.push(batch)
  return batches
}

/**
 * Returns batched <link> href values for the full font catalogue.
 * Used in the Next.js root layout so every font is available in the browser UI.
 */
export function getGoogleFontStylesheetHrefs(): string[] {
  return chunkFamilies(GOOGLE_FONT_FAMILIES).map(
    (names) =>
      `https://fonts.googleapis.com/css2?${names.map(familyQueryParam).join('&')}&display=swap`,
  )
}

/**
 * Generates a single Google Fonts @import URL for a specific set of families.
 * Used by the email compiler to embed only the fonts actually present in a
 * document — keeps email file size down and avoids loading unused fonts.
 *
 * Only families that appear in GOOGLE_FONT_FAMILIES are included; system fonts
 * (Arial, Helvetica, etc.) are silently skipped.
 *
 * Weights loaded: 300, 400, 500, 600, 700 — covers all fontWeight values the
 * editor supports.
 *
 * @returns URL string, or empty string if no recognisable Google Fonts are used.
 */
export function getEmailFontImportUrl(families: readonly string[]): string {
  const googleSet = new Set(GOOGLE_FONT_FAMILIES)
  const valid = [...new Set(families)].filter((f) => googleSet.has(f))
  if (!valid.length) return ''
  const params = valid.map(familyQueryParam).join('&')
  return `https://fonts.googleapis.com/css2?${params}&display=swap`
}
