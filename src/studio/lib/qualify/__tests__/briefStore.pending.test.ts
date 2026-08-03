import { test } from 'vitest';
import assert from 'node:assert/strict';
import { useBriefStore } from '../briefStore';

/**
 * The pending-intent handoff (studio home → CanvasEditor) leans on the
 * consume being atomic: StrictMode mounts CanvasEditor twice in dev, and the
 * second consume must find nothing or the brief opens with a duplicated
 * first message.
 */

test('consume returns the pending intent exactly once', () => {
  const store = useBriefStore.getState();
  store.setPendingIntent('Create a landing page for Nuckle');
  assert.equal(useBriefStore.getState().pendingIntent, 'Create a landing page for Nuckle');

  assert.equal(store.consumePendingIntent(), 'Create a landing page for Nuckle');
  assert.equal(useBriefStore.getState().pendingIntent, null);
  assert.equal(store.consumePendingIntent(), null);
});

test('consume on an untouched store is a null no-op', () => {
  assert.equal(useBriefStore.getState().consumePendingIntent(), null);
  assert.equal(useBriefStore.getState().pendingIntent, null);
});

test('a later intent replaces an unconsumed one', () => {
  const store = useBriefStore.getState();
  store.setPendingIntent('first');
  store.setPendingIntent('second');
  assert.equal(store.consumePendingIntent(), 'second');
  assert.equal(store.consumePendingIntent(), null);
});
