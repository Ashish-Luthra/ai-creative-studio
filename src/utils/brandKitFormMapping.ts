import type { BrandKit, UpdateBrandKitRequest } from '../hooks/useAdmin';
import type { BrandKitFormState } from '../components/Admin/brand-center/BrandKitDrawerContent';
import type { ExtractionCandidateRow } from './mapBrandExtractionResultToReviewRows';
import { resolveBrandKitFontSelectValue } from './brandKitFonts';
import { generateBrandKitComponentStyles } from './brandKitComponentStyles';
import type { BrandKitCanonicalLogo } from '../components/Admin/brand-center/BrandKitLogosTabContent';

/** Workspace IDs for the brand kit form: detail fields, then ownerRef, then list fallback. */
export function resolveBrandKitWorkspaceIds(kit: Pick<BrandKit, 'appliesToWorkspaces' | 'workspacesUsing' | 'ownerRef'>): string[] {
  const fromSpec = kit.appliesToWorkspaces;
  if (Array.isArray(fromSpec) && fromSpec.length > 0) {
    return [...fromSpec];
  }
  const ref = kit.ownerRef;
  if (ref?.ownerType === 'workspace' && ref.workspaceId) {
    return [ref.workspaceId];
  }
  if (kit.workspacesUsing?.length) {
    return [kit.workspacesUsing[0]];
  }
  return [];
}

function stringifyTokenPrimitive(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/** Parse a single token row object (flexible field names from IR / extraction). */
function tokenRowFromObject(o: Record<string, unknown>): { name: string; value: string } | null {
  const nameRaw =
    o.name ??
    o.key ??
    o.token ??
    o.id ??
    o.label ??
    (typeof o.path === 'string' ? o.path : undefined);
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
  if (!name) return null;

  let value = '';
  if (typeof o.value === 'string') value = o.value;
  else if (typeof o.value === 'number' || typeof o.value === 'boolean') value = String(o.value);
  else if (typeof o.hex === 'string') value = o.hex;
  else if (typeof o.val === 'string') value = o.val;
  else if (typeof o.css === 'string') value = o.css;
  else if (o.value && typeof o.value === 'object') {
    const inner = o.value as Record<string, unknown>;
    if (typeof inner.hex === 'string') value = inner.hex;
    else if (typeof inner.text === 'string') value = inner.text;
  }
  return { name, value: value.trim() };
}

/**
 * Normalize a token category from API/IR into UI rows.
 * Supports: `{ name, value }[]`, record maps, and common alternate row shapes.
 */
export function normalizeTokenTable(raw: unknown): { name: string; value: string }[] {
  if (raw == null) return [];

  if (Array.isArray(raw)) {
    const out: { name: string; value: string }[] = [];
    for (const row of raw) {
      if (row == null) continue;
      if (typeof row === 'string') {
        const t = row.trim();
        if (t) out.push({ name: t, value: t });
        continue;
      }
      if (typeof row === 'number' || typeof row === 'boolean') {
        const s = String(row);
        out.push({ name: s, value: s });
        continue;
      }
      if (typeof row === 'object') {
        const parsed = tokenRowFromObject(row as Record<string, unknown>);
        if (parsed && (parsed.name || parsed.value)) out.push(parsed);
      }
    }
    return out;
  }

  if (typeof raw === 'object') {
    const out: { name: string; value: string }[] = [];
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const name = k.trim();
      if (!name) continue;
      if (v == null) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out.push({ name, value: stringifyTokenPrimitive(v) });
        continue;
      }
      if (typeof v === 'object' && !Array.isArray(v)) {
        const parsed = tokenRowFromObject({ name, ...(v as Record<string, unknown>) });
        if (parsed && parsed.value) out.push(parsed);
        else if (typeof (v as Record<string, unknown>).hex === 'string') {
          out.push({ name, value: (v as { hex: string }).hex });
        }
      }
    }
    return out;
  }

  return [];
}

const TYPE_SCALE_IDS = ['h1', 'h2', 'h3', 'body', 'caption'] as const;

function normalizeKeyForMerge(raw: string): string {
  return raw.trim().toLowerCase().replace(/[.\-]/g, '_').replace(/\s+/g, '_').replace(/_+/g, '_');
}

