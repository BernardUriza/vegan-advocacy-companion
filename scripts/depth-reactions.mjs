#!/usr/bin/env node
// Profundidad de anidación vs señal de lurker sobre MIS replies, leído de los .coagent/tx-*.json.
// Pregunta (Gemini 2026-10-05, sin dato): ¿una reply enterrada en la anidación tiene audiencia de uno?
// Solo lectura; no decide nada. La regla, si la hay, se registra con esta tabla en la mano.
//
// Uso: node scripts/depth-reactions.mjs [--json] [--since YYYY-MM-DD]

import { readdirSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { thirdPartyReplies } from './lurker.mjs';
import { jeffreysInterval } from './stats.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIR = resolve(ROOT, '.coagent');

// tx anteriores al campo `depth`: se deriva del aria-label (null → raíz; "'s comment" → 1; "'s reply" → 2)
export function depthOf(turn) {
  if (Number.isInteger(turn.depth)) return turn.depth;
  if (!turn.target) return 0;
  return /'s comment/.test(turn.label || '') ? 1 : 2;
}

// posición de la reply dentro de la lista de su comentario raíz (0 = es la raíz)
export function annotate(turns) {
  let pos = 0;
  return turns.map((t) => {
    const depth = depthOf(t);
    pos = depth === 0 ? 0 : pos + 1;
    return { ...t, depth, position: pos };
  });
}

export function collect(files, { since = null } = {}) {
  const rows = [];
  for (const f of files) {
    let j;
    try { j = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
    if (since && statSync(f).mtime.toISOString().slice(0, 10) < since) continue;
    const turns = annotate(j.turns || []);
    turns.forEach((t, i) => {
      if (!t.isMine || t.retained) return;
      const interlocutor = t.target || null;
      rows.push({ file: f, depth: t.depth, position: t.position, reactions: Number.isInteger(t.reactions) ? t.reactions : null, thirdParty: thirdPartyReplies(turns, i, interlocutor).length });
    });
  }
  return rows;
}

export function summarize(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    const k = key(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups.entries()].sort((a, b) => (a[0] > b[0] ? 1 : -1)).map(([k, rs]) => {
    const measured = rs.filter((r) => r.reactions !== null);
    const withLike = measured.filter((r) => r.reactions > 0).length;
    const sorted = measured.map((r) => r.reactions).sort((a, b) => a - b);
    const { lo, hi } = jeffreysInterval(withLike, measured.length);
    return {
      key: k, n: rs.length, measured: measured.length, withLike,
      pLike: measured.length ? `${withLike}/${measured.length} [${(lo * 100).toFixed(0)}–${(hi * 100).toFixed(0)}%]` : '—',
      meanLikes: measured.length ? (sorted.reduce((a, b) => a + b, 0) / measured.length).toFixed(2) : '—',
      medianLikes: measured.length ? sorted[Math.floor(sorted.length / 2)] : '—',
      withThird: rs.filter((r) => r.thirdParty > 0).length,
    };
  });
}

function table(title, rows) {
  console.log(`\n${title}\n`);
  const header = ['', 'mis replies', 'medidas', 'con ≥1 like (IC95)', 'media', 'mediana', 'con terceros'];
  const body = rows.map((r) => [String(r.key), String(r.n), String(r.measured), r.pLike, String(r.meanLikes), String(r.medianLikes), String(r.withThird)]);
  const w = header.map((h, i) => Math.max(h.length, ...body.map((b) => b[i].length)));
  const fmt = (r) => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  console.log(fmt(header));
  console.log(w.map((n) => '-'.repeat(n)).join('  '));
  body.forEach((r) => console.log(fmt(r)));
}

function main() {
  const args = process.argv.slice(2);
  const sinceIdx = args.indexOf('--since');
  const since = sinceIdx >= 0 ? args[sinceIdx + 1] : null;
  const files = readdirSync(DIR).filter((x) => /^tx-.*\.json$/.test(x)).map((x) => resolve(DIR, x));
  const rows = collect(files, { since });
  const byDepth = summarize(rows, (r) => `depth ${r.depth}`);
  const byPosition = summarize(rows, (r) => (r.position === 0 ? 'raíz' : r.position <= 3 ? 'pos 1–3' : r.position <= 8 ? 'pos 4–8' : 'pos 9+'));
  if (args.includes('--json')) { console.log(JSON.stringify({ files: files.length, replies: rows.length, byDepth, byPosition }, null, 2)); return; }
  console.log(`depth-reactions · ${files.length} tx · ${rows.length} replies mías (vivas, no retained)`);
  table('Por PROFUNDIDAD (0 raíz · 1 reply al comentario · 2 reply a una reply)', byDepth);
  table('Por POSICIÓN dentro de la lista de su comentario raíz', byPosition);
  console.log('\nLectura: likes = secundario (rebaño + orden de FB; research 28-sep). "con terceros" = alguien más me contestó.');
  console.log('Intervalos que se traslapan NO separan niveles. Nada de esto decide una denylist; solo dice si hay señal que medir mejor.');
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
