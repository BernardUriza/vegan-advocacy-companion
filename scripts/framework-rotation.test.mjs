import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPick, pickProblems, exposureOf, distinctFamilies, isStalePick, planVoice, voiceProblems, observedVoice } from './framework-rotation.mjs';
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

test('a pick is consumed once the target gets a new interaction', () => {
  const before = actor({ interactions: [{ framework: 'antropoespecismo' }] });
  const pick = planPick({ actor: before, frameworks, policy, rng: seq(0.9) });
  assert.equal(isStalePick(pick, before), false);
  const after = actor({ interactions: [{ framework: 'antropoespecismo' }, { framework: 'algo-a-alguien-sujeto-derecho' }] });
  assert.equal(isStalePick(pick, after), true);
  assert.match(pickProblems(pick, 'algo-a-alguien-sujeto-derecho', frameworks, after)[0], /re-corre/);
});

test('without a pick receipt finalize has nothing to validate against', () => {
  assert.match(pickProblems(null, 'algo-a-alguien-sujeto-derecho', frameworks)[0], /framework-pick/);
});

test('a civil filo interlocutor (the Dean/Adam profile) is eligible for the draw', () => {
  const p = planPick({ actor: actor({ tone: 'civil' }), frameworks, policy, rng: seq(0.01, 0) });
  assert.equal(p.good_faith, true);
  assert.equal(p.assignment, 'randomized');
});

// ---------- voice_trial (2026-10-06): el brazo de voz se sortea solo en filo y finalize lo exige ----------

const SWEAR = 'That is bullshit and you know it. ';
const CLEAN = 'That does not follow, and the title is still undefended. ';

test('a filo target is drawn 50/50 into profano or limpio, with the draw and its propensity logged', () => {
  const profano = planPick({ actor: actor(), frameworks, policy, rng: seq(0.9, 0.1) });
  assert.equal(profano.assignment, 'chosen');
  assert.equal(profano.voice, 'profano');
  assert.equal(profano.voice_assignment, 'randomized');
  assert.equal(profano.voice_draw, 0.1);
  assert.equal(profano.voice_propensity, 0.5);
  const limpio = planPick({ actor: actor(), frameworks, policy, rng: seq(0.9, 0.7) });
  assert.equal(limpio.voice, 'limpio');
  assert.equal(limpio.voice_propensity, 0.5);
});

test('the voice draw consumes the rng AFTER the framework draw, so a randomized framework keeps its index', () => {
  const p = planPick({ actor: actor({ register: 'compasivo' }), frameworks, policy, rng: seq(0.01, 0.99, 0.2) });
  assert.equal(p.assignment, 'randomized');
  assert.equal(p.framework, p.shortlist.at(-1).id);
  assert.equal(p.voice_assignment, 'chosen');
  assert.equal(p.voice, null);
});

test('compasivo, wit and no_enganchar never enter the voice trial: the voice is observed from the draft', () => {
  for (const register of ['compasivo', 'wit', 'na', 'no_enganchar']) {
    const v = planVoice(actor({ register }), policy, seq(0.01));
    assert.deepEqual(v, { voice: null, voice_assignment: 'chosen', voice_draw: null, voice_propensity: null }, register);
  }
  assert.equal(observedVoice(SWEAR + CLEAN), 'profano');
  assert.equal(observedVoice(CLEAN.repeat(3)), 'limpio');
});

test('voiceProblems enforces the drawn arm: profano needs the trial minimum, limpio needs zero', () => {
  const profano = { voice: 'profano', voice_assignment: 'randomized' };
  const limpio = { voice: 'limpio', voice_assignment: 'randomized' };
  assert.match(voiceProblems(profano, CLEAN + SWEAR, policy)[0], /PROFANO.*1 grosería/);
  assert.deepEqual(voiceProblems(profano, SWEAR + SWEAR + CLEAN, policy), []);
  assert.match(voiceProblems(limpio, CLEAN + SWEAR, policy)[0], /LIMPIO.*1 grosería/);
  assert.deepEqual(voiceProblems(limpio, CLEAN.repeat(3), policy), []);
});

test('a chosen voice (or a pick from before the trial) never blocks finalize', () => {
  assert.deepEqual(voiceProblems({ voice: null, voice_assignment: 'chosen' }, SWEAR, policy), []);
  assert.deepEqual(voiceProblems({ exposure_n: 2, assignment: 'chosen' }, SWEAR, policy), []);
  assert.deepEqual(voiceProblems(null, SWEAR, policy), []);
});
