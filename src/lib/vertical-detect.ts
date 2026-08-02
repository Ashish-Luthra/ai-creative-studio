/**
 * Which of the three qualifying catalogues a tenant should get.
 *
 * The important subtlety: corpus `industry:` tags describe **the audience a
 * page targets**, not the brand's own vertical. Hightouch — a composable-CDP
 * SaaS vendor — carries `industry:retail (12)`, `industry:saas (9)`,
 * `industry:fintech (6)` because its case studies are about retailers and
 * banks. A naive tag vote classifies it as ecommerce. So brand-kit prose
 * (`brandSummary`, `voice`) is the primary signal and tags are a capped
 * tiebreaker that can never win on their own.
 *
 * Pure and fs-free so it can be unit-tested and imported from a route.
 */

export type Vertical = 'ecommerce' | 'fintech-banking' | 'saas-tech';

export const VERTICALS: Vertical[] = ['ecommerce', 'fintech-banking', 'saas-tech'];

export const VERTICAL_LABELS: Record<Vertical, string> = {
  ecommerce: 'Ecommerce / retail',
  'fintech-banking': 'Fintech / banking',
  'saas-tech': 'SaaS / tech',
};

/** Bridge to the backend-owned vocabulary in `src/types/signup-onboarding.ts`. */
export const VERTICAL_TO_INDUSTRY: Record<Vertical, string> = {
  ecommerce: 'E-commerce / Retail',
  'fintech-banking': 'BFSI',
  'saas-tech': 'SaaS / B2B',
};

export interface VerticalDetection {
  vertical: Vertical;
  /** 0..1 — how far clear of the runner-up. Drives the card-1 helper copy. */
  confidence: number;
  source: 'brand-kit' | 'corpus' | 'default';
  runnerUp: Vertical | null;
  reasons: string[];
}

export interface DetectVerticalInput {
  brandSummary?: string | null;
  voice?: {
    summary?: string;
    pillars?: string[];
    descriptors?: string[];
    phrasesToUse?: string[];
  } | null;
  kitName?: string | null;
  domain?: string | null;
  /** Tags across ALL content items — approved alone is far too thin. */
  tags?: string[];
}

const LEXICON: Record<Vertical, { tags: string[]; text: RegExp; name: RegExp }> = {
  'fintech-banking': {
    tags: [
      'fintech', 'financial-services', 'financial', 'banking', 'bank', 'bfsi', 'insurance',
      'insurtech', 'payments', 'payment', 'lending', 'loans', 'wealth', 'investing',
      'capital-markets', 'neobank', 'brokerage',
    ],
    text: /\b(payments?|banking|bank|fintech|financial|lending|loans?|underwriting|kyc|aml|pci[- ]?dss|debit|credit card|acquirer|issuer|treasury|insurance|deposits?|apy|interest rate|remittance|forex|brokerage|custody)\b/gi,
    name: /\b(bank|pay|fin|capital|invest|credit|wealth|insur)/i,
  },
  ecommerce: {
    tags: [
      'ecommerce', 'e-commerce', 'retail', 'dtc', 'd2c', 'marketplace', 'commerce', 'shopping',
      'cpg', 'grocery', 'restaurant', 'quick-commerce', 'fashion', 'beauty', 'apparel',
    ],
    text: /\b(shoppers?|cart|carts|checkout|merchandis\w*|storefront|skus?|catalog\w*|retail\w*|omnichannel|aov|basket|add to cart|free shipping|bestsell\w*|collections?|dtc|d2c)\b/gi,
    name: /\b(shop|store|cart|mart|bazaar|retail)/i,
  },
  'saas-tech': {
    tags: [
      'saas', 'b2b', 'b2b-saas', 'software', 'tech', 'technology', 'developer', 'devtools',
      'data', 'api', 'ai', 'infrastructure', 'cloud', 'martech', 'edtech', 'analytics',
    ],
    text: /\b(saas|platform|apis?|sdks?|developers?|data warehouse|warehouse|integrations?|workflows?|infrastructure|self[- ]serve|seats?|arr|onboarding flow|dashboards?|no[- ]code|automation|agents?|pipelines?|deploy\w*)\b/gi,
    name: /\b(\.ai$|\.io$|labs|soft|tech|data|cloud|stack)/i,
  },
};

const PERSONA_HINTS: Array<{ match: RegExp; vertical: Vertical }> = [
  { match: /(data-engineer|data-engineering|data-team|data-analyst|data-science|developer|devops|technical|engineer)/i, vertical: 'saas-tech' },
  { match: /(merchandiser|store-manager|retail|ecommerce-manager|shopper)/i, vertical: 'ecommerce' },
  { match: /(risk|compliance|underwrit|treasury|cfo|finance)/i, vertical: 'fintech-banking' },
];

