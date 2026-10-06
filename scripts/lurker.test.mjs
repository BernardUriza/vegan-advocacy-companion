import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  parseReactionCount, sumPostReactionLabels, draftHead, turnMatchesDraft,
  loadConsultDrafts, resolveDraftInteraction, matchMyTurns,
  thirdPartyReplies,
} from './lurker.mjs';
import { draftSha } from './seed-coagent.mjs';

test('reaction count: trailing digit after LikeReply is the count', () => {
  assert.equal(parseReactionCount({ text: 'Bernard Uriza Orozco · 4hAj Meredith are you answering something?LikeReply3' }), 3);
  assert.equal(parseReactionCount({ text: 'Aj Meredith · 4hReaching a bit there LikeReplyShare2' }), 2);
  assert.equal(parseReactionCount({ text: 'Nemes Rita · 1hI think the idea is that we created them.LikeReply' }), 0);
});

test('reaction count: a number that ends the comment body is never the count', () => {
  assert.equal(parseReactionCount({ text: 'Someone · 2hI have 2LikeReply' }), 0);
  assert.equal(parseReactionCount({ text: 'Someone · 2hI have 2 LikeReply' }), 0);
  assert.equal(parseReactionCount({ text: 'Someone · 2hI have 2LikeReply5' }), 5);
});

test('reaction count: aria label (DOM) wins over the text trailer', () => {
  assert.equal(parseReactionCount({ labels: ['Like', 'React', '3 reactions; see who reacted to this'], text: 'x LikeReply' }), 3);
  assert.equal(parseReactionCount({ labels: ['1 reaction; see who reacted to this'] }), 1);
  assert.equal(parseReactionCount({ labels: ['1.2K reactions; see who reacted to this'] }), 1200);
  assert.equal(parseReactionCount({ labels: ['Like', 'React'], text: 'body LikeReply' }), 0);
  assert.equal(parseReactionCount({}), 0);
});

test('post reactions: sums reaction types, dedups the two renders, null when none', () => {
  assert.equal(sumPostReactionLabels(['Haha: 3 people', 'Haha: 3 people']), 3);
  assert.equal(sumPostReactionLabels(['Like: 2 people', 'Love: 1 person']), 3);
  assert.equal(sumPostReactionLabels(['Like: 4.4K people']), 4400);
  assert.equal(sumPostReactionLabels([]), null);
});

const DRAFT = "You're right that we've been here before, and I remember the goats and the feral rules. I'll grant the legal part.";
const POSTED = "Bernard Uriza Orozco · 5mChris Duffy You're right that we've been here before, and I remember the goats and the feral rules. I'll grant the legal part.LikeReply";

test('matcher: draft head matches the posted turn despite author + @mention prefix and collapsed whitespace', () => {
  const head = draftHead(DRAFT, 'Chris Duffy');
  assert.ok(head);
  assert.ok(turnMatchesDraft(POSTED, head));
  assert.ok(turnMatchesDraft(POSTED.replace(/ /g, '  '), head));
  assert.ok(!turnMatchesDraft('Bernard Uriza Orozco · 4hAj Meredith are you answering something?LikeReply3', head));
});

test('matcher: a leading @mention inside the draft is stripped; a too-short draft is not distinctive', () => {
  assert.equal(draftHead('@Chris Duffy ' + DRAFT, 'Chris Duffy'), draftHead(DRAFT, 'Chris Duffy'));
  assert.equal(draftHead('Yes.', 'X'), null);
});

const actors = [
  { user_id: '1', name: 'Chris Duffy', interactions: [
    { thread_id: 'T', date: '2026-09-27', their_move: 'Animals are property for their own good', framework: 'algo-a-alguien-sujeto-derecho' },
    { thread_id: 'OTHER', date: '2026-09-27', their_move: 'x' },
  ] },
  { user_id: '2', name: 'Matt Terrain', interactions: [
    { thread_id: 'T', date: '2026-09-25', their_move: 'a' },
    { thread_id: 'T', date: '2026-09-26', their_move: 'b' },
  ] },
];

