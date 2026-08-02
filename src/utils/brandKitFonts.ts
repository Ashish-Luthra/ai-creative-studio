/**
 * Brand Kit typography font list.
 *
 * - **Display labels** (`labelKey`): User-facing; resolve with `t(labelKey)` and `useTranslation('admin')`.
 * - **Stacks** (`stack`): CSS `font-family` values for preview/rendering. These are *not* translated:
 *   quoted segments must match webfont/CSS family names the browser resolves. They are technical data,
 *   same class as hex colors or MIME types — keep them here in one place per font id.
 */
type BrandKitFontDef = {
  readonly value: string;
  readonly labelKey: string;
  /** Full CSS `font-family` stack (technical, not i18n). */
  readonly stack: string;
};

const BRAND_KIT_FONT_DEFS: readonly BrandKitFontDef[] = [
  {
    value: 'inter',
    labelKey: 'brand.brandKitForm.fonts.inter',
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    value: 'system',
    labelKey: 'brand.brandKitForm.fonts.system',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    value: 'roboto',
    labelKey: 'brand.brandKitForm.fonts.roboto',
    stack: '"Roboto", ui-sans-serif, sans-serif',
  },
  {
    value: 'open-sans',
    labelKey: 'brand.brandKitForm.fonts.openSans',
    stack: '"Open Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'lato',
    labelKey: 'brand.brandKitForm.fonts.lato',
    stack: '"Lato", ui-sans-serif, sans-serif',
  },
  {
    value: 'montserrat',
    labelKey: 'brand.brandKitForm.fonts.montserrat',
    stack: '"Montserrat", ui-sans-serif, sans-serif',
  },
  {
    value: 'source-sans-3',
    labelKey: 'brand.brandKitForm.fonts.sourceSans3',
    stack: '"Source Sans 3", "Source Sans Pro", ui-sans-serif, sans-serif',
  },
  {
    value: 'nunito-sans',
    labelKey: 'brand.brandKitForm.fonts.nunitoSans',
    stack: '"Nunito Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'work-sans',
    labelKey: 'brand.brandKitForm.fonts.workSans',
    stack: '"Work Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'poppins',
    labelKey: 'brand.brandKitForm.fonts.poppins',
    stack: '"Poppins", ui-sans-serif, sans-serif',
  },
  {
    value: 'dm-sans',
    labelKey: 'brand.brandKitForm.fonts.dmSans',
    stack: '"DM Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'raleway',
    labelKey: 'brand.brandKitForm.fonts.raleway',
    stack: '"Raleway", ui-sans-serif, sans-serif',
  },
  {
    value: 'merriweather',
    labelKey: 'brand.brandKitForm.fonts.merriweather',
    stack: '"Merriweather", ui-serif, Georgia, serif',
  },
  {
    value: 'playfair-display',
    labelKey: 'brand.brandKitForm.fonts.playfairDisplay',
    stack: '"Playfair Display", ui-serif, Georgia, serif',
  },
  {
    value: 'libre-baskerville',
    labelKey: 'brand.brandKitForm.fonts.libreBaskerville',
    stack: '"Libre Baskerville", ui-serif, Georgia, serif',
  },
  {
    value: 'jetbrains-mono',
    labelKey: 'brand.brandKitForm.fonts.jetbrainsMono',
    stack: '"JetBrains Mono", ui-monospace, monospace',
  },
  {
    value: 'ibm-plex-sans',
    labelKey: 'brand.brandKitForm.fonts.ibmPlexSans',
    stack: '"IBM Plex Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'noto-sans',
    labelKey: 'brand.brandKitForm.fonts.notoSans',
    stack: '"Noto Sans", ui-sans-serif, sans-serif',
  },
  {
    value: 'noto-serif',
    labelKey: 'brand.brandKitForm.fonts.notoSerif',
    stack: '"Noto Serif", ui-serif, Georgia, serif',
  },
];

export type BrandKitFontOption = Pick<BrandKitFontDef, 'value' | 'labelKey'>;

/** Select options: `value` + i18n `labelKey` only (no CSS stacks). */
export const BRAND_KIT_FONT_OPTIONS: readonly BrandKitFontOption[] = BRAND_KIT_FONT_DEFS.map(({ value, labelKey }) => ({
  value,
  labelKey,
}));

export function brandKitFontStack(fontFamily: string | undefined): string | undefined {
  if (!fontFamily?.trim()) return undefined;
  const t = fontFamily.trim();
  const def = BRAND_KIT_FONT_DEFS.find((d) => d.value === t);
  if (def) return def.stack;
  // Extraction / API may store a full CSS stack or family list — use as-is for preview.
  return t;
}

/** Map extracted font CSS / label text to a `BrandKitFormState.typography.fontFamily` select value when possible. */
export function resolveBrandKitFontSelectValue(recommended: string | undefined): string | undefined {
  if (!recommended?.trim()) return undefined;
  const n = recommended.trim().toLowerCase();
  for (const d of BRAND_KIT_FONT_DEFS) {
    if (n === d.value || n === d.value.replace(/-/g, ' ')) return d.value;
    const quoted = d.stack.match(/"([^"]+)"/)?.[1]?.toLowerCase();
    if (quoted && n.includes(quoted)) return d.value;
  }
  return undefined;
}
