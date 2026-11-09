import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCommentsOff, findVeto, upsertVeto, vetoProblems } from './post-author-veto.mjs';
import { isCandidate } from './scout.mjs';
import { recordPostOwner } from './thread-extract.mjs';

const VINAY = { user_id: '100001629866647', name: 'Vinay Kumar' };
const NOTICE = 'Vinay Kumar turned off commenting for this post.';
const URL = 'https://www.facebook.com/groups/683615698352965/posts/28721895640764928/';

test('el aviso real del post de Vinay se detecta con su autor (caso del 2026-11-09)', () => {
  const page = ['Geoff Robson', 'One is a tray of puppies…', 'Share', '4', 'Facebook', NOTICE].join('\n');
  assert.deepEqual(parseCommentsOff(page), { off: true, by: 'Vinay Kumar', notice: NOTICE });
});

test('un comentario que solo menciona la frase a media línea no dispara', () => {
  const page = 'Samantha Mckenna\nI heard Vinay Kumar turned off commenting for this post. because of you lot\nLike';
  assert.equal(parseCommentsOff(page).off, false);
  assert.equal(parseCommentsOff('').off, false);
});

test('findVeto empata por user_id, y por nombre cuando falta el id', () => {
  const vetoes = [{ ...VINAY, reason: 'comments_off', since: '2026-11-09', threads: [] }];
  assert.equal(findVeto(vetoes, { user_id: '100001629866647', name: 'otro nombre' })?.name, 'Vinay Kumar');
  assert.equal(findVeto(vetoes, { user_id: null, name: 'vinay kumar' })?.name, 'Vinay Kumar');
  assert.equal(findVeto(vetoes, { user_id: '1', name: 'Matt Terrain' }), null);
  assert.equal(findVeto([], VINAY), null);
});

test('upsertVeto crea una vez y después solo acumula hilos', () => {
  const a = upsertVeto([], { ...VINAY, thread_id: '28721895640764928', since: '2026-11-09', evidence: NOTICE });
  assert.equal(a.created, true);
  const b = upsertVeto(a.list, { ...VINAY, thread_id: '999', since: '2026-12-01' });
  assert.equal(b.created, false);
  assert.equal(b.list.length, 1);
  assert.deepEqual(b.entry.threads, ['28721895640764928', '999']);
  assert.equal(b.entry.since, '2026-11-09');
  assert.deepEqual(vetoProblems(b.list), []);
  assert.throws(() => upsertVeto([], { name: 'X', reason: 'porque sí', since: '2026-11-09' }));
});

test('el scout descarta el post de un autor vetado', () => {
  const p = { post_id: '1', author: 'Vinay Kumar', user_id: VINAY.user_id, ageMin: 60, comments: 9, reactions: 40, tactics_hint: [] };
  const isVetoedAuthor = (who) => !!findVeto([{ ...VINAY, reason: 'comments_off', since: '2026-11-09' }], who);
  assert.deepEqual(isCandidate(p, { isVetoedAuthor }), { ok: false, why: 'autor vetado (apagó comentarios)' });
  assert.equal(isCandidate({ ...p, author: 'Matt Terrain', user_id: '100018422793817' }, { isVetoedAuthor }).ok, true);
  assert.equal(isCandidate(p).ok, true);
});

function fakeDb(vetoes = []) {
  const calls = { veto: [], thread: [] };
  return {
    calls,
    vetoPostAuthor: (v) => { calls.veto.push(v); vetoes.push({ ...v, reason: 'comments_off', since: '2026-11-09' }); },
    registerThread: (t) => calls.thread.push(t),
    getPostAuthorVeto: (who) => findVeto(vetoes, who),
  };
}

test('el extractor veta al autor que apagó sus comentarios y marca el hilo', () => {
  const db = fakeDb();
  const vetoed = recordPostOwner({ url: URL, owner: VINAY, commentsOff: parseCommentsOff(NOTICE), postIsMine: false }, db);
  assert.equal(vetoed, true);
  assert.equal(db.calls.veto[0].thread_id, '28721895640764928');
  assert.deepEqual(db.calls.thread[0], { thread_id: '28721895640764928', group_id: '683615698352965', owner_id: VINAY.user_id, owner_name: 'Vinay Kumar', comments_off: true });
});

test('si los apagó un admin, el hilo queda marcado y el autor NO se veta', () => {
  const db = fakeDb();
  const off = parseCommentsOff('An admin turned off commenting for this post.');
  assert.equal(recordPostOwner({ url: URL, owner: VINAY, commentsOff: off, postIsMine: false }, db), false);
  assert.equal(db.calls.veto.length, 0);
  assert.equal(db.calls.thread[0].comments_off, true);
});

test('un post mío nunca veta ni registra dueño', () => {
  const db = fakeDb();
  assert.equal(recordPostOwner({ url: URL, owner: { user_id: '1', name: 'Bernard Uriza Orozco' }, commentsOff: parseCommentsOff(''), postIsMine: true }, db), false);
  assert.equal(db.calls.thread.length, 0);
});

test('un post normal de un autor ya vetado sale ownerVetoed sin volver a vetar', () => {
  const db = fakeDb([{ ...VINAY, reason: 'comments_off', since: '2026-11-09' }]);
  assert.equal(recordPostOwner({ url: URL, owner: VINAY, commentsOff: parseCommentsOff('nada'), postIsMine: false }, db), true);
  assert.equal(db.calls.veto.length, 0);
});
