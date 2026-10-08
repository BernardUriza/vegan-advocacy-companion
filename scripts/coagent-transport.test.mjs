import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nonEmptyLines, compareLines, extractReply, findSeedAnchor, chatIdOf, gptIdOf,
  isBaseGptUrl, hrefMatches, parseEnvValue, chunkLines, readReplyWhenStable, isPlaceholderReply,
} from './coagent-transport.mjs';
import { insertProblems, draftSha } from './seed-coagent.mjs';

const SEED = 'hola soy claude code, escribo desde exchange-coagent devtools.\n\nEtapa 3, lote de tres.\n\n## Marco (x)\n  - propiedad   y esclavitud\n\nEsto es solo la reescritura de mi posición; publicarla es decisión de Bernard, no tuya.\n';

test('non-empty lines: drops blanks, trims, collapses spaces and nbsp', () => {
  assert.deepEqual(nonEmptyLines('a\n\n  b  c  \r\n\r\nd'), ['a', 'b c', 'd']);
});

test('compareLines: ProseMirror paragraphs (no blank lines) still match the file', () => {
  const composer = SEED.split('\n').filter((l) => l.trim()).map((l) => l.trim()).join('\n');
  assert.deepEqual(compareLines(SEED, composer), { ok: true, expected: 5, actual: 5 });
});

test('compareLines: reordered, truncated or extra lines fail with the first diff', () => {
  const lines = nonEmptyLines(SEED);
  const swapped = [lines[1], lines[0], ...lines.slice(2)].join('\n');
  assert.equal(compareLines(SEED, swapped).firstDiff.index, 0);
  const truncated = compareLines(SEED, lines.slice(0, 3).join('\n'));
  assert.equal(truncated.ok, false);
  assert.deepEqual(truncated.firstDiff, { index: 3, expected: lines[3], actual: null });
  assert.equal(compareLines(SEED, lines.join('\n') + '\nbasura').ok, false);
  assert.equal(compareLines(SEED, '').ok, false);
});

const PAGE = [
  'Earlier chat',
  'You said:',
  'algo viejo sobre lote de tres',
  'ChatGPT said:',
  'respuesta vieja',
  'Today 3:50 PM',
  'You said:',
  'hola soy claude code, escribo desde exchange-coagent devtools.',
  '',
  'Etapa 3 del pipeline de debate (coagent-advise), lote de tres. Te traigo MI marco.',
  '',
  'Esto es solo la reescritura de mi posición; publicarla es decisión de Bernard, no tuya.',
  '…',
  'Show more',
  'Worked for 11s',
  'ChatGPT said:',
  '',
  'Las tres y son coherentes con x. Ajustes duros:',
  '',
  'Matt: la alusión histórica sobra. Un eco del lote de tres no es el seed.',
  '',
  'Latest response',
  '',
  '5.5 High',
  'ChatGPT can make mistakes. Check important info.',
].join('\n');

test('extractReply: reply after the LAST seed, split at "ChatGPT said:", cut at "Latest response"', () => {
  const r = extractReply(PAGE, 'lote de tres');
  assert.equal(r.ok, true);
  assert.ok(r.reply.startsWith('Las tres y son coherentes con x.'));
  assert.ok(r.reply.endsWith('no es el seed.'));
  assert.ok(!r.reply.includes('Latest response'));
  assert.ok(!r.reply.includes('respuesta vieja'));
});

test('findSeedAnchor ignores the phrase quoted inside the assistant reply', () => {
  const i = findSeedAnchor(PAGE, 'lote de tres');
  assert.ok(PAGE.slice(i - 80, i).includes('Etapa 3 del pipeline'));
});

test('extractReply: pending while no reply follows the seed; missing phrase is an error', () => {
  const pending = PAGE.slice(0, PAGE.indexOf('Worked for 11s'));
  assert.deepEqual(extractReply(pending, 'lote de tres'), { ok: false, pending: true, error: 'no reply after the seed yet' });
  assert.equal(extractReply(PAGE, 'frase inexistente').ok, false);
});

test('extractReply stops at the next user turn', () => {
  const r = extractReply(PAGE.replace('\nLatest response', '\nYou said:\notra cosa'), 'lote de tres');
  assert.ok(!r.reply.includes('otra cosa'));
});

test('url identity: chat id vs base GPT url', () => {
  const chat = 'https://chatgpt.com/g/g-iCKKoRd5A-insult-gpt/c/6a435111-a164-83e8-87ab-5f820921ecee';
  const base = 'https://chatgpt.com/g/g-iCKKoRd5A-insult-gpt';
  assert.equal(chatIdOf(chat), '6a435111-a164-83e8-87ab-5f820921ecee');
  assert.equal(gptIdOf(chat), 'g-iCKKoRd5A');
  assert.equal(isBaseGptUrl(base), true);
  assert.equal(isBaseGptUrl(chat), false);
  assert.equal(hrefMatches(chat, chat + '?model=x'), true);
  assert.equal(hrefMatches(chat, 'https://chatgpt.com/c/otro-chat'), false);
  assert.equal(hrefMatches(base, base), true);
  assert.equal(hrefMatches(base, 'https://chatgpt.com/g/g-iCKKoRd5A-insult-gpt/c/abc-123'), false, 'base url must land on an EMPTY new chat');
  assert.equal(hrefMatches(base, 'https://chatgpt.com/g/g-OTRO-gpt'), false);
});

