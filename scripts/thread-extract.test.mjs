import { test } from 'node:test';
import assert from 'node:assert/strict';
import { turnBody, normKey, mergeTurns, assessCompleteness, mergeWithPrior } from './thread-extract.mjs';

const row = (author, target, text, extra = {}) => ({ author, user_id: extra.user_id || author, target, text, ageStr: '', ...extra });
const BODY = "you've just invented an argument that nobody has made";

test('turnBody strips the "Name · 3h" header and the LikeReply[Share][N] trailer', () => {
  assert.equal(turnBody(row('Les M', null, `Les M · 15hMate, ${BODY} LikeReplyShare`)), `Mate, ${BODY}`);
  assert.equal(turnBody(row('Les M', null, `Les M·Follow · 16hMate, ${BODY}LikeReplyShare3`)), `Mate, ${BODY}`);
});

test('dedup across passes: same short comment with a different age and reaction count is ONE turn', () => {
  const a = row('Les M', 'Bernard Uriza Orozco', 'Les M · 8hNo shit. LikeReply');
  const b = row('Les M', 'Bernard Uriza Orozco', 'Les M · 9hNo shit.LikeReplyShare2');
  assert.equal(normKey(a), normKey(b));
  assert.equal(mergeTurns([[a], [b]]).length, 1);
});

test('dedup keeps the LONGER copy: a "See more" truncation loses to the full text', () => {
  const full = `Les M · 8hBernard Uriza Orozco ${BODY} and that is the whole of it, mate, because I never said it LikeReply`;
  const cut = `Les M · 8hBernard Uriza Orozco ${BODY} and that… See more LikeReply`;
  const merged = mergeTurns([[row('Les M', 'Bernard Uriza Orozco', cut)], [row('Les M', 'Bernard Uriza Orozco', full)]]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, full);
});

test('merge order: canonical pass first, anchored-only reply goes right after its parent', () => {
  const p0 = [row('Anna', null, 'Anna · 2hroot one'), row('Kirk', null, 'Kirk · 1hroot two')];
  const p1 = [row('Anna', null, 'Anna · 2hroot one'), row('Bernard', 'Anna', 'Bernard · 1hreply to anna'), row('Zed', 'Nobody', 'Zed · 1horphan')];
  assert.deepEqual(mergeTurns([p0, p1]).map((t) => t.author), ['Anna', 'Bernard', 'Kirk', 'Zed']);
});

const clean = { clicked: 1, rounds: 1, expandedText: 0, articles: 4, promisedReplies: 0, pending: 0, truncatedRemaining: 0 };

test('completeness ORs failure signals across passes (a clean pass does not hide a truncated one)', () => {
  const rows = [row('Anna', null, 'Anna · 2hroot')];
  const r = assessCompleteness([{ e: { ...clean, articles: 9 }, rows }, { e: { ...clean, articles: 2, pending: 2 }, rows }], rows);
  assert.equal(r.complete, false);
  assert.equal(r.completeness.pendingExpandButtons, 2);
  assert.equal(r.expand.pendingMax, 2);
  assert.equal(r.expand.articlesMax, 9);
  assert.equal(r.expand.clickedSum, 2);
});

test('completeness: promised replies are checked per pass, and truncation in any pass fails', () => {
  const p0 = [row('Anna', null, 'Anna · 2hroot'), row('B', 'Anna', 'B · 1hr1'), row('B', 'Anna', 'B · 1hr2')];
  const p1 = [row('Anna', null, 'Anna · 2hroot')];
  const miss = assessCompleteness([{ e: clean, rows: p0 }, { e: { ...clean, promisedReplies: 2 }, rows: p1 }], mergeTurns([p0, p1]));
  assert.equal(miss.complete, false);
  assert.equal(miss.completeness.missingReplies, 2);
  const trunc = assessCompleteness([{ e: clean, rows: p0 }, { e: { ...clean, truncatedRemaining: 1 }, rows: p1 }], mergeTurns([p0, p1]));
  assert.equal(trunc.complete, false);
  assert.equal(assessCompleteness([{ e: clean, rows: p0 }, { e: clean, rows: p1 }], mergeTurns([p0, p1])).complete, true);
});

