// Lurker sweep: re-extrae los hilos FRESCOS del moat y escribe lurker_reactions (reacciones a MI reply).
// Uso: node lurker-sweep.mjs [--dry-run] [--json] — nunca abre hilos de más de MAX_AGE_DAYS.

import { execFileSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, threadOpenUrl, updateInteractionLurker } from './db.mjs';
import { MAX_AGE_DAYS, isStaleDate } from './freshness.mjs';
import { loadConsultDrafts, matchMyTurns, COAGENT_DIR } from './lurker.mjs';

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
  const { matched, unmatched } = matchMyTurns(d.turns ?? [], drafts, thread_id, readActors());
  const rows = [];
  for (const m of matched) {
    const needle = m.interaction.their_move.slice(0, 40);
    let written = false, writeError = null;
    if (!dryRun) {
      try {
        updateInteractionLurker(m.user_id, thread_id, m.interaction.date, needle, { reactions: m.turn.reactions ?? 0, checkedAt });
        written = true;
      } catch (e) {
        writeError = String(e.message || e);
      }
    }
    rows.push({ target: m.name, date: m.interaction.date, framework: m.interaction.framework ?? null, reactions: m.turn.reactions ?? 0, draft_sha: m.draft_sha, written, writeError });
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
console.log('  LURKER SWEEP — reacciones a mis replies (la huella del lector silencioso)');
console.log('═'.repeat(64));
console.log(`  ${fresh.size} hilo(s) frescos · tope ${MAX_AGE_DAYS}d · ${staleThreads.size} viejo(s) NO abiertos${dryRun ? ' · DRY-RUN (no escribe)' : ''}\n`);
for (const t of threads) {
  if (t.unresolved) { console.log(`⚠️  ${t.thread_id} — no registrado en data/threads.json\n`); continue; }
  if (t.error) { console.log(`❌ ${t.thread_id} — extract falló: ${t.error}\n`); continue; }
  if (t.stale) { console.log(`⏳ ${t.thread_id} — thread-extract lo marcó stale, no se mide\n`); continue; }
  console.log(`${t.thread_id} · post 👍 ${t.postReactions ?? '-'} · ${t.drafts} draft(s) consultados${t.complete ? '' : ' · ⚠️ EXTRACCIÓN INCOMPLETA'}`);
  for (const r of t.matched) {
    const st = r.writeError ? `✗ ${r.writeError}` : r.written ? 'escrito' : 'dry-run';
    console.log(`   👍 ${String(r.reactions).padStart(3)}  → ${r.target} [${r.date}] ${r.framework ?? '(sin framework)'} · ${st}`);
  }
  for (const u of t.unmatched) console.log(`   👍 ${String(u.reactions).padStart(3)}  ?  → ${u.target ?? '(raíz)'} — sin match (${u.reason}): "${u.head}"`);
  console.log('');
}
console.log(`→ ${totals.matched} reply(s) mío(s) medidos y ligados al moat · ${totals.unmatched} sin match confiable (no se escribe, Art. 2).`);