function inferTokenBucketFromType(rawType: string): 'colors' | 'spacing' | 'radius' | 'shadows' {
  const k = normalizeKeyForMerge(rawType);
  if (k.includes('spacing') || k.includes('space')) return 'spacing';
  if (k.includes('radius') || k.includes('radii') || k.includes('corner')) return 'radius';
  if (k.includes('shadow') || k.includes('elevation')) return 'shadows';
  return 'colors';
}

export function upsertTokenRows(
  existing: { name: string; value: string }[] | undefined,
  incoming: { name: string; value: string }[]
): { name: string; value: string }[] {
  const map = new Map((existing ?? []).map((r) => [r.name.trim().toLowerCase(), { ...r }]));
  for (const row of incoming) {
    const key = row.name.trim().toLowerCase();
    if (!key) continue;
    map.set(key, { name: row.name.trim(), value: row.value });
  }
  return [...map.values()];
}

function mergeTokenRowsUnique(a: { name: string; value: string }[], b: { name: string; value: string }[]) {
  return upsertTokenRows(a, b);
}

/** Merge normalized rows from every present alternate spec key (e.g. `space` + `spacing`). */
function accumulateTokenTables(
  tokens: Record<string, unknown> | undefined,
  keys: string[],
): { name: string; value: string }[] {
  if (!tokens) return [];
  let acc: { name: string; value: string }[] = [];
  for (const k of keys) {
    acc = mergeTokenRowsUnique(acc, normalizeTokenTable(tokens[k]));
  }
  return acc;
}

function snakeToCamelKey(key: string): string {
  return key.replace(/_([a-z])/gi, (_, c: string) => c.toUpperCase());
}

const TYPE_SCALE_BASE = ['h1', 'h2', 'h3', 'body', 'caption'] as const;

/**
 * Map BrandKit spec.typography (loose object / nested scale / snake_case) into flat form fields.
 */
export function normalizeTypographyFromSpec(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: Record<string, string> = {};

  const setIf = (k: string, v: unknown) => {
    const s = stringifyTokenPrimitive(v).trim();
    if (!s) return;
    out[k] = s;
  };

  for (const [rawKey, val] of Object.entries(src)) {
    const key = snakeToCamelKey(rawKey.replace(/\s+/g, '_'));

    if (val != null && (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean')) {
      if (key === 'fontFamily' || key.toLowerCase() === 'fontfamily') setIf('fontFamily', val);
      else setIf(key, val);
      continue;
    }

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const o = val as Record<string, unknown>;
      const base = rawKey.replace(/[_\s-]/g, '').toLowerCase();
      const scale = TYPE_SCALE_BASE.find((id) => base === id || base === `${id}text` || base === `${id}style`);
      if (scale) {
        setIf(`${scale}Size`, o.size ?? o.fontSize ?? o.font_size ?? o.px);
        setIf(`${scale}Weight`, o.weight ?? o.fontWeight ?? o.font_weight);
        setIf(`${scale}LineHeight`, o.lineHeight ?? o.line_height);
        continue;
      }
    }
  }

  const aliasPairs: [string, string][] = [
    ['font_family', 'fontFamily'],
    ['fontFamily', 'fontFamily'],
    ['h1_size', 'h1Size'],
    ['h1Size', 'h1Size'],
    ['h1_weight', 'h1Weight'],
    ['h1Weight', 'h1Weight'],
    ['h2_size', 'h2Size'],
    ['h2_weight', 'h2Weight'],
    ['h3_size', 'h3Size'],
    ['h3_weight', 'h3Weight'],
    ['body_size', 'bodySize'],
    ['body_weight', 'bodyWeight'],
    ['caption_size', 'captionSize'],
    ['caption_weight', 'captionWeight'],
    ['font_family_heading', 'fontFamilyHeading'],
    ['fontFamilyHeading', 'fontFamilyHeading'],
    ['font_family_body', 'fontFamilyBody'],
    ['fontFamilyBody', 'fontFamilyBody'],
  ];
  for (const [from, to] of aliasPairs) {
    if (out[to]) continue;
    const v = src[from] ?? src[snakeToCamelKey(from)];
    setIf(to, v);
  }

  return out;
}

/**
 * Partition flat or semi-structured design token lists into UI token buckets when
 * the spec only has a combined list (e.g. extraction payloads).
 */
