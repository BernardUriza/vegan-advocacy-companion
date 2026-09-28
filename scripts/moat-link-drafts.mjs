#!/usr/bin/env node
// Liga cada draft consultado (.coagent/<post>.consult.json) a SU interacción del moat
// escribiendo interaction.draft_sha. Propone por (autor, hilo, día) y desempata por ORDEN
// cronológico cuando hay N drafts y N interacciones del mismo día; --apply escribe.
import { readFileSync, writeFileSync, readdirSync, statSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { basename } from 'path';
import { loadConsultDrafts, draftHead, turnMatchesDraft } from './lurker.mjs';
import { draftSha } from './seed-coagent.mjs';
import { readActors } from './db.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS = resolve(ROOT, 'data', 'actors.json');
const COAGENT = resolve(ROOT, '.coagent');
const deburr = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const localDate = (iso) => iso ? new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }) : null;
export const addDays = (ymd, n) => { const d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

export function writeJsonAtomic(path, data) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}

export function poolFor(day, free, draftDays) {
  const exact = free.filter((i) => i.date === day);
  if (exact.length) return exact;
  const next = addDays(day, 1);
  return draftDays.has(next) ? [] : free.filter((i) => i.date === next);
}

export function applyAssignments(fresh, assignments) {
  const applied = [], skipped = [];
  for (const a of assignments) {
    const actor = fresh.find((x) => x.user_id === a.user_id);
    const hits = (actor?.interactions ?? []).filter((i) => i.thread_id === a.thread_id && i.date === a.date && i.their_move === a.their_move);
    if (hits.length !== 1) { skipped.push({ ...a, reason: `${hits.length} interacciones coinciden en la relectura` }); continue; }
    if (hits[0].draft_sha && hits[0].draft_sha !== a.sha) { skipped.push({ ...a, reason: `ya tiene otro draft_sha (${hits[0].draft_sha})` }); continue; }
    hits[0].draft_sha = a.sha;
    applied.push(a);
  }
  return { applied, skipped };
}

