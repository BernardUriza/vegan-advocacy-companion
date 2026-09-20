import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_MAX_AGE_DAYS, HARD_CEILING_DAYS, UNKNOWN_AGE,
  resolveMaxAgeDays, isStaleMinutes, isStaleDate,
} from './freshness.mjs';
import { getOpenDebtThreads } from './db.mjs';

test('default cap is 7 days; hard ceiling 14', () => {
  assert.equal(DEFAULT_MAX_AGE_DAYS, 7);
  assert.equal(HARD_CEILING_DAYS, 14);
  assert.equal(resolveMaxAgeDays([], {}), 7);
});

test('override via argv / env is clamped to the ceiling, garbage falls back to default', () => {
  assert.equal(resolveMaxAgeDays(['--max-age-days', '3'], {}), 3);
  assert.equal(resolveMaxAgeDays(['--max-age-days=10'], {}), 10);
  assert.equal(resolveMaxAgeDays([], { VEGAN_MAX_AGE_DAYS: '5' }), 5);
  assert.equal(resolveMaxAgeDays(['--max-age-days', '40'], {}), 14, '5 weeks never passes, even asked for');
  assert.equal(resolveMaxAgeDays([], { VEGAN_MAX_AGE_DAYS: '999' }), 14);
  assert.equal(resolveMaxAgeDays(['--max-age-days', 'abc'], {}), 7);
  assert.equal(resolveMaxAgeDays(['--max-age-days', '0'], {}), 7);
});

test('minutes: 5 weeks is stale, 3 days is not, unknown age is never stale (Art. 2)', () => {
  assert.equal(isStaleMinutes(5 * 10080), true);
  assert.equal(isStaleMinutes(3 * 1440), false);
  assert.equal(isStaleMinutes(7 * 1440), false, 'exactly at the cap is still fresh');
  assert.equal(isStaleMinutes(7 * 1440 + 1), true);
  assert.equal(isStaleMinutes(UNKNOWN_AGE), false);
});

test('dates: moat interaction dates older than the cap are stale; unparseable never', () => {
  const now = Date.parse('2026-09-19T20:00:00Z');
  assert.equal(isStaleDate('2026-06-16', 7, now), true);
  assert.equal(isStaleDate('2026-09-18', 7, now), false);
  assert.equal(isStaleDate('2026-09-01', 7, now), true);
  assert.equal(isStaleDate('2026-09-01', 14, now), true);
  assert.equal(isStaleDate('2026-09-10', 14, now), false);
  assert.equal(isStaleDate(undefined, 7, now), false);
  assert.equal(isStaleDate('not a date', 7, now), false);
});

test('getOpenDebtThreads hides stale threads by default and marks them with includeStale', () => {
  const now = Date.parse('2026-09-19T20:00:00Z');
  const all = getOpenDebtThreads({ includeStale: true, now });
  const fresh = getOpenDebtThreads({ now });
  assert.ok(all.length >= fresh.length);
  for (const t of fresh) assert.equal(t.stale, false);
  for (const t of all) {
    assert.ok('newestDate' in t && 'ageDays' in t && 'stale' in t);
    if (t.ageDays !== null) assert.equal(t.stale, t.ageDays > 7);
  }
  const june = all.find((t) => t.newestDate && t.newestDate < '2026-08-01');
  if (june) assert.equal(june.stale, true, 'a June thread must never come back as open debt');
  assert.equal(fresh.some((t) => t.newestDate && t.newestDate < '2026-08-01'), false);
});

test('ageMinutes: a body that merely contains "Now" is dated by its trailing token, not as 0m', async () => {
  const { ageMinutes } = await import('./fb-lib.mjs');
  assert.equal(ageMinutes('Unread Now in Antinatalismo para todxs DIFUSIÓN: "Traen niñ@s al mundo a sufrir…" 5w'), 5 * 10080);
  assert.equal(ageMinutes('just now'), 0);
  assert.equal(ageMinutes('Comment by X a few seconds ago'), 0);
  assert.equal(ageMinutes('Bernard replied now'), 0);
  assert.equal(ageMinutes('3h'), 180);
});