function partitionDesignTokenRows(
  rows: { name: string; value: string }[],
): {
  colors: { name: string; value: string }[];
  spacing: { name: string; value: string }[];
  radius: { name: string; value: string }[];
  shadows: { name: string; value: string }[];
} {
  const colors: { name: string; value: string }[] = [];
  const spacing: { name: string; value: string }[] = [];
  const radius: { name: string; value: string }[] = [];
  const shadows: { name: string; value: string }[] = [];
  for (const row of rows) {
    const bucket = inferTokenBucketFromType(row.name);
    if (bucket === 'spacing') spacing.push(row);
    else if (bucket === 'radius') radius.push(row);
    else if (bucket === 'shadows') shadows.push(row);
    else colors.push(row);
  }
  return { colors, spacing, radius, shadows };
}

/** IR spec.scope: org | workspace → UI select values */
export function brandKitScopeApiToUi(api: string | undefined | null): string {
  if (api === 'org') return 'org-wide';
  if (api === 'workspace') return 'workspace-specific';
  return '';
}

export function brandKitScopeUiToApi(ui: string): string {
  if (ui === 'org-wide') return 'org';
  if (ui === 'workspace-specific') return 'workspace';
  return 'workspace';
}

/** IR default_for_editions uses ecomm; UI uses ecommerce */
export function brandKitEditionApiToUi(arr: string[] | undefined | null): string {
  const x = arr?.[0];
  if (!x) return '';
  if (x === 'ecomm') return 'ecommerce';
  return x;
}

export function brandKitEditionUiToApi(edition: string): string[] {
  if (!edition || edition === 'none') return [];
  if (edition === 'ecommerce') return ['ecomm'];
  return [edition];
}

/** Map GET BrandKit detail into drawer form fields. */
export function brandKitDetailToFormPatch(detail: BrandKit): Partial<BrandKitFormState> {
  const tokens = detail.tokens as Record<string, unknown> | undefined;
  const components = detail.components as
    | { generatedAt?: string; mappings?: Record<string, Record<string, string>> }
    | undefined;

  const scopeUi = brandKitScopeApiToUi(detail.scope ?? undefined);
  const editionUi = brandKitEditionApiToUi(detail.defaultForEditions ?? undefined);
  const workspaces = resolveBrandKitWorkspaceIds(detail);

  const fromDesignTokens = partitionDesignTokenRows(
    normalizeTokenTable(tokens?.design_tokens ?? tokens?.designTokens),
  );

  const colors = mergeTokenRowsUnique(
    mergeTokenRowsUnique(
      normalizeTokenTable(tokens?.colors ?? tokens?.colour),
      accumulateTokenTables(tokens, ['palette', 'swatches', 'color_tokens', 'colorTokens']),
    ),
    fromDesignTokens.colors,
  );

  const spacing = mergeTokenRowsUnique(
    mergeTokenRowsUnique(
      normalizeTokenTable(tokens?.spacing),
      accumulateTokenTables(tokens, ['space', 'spaces', 'spacing_scale', 'spacingScale', 'spacings']),
    ),
    fromDesignTokens.spacing,
  );

  const radius = mergeTokenRowsUnique(
    mergeTokenRowsUnique(
      normalizeTokenTable(tokens?.radius),
      accumulateTokenTables(tokens, ['radii', 'border_radius', 'borderRadius', 'corners']),
    ),
    fromDesignTokens.radius,
  );

  const shadows = mergeTokenRowsUnique(
    mergeTokenRowsUnique(
      normalizeTokenTable(tokens?.shadows),
      accumulateTokenTables(tokens, ['shadow', 'elevations', 'elevation', 'box_shadows', 'boxShadows']),
    ),
    fromDesignTokens.shadows,
  );

  const typography = normalizeTypographyFromSpec(detail.typography);

  return {
    colors,
    spacing,
    radius,
    shadows,
    typography,
    componentStyleMappings:
      components?.mappings && typeof components.mappings === 'object' ? { ...components.mappings } : {},
    componentStylesGeneratedAt: typeof components?.generatedAt === 'string' ? components.generatedAt : undefined,
    owner: typeof detail.owner === 'string' ? detail.owner : '',
    scope: scopeUi,
    edition: editionUi,
    notes: typeof detail.notes === 'string' ? detail.notes : '',
    workspaces,
  };
}

