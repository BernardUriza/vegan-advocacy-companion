import { test } from 'node:test';
import assert from 'node:assert/strict';
import { depthOf, annotate, summarize } from './depth-reactions.mjs';

test('depthOf uses the DOM depth when present and falls back to the aria-label for old tx', () => {
  assert.equal(depthOf({ depth: 2, target: null }), 2);
  assert.equal(depthOf({ target: null, label: 'Comment by A 3 hours ago' }), 0);
  assert.equal(depthOf({ target: 'A', label: "Reply by B to A's comment 2 hours ago" }), 1);
  assert.equal(depthOf({ target: 'B', label: "Reply by C to B's reply 1 hour ago" }), 2);
});

test('annotate numbers each reply by its position under the nearest root comment', () => {
  const t = annotate([
    { target: null, label: 'Comment by A 1 hour ago' },
    { target: 'A', label: "Reply by B to A's comment 1 hour ago" },
    { target: 'B', label: "Reply by C to B's reply 1 hour ago" },
    { target: null, label: 'Comment by D 1 hour ago' },
    { target: 'D', label: "Reply by E to D's comment 1 hour ago" },
  ]);
  assert.deepEqual(t.map((x) => [x.depth, x.position]), [[0, 0], [1, 1], [2, 2], [0, 0], [1, 1]]);
});

test('summarize counts measured replies, likes and third-party replies per bucket', () => {
  const rows = [
    { depth: 1, reactions: 0, thirdParty: 1 },
    { depth: 1, reactions: 2, thirdParty: 0 },
    { depth: 1, reactions: null, thirdParty: 0 },
    { depth: 2, reactions: 0, thirdParty: 0 },
  ];
  const s = summarize(rows, (r) => r.depth);
  assert.equal(s.length, 2);
  assert.deepEqual([s[0].n, s[0].measured, s[0].withLike, s[0].withThird], [3, 2, 1, 1]);
  assert.equal(s[0].meanLikes, '1.00');
  assert.equal(s[1].pLike.startsWith('0/1'), true);
});
