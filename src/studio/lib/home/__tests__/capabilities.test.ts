import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { CAPABILITIES, ROTATING_PLACEHOLDERS } from '../capabilities';
import { detectAssetType } from '../../qualify/assetIntent';

test('six capability cards, unique ids, no empty fields', () => {
  assert.equal(CAPABILITIES.length, 6);
  assert.equal(new Set(CAPABILITIES.map((c) => c.id)).size, 6);
  for (const c of CAPABILITIES) {
    assert.ok(c.title.trim().length > 0, `${c.id} title`);
    assert.ok(c.description.trim().length > 0, `${c.id} description`);
    assert.ok(c.seedPrompt.trim().length > 0, `${c.id} seedPrompt`);
  }
});

// The tiles are static design exports; a renamed or missing file would render
// a broken image on the home page, so pin their existence here.
test('every card illustration exists under public/', () => {
  for (const c of CAPABILITIES) {
    assert.match(c.illustration, /^\/studio\/home\/.+\.svg$/, `${c.id} illustration path`);
    assert.ok(existsSync(join(process.cwd(), 'public', c.illustration)), `${c.id}: ${c.illustration} missing`);
  }
});

// The card seeds are written against assetIntent's regexes on purpose: a card
// named "Landing Page" must actually route to the landing-page builder once
// the user sends the seeded prompt. This pins that contract, so a PATTERNS
// change can't silently reroute a card.
test('each seed prompt routes where its card promises', () => {
  for (const c of CAPABILITIES) {
    assert.equal(
      detectAssetType(c.seedPrompt),
      c.expectedAsset,
      `${c.id}: "${c.seedPrompt}"`
    );
  }
});

test('rotating placeholders are present and non-empty', () => {
  assert.equal(ROTATING_PLACEHOLDERS.length, 4);
  for (const p of ROTATING_PLACEHOLDERS) assert.ok(p.trim().length > 0);
});