test('resolver: actor + thread + local consult date (or next day)', () => {
  const r = resolveDraftInteraction({ author: 'Chris Duffy', consulted_at: '2026-09-27T21:52:04.224Z' }, 'T', actors);
  assert.equal(r.user_id, '1');
  assert.equal(r.interaction.their_move, 'Animals are property for their own good');
  const late = resolveDraftInteraction({ author: 'Chris Duffy', consulted_at: '2026-09-27T03:00:00Z' }, 'T', actors);
  assert.equal(late.interaction.date, '2026-09-27', 'consulted 26th local night, posted next day');
});

test('resolver: ambiguous dates pick the exact day; unknown actor or no date gives null', () => {
  const r = resolveDraftInteraction({ author: 'Matt Terrain', consulted_at: '2026-09-25T18:00:00Z' }, 'T', actors);
  assert.equal(r.interaction.date, '2026-09-25');
  assert.equal(resolveDraftInteraction({ author: 'Nobody', consulted_at: '2026-09-25T18:00:00Z' }, 'T', actors), null);
  assert.equal(resolveDraftInteraction({ author: 'Chris Duffy', consulted_at: '2026-09-10T18:00:00Z' }, 'T', actors), null);
});

test('resolver: draft_sha on the interaction wins over the date heuristic (two interactions, same actor, same day)', () => {
  const two = [{ user_id: '9', name: 'Les M', interactions: [
    { thread_id: 'T', date: '2026-09-28', their_move: 'first', draft_sha: 'aaa' },
    { thread_id: 'T', date: '2026-09-28', their_move: 'second', draft_sha: 'bbb' },
  ] }];
  assert.equal(resolveDraftInteraction({ author: 'Les M', draft_sha: 'bbb', consulted_at: '2026-09-28T14:00:00Z' }, 'T', two).interaction.their_move, 'second');
  assert.equal(resolveDraftInteraction({ author: 'Les M', draft_sha: 'zzz', consulted_at: '2026-09-28T14:00:00Z' }, 'T', two), null, 'unknown sha + ambiguous day never guesses');
});

test('matchMyTurns: matches my posted turn, skips turns without a consulted draft, never guesses', () => {
  const drafts = [{ author: 'Chris Duffy', draft_sha: 'abc', consulted_at: '2026-09-27T21:52:04.224Z', body: DRAFT }];
  const turns = [
    { isMine: false, author: 'Chris Duffy', text: 'Chris Duffy · 2hAnimals are property for their own good LikeReply2', reactions: 2 },
    { isMine: true, target: 'Chris Duffy', text: POSTED, reactions: 4 },
    { isMine: true, target: 'Aj Meredith', text: 'Bernard Uriza Orozco · 4hAj Meredith are you answering something?LikeReply3', reactions: 3 },
  ];
  const { matched, unmatched } = matchMyTurns(turns, drafts, 'T', actors);
  assert.equal(matched.length, 1);
  assert.equal(matched[0].turn.reactions, 4);
  assert.equal(matched[0].user_id, '1');
  assert.equal(unmatched.length, 1);
  assert.equal(unmatched[0].turn.target, 'Aj Meredith');
});

test('matchMyTurns: two of my turns matching the same interaction are both skipped', () => {
  const drafts = [{ author: 'Chris Duffy', draft_sha: 'abc', consulted_at: '2026-09-27T21:52:04.224Z', body: DRAFT }];
  const turns = [{ isMine: true, text: POSTED, reactions: 1 }, { isMine: true, text: POSTED + ' ', reactions: 2 }];
  const { matched, unmatched } = matchMyTurns(turns, drafts, 'T', actors);
  assert.equal(matched.length, 0);
  assert.equal(unmatched.length, 2);
});

test('loadConsultDrafts: reads drafts[] and the legacy single-draft shape, drops missing files and superseded shas', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lurker-'));
  writeFileSync(join(dir, 'd1.txt'), DRAFT);
  writeFileSync(join(dir, '111.consult.json'), JSON.stringify({ drafts: [
    { author: 'Chris Duffy', draft_sha: draftSha(DRAFT), draft_file: join(dir, 'd1.txt'), consulted_at: '2026-09-27T21:52:04Z' },
    { author: 'Chris Duffy', draft_sha: 'stale', draft_file: join(dir, 'd1.txt'), consulted_at: '2026-09-27T20:00:00Z' },
    { author: 'Ghost', draft_sha: 'b', draft_file: join(dir, 'missing.txt') },
  ] }));
  writeFileSync(join(dir, '222.consult.json'), JSON.stringify({ author: 'Chris Duffy', draft_sha: draftSha(DRAFT), draft_file: join(dir, 'd1.txt'), consulted_at: '2026-09-27T21:52:04Z' }));
  const a = loadConsultDrafts('111', dir);
  assert.equal(a.length, 1);
  assert.equal(a[0].body, DRAFT);
  const b = loadConsultDrafts('222', dir);
  assert.equal(b.length, 1);
  assert.equal(b[0].author, 'Chris Duffy');
  assert.deepEqual(loadConsultDrafts('333', dir), []);
});

