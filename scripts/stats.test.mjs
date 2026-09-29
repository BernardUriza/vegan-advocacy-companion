import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betaCdf, jeffreysInterval } from './stats.mjs';

const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);

test('betaCdf matches closed forms', () => {
  near(betaCdf(0.3, 1, 1), 0.3);
  near(betaCdf(0.5, 2, 2), 0.5);
  near(betaCdf(0.2, 2, 1), 0.04);
});

test('Jeffreys interval for 4/159 brackets the observed rate and stays in 1%-7%', () => {
  const { lo, hi } = jeffreysInterval(4, 159);
  assert.ok(lo < 4 / 159 && 4 / 159 < hi);
  assert.ok(lo > 0.005 && lo < 0.015, `lo=${lo}`);
  assert.ok(hi > 0.05 && hi < 0.07, `hi=${hi}`);
});

test('zero successes pins the lower bound at 0 and n=0 is uninformative', () => {
  assert.equal(jeffreysInterval(0, 20).lo, 0);
  assert.ok(jeffreysInterval(0, 20).hi < 0.15);
  assert.deepEqual(jeffreysInterval(0, 0), { lo: 0, hi: 1 });
});
