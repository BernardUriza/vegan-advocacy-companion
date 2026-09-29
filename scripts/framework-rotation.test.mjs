import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPick, pickProblems, exposureOf, distinctFamilies } from './framework-rotation.mjs';
import { readFrameworks, readVocab } from './db.mjs';

const policy = readVocab().rotation;
const frameworks = readFrameworks();
const seq = (...xs) => () => xs.shift();

const actor = (over = {}) => ({
  tactics: ['species_hierarchy', 'naturalismo'],
  register: 'filo',
  verdict: 'audiencia',
  tone: 'dismissive',
  interactions: [],
  ...over,
});

test('first and second exposures block nothing', () => {
  const a = actor({ interactions: [{ framework: 'algo-a-alguien-sujeto-derecho' }] });
  const p = planPick({ actor: a, frameworks, policy, rng: seq(0.9) });
  assert.equal(p.exposure_n, 2);
  assert.deepEqual(p.blocked, []);
});

test('from the 3rd exposure the previous framework is blocked and pickProblems rejects it', () => {
  const a = actor({ interactions: [{ framework: 'dominacion-no-es-superioridad-moral' }, { framework: 'algo-a-alguien-sujeto-derecho' }] });
  const p = planPick({ actor: a, frameworks, policy, rng: seq(0.9) });
  assert.equal(p.exposure_n, 3);
  assert.deepEqual(p.blocked, ['algo-a-alguien-sujeto-derecho']);
  assert.ok(!p.shortlist.some(c => c.id === 'algo-a-alguien-sujeto-derecho'));
  assert.match(pickProblems(p, 'algo-a-alguien-sujeto-derecho', frameworks)[0], /entrada nueva/);
  assert.deepEqual(pickProblems(p, 'dominacion-no-es-superioridad-moral', frameworks), []);
});

test('bad-faith targets are never randomized', () => {
  const p = planPick({ actor: actor(), frameworks, policy, rng: seq(0, 0) });
  assert.equal(p.assignment, 'chosen');
});

test('a good-faith target under the rate is randomized with a logged propensity, and only that framework passes', () => {
  const p = planPick({ actor: actor({ register: 'compasivo' }), frameworks, policy, rng: seq(0.01, 0.99) });
  assert.equal(p.assignment, 'randomized');
  assert.equal(p.propensity, 1 / p.shortlist.length);
  assert.equal(p.framework, p.shortlist.at(-1).id);
  const other = p.shortlist.find(c => c.id !== p.framework).id;
  assert.match(pickProblems(p, other, frameworks)[0], /SORTEADO/);
  assert.deepEqual(pickProblems(p, p.framework, frameworks), []);
});

test('the shortlist spans distinct families and never offers self-discipline', () => {
  const p = planPick({ actor: actor(), frameworks, policy, rng: seq(0.9) });
  const fams = p.shortlist.map(c => c.family);
  assert.equal(new Set(fams).size, fams.length);
  assert.ok(!fams.includes('auto-disciplina'));
  assert.match(pickProblems(p, 'nvc-observacion-sin-juicio', frameworks)[0], /auto-disciplina/);
});

test('an actor new to the moat is exposure 1 and falls back to estatus-sujeto when no tactic matches', () => {
  assert.deepEqual(exposureOf(undefined), { exposure_n: 1, previous_framework: null });
  const p = planPick({ actor: actor({ tactics: [] }), frameworks, policy, rng: seq(0.9) });
  assert.equal(p.shortlist[0].family, 'estatus-sujeto');
});

test('distinctFamilies keeps the first of each family up to k', () => {
  const c = [{ id: 'a', family: 'x' }, { id: 'b', family: 'x' }, { id: 'c', family: 'y' }];
  assert.deepEqual(distinctFamilies(c, 3).map(x => x.id), ['a', 'c']);
});

test('without a pick receipt finalize has nothing to validate against', () => {
  assert.match(pickProblems(null, 'algo-a-alguien-sujeto-derecho', frameworks)[0], /framework-pick/);
});

test('a civil filo interlocutor (the Dean/Adam profile) is eligible for the draw', () => {
  const p = planPick({ actor: actor({ tone: 'civil' }), frameworks, policy, rng: seq(0.01, 0) });
  assert.equal(p.good_faith, true);
  assert.equal(p.assignment, 'randomized');
});
