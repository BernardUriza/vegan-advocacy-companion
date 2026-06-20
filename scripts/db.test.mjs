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
