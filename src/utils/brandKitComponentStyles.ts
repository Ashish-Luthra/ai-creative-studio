/**
 * Resolves design-token names to values and maps them to UI component slots (BrandKit spec.components).
 * Token names in the token tables must match the keys expected per component (e.g. primary-color, radius).
 */

export const BRAND_KIT_COMPONENT_DEFS = [
  { id: 'button', labelKey: 'brand.brandKitDrawerContent.components.componentLabels.button', tokenKeys: ['primary-color', 'text-color', 'radius'] as const },
  { id: 'input', labelKey: 'brand.brandKitDrawerContent.components.componentLabels.input', tokenKeys: ['border-color', 'bg-color', 'radius'] as const },
  { id: 'chip', labelKey: 'brand.brandKitDrawerContent.components.componentLabels.chip', tokenKeys: ['bg-color', 'text-color', 'radius'] as const },
  { id: 'table', labelKey: 'brand.brandKitDrawerContent.components.componentLabels.table', tokenKeys: ['border-color', 'row-bg', 'header-bg'] as const },
  { id: 'drawer', labelKey: 'brand.brandKitDrawerContent.components.componentLabels.drawer', tokenKeys: ['bg-color', 'border-color', 'shadow'] as const },
] as const;

export type BrandKitComponentId = (typeof BRAND_KIT_COMPONENT_DEFS)[number]['id'];

export type TokenRow = { name: string; value: string };

/**
 * Token matching aliases used by style-resolution logic.
 * These are technical token identifiers (not UI copy), so they should remain raw keys and must not be translated.
 */
const TOKEN_ALIASES: Record<string, readonly string[]> = {
  'primary-color': ['primary', 'brand-primary', 'primaryColor', 'accent', 'brand'],
  'text-color': ['text', 'on-primary', 'foreground', 'body-text'],
  'border-color': ['border', 'outline', 'stroke'],
  'bg-color': ['background', 'surface', 'bg', 'fill'],
  radius: ['radius-md', 'corner-radius', 'rounding', 'radii'],
  'row-bg': ['row', 'surface', 'zebra'],
  'header-bg': ['header', 'header-background', 'thead'],
  shadow: ['elevation', 'shadow-md', 'box-shadow'],
};

/** Flatten color/spacing/radius/shadow rows into a name → value map (first wins on duplicate names). */
export function buildTokenLookup(rows: {
  colors?: TokenRow[];
  spacing?: TokenRow[];
  radius?: TokenRow[];
  shadows?: TokenRow[];
}): Record<string, string> {
  const out: Record<string, string> = {};
  const buckets: TokenRow[][] = [
    rows.colors ?? [],
    rows.spacing ?? [],
    rows.radius ?? [],
    rows.shadows ?? [],
  ];
  for (const list of buckets) {
    for (const row of list) {
      const key = (row.name ?? '').trim();
      if (!key) continue;
      if (!(key in out)) out[key] = row.value ?? '';
    }
  }
  return out;
}

/** Resolve a token key to a value; tries aliases, then hyphen prefixes. */
export function resolveTokenValue(lookup: Record<string, string>, tokenKey: string): string {
  const direct = lookup[tokenKey];
  if (direct != null && direct !== '') return direct;
  const aliases = TOKEN_ALIASES[tokenKey];
  if (aliases) {
    for (const a of aliases) {
      const v = lookup[a];
      if (v != null && v !== '') return v;
    }
  }
  const parts = tokenKey.split('-');
  for (let i = parts.length; i > 0; i--) {
    const candidate = parts.slice(0, i).join('-');
    const v = lookup[candidate];
    if (v != null && v !== '') return v;
  }
  return '';
}

export interface BrandKitComponentStylesResult {
  generatedAt: string;
  mappings: Record<string, Record<string, string>>;
}

/** Produce a persisted `spec.components` shape from current token rows. */
export function generateBrandKitComponentStyles(rows: {
  colors?: TokenRow[];
  spacing?: TokenRow[];
  radius?: TokenRow[];
  shadows?: TokenRow[];
}): BrandKitComponentStylesResult {
  const lookup = buildTokenLookup(rows);
  const mappings: Record<string, Record<string, string>> = {};
  for (const def of BRAND_KIT_COMPONENT_DEFS) {
    const slot: Record<string, string> = {};
    for (const tk of def.tokenKeys) {
      slot[tk] = resolveTokenValue(lookup, tk);
    }
    mappings[def.id] = slot;
  }
  return {
    generatedAt: new Date().toISOString(),
    mappings,
  };
}