function asCanonicalLogoName(rawType: string): BrandKitCanonicalLogo['variant'] {
  const k = normalizeKeyForMerge(rawType);
  if (k.includes('wordmark')) return 'wordmark';
  if (k.includes('icon') || k.includes('symbol')) return 'icon';
  if (k.includes('secondary') || k.includes('alt')) return 'secondary';
  return 'primary';
}

/** Merge accepted extraction review rows into editable token / typography form fields (until API persists them on the kit). */
export function mergeAcceptedExtractionIntoBrandKitForm(
  form: BrandKitFormState,
  rows: ExtractionCandidateRow[]
): Partial<BrandKitFormState> {
  const accepted = rows.filter((r) => r.uiStatus === 'accepted');
  if (accepted.length === 0) return {};

  const colorAdds: { name: string; value: string }[] = [];
  const spacingAdds: { name: string; value: string }[] = [];
  const radiusAdds: { name: string; value: string }[] = [];
  const shadowAdds: { name: string; value: string }[] = [];
  const logoAdds: BrandKitCanonicalLogo[] = [];
  const typo: Record<string, string> = {};

  for (const r of accepted) {
    if (r.section === 'colors') {
      const name = (r.type || 'color').replace(/\s+/g, '-').replace(/^-+|-+$/g, '') || 'color';
      const value = (r.recommended || '').trim();
      if (value && value !== '(empty)') {
        const bucket = inferTokenBucketFromType(r.type || '');
        if (bucket === 'spacing') spacingAdds.push({ name, value });
        else if (bucket === 'radius') radiusAdds.push({ name, value });
        else if (bucket === 'shadows') shadowAdds.push({ name, value });
        else colorAdds.push({ name, value });
      }
    } else if (r.section === 'typography') {
      const value = (r.recommended || '').trim();
      if (!value || value === '(empty)') continue;
      const typeRaw = (r.type || 'typography').trim();
      let typeLower = normalizeKeyForMerge(typeRaw)
        .replace(/^tokens_typography_/, '')
        .replace(/^typography_/, '')
        .replace(/^tokens_/, '');

      let mapped = false;
      for (const id of TYPE_SCALE_IDS) {
        const sizeKeys = new Set([
          `${id}size`,
          `${id}_size`,
          `${id}fontsize`,
          `${id}_fontsize`,
          `${id}_font_size`,
        ]);
        if (sizeKeys.has(typeLower)) {
          typo[`${id}Size`] = value;
          mapped = true;
          break;
        }
        const weightKeys = new Set([
          `${id}weight`,
          `${id}_weight`,
          `${id}fontweight`,
          `${id}_fontweight`,
          `${id}_font_weight`,
        ]);
        if (weightKeys.has(typeLower)) {
          typo[`${id}Weight`] = value;
          mapped = true;
          break;
        }
      }
      if (mapped) continue;

      const headingFontKey =
        typeLower === 'fontfamily_heading' ||
        typeLower.endsWith('_fontfamily_heading') ||
        typeLower === 'font_family_heading' ||
        (typeLower.includes('fontfamily') && typeLower.includes('heading')) ||
        (typeLower.includes('font_family') && typeLower.includes('heading'));
      if (headingFontKey) {
        const sel = resolveBrandKitFontSelectValue(value);
        typo.fontFamilyHeading = sel ?? value;
        continue;
      }

      const bodyFontKey =
        typeLower === 'fontfamily_body' ||
        typeLower.endsWith('_fontfamily_body') ||
        typeLower === 'font_family_body' ||
        (typeLower.includes('fontfamily') && typeLower.includes('body') && !typeLower.includes('fontsize')) ||
        (typeLower.includes('font_family') && typeLower.includes('body'));
      if (bodyFontKey) {
        const sel = resolveBrandKitFontSelectValue(value);
        typo.fontFamilyBody = sel ?? value;
        continue;
      }

      const looksFont =
        !/^(h1|h2|h3|body|caption)_/.test(typeLower) &&
        (typeLower === 'fontfamily' ||
          typeLower === 'font_family' ||
          typeLower.includes('typeface') ||
          (typeLower.includes('font') &&
            !typeLower.includes('size') &&
            !typeLower.includes('weight') &&
            !typeLower.includes('heading') &&
            !typeLower.includes('body')));
      if (looksFont) {
        const sel = resolveBrandKitFontSelectValue(value);
        typo.fontFamily = sel ?? value;
        continue;
      }

      const key = typeRaw
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '') || 'font';
      typo[key] = value;
    } else if (r.section === 'logos') {
      const src = (r.imagePreviewUrl || r.recommended || '').trim();
      if (!/^https?:\/\//i.test(src)) continue;
      const variant = asCanonicalLogoName(r.type || '');
      const cleanId = normalizeKeyForMerge(r.id || `logo_${logoAdds.length + 1}`);
      logoAdds.push({
        id: cleanId,
        variant,
        fileName: `${variant}-${cleanId}.png`,
        previewUrl: src,
        format: 'PNG',
        source: 'extracted',
        isPrimary: variant === 'primary',
      });
    }
  }

  const out: Partial<BrandKitFormState> = {};
  if (colorAdds.length > 0) {
    out.colors = upsertTokenRows(form.colors, colorAdds);
  }
  if (spacingAdds.length > 0) {
    out.spacing = upsertTokenRows(form.spacing, spacingAdds);
  }
  if (radiusAdds.length > 0) {
    out.radius = upsertTokenRows(form.radius, radiusAdds);
  }
  if (shadowAdds.length > 0) {
    out.shadows = upsertTokenRows(form.shadows, shadowAdds);
  }
  if (Object.keys(typo).length > 0) {
    out.typography = { ...(form.typography ?? {}), ...typo };
  }
  if (logoAdds.length > 0) {
    const existing = new Map((form.canonicalLogos ?? []).map((l) => [l.id, l]));
    for (const l of logoAdds) existing.set(l.id, l);
    out.canonicalLogos = [...existing.values()];
  }

  const mergedForComponents = {
    colors: out.colors ?? form.colors,
    spacing: out.spacing ?? form.spacing,
    radius: out.radius ?? form.radius,
    shadows: out.shadows ?? form.shadows,
  };
  const generated = generateBrandKitComponentStyles(mergedForComponents);
  out.componentStyleMappings = generated.mappings;
  out.componentStylesGeneratedAt = generated.generatedAt;
  return out;
}

