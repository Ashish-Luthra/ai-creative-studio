import { test } from 'vitest';
import assert from 'node:assert/strict';
import { detectVertical } from '../vertical-detect';

/**
 * Run with: pnpm test
 * (node:test + --experimental-strip-types — no test-runner dependency)
 */

// The regression this whole weighting scheme exists for. Hightouch is a
// composable-CDP SaaS vendor whose case studies are ABOUT retailers and banks,
// so its corpus carries industry:retail ×12, industry:saas ×9,
// industry:fintech ×6. A naive tag vote calls it ecommerce.
const HIGHTOUCH_TAGS = [
  ...Array(12).fill('industry:retail'),
  ...Array(9).fill('industry:saas'),
  ...Array(6).fill('industry:fintech'),
  ...Array(5).fill('industry:media'),
  ...Array(5).fill('industry:healthcare'),
  'persona:data-engineer',
  'persona:marketer',
];

const HIGHTOUCH_BRAND =
  'Hightouch is a composable CDP that syncs data from your warehouse to over 200 destinations. ' +
  'Built for data teams and marketers to activate customer data without engineering.';

test('brand prose beats a misleading corpus tag mix', () => {
  const result = detectVertical({ brandSummary: HIGHTOUCH_BRAND, tags: HIGHTOUCH_TAGS });
  assert.equal(result.vertical, 'saas-tech');
  assert.equal(result.source, 'brand-kit');
});

test('industry tags alone can never outweigh brand prose', () => {
  // Retail tags outnumber every other industry, but the brand text is SaaS.
  const withRetailFlood = detectVertical({
    brandSummary: 'A platform with APIs and SDKs for developers.',
    tags: Array(50).fill('industry:retail'),
  });
  assert.equal(withRetailFlood.vertical, 'saas-tech');
});

test('a genuine ecommerce brand is detected as ecommerce', () => {
  const result = detectVertical({
    brandSummary: 'Shoppers browse our storefront and check out in seconds. Free shipping on every basket.',
    kitName: 'Shopfront',
  });
  assert.equal(result.vertical, 'ecommerce');
});

test('a payments brand is detected as fintech', () => {
  const result = detectVertical({
    brandSummary: 'A single platform for payments, acquiring and treasury for licensed financial institutions.',
    voice: { pillars: ['Secure by default', 'KYC and AML built in'] },
  });
  assert.equal(result.vertical, 'fintech-banking');
});

test('no signal falls back to saas-tech at zero confidence, flagged as a default', () => {
  const result = detectVertical({});
  assert.equal(result.vertical, 'saas-tech');
  assert.equal(result.confidence, 0);
  assert.equal(result.source, 'default');
  // The card-1 helper keys off this — a guess must never read as a claim.
  assert.notEqual(result.source, 'brand-kit');
});

test('confidence rises when the runner-up is far behind', () => {
  const clear = detectVertical({
    brandSummary: 'Payments, lending, deposits, APY, KYC, AML, card issuing and treasury.',
  });
  const muddy = detectVertical({ brandSummary: 'A platform for payments.' });
  assert.ok(clear.confidence > muddy.confidence);
});

test('source is corpus when tags carried the decision', () => {
  const result = detectVertical({ tags: Array(10).fill('industry:ecommerce') });
  assert.equal(result.vertical, 'ecommerce');
  assert.equal(result.source, 'corpus');
});
