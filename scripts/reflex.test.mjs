import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actorArc } from './reflex.mjs';

const T = (author, target, text, isMine = false) => ({ author, target, text, isMine, ageStr: '1 hour' });

test('actorArc keeps only the actor, Bernard to the actor, and replies to the actor', () => {
  const turns = [
    T('Frank Teuton', null, 'root by frank'),
    T('Bernard Uriza Orozco', 'Frank Teuton', 'reply to frank', true),
    T('Bernard Uriza Orozco', 'Kirk Sawler', 'reply to kirk', true),
    T('Dori Cavy Sims', 'Bernard Uriza Orozco', 'dori to bernard'),
    T('Kirk Sawler', 'Frank Teuton', 'kirk to frank'),
  ];
  const arc = actorArc(turns, 'Frank Teuton');
  assert.deepEqual(arc.map((t) => t.text), ['root by frank', 'reply to frank', 'kirk to frank']);
  assert.equal(arc[1].who, 'BERNARD');
});

test('actorArc with no turns for the actor is empty', () => {
  assert.deepEqual(actorArc([T('Bernard Uriza Orozco', 'Kirk Sawler', 'x', true)], 'Frank Teuton'), []);
});
