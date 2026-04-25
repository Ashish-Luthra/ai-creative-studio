/**
 * Standard Google Fonts for the canvas font picker.
 * Loaded in root layout via batched CSS URLs (Google URL length limits).
 */
export const GOOGLE_FONT_FAMILIES: readonly string[] = [
  'Archivo',
  'Archivo Black',
  'Arvo',
  'Barlow',
  'Bebas Neue',
  'Bitter',
  'Cabin',
  'Catamaran',
  'Comfortaa',
  'Cormorant Garamond',
  'Crimson Text',
  'DM Sans',
  'Dancing Script',
  'Domine',
  'EB Garamond',
  'Exo 2',
  'Figtree',
  'Fira Sans',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Inter',
  'Josefin Sans',
  'Kanit',
  'Karla',
  'Lato',
  'Lexend',
  'Libre Baskerville',
  'Libre Franklin',
  'Lobster',
  'Lora',
  'Manrope',
  'Merriweather',
  'Montserrat',
  'Mulish',
  'Noto Sans',
  'Noto Serif',
  'Nunito',
  'Open Sans',
  'Oswald',
  'Outfit',
  'Oxygen',
  'Pacifico',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Poppins',
  'PT Sans',
  'PT Serif',
  'Quicksand',
  'Raleway',
  'Roboto',
  'Rubik',
  'Source Sans 3',
  'Source Serif 4',
  'Space Grotesk',
  'Spectral',
  'Sora',
  'Teko',
  'Titillium Web',
  'Ubuntu',
  'Work Sans',
  'Zilla Slab',
].sort((a, b) => a.localeCompare(b))

function familyQueryParam(name: string): string {
  const slug = name.replace(/\s+/g, '+')
  return `family=${slug}:wght@400;700`
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

export function getGoogleFontStylesheetHrefs(): string[] {
  return chunkFamilies(GOOGLE_FONT_FAMILIES).map(
    (names) =>
      `https://fonts.googleapis.com/css2?${names.map(familyQueryParam).join('&')}&display=swap`,
  )
}