test('updateInteractionLurker rejects bad counts and unknown actors before writing', async () => {
  const { updateInteractionLurker, getFrameworkWinRate } = await import('./db.mjs');
  assert.throws(() => updateInteractionLurker('x', 'T', '2026-09-27', 'n', { reactions: -1 }), /reactions inválido/);
  assert.throws(() => updateInteractionLurker('__no_actor__', 'T', '2026-09-27', 'n', { reactions: 1 }), /not found/);
  const wr = getFrameworkWinRate('algo-a-alguien-sujeto-derecho');
  assert.ok(wr.lurker && Number.isInteger(wr.lurker.measured) && Number.isInteger(wr.lurker.totalReactions));
});

test('thirdPartyReplies keeps replies to me from people other than the interlocutor, until my next turn', () => {
  const turns = [
    { author: 'Bernard Uriza Orozco', isMine: true, target: 'Kirk Sawler', text: 'mine' },
    { author: 'Kirk Sawler', isMine: false, target: 'Bernard Uriza Orozco', text: 'kirk again' },
    { author: 'Jude Cooper', isMine: false, target: 'Bernard Uriza Orozco', text: 'pile on', user_id: '1' },
    { author: 'Dori Cavy Sims', isMine: false, target: 'Kirk Sawler', text: 'to kirk' },
    { author: 'Bernard Uriza Orozco', isMine: true, target: 'Jude Cooper', text: 'mine 2' },
    { author: 'Les M', isMine: false, target: 'Bernard Uriza Orozco', text: 'after next' },
  ];
  assert.deepEqual(thirdPartyReplies(turns, 0, 'Kirk Sawler'), [{ author: 'Jude Cooper', user_id: '1', text: 'pile on' }]);
});

test('annotate (SSOT de ubicación) numera profundidad y posición bajo el comentario raíz más cercano', async () => {
  const { annotate, depthOf } = await import('./lurker.mjs');
  assert.equal(depthOf({ depth: 1, target: 'X', label: "Reply by A to X's reply" }), 1);
  const t = annotate([
    { target: null, label: 'Comment by A 1h' },
    { target: 'A', label: "Reply by B to A's comment 1h" },
    { target: 'B', label: "Reply by C to B's reply 1h" },
    { target: null, label: 'Comment by D 1h' },
  ]);
  assert.deepEqual(t.map((x) => [x.depth, x.position]), [[0, 0], [1, 1], [2, 2], [0, 0]]);
});

test('placementProblem: depth 0|1|2, position entera, raíz sii posición 0, y van juntos', async () => {
  const { placementProblem } = await import('./db.mjs');
  assert.doesNotThrow(() => placementProblem(null, null));
  assert.doesNotThrow(() => placementProblem(0, 0));
  assert.doesNotThrow(() => placementProblem(2, 9));
  assert.throws(() => placementProblem(3, 1), /reply_depth/);
  assert.throws(() => placementProblem(1, 0), /reply_position/);
  assert.throws(() => placementProblem(0, 2), /reply_position/);
  assert.throws(() => placementProblem(1, null), /reply_position/);
});

test('updateInteractionLurker y updateInteractionPlacement rechazan una ubicación inválida antes de leer el moat', async () => {
  const { updateInteractionLurker, updateInteractionPlacement } = await import('./db.mjs');
  assert.throws(() => updateInteractionLurker('x', 'T', '2026-10-06', 'n', { reactions: 0, depth: 5, position: 1 }), /reply_depth/);
  assert.throws(() => updateInteractionPlacement('x', 'T', 'sha', { depth: 1, position: 0 }), /reply_position/);
});
