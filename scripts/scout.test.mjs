import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ageMinutesFromTooltip, readGroupsRegistry, tacticsHint, isCandidate, rank, ME } from './scout.mjs';
import { UNKNOWN_AGE } from './freshness.mjs';

const NOW = Date.parse('September 27, 2026 4:22 PM');

test('tooltip date → age in minutes; anything else is UNKNOWN_AGE, never "fresh"', () => {
  assert.equal(ageMinutesFromTooltip('Sunday, September 27, 2026 at 2:22 PM', NOW), 120);
  assert.equal(ageMinutesFromTooltip('Sunday, September 27, 2026 at 4:22 PM', NOW), 0);
  assert.equal(ageMinutesFromTooltip('Sunday, September 27, 2026 at 3:22 PM', NOW), 60);
  assert.equal(ageMinutesFromTooltip('See who reacted to this', NOW), UNKNOWN_AGE);
  assert.equal(ageMinutesFromTooltip(undefined, NOW), UNKNOWN_AGE);
});

test('groups registry: names pair with the ids line, comments ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'scout-'));
  const p = join(dir, 'destinatarios-canales.txt');
  writeFileSync(p, '# header\nGroup A\nGroup B\n# ids: 1111111111 · 2222222222\n# 3333333333 (gone) — ya no disponible\n');
  assert.deepEqual(readGroupsRegistry(p), [{ id: '1111111111', name: 'Group A' }, { id: '2222222222', name: 'Group B' }]);
});

test('tactics hint: lexical, filtered to known ids, empty when nothing matches', () => {
  const known = new Set(['naturalismo', 'crop_deaths_flip', 'insulto_ad_hominem']);
  assert.deepEqual(tacticsHint('Humans are omnivores and lions eat meat, get over it', known), ['naturalismo']);
  assert.deepEqual(tacticsHint('Vegans are More Prone to Mental Health Issues', known), ['insulto_ad_hominem']);
  assert.deepEqual(tacticsHint('all the insects you poison to get your plants', known), ['crop_deaths_flip']);
  assert.deepEqual(tacticsHint('Sign the Petition', known), []);
});

const base = { post_id: '1', author: 'Someone', ageMin: 60, comments: 3, reactions: 2, bernardCommented: false, tactics_hint: [] };

test('candidate filter: own posts, already commented, known threads, stale, unknown age, dead posts are out', () => {
  assert.equal(isCandidate(base).ok, true);
  assert.equal(isCandidate({ ...base, author: ME }).why, 'post mío');
  assert.equal(isCandidate({ ...base, bernardCommented: true }).why, 'ya comenté');
  assert.equal(isCandidate(base, { threadsKnown: new Set(['1']) }).why, 'ya respondí ahí (moat)');
  assert.equal(isCandidate({ ...base, ageMin: 49 * 60 }).why, 'viejo');
  assert.equal(isCandidate({ ...base, ageMin: UNKNOWN_AGE }).why, 'edad desconocida');
  assert.equal(isCandidate({ ...base, comments: 0, reactions: 0 }).why, 'sin actividad');
  assert.equal(isCandidate({ ...base, post_id: null }).why, 'sin permalink');
});

test('rank: comments outweigh reactions, hints add, freshness only breaks ties', () => {
  const { kept, dropped } = rank([
    { ...base, post_id: 'a', comments: 1, reactions: 5 },
    { ...base, post_id: 'b', comments: 4, reactions: 0 },
    { ...base, post_id: 'c', comments: 4, reactions: 0, ageMin: 10 },
    { ...base, post_id: 'd', author: ME },
  ]);
  assert.deepEqual(kept.map((p) => p.post_id), ['c', 'b', 'a']);
  assert.deepEqual(dropped, [{ post_id: 'd', author: ME, why: 'post mío' }]);
});
