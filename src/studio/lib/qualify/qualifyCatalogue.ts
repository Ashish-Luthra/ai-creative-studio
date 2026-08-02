import type { Vertical } from '../../../lib/vertical-detect';

/**
 * The qualifying catalogue: for each vertical, the campaign jobs a marketer
 * actually runs, and the three questions that change the creative for each one.
 *
 * Two rules govern what is in here:
 *
 * 1. **Every question maps to a CreativeSpec field.** `influences` is not
 *    documentation — a question that can't name what it changes is friction and
 *    gets cut. That is why nothing asks about tone, colour or type: the Brand
 *    Kit already holds them.
 * 2. **The task comes before the questions.** Asked generically, "who is this
 *    for" gets a generic answer. A marketer opening this screen already knows
 *    they are running a win-back or a rate promotion, and those jobs have
 *    different questions, different copy conventions, and different defaults.
 *
 * Bump QUALIFY_CATALOGUE_VERSION whenever question ids change — stored sessions
 * are discarded on mismatch rather than replayed against questions that moved.
 */

export const QUALIFY_CATALOGUE_VERSION = 'ads-qualify@1';

export interface QualifyOption {
  id: string;
  label: string;
  /** What actually reaches the model; the label is for the UI. */
  value: string;
  hint?: string;
}

export type QualifyQuestionKind = 'radio' | 'radio-live' | 'multi';

export interface QualifyQuestion {
  id: string;
  prompt: string;
  helper?: string;
  kind: QualifyQuestionKind;
  options: QualifyOption[];
  /** 'required' means the free-text box carries the real answer. */
  freeText: 'off' | 'allowed' | 'required';
  /** Which CreativeSpec fields this answer moves. Enforced by a test. */
  influences: Array<'presetId' | 'ctaLabel' | 'headlineAngle' | 'subheadProof' | 'constraints'>;
  /** Answers that must reach the creative character-for-character. */
  verbatim?: boolean;
}

export interface QualifyTask {
  id: string;
  /** Chip label, e.g. "Acquisition" — mirrors the campaign-library reference. */
  category: string;
  name: string;
  description: string;
  defaultPresetId: string;
  /** 'primary' = the brand's main CTA; 'soft' = a lower-commitment label. */
  defaultCtaIntent: 'primary' | 'soft';
  questions: QualifyQuestion[];
}

const opt = (id: string, label: string, hint?: string): QualifyOption => ({
  id,
  label,
  value: label,
  hint,
});

// ── Ecommerce ────────────────────────────────────────────────────────────────

