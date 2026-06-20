// Outcome-loop — cierra la memoria write-only del companion (data/actors.json).
//
// Las interacciones nacen con outcome="pending" y hoy NUNCA se cierran: la memoria
// es write-only. Este script toma un transcript de hilo (formato thread-extract:
// { turns:[...], me, postOwner, url, ... }) y, por cada interacción `pending` de un
// actor presente en ESE hilo, clasifica el outcome con heurísticas deterministas
// (ver scripts/OUTCOME-LOOP.md) leyendo qué hizo el oponente DESPUÉS de tu reply.
//
// Uso:
//   node close-outcomes.mjs <transcript.json>            # aplica (escribe vía db.mjs)
//   node close-outcomes.mjs <transcript.json> --dry-run  # clasifica sin escribir
//   cat transcript.json | node close-outcomes.mjs --stdin
//
// NO toca Chrome/red/Facebook: solo lee un transcript ya extraído (etapa 2) y
// escribe el outcome con closeOutcome() (append-only sobre el campo). La integración
// con el Chrome en vivo (re-extraer el hilo para alimentar este script) está
// DIFERIDA — ver OUTCOME-LOOP.md.

import { readFileSync } from 'fs';
import { getPendingInteractions, closeOutcome } from './db.mjs';

// ---- keyword sets para la clasificación (case-insensitive, word-ish boundaries) ----
const CONCEDED = [
  'fair enough', "you're right", 'you are right', 'youre right', 'good point',
  'i see your point', 'i see what you mean', 'i stand corrected', 'point taken',
  "you've convinced me", 'you have convinced me', 'i concede', 'agreed', "i'll give you that",
];
const ESCALATED = [
  'cult', 'brainwash', 'sheep', 'virtue signal', 'preachy', 'manipulat',
  'idiot', 'stupid', 'moron', 'clown', 'pathetic', 'shut up', 'snowflake',
  'triggered', 'extremist', 'nutjob', 'lunatic', 'troll', 'loser', 'pussy',
];
const GOALPOST = [
  'but what about', 'what about', "that's not the point", 'thats not the point',
  'the real issue', 'you still', 'anyway', 'besides', 'moving on', 'actually the question is',
  'plants feel', 'predators', 'lions', 'we are omnivore', 'natural', 'circle of life',
];

const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const hits = (text, list) => list.filter((k) => text.includes(k));

// ---- normaliza el turno: tolera thread-extract (isMine/ageStr) y el shape del prompt (mine/age) ----
function normTurn(t) {
  return {
    author: t.author,
    user_id: t.user_id ?? null,
    target: t.target ?? null,
    mine: t.mine ?? t.isMine ?? false,
    text: norm(t.text),
  };
}

// ---- clasifica el outcome de UNA interacción dada el transcript del hilo ----
// La heurística mira lo que el oponente (actor) dijo DESPUÉS de tu última reply
// en este hilo. Si no volvió a hablar → "silent".
function classify(transcript, actor) {
  const turns = transcript.map(normTurn);
  const oppById = (t) => actor.user_id && t.user_id && t.user_id === actor.user_id;
  const oppByName = (t) => !t.mine && actor.name && t.author === actor.name;
  const isOpp = (t) => oppById(t) || oppByName(t);

  // ancla = MI ÚLTIMA reply dirigida a ESTE oponente (no la primera — si le contesté
  // varias veces a través de días, los turnos que él dijo ENTRE mi primera y mi última
  // reply ya los respondí; solo lo que dijo DESPUÉS de mi ÚLTIMA reply es la respuesta
  // a la jugada que estoy cerrando. Anclar en la primera mete keyword-bleed de turnos
  // viejos/de otras ramas → silencio mal clasificado como escalated/goalpost).
  let anchor = lastIndexWhere(turns, (t) => t.mine && t.target === actor.name);
  if (anchor < 0) anchor = lastIndexWhere(turns, (t) => t.mine);

  // turnos del oponente DESPUÉS de mi reply a él (lo que cuenta para el cierre).
  const after = turns.filter((t, i) => isOpp(t) && i > anchor);

  if (after.length === 0) {
    // el oponente no volvió a hablar tras tu reply → silencio (la jugada quedó sin contestar).
    return { outcome: 'silent', evidence: 'opponent did not reply after your reply to them' };
  }

  const blob = after.map((t) => t.text).join(' • ');

  // precedencia: escalated > conceded > goalpost > engaged.
  // (un insulto envenena el intercambio aunque haya un "good point" sarcástico; la
  // concesión gana al goalpost porque es la señal más fuerte de que el reply pegó.)
  const esc = hits(blob, ESCALATED);
  if (esc.length) return { outcome: 'escalated', evidence: `keywords: ${esc.join(', ')}` };

  const con = hits(blob, CONCEDED);
  if (con.length) return { outcome: 'conceded', evidence: `keywords: ${con.join(', ')}` };

  const gp = hits(blob, GOALPOST);
  if (gp.length) return { outcome: 'goalpost', evidence: `keywords: ${gp.join(', ')}` };

  return { outcome: 'engaged', evidence: `opponent kept arguing (${after.length} civil follow-up turn(s), no concession/escalation/goalpost markers)` };
}