function main() {
const apply = process.argv.includes('--apply');
const sinceIx = process.argv.indexOf('--since');
const since = sinceIx > 0 ? process.argv[sinceIx + 1] : null;
const actors = readActors();
const posts = readdirSync(COAGENT).filter((f) => f.endsWith('.consult.json')).map((f) => f.replace('.consult.json', ''));
const rows = [];
const inferred = [];
const assignments = [];
for (const post of posts) {
  const txFile = resolve(COAGENT, `tx-${post}.json`);
  const readTx = () => { try { return JSON.parse(readFileSync(txFile, 'utf8')); } catch { return null; } };
  const all0 = loadConsultDrafts(post, COAGENT).filter((d) => d.draft_sha).filter((d) => {
    if (d.consulted_at) return true;
    rows.push({ post, author: d.author ?? '?', sha: d.draft_sha, status: `consulted_at null en ${basename(d.draft_file || '')}, se salta (sin fecha no hay pareo por día)` });
    return false;
  }).filter((d) => !since || d.consulted_at >= since).filter((d) => {
    if (draftSha(d.body) === d.draft_sha) return true;
    rows.push({ post, author: d.author ?? '?', sha: d.draft_sha, status: `sha no coincide con el archivo actual (versión superseded de ${basename(d.draft_file || '')}), se ignora` });
    return false;
  });
  if (!all0.length) continue;
  const newestConsult = all0.map((d) => d.consulted_at || '').sort().at(-1);
  const txFresh = existsSync(txFile) && statSync(txFile).mtime.toISOString() > newestConsult;
  const tx = txFresh ? readTx() : null;
  const myTurns = tx ? (tx.turns ?? []).filter((t) => t.isMine) : null;
  const inferAuthor = (d) => {
    const slug = basename(d.draft_file || '').replace(/\.txt$/, '').replace(/^(y\d+-|\d{4}[a-z]?-)/, '').replace(/-(root|crop|richard|veganoyance|vsme|copy\d*)$/, '');
    const hits = actors.filter((a) => deburr(a.name).split(/\s+/)[0] === slug.split('-')[0] && (slug.split('-').length === 1 || deburr(a.name).replace(/\s+/g, '-').startsWith(slug)));
    return hits.length === 1 ? hits[0].name : null;
  };
  const all = all0;
  const drafts = [];
  for (const d of all) {
    if (!d.author) { const a = inferAuthor(d); if (!a) { rows.push({ post, author: '?', sha: d.draft_sha, status: `autor null, no inferible de ${basename(d.draft_file || '')}` }); continue; } d.author = a; d.inferred = true; }
    drafts.push(d);
  }
  if (myTurns) {
    const norm = (t) => (t || '').normalize('NFKC').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, '').toLowerCase().trim();
    const bodyOf = (d) => norm(d.body.replace(new RegExp('^@?' + d.author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s,:]*', 'i'), ''));
    const turnsN = myTurns.map((t) => norm(t.text));
    const fullHit = (d) => turnsN.some((t) => t.includes(bodyOf(d)));
    const headHit = (d) => { const h = draftHead(d.body, d.author); return !!h && myTurns.some((t) => turnMatchesDraft(t.text, h)); };
    const kept = [];
    for (const d of drafts) {
      const full = fullHit(d);
      const sameHead = drafts.filter((o) => o !== d && draftHead(o.body, o.author) === draftHead(d.body, d.author));
      const posted = full || (headHit(d) && !sameHead.some(fullHit));
      if (!posted) { rows.push({ post, author: d.author, sha: d.draft_sha, status: 'no aparece posteado en el hilo (versión descartada), se ignora' }); continue; }
      kept.push(d);
    }
    drafts.length = 0; drafts.push(...kept);
  }
  const groups = new Map();
  for (const d of drafts) { const k = deburr(d.author); (groups.get(k) ?? groups.set(k, []).get(k)).push(d); }
  for (const [author, ds] of groups) {
    const who = actors.filter((a) => deburr(a.name) === author);
    if (who.length !== 1) { rows.push({ post, author, status: 'actor ambiguo/ausente', n: ds.length }); continue; }
    const inThread = (who[0].interactions ?? []).filter((i) => i.thread_id === post);
    const already = new Set(inThread.map((i) => i.draft_sha).filter(Boolean));
    const pending = ds.filter((d) => !already.has(d.draft_sha)).sort((a, b) => a.consulted_at.localeCompare(b.consulted_at));
    const free = () => inThread.filter((i) => !i.draft_sha);
    const byDay = new Map();
    for (const d of pending) { const day = localDate(d.consulted_at); (byDay.get(day) ?? byDay.set(day, []).get(day)).push(d); }
    const draftDays = new Set(ds.map((d) => localDate(d.consulted_at)));
    for (const [day, group] of byDay) {
      const pool = poolFor(day, free(), draftDays);
      const pairable = pool.length === group.length;
      group.forEach((d, k) => {
        if (!pairable) { rows.push({ post, author, sha: d.draft_sha, status: `SIN PAR (${pool.length} interacciones libres, ${group.length} drafts el ${day})` }); return; }
        const pick = pool[k];
        const how = group.length === 1 ? 'único del día' : `orden ${k + 1}/${group.length}`;
        rows.push({ post, author: d.author + (d.inferred ? ' (inferido del archivo)' : ''), sha: d.draft_sha, status: how, date: pick.date, their_move: (pick.their_move || '').slice(0, 70), draft: d.body.replace(/\s+/g, ' ').slice(0, 60) });
        pick.draft_sha = d.draft_sha;
        assignments.push({ user_id: who[0].user_id, thread_id: post, date: pick.date, their_move: pick.their_move, sha: d.draft_sha });
        if (d.inferred) inferred.push({ post, sha: d.draft_sha, author: d.author });
      });
    }
  }
}
if (apply && inferred.length) {
  for (const { post, sha, author } of inferred) {
    const f = resolve(COAGENT, `${post}.consult.json`);
    const r = JSON.parse(readFileSync(f, 'utf8'));
    const e = (r.drafts || []).find((d) => d.draft_sha === sha);
    if (e && !e.author) { e.author = author; writeJsonAtomic(f, r); }
  }
  console.log(`✓ author inferido escrito en ${inferred.length} recibo(s)`);
}
for (const r of rows) console.log(`${r.post} · ${r.author} · ${r.sha ?? ''} · ${r.status}${r.date ? ` · [${r.date}] ${r.their_move}\n      ↔ ${r.draft}` : ''}`);
if (apply) {
  const fresh = readActors();
  const { applied, skipped } = applyAssignments(fresh, assignments);
  for (const k of skipped) console.log(`  ✗ no escrito ${k.thread_id} · ${k.user_id} · ${k.sha}: ${k.reason}`);
  if (applied.length) writeJsonAtomic(ACTORS, fresh);
  console.log(`\n✓ draft_sha escrito en ${applied.length} interacción(es)${skipped.length ? `, ${skipped.length} omitida(s)` : ''}`);
}
else console.log(`\n(dry-run) ${assignments.length} pareo(s); --apply para escribir`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
