import { test } from 'vitest';
import assert from 'node:assert/strict';
import { assetMismatch, detectAssetType } from '../assetIntent';

/**
 * The regression that prompted this file: "Create a landing page based on my
 * target persona" was answered with Instagram ads.
 */

test('a landing-page brief is not read as an ad brief', () => {
  assert.equal(detectAssetType('Create a landing page based on my target persona'), 'landing-page');
  assert.equal(detectAssetType('Build me an LP for the new pricing'), 'landing-page');
  assert.equal(detectAssetType('I need a sales page for CRM marketers'), 'landing-page');
});

test('that brief mismatches the ads canvas', () => {
  assert.equal(assetMismatch('Create a landing page based on my target persona', 'canvas'), 'landing-page');
});

test('ad briefs are detected', () => {
  assert.equal(detectAssetType('Three LinkedIn ads for data leaders'), 'ad');
  assert.equal(detectAssetType('Instagram creatives for the sale'), 'ad');
  assert.equal(detectAssetType('Some banners for retargeting'), 'ad');
});

test('case study beats landing page when both appear', () => {
  // "case study landing page" is a case study, not a landing page.
  assert.equal(detectAssetType('a case study landing page for Acme'), 'case-study');
});

test('email briefs are detected', () => {
  assert.equal(detectAssetType('A nurture sequence for trial signups'), 'email');
  assert.equal(detectAssetType('Write the newsletter for March'), 'email');
});

test('an unstated asset leaves the current surface alone', () => {
  assert.equal(detectAssetType('Something for CRM marketers'), null);
  assert.equal(assetMismatch('Something for CRM marketers', 'canvas'), null);
  assert.equal(detectAssetType(''), null);
});

test('no mismatch when the brief matches the surface', () => {
  assert.equal(assetMismatch('Three LinkedIn ads', 'canvas'), null);
  assert.equal(assetMismatch('Build a landing page', 'landing-page'), null);
  assert.equal(assetMismatch('A case study for Acme', 'case-study'), null);
});
