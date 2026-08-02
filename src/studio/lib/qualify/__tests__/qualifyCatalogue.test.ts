import { test } from 'vitest';
import assert from 'node:assert/strict';
import { allTasks, getTask, getTasks, QUALIFY_CATALOGUE_VERSION } from '../qualifyCatalogue';
import { CREATIVE_PRESETS } from '../../canvas/presets';
import { VERTICALS } from '../../../../lib/vertical-detect';

/**
 * Structural guarantees for the catalogue. This is what stops it rotting as
 * tasks are added: the UI assumes a fixed card count, and the whole design
 * rests on every question naming the spec field it moves.
 */

const PRESET_IDS = new Set(CREATIVE_PRESETS.map((p) => p.id));

test('every vertical has exactly six tasks', () => {
  for (const vertical of VERTICALS) {
    assert.equal(getTasks(vertical).length, 6, `${vertical} should have 6 tasks`);
  }
});

test('every task has exactly three questions', () => {
  for (const task of allTasks()) {
    assert.equal(task.questions.length, 3, `${task.id} should have 3 questions`);
  }
});

test('task ids are globally unique', () => {
  const ids = allTasks().map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('question ids are unique within a task', () => {
  for (const task of allTasks()) {
    const ids = task.questions.map((q) => q.id);
    assert.equal(new Set(ids).size, ids.length, `${task.id} has duplicate question ids`);
  }
});

test('every default preset is a real CREATIVE_PRESETS id', () => {
  for (const task of allTasks()) {
    assert.ok(PRESET_IDS.has(task.defaultPresetId), `${task.id} → unknown preset ${task.defaultPresetId}`);
  }
});

test('every question declares at least one influenced field', () => {
  // The design rule: a question that cannot name what it changes is friction.
  for (const task of allTasks()) {
    for (const q of task.questions) {
      assert.ok(q.influences.length > 0, `${task.id}/${q.id} influences nothing`);
    }
  }
});

test('every question offers a real choice', () => {
  for (const task of allTasks()) {
    for (const q of task.questions) {
      if (q.kind === 'radio-live') {
        // Options are injected from the corpus at runtime.
        assert.equal(q.options.length, 0, `${task.id}/${q.id} is live; ship it empty`);
        continue;
      }
      assert.ok(q.options.length >= 2, `${task.id}/${q.id} needs 2+ options`);
    }
  }
});

test('option ids are unique within a question and carry a value', () => {
  for (const task of allTasks()) {
    for (const q of task.questions) {
      const ids = q.options.map((o) => o.id);
      assert.equal(new Set(ids).size, ids.length, `${task.id}/${q.id} has duplicate option ids`);
      for (const o of q.options) {
        assert.ok(o.value.trim().length > 0, `${task.id}/${q.id}/${o.id} has an empty value`);
      }
    }
  }
});

test('a question demanding free text must actually accept it', () => {
  for (const task of allTasks()) {
    for (const q of task.questions) {
      if (q.verbatim) {
        assert.notEqual(q.freeText, 'off', `${task.id}/${q.id} is verbatim but blocks free text`);
      }
    }
  }
});

test('a live question exists only where the corpus can fill it', () => {
  const live = allTasks().filter((t) => t.questions.some((q) => q.kind === 'radio-live'));
  assert.equal(live.length, 1);
  assert.equal(live[0].id, 'saas-story');
});

test('getTask resolves by id and returns null for a miss', () => {
  assert.ok(getTask('ecommerce', 'ecom-winback'));
  assert.equal(getTask('ecommerce', 'saas-demo'), null);
});

test('the catalogue version is set', () => {
  assert.match(QUALIFY_CATALOGUE_VERSION, /@\d+$/);
});