export function buildSpecTokensPayload(form: BrandKitFormState): Record<string, unknown> {
  return {
    colors: form.colors ?? [],
    spacing: form.spacing ?? [],
    radius: form.radius ?? [],
    shadows: form.shadows ?? [],
  };
}

export function buildComponentStylesPayload(form: BrandKitFormState): Record<string, unknown> {
  const out: Record<string, unknown> = {
    mappings: form.componentStyleMappings ?? {},
  };
  if (form.componentStylesGeneratedAt) out.generatedAt = form.componentStylesGeneratedAt;
  return out;
}

/** Persisted PATCH body for BrandKit (overview + design blobs). */
export function brandKitFormToUpdateRequest(
  form: BrandKitFormState,
  options?: { publish?: boolean; publishApprovalReason?: string }
): UpdateBrandKitRequest {
  const scopeApi = form.scope ? brandKitScopeUiToApi(form.scope) : undefined;
  const primaryWorkspaceId = (form.workspaces?.[0] ?? '').trim();

  let defaultForEditions: string[] | undefined;
  if (form.edition === 'none') defaultForEditions = [];
  else if (form.edition) defaultForEditions = brandKitEditionUiToApi(form.edition);

  let notes = form.notes !== undefined ? form.notes : undefined;
  if (options?.publish && options.publishApprovalReason?.trim()) {
    const block = `\n\n[Publish approval]\n${options.publishApprovalReason.trim()}`;
    notes = `${notes ?? ''}${block}`;
  }

  const req: UpdateBrandKitRequest = {
    name: form.name,
    tokens: buildSpecTokensPayload(form),
    typography: form.typography ?? {},
    components: buildComponentStylesPayload(form),
    owner: form.owner && form.owner !== '' ? form.owner : undefined,
    scope: form.scope ? scopeApi : undefined,
    ownerRef:
      scopeApi === 'org'
        ? { ownerType: 'organization' }
        : scopeApi === 'workspace'
          ? { ownerType: 'workspace', workspaceId: primaryWorkspaceId || undefined }
          : undefined,
    notes,
    appliesToWorkspaces: (form.workspaces?.length ?? 0) > 0 ? form.workspaces : undefined,
    defaultForEditions,
  };
  if (options?.publish) {
    // IR BrandKitSpec: org-wide publish enters in_review (maker–checker); workspace can go straight to published.
    req.status = scopeApi === 'org' ? 'in_review' : 'published';
  }
  return req;
}
