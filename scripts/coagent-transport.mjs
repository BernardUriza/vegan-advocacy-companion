// Transporte CDP del master prompt al coagent (G.41): inserta SIN enviar y lee la respuesta.
// Selectores = /coagent SKILL.md "DOM update 2026-09-27"; el juicio y el Send son de Claude+MCP.

import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';

export const COMPOSER = 'form .ProseMirror';
export const REPLY_MARKER = 'ChatGPT said:';
const REPLY_ENDS = ['\nYou said:', '\nLatest response', '\nChatGPT can make mistakes'];
const ENV_VAR = 'COAGENT_CHATGPT_URL';

export function normLine(s) {
  return s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

export function nonEmptyLines(text) {
  return (text || '').replace(/\r\n?/g, '\n').split('\n').map(normLine).filter(Boolean);
}

export function compareLines(expectedText, actualText) {
  const exp = nonEmptyLines(expectedText);
  const act = nonEmptyLines(actualText);
  const n = Math.max(exp.length, act.length);
  for (let i = 0; i < n; i++) {
    if (exp[i] !== act[i]) {
      return { ok: false, expected: exp.length, actual: act.length, firstDiff: { index: i, expected: exp[i] ?? null, actual: act[i] ?? null } };
    }
  }
  return { ok: true, expected: exp.length, actual: act.length };
}

export function chatIdOf(url) {
  const m = (url || '').match(/\/c\/([0-9a-fA-F-]+)/);
  return m ? m[1] : null;
}

export function gptIdOf(url) {
  const m = (url || '').match(/\/g\/(g-[A-Za-z0-9]+)/);
  return m ? m[1] : null;
}

export function isBaseGptUrl(url) {
  return /^https:\/\/chatgpt\.com\/g\/g-[A-Za-z0-9-]+\/?(\?.*)?$/.test(url || '') && !chatIdOf(url);
}

// El href vivo debe ser ESE chat; con la URL base del GPT (chat nuevo) basta el GPT y que no haya /c/.
export function hrefMatches(targetUrl, href) {
  if (isBaseGptUrl(targetUrl)) return !!gptIdOf(targetUrl) && gptIdOf(href) === gptIdOf(targetUrl) && !chatIdOf(href);
  const id = chatIdOf(targetUrl);
  return !!id && (href || '').includes(id);
}

export function parseEnvValue(text, varName = ENV_VAR) {
  let val = null;
  const re = new RegExp(`^\\s*(?:export\\s+)?${varName}\\s*=\\s*(.+?)\\s*$`);
  for (const line of (text || '').split(/\r?\n/)) {
    const m = line.match(re);
    if (m) val = m[1].trim().replace(/^["']|["']$/g, '');
  }
  return val || null;
}

function mainCheckoutRoot(root) {
  const r = spawnSync('git', ['-C', root, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' });
  return r.status === 0 ? dirname(r.stdout.trim()) : null;
}

// Misma llave que resolve-coagent.py; en un worktree cae al .env del checkout principal.
export function resolveCoagentUrl({ url, root }) {
  if (url) return { url, source: '--url' };
  const candidates = [resolve(root, '.env')];
  const main = mainCheckoutRoot(root);
  if (main && resolve(main) !== resolve(root)) candidates.push(resolve(main, '.env'));
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const v = parseEnvValue(readFileSync(envPath, 'utf8'));
    if (v) return { url: v, source: envPath };
  }
  return { url: null, source: null, error: `${ENV_VAR} no está en ${candidates.join(' ni ')} — pídele a Bernard la URL del coagent (nunca adoptes una tab abierta)` };
}

// Ancla = la última aparición de la frase DENTRO de un mensaje del usuario (no una cita en una respuesta).
export function findSeedAnchor(text, phrase) {
  let i = text.lastIndexOf(phrase);
  while (i >= 0) {
    const userStart = text.lastIndexOf('You said:', i);
    const between = userStart >= 0 ? text.slice(userStart, i) : text.slice(0, i);
    if (userStart >= 0 && !between.includes(REPLY_MARKER)) return i;
    i = i > 0 ? text.lastIndexOf(phrase, i - 1) : -1;
  }
  return -1;
}

const PLACEHOLDER_LINE = /^(?:thinking|searching(?: the web| for .*)?|reasoning|analy[sz]ing(?: .*)?|working|thought for \d+\s*s(?:econds)?|worked for \d+\s*s(?:econds)?|stopped thinking)\s*[.…]*$/i;
export const MIN_BUSY_REPLY = 40;

export function isPlaceholderReply(reply) {
  const lines = nonEmptyLines(reply);
  return !lines.length || lines.every((l) => PLACEHOLDER_LINE.test(l));
}

// `busy` = la página muestra stop/thinking: una respuesta corta ahí es un fragmento en curso.
export function extractReply(text, phrase, { busy = false } = {}) {
  const at = findSeedAnchor(text || '', phrase);
  if (at < 0) return { ok: false, error: 'seed phrase not found in a user message' };
  const after = text.slice(at + phrase.length);
  const k = after.indexOf(REPLY_MARKER);
  if (k < 0) return { ok: false, pending: true, error: 'no reply after the seed yet' };
  let reply = after.slice(k + REPLY_MARKER.length);
  const cut = REPLY_ENDS.map((e) => reply.indexOf(e)).filter((x) => x >= 0);
  if (cut.length) reply = reply.slice(0, Math.min(...cut));
  reply = reply.trim();
  if (!reply) return { ok: false, pending: true, error: 'reply marker present but empty' };
  if (isPlaceholderReply(reply)) return { ok: false, pending: true, error: 'reply is only a thinking/searching placeholder', partial: reply };
  if (busy && reply.length < MIN_BUSY_REPLY) return { ok: false, pending: true, error: 'page still generating and the reply is too short', partial: reply };
  return { ok: true, reply };
}

export function pageBusyInPage() {
  const stop = document.querySelector('button[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="Stop generating"]');
  const thinking = [...document.querySelectorAll('main [class*="shimmer"], main [data-testid*="thinking" i]')].length > 0;
  return !!stop || thinking;
}

export async function waitForComposer(page, timeout = 30000) {
  await page.waitForSelector(COMPOSER, { timeout });
}

export async function readComposer(page) {
  return page.evaluate((sel) => document.querySelector(sel)?.innerText ?? null, COMPOSER);
}

// ChatGPT convierte un paste largo en adjunto "Pasted text.txt": se pega por trozos de líneas completas.
export function chunkLines(text, max = 1500) {
  const lines = (text || '').replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n');
  const chunks = [];
  let cur = [];
  let len = 0;
  for (const l of lines) {
    if (cur.length && len + l.length + 1 > max) {
      chunks.push(cur.join('\n'));
      cur = [];
      len = 0;
    }
    cur.push(l);
    len += l.length + 1;
  }
  if (cur.length) chunks.push(cur.join('\n'));
  return chunks;
}

export async function attachmentCount(page) {
  return page.evaluate(() => [...(document.querySelector('form')?.querySelectorAll('*') || [])]
    .filter((e) => e.children.length === 0 && /^Pasted text/.test((e.textContent || '').trim())).length);
}

async function pasteChunk(page, chunk, first) {
  return page.evaluate(({ sel, chunk, first }) => {
    const box = document.querySelector(sel);
    if (!box) return { ok: false, error: 'composer not found' };
    if (first && (box.innerText || '').trim()) return { ok: false, error: 'composer not empty', existing: box.innerText.trim().slice(0, 120) };
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    if (!first) range.collapse(false);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    const dt = new DataTransfer();
    dt.setData('text/plain', first ? chunk : '\n' + chunk);
    box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    return { ok: true };
  }, { sel: COMPOSER, chunk, first });
}

export async function pasteSeed(page, text, meta, { chunk = 1500 } = {}) {
  const baseline = await attachmentCount(page);
  const chunks = chunkLines(text, chunk);
  for (let i = 0; i < chunks.length; i++) {
    const r = await pasteChunk(page, chunks[i], i === 0);
    if (!r.ok) return { ...r, chunk: i };
    await page.waitForTimeout(250);
    if ((await attachmentCount(page)) > baseline) {
      return { ok: false, error: 'ChatGPT convirtió el paste en adjunto "Pasted text" — baja --chunk', chunk: i, chunks: chunks.length };
    }
  }
  await page.evaluate((seed) => { window.__seed = seed; }, { text, ...meta });
  return { ok: true, chunks: chunks.length };
}

export async function settleComposer(page, { tries = 12, gap = 600 } = {}) {
  let prev = null;
  let text = null;
  for (let i = 0; i < tries; i++) {
    await page.waitForTimeout(gap);
    text = await readComposer(page);
    if (text && text === prev && nonEmptyLines(text).length) return text;
    prev = text;
  }
  return text;
}

// Limpiar NO es enviar: selección por DOM + Backspace real por CDP (Input.dispatchKeyEvent).
// ChatGPT persiste el borrador con debounce: cerrar la tab antes de ~2s lo resucita en el próximo chat del GPT.
export async function clearComposer(page, { persistMs = 2500 } = {}) {
  const focused = await page.evaluate((sel) => {
    const box = document.querySelector(sel);
    if (!box) return false;
    box.focus();
    const range = document.createRange();
    range.selectNodeContents(box);
    const s = window.getSelection();
    s.removeAllRanges();
    s.addRange(range);
    return true;
  }, COMPOSER);
  if (!focused) return { cleared: false, error: 'composer not found' };
  await page.keyboard.press('Backspace');
  await page.waitForTimeout(500);
  let left = (await readComposer(page)) || '';
  if (left.trim()) {
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(500);
    left = (await readComposer(page)) || '';
  }
  await page.evaluate(() => { delete window.__seed; });
  await page.waitForTimeout(persistMs);
  left = (await readComposer(page)) || '';
  return { cleared: !left.trim(), remaining: left.trim().length };
}

export async function waitForSeedText(page, phrase, timeout = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const found = await page.evaluate((p) => (document.querySelector('main')?.innerText || '').includes(p), phrase);
    if (found) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

// Espera por ESTABILIDAD de contenido (3 lecturas iguales a 1.5s), nunca por el stop-button.
export async function readReplyWhenStable(page, phrase, { timeout = 240000, gap = 1500, stableReads = 3 } = {}) {
  const sliceLen = () => page.evaluate((p) => {
    const t = document.querySelector('main')?.innerText || '';
    const i = t.lastIndexOf(p);
    return i < 0 ? -1 : t.length - i;
  }, phrase);
  const t0 = Date.now();
  let prev = -2;
  let stable = 0;
  let last = null;
  while (Date.now() - t0 < timeout) {
    const len = await sliceLen();
    stable = len === prev && len > 0 ? stable + 1 : 0;
    prev = len;
    if (stable >= stableReads - 1) {
      const busy = await page.evaluate(pageBusyInPage).catch(() => false);
      last = extractReply(await page.evaluate(() => document.querySelector('main')?.innerText || ''), phrase, { busy });
      if (last.ok) return { ...last, waitedMs: Date.now() - t0 };
      stable = 0;
    }
    await page.waitForTimeout(gap);
  }
  return { ...(last || { ok: false }), ok: false, error: (last && last.error) || 'timeout waiting for a stable reply', waitedMs: Date.now() - t0 };
}
