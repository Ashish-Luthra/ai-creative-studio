/**
 * Maps OpenAPI BrandExtractionResult (+ summary.reviewState) to extraction-review UI rows.
 * API `domain` uses `imagery_style`; UI tabs use `imagery`. See contracts/openapi BrandTokenCandidate.domain.
 */
import type { components } from '../generated/openapi-types';

export type ExtractionReviewSection = 'logos' | 'colors' | 'typography' | 'voice' | 'imagery';
export type ExtractionUiStatus = 'pending' | 'accepted' | 'rejected';

export type ExtractionCandidateRow = {
  id: string;
  section: ExtractionReviewSection;
  type: string;
  recommended: string;
  alternates: string[];
  /** http(s) URL for thumbnail preview (logos, imagery, etc.) */
  imagePreviewUrl?: string | null;
  sources: { source: string; confidence: number; explicit: boolean }[];
  uiStatus: ExtractionUiStatus;
  conflict?: boolean;
};

type BrandTokenCandidate = components['schemas']['BrandTokenCandidate'];
type BrandExtractionResult = components['schemas']['BrandExtractionResult'];

function tryHttpUrl(s: string): string | null {
  const t = s.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

/** Safe for `<img src>`: only http(s) URLs from a display string or structured value. */
export function extractHttpImageUrl(selectedValue: unknown, displayString: string): string | null {
  const fromDisplay = tryHttpUrl(displayString);
  if (fromDisplay) return fromDisplay;
  if (selectedValue && typeof selectedValue === 'object') {
    const o = selectedValue as Record<string, unknown>;
    for (const k of ['uri', 'url', 'src', 'href', 'imageUrl', 'heroUrl', 'thumbnailUrl']) {
      const x = o[k];
      if (typeof x === 'string') {
        const u = tryHttpUrl(x);
        if (u) return u;
      }
    }
  }
  return null;
}

function mapDomainToSection(domain: string): ExtractionReviewSection {
  switch (domain) {
    case 'colors':
    case 'design_tokens':
      return 'colors';
    case 'typography':
      return 'typography';
    case 'logos':
    case 'identity':
      return 'logos';
    case 'imagery_style':
      return 'imagery';
    case 'voice':
    case 'taglines':
      return 'voice';
    default:
      return 'colors';
  }
}

function valueToDisplayString(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if (typeof o.hex === 'string') return o.hex;
    if (typeof o.uri === 'string') return o.uri;
    if (typeof o.url === 'string') return o.url;
    if (typeof o.text === 'string') return o.text;
    if (typeof o.family === 'string') return o.family;
    if (typeof o.description === 'string') return o.description;
    if (typeof o.label === 'string') return o.label;
    if (typeof o.name === 'string') return o.name;
    if (typeof o.value === 'string') return o.value;
    try {
      return JSON.stringify(v);
    } catch {
      return '';
    }
  }
  return String(v);
}

function explicitnessToBool(explicitness?: string | null): boolean {
  return explicitness === 'explicit';
}

function provenanceToSources(
  provenance: BrandTokenCandidate['provenance'],
  confidence?: number | null
): { source: string; confidence: number; explicit: boolean }[] {
  const list = Array.isArray(provenance) ? provenance : [];
  const conf = typeof confidence === 'number' && !Number.isNaN(confidence) ? confidence : 0.85;
  return list.map((p, i) => {
    const rec = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    const sid = rec.sourceId ?? rec.adapter ?? rec.source ?? `source_${i + 1}`;
    return {
      source: String(sid),
      confidence: conf,
      explicit: true,
    };
  });
}

function reviewStateToUiStatus(state: string | undefined): ExtractionUiStatus | null {
  if (state === 'approve' || state === 'override') return 'accepted';
  if (state === 'reject') return 'rejected';
  if (state === 'defer' || state === 'merge') return 'pending';
  return null;
}

export function mapBrandExtractionResultToReviewRows(result: BrandExtractionResult): ExtractionCandidateRow[] {
  const candidates = result.candidates ?? [];
  const conflicts = result.conflicts ?? [];
  const summary = result.summary;
  const reviewState =
    summary && typeof summary === 'object' && 'reviewState' in summary
      ? ((summary as Record<string, unknown>).reviewState as Record<string, string> | undefined)
      : undefined;

  const conflictIds = new Set<string>();
  for (const c of conflicts) {
    if (!c || c.status !== 'open') continue;
    const ids = (c as { relatedCandidateIds?: string[] }).relatedCandidateIds ?? [];
    for (const id of ids) conflictIds.add(id);
  }

  return candidates.map((c) => {
    const domain = String(c.domain ?? 'colors');
    const section = mapDomainToSection(domain);
    const primary = valueToDisplayString(c.selectedValue);
    const alts = (c.alternativeValues ?? []).map((a) => valueToDisplayString(a)).filter(Boolean);
    const rs = reviewState?.[c.candidateId];
    const fromServer = reviewStateToUiStatus(rs);
    const uiStatus: ExtractionUiStatus = fromServer ?? 'pending';
    const imagePreviewUrl =
      section === 'logos' || section === 'imagery' ? extractHttpImageUrl(c.selectedValue, primary) : null;
    return {
      id: c.candidateId,
      section,
      type: c.key || domain,
      recommended: primary || '(empty)',
      alternates: alts,
      imagePreviewUrl,
      sources:
        provenanceToSources(c.provenance, c.confidence).length > 0
          ? provenanceToSources(c.provenance, c.confidence)
          : [{ source: domain, confidence: c.confidence ?? 0.8, explicit: explicitnessToBool(c.explicitness) }],
      uiStatus,
      conflict: conflictIds.has(c.candidateId),
    };
  });
}

export function manualValueForAlternate(row: ExtractionCandidateRow, value: string): Record<string, unknown> {
  if (row.section === 'colors') return { hex: value };
  if (row.section === 'logos') return { uri: value };
  return { text: value };
}