const ECOMMERCE: QualifyTask[] = [
  {
    id: 'ecom-prospecting',
    category: 'Acquisition',
    name: 'Cold prospecting',
    description: 'Introduce the brand to people who have never bought.',
    defaultPresetId: 'instagram-4-5',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'problem',
        prompt: 'What does this solve for someone who has never heard of you?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('time', 'Saves time or effort'),
          opt('price', 'Costs less than the alternative'),
          opt('quality', 'Better quality or materials'),
          opt('annoyance', 'Fixes a specific annoyance'),
        ],
      },
      {
        id: 'subject',
        prompt: "What's in the frame?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('hero', 'One hero product'),
          opt('category', 'A category or collection'),
          opt('lifestyle', 'A lifestyle idea, no single product'),
        ],
      },
      {
        id: 'trust',
        prompt: 'What earns trust in three seconds?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['subheadProof'],
        options: [
          opt('rating', 'Star rating and review count'),
          opt('bestseller', 'Bestseller status'),
          opt('press', 'Press or expert pick'),
          opt('founder', 'Founder or origin story'),
          opt('none', 'Nothing — let the product work'),
        ],
      },
    ],
  },
  {
    id: 'ecom-retargeting',
    category: 'Conversion',
    name: 'Cart & browse retargeting',
    description: 'Bring back people who viewed or abandoned.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'intent-tier',
        // How far they got changes the copy more than any other variable here.
        prompt: 'How far did they get?',
        helper: 'Warm audiences need reminding, not explaining.',
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('viewed', 'Viewed a product'),
          opt('carted', "Added to cart, didn't check out"),
          opt('checkout', 'Started checkout, dropped'),
          opt('browsed', 'Browsed a category'),
        ],
      },
      {
        id: 'friction',
        prompt: 'What friction are we removing?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('price', 'Price or value doubt'),
          opt('shipping', 'Shipping cost or speed'),
          opt('trust', 'Trust in the brand'),
          opt('fit', 'Size, fit or spec uncertainty'),
          opt('forgot', 'They simply forgot'),
        ],
      },
      {
        id: 'closer',
        prompt: 'What closes it?',
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('discount', 'A discount', 'Add the exact amount below'),
          opt('shipping', 'Free shipping'),
          opt('urgency', 'Low stock or a deadline'),
          opt('reassurance', 'Reassurance — returns, warranty'),
          opt('none', 'No incentive — remind only'),
        ],
      },
    ],
  },
  {
    id: 'ecom-sale',
    category: 'Promotion',
    name: 'Sale or seasonal event',
    description: 'A time-boxed, offer-led push.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'moment',
        prompt: 'Which moment, and when does it end?',
        helper: 'Whatever you type appears in the ad exactly as written.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle'],
        options: [
          opt('bfcm', 'Black Friday / Cyber Monday'),
          opt('eoss', 'End of season'),
          opt('festive', 'Festive or holiday'),
          opt('brandday', 'Brand day or anniversary'),
          opt('clearance', 'Clearance'),
        ],
      },
      {
        id: 'mechanic',
        prompt: "What's the mechanic?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('sitewide', 'Sitewide % off'),
          opt('tiered', 'Tiered — spend more, save more'),
          opt('category', 'Category-specific'),
          opt('bogo', 'BOGO or bundle'),
          opt('flat', 'Flat price point'),
        ],
      },
      {
        id: 'phase',
        prompt: 'Which phase is this ad?',
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('teaser', 'Teaser — before it starts'),
          opt('live', 'Live — on now'),
          opt('last', 'Last chance — final hours'),
        ],
      },
    ],
  },
  {
    id: 'ecom-launch',
    category: 'Launch',
    name: 'New drop or collection',
    description: 'Lead with newness and scarcity.',
    defaultPresetId: 'instagram-4-5',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'whats-new',
        prompt: "What's new?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('product', 'A single product'),
          opt('collection', 'A collection or capsule'),
          opt('collab', 'A collaboration'),
          opt('restock', 'A restock of a sell-out'),
        ],
      },
      {
        id: 'why-care',
        prompt: 'Why care, versus what you already sell?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('capability', 'New capability'),
          opt('material', 'New material or formulation'),
          opt('range', 'New size or colour range'),
          opt('limited', 'Limited quantity'),
          opt('notable', 'Made with someone notable'),
        ],
      },
      {
        id: 'availability',
        prompt: 'How available is it?',
        kind: 'radio',
        freeText: 'off',
        influences: ['ctaLabel', 'headlineAngle'],
        options: [
          opt('now', 'Available now'),
          opt('preorder', 'Pre-order'),
          opt('limited', 'Limited units'),
          opt('early', 'Early access for subscribers'),
        ],
      },
    ],
  },
  {
    id: 'ecom-proof',
    category: 'Consideration',
    name: 'Social proof / UGC',
    description: 'Answer one objection with evidence.',
    defaultPresetId: 'instagram-4-5',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'objection',
        prompt: 'Which objection are we answering?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('quality', 'Is the quality real?'),
          opt('suit', 'Will it suit me?'),
          opt('worth', 'Is it worth the price?'),
          opt('trust', 'Can I trust this brand?'),
          opt('works', 'Does it actually work?'),
        ],
      },
      {
        id: 'evidence',
        prompt: "What's the strongest evidence?",
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['subheadProof'],
        options: [
          opt('rating', 'Rating and review count'),
          opt('quote', 'A specific review quote', 'Paste it below'),
          opt('ugc', 'Customer photos or video'),
          opt('creator', 'Creator or expert endorsement'),
          opt('volume', 'Volume sold'),
        ],
      },
      {
        id: 'source',
        prompt: 'Who is the proof from?',
        kind: 'radio',
        freeText: 'off',
        influences: ['subheadProof'],
        options: [
          opt('peer', 'Someone like the buyer'),
          opt('name', 'A recognised name'),
          opt('press', 'An independent publication'),
          opt('aggregate', 'Customers in aggregate'),
        ],
      },
    ],
  },
  {
    id: 'ecom-winback',
    category: 'Retention',
    name: 'Win-back lapsed buyers',
    description: 'Re-engage customers who have gone quiet.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'dormancy',
        prompt: 'How long have they been away?',
        // Copy must acknowledge the existing relationship — that is the whole
        // difference between a win-back and a prospecting ad.
        helper: 'They already know you. The copy should show it.',
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle'],
        options: [
          opt('30', '30–60 days'),
          opt('60', '60–90 days'),
          opt('90', '90–180 days'),
          opt('180', '180+ days, or a one-time buyer'),
        ],
      },
      {
        id: 'why-left',
        prompt: 'Why do we think they left?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('price', 'Too expensive'),
          opt('oneoff', 'One-off need'),
          opt('competitor', 'Went to a competitor'),
          opt('bad', 'Bad experience'),
          opt('drift', 'Simply drifted'),
        ],
      },
      {
        id: 'reason-to-return',
        prompt: "What's the reason to return?",
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('new', 'Something new since they left'),
          opt('offer', 'A win-back offer', 'Add the exact offer below'),
          opt('improved', 'The product improved'),
          opt('restock', 'A restock of what they bought'),
          opt('loyalty', 'A loyalty perk'),
        ],
      },
    ],
  },
];

