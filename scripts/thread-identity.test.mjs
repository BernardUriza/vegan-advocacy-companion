import { test } from 'node:test';
import assert from 'node:assert/strict';
import { threadIdsFromUrl, judgeThreadIdentity, canonicalPostUrl } from './thread-identity.mjs';

const EXPECTED = 'https://www.facebook.com/groups/2295597740524135/posts/28459136643743554/?comment_id=28462609856729566';
const REWRITTEN = 'https://www.facebook.com/groups/894315013991654/permalink/28496461986683585/';
const IN_DIALOG = [
  'https://www.facebook.com/groups/2295597740524135/posts/28459136643743554/?comment_id=28462609856729566&__cft__[0]=AZ&__tn__=R]-R',
  'https://www.facebook.com/groups/2295597740524135/posts/28459136643743554/?comment_id=28462307826759769&__cft__[0]=AZ&__tn__=R]-R',
];

test('threadIdsFromUrl lee posts, permalink y post_id', () => {
  assert.deepEqual(threadIdsFromUrl(EXPECTED), { groupId: '2295597740524135', postId: '28459136643743554' });
  assert.deepEqual(threadIdsFromUrl(REWRITTEN), { groupId: '894315013991654', postId: '28496461986683585' });
  assert.deepEqual(threadIdsFromUrl('https://www.facebook.com/groups/abc/?post_id=123'), { groupId: 'abc', postId: '123' });
  assert.deepEqual(threadIdsFromUrl(''), { groupId: null, postId: null });
});

test('URL reescrita por FB con el diálogo correcto: sameThread gana', () => {
  const j = judgeThreadIdentity({ expectedUrl: EXPECTED, pageUrl: REWRITTEN, dialogLinks: IN_DIALOG });
  assert.equal(j.urlRewritten, true);
  assert.equal(j.sameThread, true);
  assert.deepEqual(j.foreign, []);
});

test('URL intacta: ni reescrita ni ajena', () => {
  const j = judgeThreadIdentity({ expectedUrl: EXPECTED, pageUrl: EXPECTED, dialogLinks: IN_DIALOG });
  assert.equal(j.urlRewritten, false);
  assert.equal(j.sameThread, true);
});

test('el diálogo es de OTRO post: sameThread false aunque la URL parezca buena', () => {
  const other = ['https://www.facebook.com/groups/894315013991654/posts/28496461986683585/?comment_id=1'];
  const j = judgeThreadIdentity({ expectedUrl: EXPECTED, pageUrl: EXPECTED, dialogLinks: other });
  assert.equal(j.sameThread, false);
  assert.deepEqual(j.foreign, ['894315013991654/28496461986683585']);
});

test('mismo postId en otro grupo no cuenta como el mismo hilo', () => {
  const j = judgeThreadIdentity({
    expectedUrl: EXPECTED,
    pageUrl: EXPECTED,
    dialogLinks: ['https://www.facebook.com/groups/999/posts/28459136643743554/'],
  });
  assert.equal(j.sameThread, false);
});

test('sin links en el diálogo: sameThread false (fail-closed)', () => {
  const j = judgeThreadIdentity({ expectedUrl: EXPECTED, pageUrl: REWRITTEN, dialogLinks: [] });
  assert.equal(j.sameThread, false);
  assert.equal(j.dialogPosts, 0);
});

test('canonicalPostUrl quita el ancla de comentario y normaliza permalink/post_id; deja intacto lo que no es un post de grupo', () => {
  assert.equal(canonicalPostUrl('https://www.facebook.com/groups/2295597740524135/posts/28459136643743554/?comment_id=28462609856729566&reply_comment_id=28466764142980804'), 'https://www.facebook.com/groups/2295597740524135/posts/28459136643743554/');
  assert.equal(canonicalPostUrl('https://www.facebook.com/groups/894315013991654/permalink/28496461986683585/'), 'https://www.facebook.com/groups/894315013991654/posts/28496461986683585/');
  assert.equal(canonicalPostUrl('https://www.facebook.com/groups/683615698352965/?post_id=28148343171453514&comment_id=1'), 'https://www.facebook.com/groups/683615698352965/posts/28148343171453514/');
  assert.equal(canonicalPostUrl('https://www.facebook.com/bernardovegano/posts/pfbid0abc?comment_id=1'), 'https://www.facebook.com/bernardovegano/posts/pfbid0abc?comment_id=1');
});
