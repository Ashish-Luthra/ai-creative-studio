import type { CanvasMode } from '../canvas/canvasStore';

/**
 * What the user actually asked for.
 *
 * The studio has five surfaces but only the ads canvas had a brief agent, so
 * "create a landing page" on /studio/ads produced Instagram ads. Reading the
 * asset type out of the brief is what stops that: if the user names an asset,
 * we move to the surface that builds it instead of quietly building the wrong
 * thing.
 *
 * Regex-first per the monorepo rule — never call Claude for what a regex can
 * type. `null` means "not stated", which leaves the current surface alone.
 */

export type AssetType = 'ad' | 'landing-page' | 'case-study' | 'email';

export const ASSET_LABELS: Record<AssetType, string> = {
  ad: 'ad creatives',
  'landing-page': 'a landing page',
  'case-study': 'a case study',
  email: 'an email',
};

/** Studio surface that builds each asset. */
export const ASSET_TO_MODE: Record<AssetType, CanvasMode> = {
  ad: 'canvas',
  'landing-page': 'landing-page',
  'case-study': 'case-study',
  email: 'email',
};

/** URL segment for each surface, matching STUDIO_MODES in StudioScreen. */
export const ASSET_TO_SEGMENT: Record<AssetType, string> = {
  ad: 'ads',
  'landing-page': 'landing-pages',
  'case-study': 'case-studies',
  email: 'email',
};

export const MODE_TO_ASSET: Partial<Record<CanvasMode, AssetType>> = {
  canvas: 'ad',
  'landing-page': 'landing-page',
  'case-study': 'case-study',
  email: 'email',
};

// Ordered: the first match wins, so the more specific patterns come first.
// "case study landing page" should read as a case study, not a landing page.
const PATTERNS: Array<{ asset: AssetType; re: RegExp }> = [
  { asset: 'case-study', re: /\b(case[\s-]?stud(y|ies)|customer stor(y|ies)|success stor(y|ies))\b/i },
  { asset: 'landing-page', re: /\b(landing[\s-]?page|lp|micro[\s-]?site|squeeze page|web ?page|sales page)\b/i },
  { asset: 'email', re: /\b(e[\s-]?mail|newsletter|drip|nurture sequence|mailer|subject line)\b/i },
  {
    asset: 'ad',
    re: /\b(ads?|ad creatives?|creatives?|banners?|social post|instagram|linkedin|youtube|paid social|display)\b/i,
  },
];

/** The asset the brief names, or null when it doesn't name one. */
export function detectAssetType(brief: string): AssetType | null {
  const text = brief.trim();
  if (!text) return null;
  for (const { asset, re } of PATTERNS) {
    if (re.test(text)) return asset;
  }
  return null;
}

/**
 * Whether the brief is asking for something this surface cannot build.
 * Returns the requested asset when there is a genuine mismatch, else null.
 */
export function assetMismatch(brief: string, mode: CanvasMode): AssetType | null {
  const requested = detectAssetType(brief);
  if (!requested) return null;
  return ASSET_TO_MODE[requested] === mode ? null : requested;
}
