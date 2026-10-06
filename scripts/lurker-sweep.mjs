// Lurker sweep: re-extrae los hilos FRESCOS del moat y escribe, por reply mía, las respuestas de terceros
// (verbatim, para que el reflex codifique su postura) y lurker_reactions (dato secundario, no el norte).
// Uso: node lurker-sweep.mjs [--dry-run] [--json] — nunca abre hilos de más de MAX_AGE_DAYS.
//      node lurker-sweep.mjs --backfill-placement [--dry-run] — sin Chrome: escribe reply_depth/reply_position
//      desde los .coagent/tx-*.json ya extraídos, solo donde el draft empata por draft_sha único.

import { execFileSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, threadOpenUrl, updateInteractionLurker, updateInteractionPlacement } from './db.mjs';
import { MAX_AGE_DAYS, isStaleDate } from './freshness.mjs';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { loadConsultDrafts, matchMyTurns, thirdPartyReplies, annotate, COAGENT_DIR } from './lurker.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const asJson = process.argv.includes('--json');
const dryRun = process.argv.includes('--dry-run');

function extractThread(url) {
  const out = execFileSync('node', ['thread-extract.mjs', url, '--json'], {
    cwd: HERE,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out.toString('utf8'));
}

if (process.argv.includes('--backfill-placement')) {
  const done = [], skipped = [];
  const threadIds = new Set(readActors().flatMap(a => (a.interactions ?? []).filter(i => i.draft_sha && i.reply_depth === undefined).map(i => i.thread_id)));
  for (const thread_id of threadIds) {
    const tx = resolve(COAGENT_DIR, `tx-${thread_id}.json`);
    if (!existsSync(tx)) { skipped.push({ thread_id, reason: 'sin tx' }); continue; }
    const turns = annotate(JSON.parse(readFileSync(tx, 'utf8')).turns ?? []);
    const { matched } = matchMyTurns(turns, loadConsultDrafts(thread_id), thread_id, readActors());
    for (const m of matched) {
      if (m.interaction.reply_depth !== undefined || !m.interaction.draft_sha) continue;
      const row = { thread_id, target: m.name, date: m.interaction.date, depth: m.turn.depth, position: m.turn.position };
      if (dryRun) { done.push(row); continue; }
      try { updateInteractionPlacement(m.user_id, thread_id, m.interaction.draft_sha, { depth: m.turn.depth, position: m.turn.position }); done.push(row); }
      catch (e) { skipped.push({ ...row, reason: String(e.message || e) }); }
    }
  }
  console.log(JSON.stringify({ dryRun, written: done.length, skipped: skipped.length, byDepth: done.reduce((a, r) => ({ ...a, [r.depth]: (a[r.depth] ?? 0) + 1 }), {}), skippedDetail: skipped.slice(0, 12) }, null, 2));
  process.exit(0);
}

const fresh = new Set();
const staleThreads = new Set();
for (const a of readActors()) {
  for (const it of a.interactions ?? []) {
    if (!it.thread_id || !Number.isFinite(Date.parse(it.date))) continue;
    (isStaleDate(it.date) ? staleThreads : fresh).add(it.thread_id);
  }
}
for (const t of fresh) staleThreads.delete(t);

const checkedAt = new Date().toISOString();
const threads = [];
for (const thread_id of fresh) {
  const url = threadOpenUrl(thread_id);
  if (!url) { threads.push({ thread_id, unresolved: true }); continue; }
  let d;
  try {
    d = extractThread(url);
  } catch (e) {
    threads.push({ thread_id, url, error: String(e.message || e).slice(0, 200) });
    continue;
  }
  if (d.stale) { threads.push({ thread_id, url, stale: true }); continue; }
  if (d.unavailable) { threads.push({ thread_id, url, error: 'post no disponible (borrado o restringido) — cerrar sus interacciones, no re-correr' }); continue; }
  if (!(d.turns ?? []).length) { threads.push({ thread_id, url, error: 'extracción vacía (0 turnos) — FB no terminó de cargar; re-correr' }); continue; }
  const drafts = loadConsultDrafts(thread_id);
  d.turns = annotate(d.turns ?? []);
  const { matched, unmatched } = matchMyTurns(d.turns, drafts, thread_id, readActors());
  const rows = [];
  for (const m of matched) {
    const needle = m.interaction.their_move.slice(0, 40);
    const thirdParty = thirdPartyReplies(d.turns, d.turns.indexOf(m.turn), m.name);
    let written = false, writeError = null;
    if (!dryRun) {
      try {
        updateInteractionLurker(m.user_id, thread_id, m.interaction.date, needle, { reactions: m.turn.reactions ?? 0, thirdParty, draftSha: m.draft_sha, checkedAt, depth: m.turn.depth, position: m.turn.position });
        written = true;
      } catch (e) {
        writeError = String(e.message || e);
      }
    }
    rows.push({ target: m.name, date: m.interaction.date, framework: m.interaction.framework ?? null, reactions: m.turn.reactions ?? 0, thirdParty: thirdParty.length, depth: m.turn.depth, position: m.turn.position, draft_sha: m.draft_sha, written, writeError });
  }
  threads.push({
    thread_id, url, complete: d.complete !== false, postReactions: d.postReactions ?? null, drafts: drafts.length,
    matched: rows,
    unmatched: unmatched.map((u) => ({ target: u.turn.target, reactions: u.turn.reactions ?? 0, reason: u.reason, head: u.turn.text.slice(0, 70) })),
  });
}

const totals = threads.reduce((acc, t) => {
  acc.matched += t.matched?.length ?? 0;
  acc.unmatched += t.unmatched?.length ?? 0;
  return acc;
}, { matched: 0, unmatched: 0 });

if (asJson) {
  console.log(JSON.stringify({ maxAgeDays: MAX_AGE_DAYS, dryRun, coagentDir: COAGENT_DIR, checkedAt, totals, staleSkipped: [...staleThreads], threads }, null, 2));
  process.exit(0);
}

console.log('═'.repeat(64));
console.log('  LURKER SWEEP — terceros que responden a mis replies (proxy primario) + reacciones (secundario)');
console.log('═'.repeat(64));
console.log(`  ${fresh.size} hilo(s) frescos · tope ${MAX_AGE_DAYS}d · ${staleThreads.size} viejo(s) NO abiertos${dryRun ? ' · DRY-RUN (no escribe)' : ''}\n`);
for (const t of threads) {
  if (t.unresolved) { console.log(`⚠️  ${t.thread_id} — no registrado en data/threads.json\n`); continue; }
  if (t.error) { console.log(`❌ ${t.thread_id} — extract falló: ${t.error}\n`); continue; }
  if (t.stale) { console.log(`⏳ ${t.thread_id} — thread-extract lo marcó stale, no se mide\n`); continue; }
  console.log(`${t.thread_id} · post 👍 ${t.postReactions ?? '-'} · ${t.drafts} draft(s) consultados${t.complete ? '' : ' · ⚠️ EXTRACCIÓN INCOMPLETA'}`);
  for (const r of t.matched) {
    const st = r.writeError ? `✗ ${r.writeError}` : r.written ? 'escrito' : 'dry-run';
    console.log(`   💬 ${String(r.thirdParty).padStart(2)} terceros · 👍 ${String(r.reactions).padStart(3)} · d${r.depth}/p${r.position}  → ${r.target} [${r.date}] ${r.framework ?? '(sin framework)'} · ${st}`);
  }
  for (const u of t.unmatched) console.log(`   👍 ${String(u.reactions).padStart(3)}  ?  → ${u.target ?? '(raíz)'} — sin match (${u.reason}): "${u.head}"`);
  console.log('');
}
console.log(`→ ${totals.matched} reply(s) mío(s) medidos y ligados al moat · ${totals.unmatched} sin match confiable (no se escribe, Art. 2).`);