// ── Fintech / Banking ────────────────────────────────────────────────────────
//
// The binding constraint in this vertical is what you may NOT say. Financial
// ads are held to the same standard as a printed brochure: fees, eligibility
// and material terms must be disclosed, claims about returns need
// substantiation and risk wording, and an onboarding promise has to match the
// real timeline and document requirements.

const FINTECH: QualifyTask[] = [
  {
    id: 'fin-signup',
    category: 'Acquisition',
    name: 'New account or card signup',
    description: 'Drive applications for a core product.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'product',
        prompt: 'Which product?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('current', 'Current / checking account'),
          opt('savings', 'Savings or deposit'),
          opt('card', 'Debit or credit card'),
          opt('wallet', 'Digital wallet'),
          opt('business', 'Business account'),
        ],
      },
      {
        id: 'barrier',
        prompt: "What's the biggest barrier?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('paperwork', 'Paperwork and time'),
          opt('fees', 'Fees or minimums'),
          opt('trust', 'Trust and legitimacy'),
          opt('eligibility', 'Doubt about eligibility'),
          opt('switching', 'The hassle of switching'),
        ],
      },
      {
        id: 'promise',
        prompt: "What's the concrete promise?",
        helper: 'It must match your real onboarding timeline and document requirements.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle', 'constraints'],
        options: [
          opt('minutes', 'Open in N minutes'),
          opt('nominimum', 'No minimum balance'),
          opt('nofees', 'Zero or low fees'),
          opt('digital', 'Fully digital, no paperwork'),
          opt('free', 'Free for the first N months'),
        ],
      },
    ],
  },
  {
    id: 'fin-eligibility',
    category: 'Consideration',
    name: 'Eligibility / pre-approval',
    description: 'Offer a low-commitment qualification step.',
    defaultPresetId: 'instagram-4-5',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'product',
        prompt: 'Which product?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('card', 'Credit card'),
          opt('personal', 'Personal loan'),
          opt('mortgage', 'Home loan / mortgage'),
          opt('bnpl', 'BNPL or instalments'),
          opt('business', 'Business credit'),
        ],
      },
      {
        id: 'credit-impact',
        prompt: 'Does checking affect their credit score?',
        // The single biggest conversion lever in this vertical, and unsafe to
        // imply — so it is asked outright rather than guessed.
        helper: 'Never imply "no impact" unless it is true.',
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle', 'constraints'],
        options: [
          opt('soft', 'No — soft check only'),
          opt('hard', 'Yes — hard check'),
          opt('both', 'Soft first, hard on application'),
        ],
      },
      {
        id: 'qualifier',
        prompt: 'What determines eligibility?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('income', 'Income threshold'),
          opt('credit', 'Credit band'),
          opt('existing', 'Existing customer status'),
          opt('employment', 'Employment type'),
          opt('residency', 'Age or residency'),
        ],
      },
    ],
  },
  {
    id: 'fin-rate',
    category: 'Promotion',
    name: 'Rate or offer promotion',
    description: 'Push a specific, regulated number.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'figure',
        prompt: 'What exactly are we promoting?',
        helper: 'Type the figure exactly — no rounding, and no "up to" unless that is the actual term.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle', 'constraints'],
        options: [
          opt('apy', 'APY or interest rate'),
          opt('cashback', 'Cashback %'),
          opt('feewaiver', 'Fee waiver'),
          opt('fx', 'FX or transfer rate'),
          opt('bonus', 'Sign-up bonus'),
        ],
      },
      {
        id: 'conditions',
        prompt: 'What conditions apply?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['constraints', 'headlineAngle'],
        options: [
          opt('newonly', 'New customers only'),
          opt('minimum', 'Minimum balance or spend'),
          opt('window', 'Limited promotional window'),
          opt('tenure', 'Tenure or lock-in'),
          opt('none', 'No conditions'),
        ],
      },
      {
        id: 'disclosure',
        prompt: 'What must appear alongside it?',
        kind: 'multi',
        freeText: 'allowed',
        influences: ['constraints'],
        options: [
          opt('disclaimer', 'A disclaimer or T&C line'),
          opt('risk', 'Risk / no-guarantee wording'),
          opt('regulator', 'Regulator or licence mark'),
          opt('insurance', 'Deposit-insurance mark'),
          opt('apr', 'Representative APR example'),
        ],
      },
    ],
  },
  {
    id: 'fin-trust',
    category: 'Trust',
    name: 'Credibility & security',
    description: 'Answer "is my money safe with you?".',
    defaultPresetId: 'linkedin-1-1',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'doubt',
        prompt: 'What doubt are we answering?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('safe', 'Is my money safe?'),
          opt('licensed', 'Are you a real, licensed institution?'),
          opt('privacy', 'Is my data private?'),
          opt('reliable', 'Will it work when I need it?'),
          opt('scale', 'Are you big enough to trust?'),
        ],
      },
      {
        id: 'marker',
        prompt: 'Which marker leads?',
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['subheadProof'],
        options: [
          opt('regulator', 'Regulator or licence'),
          opt('insurance', 'Deposit insurance'),
          opt('certification', 'Security certification', 'PCI DSS, SOC 2, ISO 27001'),
          opt('scale', 'Scale — customers, volume, AUM'),
          opt('years', 'Years in operation'),
        ],
      },
      {
        id: 'jurisdiction',
        prompt: "Which market's rules apply?",
        helper: 'Disclosure duties differ by regulator.',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['constraints'],
        options: [
          opt('us', 'United States'),
          opt('uk-eu', 'UK / EU'),
          opt('india', 'India'),
          opt('multi', 'Multiple markets'),
        ],
      },
    ],
  },
  {
    id: 'fin-education',
    category: 'Awareness',
    name: 'Product education',
    description: 'Explain an unfamiliar product or change.',
    defaultPresetId: 'instagram-4-5',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'subject',
        prompt: 'What are we explaining?',
        kind: 'radio',
        freeText: 'required',
        influences: ['headlineAngle'],
        options: [
          opt('producttype', 'A new product type'),
          opt('feature', 'A feature within a product'),
          opt('regulation', 'A regulatory change that affects them'),
          opt('process', 'How a process works'),
        ],
      },
      {
        id: 'starting-point',
        prompt: "Where's the reader starting?",
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle'],
        options: [
          opt('never', 'Never heard of it'),
          opt('confused', "Heard of it, doesn't understand it"),
          opt('untried', "Understands it, hasn't tried it"),
          opt('rival', 'Uses a rival version'),
        ],
      },
      {
        id: 'takeaway',
        prompt: "What's the one takeaway?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('simple', "It's simpler than it sounds"),
          opt('cheaper', "It's cheaper than what they do now"),
          opt('safe', "It's safer and regulated"),
          opt('faster', "It's faster"),
          opt('eligible', "They're already eligible"),
        ],
      },
    ],
  },
  {
    id: 'fin-crosssell',
    category: 'Growth',
    name: 'Cross-sell to existing customers',
    description: 'A second product for an existing relationship.',
    defaultPresetId: 'instagram-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'existing',
        prompt: 'What do they already have?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('account', 'An account'),
          opt('card', 'A card'),
          opt('loan', 'A loan'),
          opt('investment', 'An investment'),
          opt('app', 'An app-only relationship'),
        ],
      },
      {
        id: 'offer',
        prompt: 'What are we offering next?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('second', 'A second product'),
          opt('upgrade', 'An upgrade or premium tier'),
          opt('limit', 'A higher limit'),
          opt('bundle', 'A bundled benefit'),
        ],
      },
      {
        id: 'preapproved',
        prompt: 'Can we say pre-approved?',
        helper: "Never imply an approval that hasn't happened.",
        kind: 'radio',
        freeText: 'off',
        influences: ['constraints', 'headlineAngle'],
        options: [
          opt('yes', 'Yes — pre-approved, no new check'),
          opt('prequalified', 'Pre-qualified, subject to checks'),
          opt('no', 'No — standard application'),
        ],
      },
    ],
  },
];