test('parseEnvValue mirrors resolve-coagent.py: last assignment wins, quotes and export tolerated', () => {
  const env = 'FOO=1\nCOAGENT_CHATGPT_URL=https://a\nexport COAGENT_CHATGPT_URL="https://b/c/1"\n';
  assert.equal(parseEnvValue(env), 'https://b/c/1');
  assert.equal(parseEnvValue('FOO=1'), null);
});

test('insert refuses a master that did not go through seed (sha must match the receipt)', () => {
  const ok = { seed_gate: 'pass', master_sha: draftSha(SEED) };
  assert.deepEqual(insertProblems(ok, SEED), []);
  assert.equal(insertProblems(null, SEED).length, 1);
  assert.match(insertProblems(ok, SEED + 'jugada nueva sin gate')[0], /cambió tras el seed/);
  assert.match(insertProblems({ seed_gate: 'pass' }, SEED)[0], /legacy/);
  assert.equal(insertProblems({ ...ok, seed_gate: 'fail' }, SEED).length, 1);
});

test('chunkLines: whole lines only, under the cap, and rejoining them rebuilds the text', () => {
  const text = Array.from({ length: 200 }, (_, i) => (i % 7 === 0 ? '' : `línea ${i} ` + 'x'.repeat(i % 50))).join('\n') + '\n';
  const chunks = chunkLines(text, 500);
  assert.ok(chunks.length > 5);
  for (const c of chunks) assert.ok(c.length <= 500);
  assert.equal(chunks.join('\n'), text.replace(/\n+$/, ''));
  assert.deepEqual(compareLines(text, chunks.join('\n')).ok, true);
  assert.deepEqual(chunkLines('corto'), ['corto']);
  const long = 'y'.repeat(900);
  assert.deepEqual(chunkLines(`a\n${long}\nb`, 500), ['a', long, 'b'], 'a line longer than the cap travels alone, never split');
});

const seedThen = (reply) => ['You said:', 'hola soy claude code, lote de tres', 'ChatGPT said:', reply, 'Latest response'].join('\n');

test('extractReply: a "Thinking"/"Searching" placeholder is NOT a finished reply', () => {
  for (const ph of ['Thinking', 'Thinking…', 'Searching the web', 'Reasoning\nThought for 12s']) {
    const r = extractReply(seedThen(ph), 'lote de tres');
    assert.equal(r.ok, false, ph);
    assert.equal(r.pending, true, ph);
  }
  assert.equal(isPlaceholderReply('Thought for 12s\nLas tres y son coherentes con x.'), false);
  assert.equal(extractReply(seedThen('Thought for 12s\nLas tres y son coherentes con x.'), 'lote de tres').ok, true);
});

test('extractReply: a short fragment while the page is busy is pending; the same text idle is accepted', () => {
  assert.equal(extractReply(seedThen('Las tres y son'), 'lote de tres', { busy: true }).pending, true);
  assert.equal(extractReply(seedThen('Las tres y son'), 'lote de tres').ok, true);
  const long = 'Las tres y son coherentes con x. Ajustes duros para Matt y para Les.';
  assert.equal(extractReply(seedThen(long), 'lote de tres', { busy: true }).ok, true);
});

function fakeChat(frames) {
  let tick = 0;
  const frame = () => frames[Math.min(tick, frames.length - 1)];
  const doc = {
    querySelector: (sel) => (sel === 'main' ? { innerText: frame().main } : /stop/i.test(sel) && frame().busy ? {} : null),
    querySelectorAll: () => [],
  };
  return {
    evaluate: async (fn, arg) => {
      const prev = globalThis.document;
      globalThis.document = doc;
      try { return fn(arg); } finally { globalThis.document = prev; }
    },
    waitForTimeout: async () => { tick++; },
  };
}

test('readReplyWhenStable keeps waiting through a stable "Thinking" placeholder instead of returning it', async () => {
  const final = 'Las tres y son coherentes con x. Matt: la alusión histórica sobra.';
  const page = fakeChat([
    ...Array(8).fill({ main: seedThen('Thinking'), busy: true }),
    ...Array(8).fill({ main: seedThen(final), busy: false }),
  ]);
  const r = await readReplyWhenStable(page, 'lote de tres', { timeout: 5000, gap: 0 });
  assert.equal(r.ok, true);
  assert.equal(r.reply, final);
});

test('readReplyWhenStable never reports ok:true for a reply stuck on the placeholder', async () => {
  const page = fakeChat([{ main: seedThen('Searching the web'), busy: true }]);
  const r = await readReplyWhenStable(page, 'lote de tres', { timeout: 60, gap: 0 });
  assert.equal(r.ok, false);
  assert.equal(r.reply, undefined);
});

test('conversationTextInPage rebuilds the You said / ChatGPT said markers from data-message-author-role', async () => {
  const { conversationTextInPage } = await import('./coagent-transport.mjs');
  const el = (role, text) => ({ getAttribute: (a) => (a === 'data-message-author-role' ? role : null), innerText: text });
  const prev = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => (sel === '[data-message-author-role]' ? [el('user', 'seed frase-unica'), el('assistant', 'la respuesta')] : []),
    querySelector: () => ({ innerText: 'main sin etiquetas' }),
  };
  try {
    const text = conversationTextInPage();
    assert.equal(text, 'You said:\nseed frase-unica\nChatGPT said:\nla respuesta\n');
    assert.equal(extractReply(text, 'frase-unica').reply, 'la respuesta');
    globalThis.document.querySelectorAll = () => [];
    assert.equal(conversationTextInPage(), 'main sin etiquetas');
  } finally { globalThis.document = prev; }
});
