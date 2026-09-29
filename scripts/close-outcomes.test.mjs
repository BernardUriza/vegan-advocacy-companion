import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hits, classify, KEYWORDS } from './close-outcomes.mjs';

const { CONCEDED, ESCALATED, GOALPOST } = KEYWORDS;
const arc = (reply) => [
  { author: 'Bernard Uriza Orozco', isMine: true, target: 'Opp', text: 'my reply', ageStr: '3 days' },
  { author: 'Opp', user_id: '1', isMine: false, target: 'Bernard Uriza Orozco', text: reply, ageStr: '2 days' },
];
const outcomeOf = (reply) => classify(arc(reply), { user_id: '1', name: 'Opp' }).outcome;

test('"I disagreed" is not a concession (agreed is a substring, not a word)', () => {
  assert.deepEqual(hits('i disagreed with that', CONCEDED), []);
  assert.equal(outcomeOf('I disagreed with you from the start'), 'engaged');
});

test('"controlled" is not an escalation (troll is a substring, not a word)', () => {
  assert.deepEqual(hits('the study was controlled', ESCALATED), []);
  assert.equal(outcomeOf('The study was controlled for diet'), 'engaged');
});

test('"culture" does not trigger cult, "unnatural" does not trigger natural', () => {
  assert.deepEqual(hits('it is our culture', ESCALATED), []);
  assert.deepEqual(hits('that is unnatural', GOALPOST), []);
});

test('whole words and phrases still match', () => {
  assert.deepEqual(hits('ok, agreed.', CONCEDED), ['agreed']);
  assert.equal(outcomeOf('Agreed, fair enough.'), 'conceded');
  assert.equal(outcomeOf('You’re right about that'), 'conceded');
  assert.equal(outcomeOf('stop trolling, you are a troll'), 'escalated');
  assert.equal(outcomeOf('what   about the lions?'), 'goalpost');
});

test('stems and plurals match: manipulative, brainwashed, idiots', () => {
  assert.deepEqual(hits('so manipulative and brainwashed', ESCALATED), ['brainwash', 'manipulat']);
  assert.deepEqual(hits('you idiots', ESCALATED), ['idiot']);
});

test('markStaleClosures closes old pending/goalpost as silent and keeps closed_from; fresh and closed ones stay', async () => {
  const { markStaleClosures } = await import('./db.mjs');
  const now = Date.parse('2026-09-28T12:00:00Z');
  const actors = [{ user_id: '1', name: 'A', interactions: [
    { thread_id: 't1', date: '2026-06-16', outcome: 'goalpost' },
    { thread_id: 't2', date: '2026-08-08' },
    { thread_id: 't3', date: '2026-09-27', outcome: 'pending' },
    { thread_id: 't4', date: '2026-06-01', outcome: 'conceded' },
  ] }];
  const closed = markStaleClosures(actors, { maxAgeDays: 7, now });
  assert.deepEqual(closed.map((c) => [c.thread_id, c.closed_from]), [['t1', 'goalpost'], ['t2', 'pending']]);
  const [i1, i2, i3, i4] = actors[0].interactions;
  assert.equal(i1.outcome, 'silent');
  assert.equal(i1.closed_from, 'goalpost');
  assert.equal(i2.outcome, 'silent');
  assert.equal(i3.outcome, 'pending');
  assert.equal(i4.outcome, 'conceded');
});
