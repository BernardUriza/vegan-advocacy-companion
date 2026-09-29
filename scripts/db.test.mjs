import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readActors,
  readTactics,
  readFrameworks,
  getActor,
  getTactic,
  getFramework,
  getFrameworksByAuthor,
  getFrameworksByTactic,
  readVocab,
  vocabViolations,
  getActorsByTactic,
} from './db.mjs';

const actors = readActors();
const tactics = readTactics();
const frameworks = readFrameworks();

const sampleActor = actors[0];
const sampleTactic = tactics[0];
const sampleFramework = frameworks[0];
const tacticWithFrameworks = frameworks.flatMap(f => f.related_tactics ?? [])[0];

test('getFrameworksByTactic returns every framework whose related_tactics includes the tactic', () => {
  const result = getFrameworksByTactic(tacticWithFrameworks);
  assert.ok(result.length > 0, 'fixture should have a tactic referenced by at least one framework');
  for (const f of result) {
    assert.ok(
      (f.related_tactics ?? []).includes(tacticWithFrameworks),
      `framework "${f.id}" was returned but does not list tactic "${tacticWithFrameworks}"`,
    );
  }
  const expected = frameworks
    .filter(f => (f.related_tactics ?? []).includes(tacticWithFrameworks))
    .map(f => f.id)
    .sort();
  assert.deepEqual(result.map(f => f.id).sort(), expected);
});

test('getFrameworksByTactic returns [] for a tactic no framework references', () => {
  assert.deepEqual(getFrameworksByTactic('__does_not_exist__'), []);
});

test('getFrameworksByTactic returns [] for undefined/empty input', () => {
  assert.deepEqual(getFrameworksByTactic(undefined), []);
  assert.deepEqual(getFrameworksByTactic(''), []);
});

test('getFramework returns the framework with the matching id', () => {
  const f = getFramework(sampleFramework.id);
  assert.ok(f, 'framework should be found by its id');
  assert.equal(f.id, sampleFramework.id);
  assert.equal(f.name, sampleFramework.name);
});

test('getFramework returns null for an unknown id', () => {
  assert.equal(getFramework('__no_such_framework__'), null);
});

test('getFrameworksByAuthor returns exactly the frameworks by that author', () => {
  const result = getFrameworksByAuthor(sampleFramework.author);
  assert.ok(result.length > 0, 'sample author should own at least one framework');
  for (const f of result) {
    assert.equal(f.author, sampleFramework.author);
  }
  const expected = frameworks.filter(f => f.author === sampleFramework.author).length;
  assert.equal(result.length, expected);
});

test('getFrameworksByAuthor returns [] for an unknown author', () => {
  assert.deepEqual(getFrameworksByAuthor('__nobody__'), []);
});

test('getActor returns the actor with the matching user_id', () => {
  const a = getActor(sampleActor.user_id);
  assert.ok(a, 'actor should be found by its user_id');
  assert.equal(a.user_id, sampleActor.user_id);
  assert.equal(a.name, sampleActor.name);
});

test('getActor returns null for an unknown user_id', () => {
  assert.equal(getActor('__no_such_user__'), null);
});

test('getActor returns null for a falsy user_id', () => {
  assert.equal(getActor(undefined), null);
  assert.equal(getActor(''), null);
});

test('getTactic returns the tactic with the matching id', () => {
  const t = getTactic(sampleTactic.id);
  assert.ok(t, 'tactic should be found by its id');
  assert.equal(t.id, sampleTactic.id);
});

test('getTactic returns null for an unknown id', () => {
  assert.equal(getTactic('__no_such_tactic__'), null);
});

import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname as pdirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = pdirname(fileURLToPath(import.meta.url));
const fixtureActors = () => [{
  user_id: 'u1', name: 'Fixture One', tactics: [], threads: ['t1'],
  interactions: [
    { thread_id: 't1', date: '2026-09-01', their_move: 'you make fair points', outcome: 'conceded' },
    { thread_id: 't1', date: '2026-09-02', their_move: 'plants feel pain too', outcome: 'pending' },
    { thread_id: 't1', date: '2026-09-03', their_move: 'plants feel pain again', outcome: 'engaged' },
    { thread_id: 't2', date: '2026-09-04', their_move: 'already closed', outcome: 'silent' },
  ],
}];

