import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poolFor, applyAssignments } from './moat-link-drafts.mjs';

const free = [
  { thread_id: 'p', date: '2026-09-27', their_move: 'a' },
  { thread_id: 'p', date: '2026-09-28', their_move: 'b' },
];

test('poolFor prefers the exact day', () => {
  assert.deepEqual(poolFor('2026-09-27', free, new Set(['2026-09-27'])), [free[0]]);
});

test('poolFor falls back to D+1 only when D+1 has no drafts of its own', () => {
  const noExact = [free[1]];
  assert.deepEqual(poolFor('2026-09-27', noExact, new Set(['2026-09-27'])), [free[1]]);
  assert.deepEqual(poolFor('2026-09-27', noExact, new Set(['2026-09-27', '2026-09-28'])), []);
});

test('applyAssignments writes onto a fresh read and keeps concurrent edits', () => {
  const fresh = [{ user_id: 'u', interactions: [
    { thread_id: 'p', date: '2026-09-28', their_move: 'b', outcome: 'conceded' },
    { thread_id: 'p', date: '2026-09-28', their_move: 'new from another writer', outcome: 'pending' },
  ] }];
  const { applied, skipped } = applyAssignments(fresh, [
    { user_id: 'u', thread_id: 'p', date: '2026-09-28', their_move: 'b', sha: 's1' },
    { user_id: 'u', thread_id: 'p', date: '2026-09-28', their_move: 'gone', sha: 's2' },
  ]);
  assert.equal(applied.length, 1);
  assert.equal(skipped.length, 1);
  assert.equal(fresh[0].interactions[0].draft_sha, 's1');
  assert.equal(fresh[0].interactions[0].outcome, 'conceded');
  assert.equal(fresh[0].interactions[1].their_move, 'new from another writer');
  assert.equal(fresh[0].interactions[1].draft_sha, undefined);
});

test('applyAssignments never overwrites a different draft_sha', () => {
  const fresh = [{ user_id: 'u', interactions: [{ thread_id: 'p', date: 'd', their_move: 'm', draft_sha: 'other' }] }];
  const { applied, skipped } = applyAssignments(fresh, [{ user_id: 'u', thread_id: 'p', date: 'd', their_move: 'm', sha: 's1' }]);
  assert.equal(applied.length, 0);
  assert.match(skipped[0].reason, /otro draft_sha/);
  assert.equal(fresh[0].interactions[0].draft_sha, 'other');
});