const zero = (): Record<Vertical, number> => ({ ecommerce: 0, 'fintech-banking': 0, 'saas-tech': 0 });

/** Distinct lexicon hits in a blob of brand prose, so one repeated word can't stack. */
function textHits(text: string, re: RegExp): number {
  const matches = text.match(re);
  if (!matches) return 0;
  return new Set(matches.map((m) => m.toLowerCase())).size;
}

export function detectVertical(input: DetectVerticalInput): VerticalDetection {
  const scores = zero();
  const brandScores = zero();
  const reasons: string[] = [];

  // ── Primary: brand-kit prose (weight 3/hit, capped at 9) ────────────────
  const brandText = [
    input.brandSummary ?? '',
    input.voice?.summary ?? '',
    ...(input.voice?.pillars ?? []),
    ...(input.voice?.descriptors ?? []),
    ...(input.voice?.phrasesToUse ?? []),
  ]
    .join(' ')
    .trim();

  if (brandText) {
    for (const vertical of VERTICALS) {
      const hits = textHits(brandText, LEXICON[vertical].text);
      if (hits > 0) {
        const score = Math.min(hits * 3, 9);
        brandScores[vertical] += score;
        scores[vertical] += score;
        reasons.push(`brand-kit: ${hits} ${vertical} term(s)`);
      }
    }
  }

  // ── Weak: name / domain shape (weight 1) ────────────────────────────────
  const nameText = `${input.kitName ?? ''} ${input.domain ?? ''}`.trim();
  if (nameText) {
    for (const vertical of VERTICALS) {
      if (LEXICON[vertical].name.test(nameText)) {
        brandScores[vertical] += 1;
        scores[vertical] += 1;
        reasons.push(`name/domain hints ${vertical}`);
      }
    }
  }

  // ── Tiebreaker: corpus industry: tags, normalised to 2 points TOTAL ─────
  // Capped deliberately: these describe who the CONTENT is aimed at, not who
  // the brand is, so they may break a tie but must never decide alone.
  const tags = input.tags ?? [];
  const industryVotes = zero();
  let industryTotal = 0;
  for (const tag of tags) {
    const value = /^industry:(.+)$/i.exec(tag.trim())?.[1]?.toLowerCase();
    if (!value) continue;
    for (const vertical of VERTICALS) {
      if (LEXICON[vertical].tags.includes(value)) {
        industryVotes[vertical] += 1;
        industryTotal += 1;
      }
    }
  }
  if (industryTotal > 0) {
    for (const vertical of VERTICALS) {
      if (industryVotes[vertical] === 0) continue;
      scores[vertical] += (industryVotes[vertical] / industryTotal) * 2;
      reasons.push(`corpus: industry:${vertical} ×${industryVotes[vertical]}`);
    }
  }

  // ── Tiebreaker: persona: tags, 1 point TOTAL ────────────────────────────
  const personaVotes = zero();
  let personaTotal = 0;
  for (const tag of tags) {
    const value = /^persona:(.+)$/i.exec(tag.trim())?.[1];
    if (!value) continue;
    const hint = PERSONA_HINTS.find((h) => h.match.test(value));
    if (hint) {
      personaVotes[hint.vertical] += 1;
      personaTotal += 1;
    }
  }
  if (personaTotal > 0) {
    for (const vertical of VERTICALS) {
      if (personaVotes[vertical] === 0) continue;
      scores[vertical] += personaVotes[vertical] / personaTotal;
    }
  }

  const ranked = VERTICALS.map((v) => ({ vertical: v, score: scores[v] })).sort((a, b) => b.score - a.score);
  const [top, second] = ranked;

  if (top.score === 0) {
    return {
      vertical: 'saas-tech',
      confidence: 0,
      source: 'default',
      runnerUp: null,
      reasons: ['no signal — defaulted'],
    };
  }

  // Brand prose is the trustworthy signal; say so only when it actually carried
  // the decision, so a corpus-derived guess never reads as a confident claim.
  const source: VerticalDetection['source'] =
    brandScores[top.vertical] > top.score / 2 ? 'brand-kit' : 'corpus';

  return {
    vertical: top.vertical,
    confidence: Number((top.score / (top.score + (second?.score ?? 0) + 1)).toFixed(2)),
    source,
    runnerUp: second && second.score > 0 ? second.vertical : null,
    reasons: reasons.slice(0, 6),
  };
}
