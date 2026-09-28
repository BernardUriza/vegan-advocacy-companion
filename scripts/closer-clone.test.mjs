import test from 'node:test';
import assert from 'node:assert/strict';
import { closerOf, compareClosers, detectCloserClones } from './closer-clone.mjs';

const TITLE_Q = (subj) => `Some setup sentence about the thread. So the question is still sitting there: if there's someone in ${subj}, what makes it legitimate for ${subj === 'a pig' ? 'her' : 'him'} to exist as somebody's property?`;

test('closerOf: the closer is the final QUESTION, from its wh-word, not the subordinate lead-in', () => {
  const c = closerOf(TITLE_Q('a pig'));
  assert.match(c, /^what makes it legitimate for her to exist as somebody's property\?$/);
});

test('closerOf: without a question it is the last two sentences', () => {
  assert.equal(closerOf('One. Two here. Three at the end.'), 'Two here. Three at the end.');
});

test('the same title question with the subject swapped is a HARD clone', () => {
  const r = detectCloserClones([
    { name: 'dori', text: TITLE_Q('a pig') },
    { name: 'kirk', text: TITLE_Q('him') },
  ]);
  assert.equal(r.hard, true);
  assert.equal(r.pairs[0].hard, true);
});

test('a longer closer that embeds the same question is still a HARD clone', () => {
  const homer = 'Fine, call it that. So take your own framing seriously: if the reason is that humans dominate, what makes it legitimate for a being who feels to exist as somebody\'s property, or is "we can" the whole damn answer?';
  const r = compareClosers(closerOf(homer), closerOf(TITLE_Q('a pig')));
  assert.equal(r.hard, true, JSON.stringify(r));
});

test('two closers that re-ask the question in the interlocutor\'s own words are NOT clones', () => {
  const r = detectCloserClones([
    { name: 'kirk', text: 'So the vegetables prove nothing here. Which of those two relations are you actually defending, the one with Ralph or the one with the piglet?' },
    { name: 'jason', text: 'Paper says who owns. When did it ever say why anyone gets to?' },
    { name: 'homer', text: 'Apex tells me who wins. Is "we can" really the whole of it?' },
  ]);
  assert.equal(r.hard, false);
  assert.equal(r.count, 0, JSON.stringify(r.pairs));
});

test('a single draft never flags', () => {
  assert.equal(detectCloserClones([{ name: 'x', text: TITLE_Q('a pig') }]).count, 0);
});
