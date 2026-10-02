import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractQuotes, verifyQuotes, quoteOkArgs } from './quote-check.mjs';

const CORPUS = 'Jason Patrick Fisher · 20hIf you are having a hard time understanding how food or pets work, you aren’t going to have a good time';

test('extrae solo citas de 4+ palabras, sin puntuación final', () => {
  assert.deepEqual(extractQuotes('the word "human" and "how food or pets work," again'), ['how food or pets work']);
});

test('cita verbatim pasa con apóstrofes curvos y mayúsculas distintas', () => {
  const r = verifyQuotes('you said "You aren\'t going to have a good time".', CORPUS);
  assert.equal(r[0].found, true);
});

test('paráfrasis entre comillas truena (caso Jason 1002A: "food and pets" vs "food or pets")', () => {
  const r = verifyQuotes('"that\'s how food and pets work" just describes it', CORPUS);
  assert.equal(r[0].found, false);
});

test('--quote-ok libera una comilla deliberada', () => {
  const draft = '"that\'s how food and pets work" just describes it';
  assert.equal(verifyQuotes(draft, CORPUS, ["that's how food and pets work"])[0].found, true);
  assert.deepEqual(quoteOkArgs(['x', '--quote-ok', 'a b c d', '--quote-ok', 'e f g h']), ['a b c d', 'e f g h']);
});
