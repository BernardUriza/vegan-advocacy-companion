// Señal del LURKER (reacciones por comentario), puro y sin playwright: parser para thread-extract
// y matcher turno↔draft↔interacción para lurker-sweep. Sin match único no se escribe (Art. 2).

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const COAGENT_DIR = process.env.COAGENT_DIR || resolve(ROOT, '.coagent');

const REACTION_LABEL = /^([\d.,]+)\s*([KkM]?)\s+reactions?\b.*see who reacted/i;
const TRAILER = /(?:Like|Love|Care|Haha|Wow|Sad|Angry)\s*Reply\s*(?:Share\s*)?(?:Edited\s*)?(\d+)\s*(?:Edited)?\s*$/;

function toCount(num, suffix) {
  const n = parseFloat(num.replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  const mult = suffix === 'M' ? 1e6 : /k/i.test(suffix) ? 1e3 : 1;
  return Math.round(n * mult);
}

// labels (aria del comentario, sin hijos) es la fuente preferida; text es fallback: el dígito
// DESPUÉS de "LikeReply[Share]". Un número del cuerpo queda antes del trailer y nunca cuenta.
export function parseReactionCount({ labels = null, text = '' } = {}) {
  for (const l of labels ?? []) {
    const m = (l || '').trim().match(REACTION_LABEL);
    if (m) {
      const n = toCount(m[1], m[2]);
      if (n !== null) return n;
    }
  }
  const t = (text || '').replace(/\s+/g, ' ').trim().match(TRAILER);
  return t ? +t[1] : 0;
}

// Suma del post raíz: labels "Haha: 3 people" / "Like: 1 person" del contenedor del post.
// Dos renders del mismo post repiten el label, así que se toma el máximo por tipo.
export function sumPostReactionLabels(labels = []) {
  const byType = new Map();
  for (const l of labels) {
    const m = (l || '').match(/^(Like|Love|Care|Haha|Wow|Sad|Angry):\s*([\d.,]+)\s*([KkM]?)\s+(?:people|person)\b/);
    if (!m) continue;
    const n = toCount(m[2], m[3]);
    if (n !== null) byType.set(m[1], Math.max(byType.get(m[1]) ?? 0, n));
  }
  if (!byType.size) return null;
  return [...byType.values()].reduce((a, b) => a + b, 0);
}

const deburr = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// FB colapsa espacios y pega autor + auto-mención: se quita TODO whitespace y se unifican
// comillas/guiones tipográficos para comparar lo posteado contra el draft.
export function normForMatch(s) {
  return deburr(s)
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/\s+/g, '');
}

export const HEAD_CHARS = 60;

// Cabeza distintiva del draft: sin la @mención inicial (si el draft la trae), primeros
// HEAD_CHARS caracteres normalizados. Muy corta = no distintiva → null (no se usa).
export function draftHead(body, author) {
  let b = (body || '').trim();
  if (author) {
    const re = new RegExp('^@?' + author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s,:]*', 'i');
    b = b.replace(re, '');
  }
  const head = normForMatch(b).slice(0, HEAD_CHARS);
  return head.length >= 25 ? head : null;
}

export function turnMatchesDraft(turnText, head) {
  return !!head && normForMatch(turnText).includes(head);
}

// Drafts consultados de un post: .coagent/<post_id>.consult.json, shape nuevo (drafts[])
// o legacy (draft_sha/draft_file sueltos). Solo drafts cuyo archivo existe.
export function loadConsultDrafts(postId, dir = COAGENT_DIR) {
  const f = resolve(dir, `${postId}.consult.json`);
  if (!existsSync(f)) return [];
  const r = JSON.parse(readFileSync(f, 'utf8'));
  const drafts = Array.isArray(r.drafts)
    ? r.drafts
    : r.draft_sha ? [{ author: r.author, draft_sha: r.draft_sha, draft_file: r.draft_file, consulted_at: r.consulted_at }] : [];
  const out = [];
  for (const d of drafts) {
    const file = d.draft_file && (existsSync(d.draft_file) ? d.draft_file : resolve(dir, d.draft_file));
    if (!file || !existsSync(file)) continue;
    out.push({ ...d, author: d.author ?? r.author ?? null, consulted_at: d.consulted_at ?? r.consulted_at ?? null, body: readFileSync(file, 'utf8') });
  }
  return out;
}

export function listConsultPostIds(dir = COAGENT_DIR) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => /^\d+\.consult\.json$/.test(f)).map((f) => f.split('.')[0]);
}

function localDate(iso, tz = 'America/Mexico_City') {
  const t = Date.parse(iso || '');
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString('en-CA', { timeZone: tz });
}

function addDays(ymd, n) {
  const d = new Date(ymd + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Draft → interacción: actor único con ese nombre, mismo hilo, fecha = día local de la consulta
// o el siguiente; con varias, la del día exacto si es única; si no, null.
export function resolveDraftInteraction(draft, threadId, actors) {
  const who = actors.filter((a) => a.name && draft.author && deburr(a.name).trim() === deburr(draft.author).trim());
  if (who.length !== 1) return null;
  const day = localDate(draft.consulted_at);
  if (!day) return null;
  const inThread = (who[0].interactions ?? []).filter((i) => i.thread_id === threadId);
  const near = inThread.filter((i) => i.date === day || i.date === addDays(day, 1));
  let pick = near.length === 1 ? near[0] : null;
  if (!pick && near.length > 1) {
    const exact = near.filter((i) => i.date === day);
    pick = exact.length === 1 ? exact[0] : null;
  }
  return pick ? { user_id: who[0].user_id, name: who[0].name, interaction: pick } : null;
}

// Un turno mío cuenta solo si todos sus drafts que matchean apuntan a la MISMA interacción (draft sin
// author → el target que FB puso en MI turno), y cada interacción se asigna a un solo turno.
export function matchMyTurns(turns, drafts, threadId, actors) {
  const mine = turns.filter((t) => t.isMine);
  const heads = drafts.map((d) => ({ d, head: draftHead(d.body, d.author) })).filter((x) => x.head);
  const provisional = [];
  const unmatched = [];
  for (const t of mine) {
    const hits = heads.filter((x) => turnMatchesDraft(t.text, x.head));
    const resolved = hits.map((x) => ({ x, r: resolveDraftInteraction({ ...x.d, author: x.d.author ?? t.target ?? null }, threadId, actors) }));
    const keys = new Set(resolved.map(({ r }) => (r ? `${r.user_id}|${r.interaction.date}|${r.interaction.their_move}` : null)));
    if (!hits.length) { unmatched.push({ turn: t, reason: 'sin draft consultado que matchee' }); continue; }
    if (keys.has(null) || keys.size !== 1) { unmatched.push({ turn: t, reason: keys.has(null) ? 'draft sin interacción única en el moat' : 'drafts apuntan a interacciones distintas' }); continue; }
    const { x, r } = resolved[0];
    provisional.push({ turn: t, draft_sha: x.d.draft_sha, key: [...keys][0], ...r });
  }
  const counts = new Map();
  for (const p of provisional) counts.set(p.key, (counts.get(p.key) ?? 0) + 1);
  const matched = [];
  for (const p of provisional) {
    if (counts.get(p.key) > 1) unmatched.push({ turn: p.turn, reason: 'varios turnos míos matchean la misma interacción' });
    else matched.push(p);
  }
  return { matched, unmatched };
}