test('completeness: zero turns is incomplete unless the post is unavailable', () => {
  assert.equal(assessCompleteness([{ e: clean, rows: [] }], []).complete, false);
  assert.equal(assessCompleteness([{ e: clean, rows: [] }], []).completeness.emptyExtraction, true);
  assert.equal(assessCompleteness([{ e: clean, rows: [] }], [], { unavailable: true }).complete, true);
});

import { classifyExtraction, sweepExitCode, report, stderrTail } from './debt-sweep.mjs';

const captureLog = (fn) => {
  const lines = [];
  const orig = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console.log = orig; }
  return lines.join('\n');
};

test('debt-sweep: zero turns or complete:false is a failed/incomplete extraction, never "paid"', () => {
  assert.equal(classifyExtraction({ turns: [], complete: true, debt: [] }).status, 'failed');
  assert.equal(classifyExtraction({ turns: [{}], complete: false, completeness: { pendingExpandButtons: 2 } }).status, 'incomplete');
  assert.equal(classifyExtraction({ turns: [], unavailable: true }).status, 'unavailable');
  assert.equal(classifyExtraction({ turns: [{}], complete: true }).status, 'ok');
  const base = { thread_id: '1', slug: 's', url: 'u', turns: 0, moatActors: ['Les(pending)'], owes: [], suspect: [] };
  const failed = { ...base, extraction: 'failed', extractionReasons: ['cero turnos extraídos'], complete: false };
  const out = captureLog(() => report({ results: [failed], staleSkipped: [] }, { json: false }));
  assert.doesNotMatch(out, /probablemente pagada/);
  assert.match(out, /EXTRACCIÓN FALLIDA/);
  const ok = captureLog(() => report({ results: [{ ...base, turns: 5, extraction: 'ok', extractionReasons: [], complete: true }], staleSkipped: [] }, { json: false }));
  assert.match(ok, /probablemente pagada/);
});

test('debt-sweep exits non-zero only when EVERY attempted thread failed or was incomplete', () => {
  assert.equal(sweepExitCode([{ extraction: 'failed' }, { error: 'x' }, { unresolved: true }]), 2);
  assert.equal(sweepExitCode([{ extraction: 'failed' }, { extraction: 'ok' }]), 0);
  assert.equal(sweepExitCode([{ unresolved: true }]), 0);
  assert.equal(stderrTail('a\nb\nc\nthread-extract FALLO: boom\n', 2), 'c\nthread-extract FALLO: boom');
});

test('mergeWithPrior conserva el turno que la vista anclada perdió (CarolAnn 2026-10-02) y no duplica los vivos', () => {
  const daisy = row('Bernard Uriza Orozco', 'CarolAnn Liebelt', 'Bernard Uriza Orozco · 1dCarolAnn Liebelt Sure they have names. That makes it worse for your point.');
  const names = row('CarolAnn Liebelt', 'Bernard Uriza Orozco', 'CarolAnn Liebelt · 3dBernard Uriza Orozco backyard chickens and cows also have names.LikeReply');
  const farming = row('CarolAnn Liebelt', 'Bernard Uriza Orozco', "CarolAnn Liebelt · 18mBernard Uriza Orozco You don't live in farming country, do you?LikeReply");
  const { turns, retainedCount } = mergeWithPrior([daisy, farming], [names, daisy]);
  assert.equal(retainedCount, 1);
  assert.equal(turns.length, 3);
  assert.equal(turns.filter((t) => t.retained).length, 1);
  assert.ok(turns.find((t) => t.retained).text.includes('backyard chickens'));
  assert.equal(mergeWithPrior([daisy], []).retainedCount, 0);
});