async function sandboxDb(t) {
  const dir = mkdtempSync(join(tmpdir(), 'db-test-'));
  mkdirSync(join(dir, 'scripts')); mkdirSync(join(dir, 'data'));
  for (const f of ['db.mjs', 'freshness.mjs']) copyFileSync(join(HERE, f), join(dir, 'scripts', f));
  writeFileSync(join(dir, 'data', 'actors.json'), JSON.stringify(fixtureActors()));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const db = await import(pathToFileURL(join(dir, 'scripts', 'db.mjs')).href);
  const read = () => JSON.parse(readFileSync(join(dir, 'data', 'actors.json'), 'utf8'))[0].interactions;
  return { db, read };
}

test('updateInteractionOutcome refuses to downgrade conceded without force', async (t) => {
  const { db, read } = await sandboxDb(t);
  assert.throws(() => db.updateInteractionOutcome('u1', 't1', '2026-09-01', 'fair points', { outcome: 'engaged' }), /REHÚSA degradar conceded/);
  assert.equal(read()[0].outcome, 'conceded');
});

test('updateInteractionOutcome downgrades conceded when force:true', async (t) => {
  const { db, read } = await sandboxDb(t);
  const r = db.updateInteractionOutcome('u1', 't1', '2026-09-01', 'fair points', { outcome: 'engaged', force: true, note: 'rejudged' });
  assert.equal(r.outcome, 'engaged');
  assert.equal(read()[0].outcome, 'engaged');
  assert.equal(read()[0].outcome_note, 'rejudged');
});

test('updateInteractionOutcome throws when the needle matches 0 or 2 interactions', async (t) => {
  const { db, read } = await sandboxDb(t);
  assert.throws(() => db.updateInteractionOutcome('u1', 't1', '2026-09-02', 'nothing like this', { outcome: 'silent' }), /match no único \(0\)/);
  assert.throws(() => db.updateInteractionOutcome('u1', 't1', null, 'plants feel pain', { outcome: 'silent' }), /match no único \(2\)/);
  assert.deepEqual(read().map(i => i.outcome), ['conceded', 'pending', 'engaged', 'silent']);
  const r = db.updateInteractionOutcome('u1', 't1', '2026-09-02', 'plants feel pain', { outcome: 'goalpost' });
  assert.equal(r.outcome, 'goalpost');
});

test('closeOutcome only touches a pending interaction', async (t) => {
  const { db, read } = await sandboxDb(t);
  const r = db.closeOutcome('u1', 't1', 'silent', 'no reply');
  assert.deepEqual(r, { user_id: 'u1', thread_id: 't1', outcome: 'silent', evidence: 'no reply' });
  assert.deepEqual(read().map(i => i.outcome), ['conceded', 'silent', 'engaged', 'silent']);
  assert.equal(read()[1].outcome_evidence, 'no reply');
  assert.equal(db.closeOutcome('u1', 't1', 'escalated'), null);
  assert.equal(db.closeOutcome('u1', 't2', 'escalated'), null);
  assert.deepEqual(read().map(i => i.outcome), ['conceded', 'silent', 'engaged', 'silent']);
});

test('every actor classification is inside data/vocab.json', () => {
  const vocab = readVocab();
  assert.deepEqual(actors.flatMap(a => vocabViolations(a, vocab)), []);
});

test('vocabViolations sends free text to the _note field instead of accepting it', () => {
  const [violation] = vocabViolations({ name: 'X', verdict: 'audiencia / probablemente buena fe' });
  assert.match(violation, /verdict_note/);
  assert.deepEqual(vocabViolations({ name: 'X', verdict: 'audiencia', register: 'filo', bando: 'ambiguo', tone: 'civil' }), []);
});

test('every thread an actor has an interaction in is listed in threads[]', () => {
  for (const a of actors) {
    const threads = new Set(a.threads);
    for (const i of a.interactions) assert.ok(threads.has(i.thread_id), `${a.name} missing thread ${i.thread_id}`);
  }
});

test('every vocab value that feeds actor-heat carries a numeric heat', () => {
  const vocab = readVocab();
  for (const field of ['bando', 'verdict', 'register']) {
    for (const [value, spec] of Object.entries(vocab.actor[field])) assert.equal(typeof spec.heat, 'number', `${field}.${value}`);
  }
});

test('every framework classification is inside data/vocab.json', () => {
  const vocab = readVocab();
  assert.deepEqual(frameworks.flatMap(f => vocabViolations(f, vocab, 'framework')), []);
});

test('getActorsByTactic derives who uses a tactic from actor.tactics; tactics store no reverse index', () => {
  for (const t of tactics) {
    assert.ok(!('actors_known' in t), t.id);
    const ids = getActorsByTactic(t.id).map(a => a.user_id);
    assert.deepEqual(ids, actors.filter(a => a.tactics.includes(t.id)).map(a => a.user_id));
  }
});