function lastIndexWhere(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) if (pred(arr[i])) return i;
  return -1;
}

function firstIndexWhere(arr, pred) {
  for (let i = 0; i < arr.length; i++) if (pred(arr[i])) return i;
  return -1;
}

// ---- carga el transcript de archivo o stdin ----
function loadTranscript() {
  const fileArg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (process.argv.includes('--stdin') || !fileArg) {
    const raw = readFileSync(0, 'utf8');
    return JSON.parse(raw);
  }
  return JSON.parse(readFileSync(fileArg, 'utf8'));
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  let doc;
  try {
    doc = loadTranscript();
  } catch (e) {
    console.error('No pude leer el transcript JSON:', e.message);
    console.error('uso: node close-outcomes.mjs <transcript.json> [--dry-run] | --stdin');
    process.exit(1);
  }

  const turns = doc.turns;
  if (!Array.isArray(turns)) {
    console.error('El transcript no tiene un array `turns` (formato thread-extract).');
    process.exit(1);
  }

  // los thread_id presentes en este hilo: del doc, o inferidos de la url.
  const threadIds = new Set();
  if (doc.thread_id) threadIds.add(String(doc.thread_id));
  if (doc.post_id) threadIds.add(String(doc.post_id));
  if (doc.url) {
    const m = String(doc.url).match(/(?:post_id|multi_permalinks)=(\d+)/) || String(doc.url).match(/\/posts\/(\d+)/);
    if (m) threadIds.add(m[1]);
  }

  // candidatas: interacciones pending cuyo thread_id esté en este hilo.
  const pending = getPendingInteractions().filter((p) =>
    threadIds.size ? threadIds.has(String(p.thread_id)) : true
  );

  if (!pending.length) {
    console.log(
      threadIds.size
        ? `Sin interacciones pending para los thread_id de este hilo (${[...threadIds].join(', ')}).`
        : 'Sin thread_id en el transcript y sin interacciones pending — nada que cerrar.'
    );
    return;
  }

  const results = [];
  for (const p of pending) {
    const { outcome, evidence } = classify(turns, { user_id: p.user_id, name: p.name });
    let applied = false;
    if (!dryRun) {
      const r = closeOutcome(p.user_id, p.thread_id, outcome, evidence);
      applied = !!r;
    }
    results.push({ name: p.name, user_id: p.user_id, thread_id: p.thread_id, framework: p.framework, outcome, evidence, applied });
  }

  const tally = results.reduce((m, r) => ((m[r.outcome] = (m[r.outcome] || 0) + 1), m), {});
  console.log(`\n=== OUTCOME-LOOP ${dryRun ? '(dry-run)' : ''} — hilo ${[...threadIds].join(', ') || '(?)'} ===`);
  for (const r of results) {
    console.log(`  ${r.applied || dryRun ? '✓' : '—'} ${r.name} (${r.user_id})  outcome=${r.outcome}`);
    console.log(`      framework=${r.framework ?? '(none)'} · ${r.evidence}`);
  }
  console.log(`\n  tally: ${JSON.stringify(tally)}  ${dryRun ? '(nada escrito — dry-run)' : '(escrito vía db.mjs)'}\n`);
}

main();
