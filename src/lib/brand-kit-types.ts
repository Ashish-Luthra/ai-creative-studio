/**
 * Deep brand kit data model — mirrors the five sections of the benchmark
 * (Mutiny hightouch brand kit): logo variants + rules, role-labeled color
 * system with gradients, typography scale + rules, CTA specs, voice & tone.
 *
 * Shared between the server extraction pipeline and the client UI; keep this
 * file free of React/browser imports.
 */

export type ColorRole = 'canvas' | 'ink' | 'accent' | 'neutral';

export interface DeepColor {
  hex: string;
  role: ColorRole;
  /** Human name, e.g. "Cream canvas", "Signal yellow" (LLM-labeled). */
  name?: string;
  /** Usage rule, e.g. "Primary CTA fills and links only". */
  usage?: string;
}

export interface DeepGradient {
  /** Full CSS value, e.g. "linear-gradient(120deg, #a1c4fd 0%, #c2e9fb 100%)". */
  css: string;
  /** Parsed hex stops in order, e.g. ["#c9dbe4", "#eae4c8", "#b8c47a"]. */
  stops?: string[];
  name?: string;
  usage?: string;
}

/** A downloaded, self-hosted web-font file captured from the site's @font-face rules. */
export interface FontFaceAsset {
  family: string;
  weight: number;
  style?: 'normal' | 'italic';
  /** Public path, e.g. "/brand-kits/hightouch.com/fonts/nuckle-700.woff2". */
  file: string;
  format?: string;
}

/** Brand-adaptive color grouping (e.g. "Core palette", "Atmospheric gradients"). */
export interface ColorGroup {
  title: string;
  /** Editorial/provenance note shown under the group. */
  note?: string;
  /** References into colorSystem by lowercase hex. */
  hexes: string[];
}

/** Editorial copy for one kit section (benchmark register: eyebrow + title + intro). */
export interface SectionCopy {
  title: string;
  intro?: string;
  /** Usage caption (currently used by the Buttons section). */
  caption?: string;
}

export type SectionKey = 'logo' | 'color' | 'typography' | 'buttons' | 'voice';

export interface LogoVariants {
  /** Logo for light backgrounds (usually the dark wordmark). */
  light?: string | null;
  /** Logo for dark backgrounds (usually the light/inverse wordmark). */
  dark?: string | null;
  usageRules?: string[];
}

export interface TypeScaleRow {
  /** H1 / H2 / H3 / H4 / Body / Overline */
  label: string;
  px: number;
  weight: number;
  lineHeight: string;
  family: string;
  letterSpacing?: string;
  textTransform?: string;
  /** Real copy from the site rendered as the specimen, e.g. "Activate your data". */
  exampleText?: string;
}

export interface CtaSpec {
  kind: 'primary' | 'secondary' | 'link';
  label: string;
  background: string;
  color: string;
  borderRadius: string;
  border: string;
  fontSize?: string;
  fontWeight?: string;
}

export interface BrandVoice {
  summary?: string;
  pillars: string[];
  descriptors: string[];
  phrasesToUse: string[];
  wordsToAvoid: string[];
}

export interface DeepKitData {
  logos?: LogoVariants;
  colorSystem?: DeepColor[];
  gradients?: DeepGradient[];
  typeScale?: TypeScaleRow[];
  typographyRules?: string[];
  ctaSpecs?: CtaSpec[];
  /** null = extraction ran but no LLM available (ANTHROPIC_API_KEY missing). */
  voice?: BrandVoice | null;
  snapshots?: { desktop?: string | null; mobile?: string | null };
  generatedAt?: string;
  /** Kit-level brand-personality paragraph shown under the kit header. */
  brandSummary?: string;
  /** Editorial title/intro per section; UI falls back to fixed titles when absent. */
  sections?: Partial<Record<SectionKey, SectionCopy>>;
  /** Brand-adaptive grouping over colorSystem; absent → legacy role grouping. */
  colorGroups?: ColorGroup[];
  /** Self-hosted font files downloaded from the site's @font-face rules. */
  fontFaces?: FontFaceAsset[];
  /** Per-family weights parsed from @font-face (e.g. { Nuckle: [400, 600, 700] }). */
  fontWeights?: Record<string, number[]>;
  /** Caveat shown when font files could not be fetched (licensed typefaces). */
  fontNote?: string;
  /** Optional brand-specific voice block (e.g. ElevenLabs "Safety, built in"). */
  voiceExtra?: { title: string; body: string } | null;
}