// ── SaaS / Tech ──────────────────────────────────────────────────────────────
//
// The useful split is demand CREATION (a problem they haven't named) versus
// demand CAPTURE (they are already shopping). Capture converts far better;
// creation is what builds the category. The task picker forces the choice
// instead of blending both into mush.

const SAAS: QualifyTask[] = [
  {
    id: 'saas-demandgen',
    category: 'Awareness',
    name: 'Demand generation',
    description: 'Name a problem they live with but have never named.',
    defaultPresetId: 'linkedin-1-91-1',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'role',
        prompt: 'Whose problem is it?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('practitioner', "The practitioner who'd use it"),
          opt('lead', 'The team lead who owns the outcome'),
          opt('exec', 'The executive who signs off'),
          opt('technical', 'The technical evaluator', 'Security, architecture'),
        ],
      },
      {
        id: 'awareness',
        prompt: 'How aware are they?',
        kind: 'radio',
        freeText: 'off',
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('unaware', "Doesn't know it's a problem"),
          opt('living', 'Knows, lives with it'),
          opt('looking', 'Actively looking for a fix'),
          opt('workaround', 'Using a workaround or spreadsheet'),
        ],
      },
      {
        id: 'status-quo-cost',
        prompt: 'What does the status quo cost them?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle', 'subheadProof'],
        options: [
          opt('time', 'Wasted time'),
          opt('revenue', 'Lost revenue or pipeline'),
          opt('risk', 'Risk or compliance exposure'),
          opt('backlog', 'Engineering backlog'),
          opt('cx', 'Poor customer experience'),
        ],
      },
    ],
  },
  {
    id: 'saas-displacement',
    category: 'Consideration',
    name: 'Competitor displacement',
    description: 'Win users of a named rival.',
    defaultPresetId: 'linkedin-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'competitor',
        prompt: 'Who are we displacing?',
        helper: 'Confirm you are permitted to name them — rules vary by market and by their trademark policy.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle', 'constraints'],
        options: [
          opt('named', 'A named competitor', 'Type the name below'),
          opt('category', 'The category default, unnamed'),
          opt('inhouse', 'An in-house or DIY build'),
          opt('spreadsheet', 'Spreadsheets and manual process'),
        ],
      },
      {
        id: 'wedge',
        prompt: "What's the wedge?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('price', 'Price or total cost'),
          opt('speed', 'Speed to value'),
          opt('lockin', 'No lock-in'),
          opt('architecture', 'Architecture', 'e.g. no data copy'),
          opt('support', 'Support and service'),
          opt('integrations', 'Breadth of integrations'),
        ],
      },
      {
        id: 'switching-friction',
        prompt: 'What stops them switching?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle', 'subheadProof'],
        options: [
          opt('migration', 'Migration effort'),
          opt('contract', 'Contract still running'),
          opt('retraining', 'Retraining the team'),
          opt('risk', 'Fear of breaking things'),
          opt('sunk', 'Sunk investment'),
        ],
      },
    ],
  },
  {
    id: 'saas-trial',
    category: 'Conversion',
    name: 'Free trial / self-serve',
    description: 'Product-led signup, no sales contact.',
    defaultPresetId: 'linkedin-1-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'whats-free',
        prompt: 'What exactly is free?',
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('trial', 'Full product for N days', 'Say how many below'),
          opt('freemium', 'Freemium tier, forever'),
          opt('sandbox', 'Sandbox or dev environment'),
          opt('smallteams', 'Free for small teams'),
        ],
      },
      {
        id: 'time-to-value',
        prompt: "What's the time-to-value promise?",
        kind: 'radio',
        freeText: 'allowed',
        verbatim: true,
        influences: ['headlineAngle', 'subheadProof'],
        options: [
          opt('minutes', 'Live in minutes'),
          opt('dayone', 'First result on day one'),
          opt('noimpl', 'No implementation project'),
          opt('stack', 'Works with your existing stack'),
        ],
      },
      {
        id: 'friction-removed',
        prompt: 'What friction have we removed?',
        kind: 'multi',
        freeText: 'allowed',
        influences: ['subheadProof', 'ctaLabel'],
        options: [
          opt('nocard', 'No credit card'),
          opt('nocall', 'No sales call'),
          opt('noinstall', 'No install'),
          opt('cancel', 'Cancel anytime'),
          opt('migration', 'Free migration'),
        ],
      },
    ],
  },
  {
    id: 'saas-demo',
    category: 'Conversion',
    name: 'Demo / sales pipeline',
    description: 'Book a meeting with a qualified buyer.',
    defaultPresetId: 'linkedin-1-91-1',
    defaultCtaIntent: 'primary',
    questions: [
      {
        id: 'attendee',
        prompt: 'Who takes the meeting?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('practitioner', 'Practitioner'),
          opt('lead', 'Team lead'),
          opt('exec', 'Executive'),
          opt('technical', 'Technical evaluator'),
          opt('committee', 'A buying committee'),
        ],
      },
      {
        id: 'demo-content',
        prompt: 'What will the demo actually show?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle', 'subheadProof'],
        options: [
          opt('core', 'The product doing the core job'),
          opt('usecase', 'Their specific use case'),
          opt('integration', 'An integration with their stack'),
          opt('roi', 'The ROI case'),
          opt('security', 'Security and architecture'),
        ],
      },
      {
        id: 'objection',
        prompt: 'Which objection do we pre-empt?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('time', '"Implementation takes months"'),
          opt('cost', '"Too expensive"'),
          opt('eng', '"We\'d need engineering"'),
          opt('security', '"Security won\'t approve"'),
          opt('incumbent', '"We already have something"'),
        ],
      },
    ],
  },
  {
    id: 'saas-story',
    category: 'Proof',
    name: 'Customer story amplification',
    description: 'Turn an approved case study into an ad.',
    defaultPresetId: 'linkedin-1-1',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'story',
        prompt: 'Which story?',
        helper: 'Pulled from approved content in your Content Engine.',
        // Options are injected at runtime from the corpus; when there are none
        // the question is dropped from the run entirely.
        kind: 'radio-live',
        freeText: 'allowed',
        influences: ['subheadProof', 'headlineAngle'],
        options: [],
      },
      {
        id: 'metric',
        prompt: "What's the headline number?",
        helper: 'Pre-filled from the story — confirm or override.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle'],
        options: [
          opt('fromstory', 'Use the number in the story'),
          opt('other', 'A different number'),
          opt('none', 'No number — lead with the name'),
        ],
      },
      {
        id: 'relatability',
        prompt: 'Why will the reader see themselves in it?',
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle'],
        options: [
          opt('industry', 'Same industry'),
          opt('size', 'Same size or stage'),
          opt('stack', 'Same stack'),
          opt('role', 'Same role'),
          opt('problem', 'Same problem'),
        ],
      },
    ],
  },
  {
    id: 'saas-content',
    category: 'Lead gen',
    name: 'Report or content promotion',
    description: 'Distribute a gated or ungated asset.',
    defaultPresetId: 'linkedin-1-91-1',
    defaultCtaIntent: 'soft',
    questions: [
      {
        id: 'asset',
        prompt: "What's the asset?",
        kind: 'radio',
        freeText: 'allowed',
        influences: ['headlineAngle', 'ctaLabel'],
        options: [
          opt('report', 'Research or benchmark report'),
          opt('guide', 'Practical guide or playbook'),
          opt('template', 'Template or toolkit'),
          opt('webinar', 'Webinar or recorded session'),
          opt('assessment', 'Interactive assessment'),
        ],
      },
      {
        id: 'surprise',
        prompt: "What's the most surprising thing in it?",
        helper: 'This becomes the headline, so be specific.',
        kind: 'radio',
        freeText: 'required',
        verbatim: true,
        influences: ['headlineAngle'],
        options: [
          opt('stat', 'A statistic'),
          opt('contrarian', 'A contrarian finding'),
          opt('benchmark', 'A benchmark they can compare against'),
          opt('prediction', 'A prediction'),
        ],
      },
      {
        id: 'gating',
        prompt: 'Is it gated?',
        kind: 'radio',
        freeText: 'off',
        influences: ['ctaLabel'],
        options: [
          opt('ungated', 'Ungated — read now'),
          opt('email', 'Gated — email only'),
          opt('form', 'Gated — full form'),
        ],
      },
    ],
  },
];

const BY_VERTICAL: Record<Vertical, QualifyTask[]> = {
  ecommerce: ECOMMERCE,
  'fintech-banking': FINTECH,
  'saas-tech': SAAS,
};

export function getTasks(vertical: Vertical): QualifyTask[] {
  return BY_VERTICAL[vertical] ?? SAAS;
}

export function getTask(vertical: Vertical, taskId: string): QualifyTask | null {
  return getTasks(vertical).find((t) => t.id === taskId) ?? null;
}

/** Every task in the catalogue, for integrity tests and lookups by id alone. */
export function allTasks(): QualifyTask[] {
  return [...ECOMMERCE, ...FINTECH, ...SAAS];
}
