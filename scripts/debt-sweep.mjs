// Debt sweep — encuentra la deuda DESDE EL MOAT, no desde las notificaciones de FB.
//
// El embudo de notificaciones (notif-scan) es LOSSY: FB agrega ("and N others"),
// vence avisos viejos, y un debate de hace días deja de notificar. La deuda real
// vive en el moat (data/actors.json): interacciones pending|goalpost que siguen
// abiertas. Este barrido itera esos threads, reconstruye su openUrl desde el
// registro (data/threads.json, auto-poblado por thread-extract), re-extrae cada uno
// y reporta los `owes:true`/`suspect` — independiente de si FB sigue notificando.
//
// Es el paso 0.5 de [notification-agrupation]: la búsqueda de deuda rigurosa que el
// embudo no puede dar. Solo SURFACEA candidatas; la jugada se decide con dossiers.
//
// Uso:
//   node debt-sweep.mjs            # tabla humana, ordenada por deuda dura
//   node debt-sweep.mjs --json     # JSON para pipear
//
// Honestidad (Art. 2): freshestMin === UNKNOWN_AGE es el centinela de "no pude fechar este
// turno", NO "fresco" ni "viejísimo". Esas son candidatas a confirmar, no deuda viva
// confirmada — se marcan "edad?". Un hilo cuya extracción quedó truncada se marca
// EXTRACCIÓN INCOMPLETA: su deuda no se sirve como dato duro.

import { execFileSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getOpenDebtThreads, getThreadMeta, threadOpenUrl } from './db.mjs';
import { UNKNOWN_AGE, MAX_AGE_DAYS } from './freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const asJson = process.argv.includes('--json');

function extractThread(url) {
  const out = execFileSync('node', ['thread-extract.mjs', url, '--json'], {
    cwd: HERE,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return JSON.parse(out.toString('utf8'));
}

const results = [];
const staleSkipped = [];
for (const { thread_id, actors, stale, newestDate, ageDays } of getOpenDebtThreads({ includeStale: true })) {
  const meta = getThreadMeta(thread_id);
  const url = threadOpenUrl(thread_id);
  const moatActors = actors.map((a) => `${a.name}(${a.outcome})`);
  // TOPE DE FRESCURA: la deuda abierta más reciente de este hilo ya pasó MAX_AGE_DAYS —
  // se lista, NO se abre (cero tabs, cero thread-extract). Ver pipeline-freshness-cap.md.
  if (stale) {
    staleSkipped.push({ thread_id, slug: meta?.slug ?? null, newestDate, ageDays, moatActors });
    continue;
  }
  if (!url) {
    results.push({ thread_id, unresolved: true, slug: meta?.slug ?? null, moatActors });
    continue;
  }
  try {
    const d = extractThread(url);
    const owes = (d.debt ?? []).filter((x) => x.owes);
    const suspect = (d.debt ?? []).filter((x) => x.suspect && !x.owes);
    results.push({
      thread_id,
      slug: meta?.slug ?? null,
      url,
      // `complete` viene de thread-extract: si la extracción quedó truncada, la deuda de este
      // hilo NO es confiable y el sweep debe decirlo en vez de servirla como dato duro (Art. 2).
      complete: d.complete !== false,
      completeness: d.completeness ?? null,
      turns: d.turns?.length ?? 0,
      moatActors,
      owes: owes.map((x) => ({ author: x.author, user_id: x.user_id, freshestMin: x.freshestMin, ageUnknown: !!x.ageUnknown, neverAnswered: !!x.neverAnswered, oppCount: x.oppCount, myCount: x.myCount })),
      suspect: suspect.map((x) => ({ author: x.author, user_id: x.user_id, freshestMin: x.freshestMin, ageUnknown: !!x.ageUnknown, neverAnswered: !!x.neverAnswered, oppCount: x.oppCount, myCount: x.myCount })),
    });
  } catch (e) {
    results.push({ thread_id, slug: meta?.slug ?? null, url, error: String(e.message || e).slice(0, 200), moatActors });
  }
}

const score = (r) => (r.owes?.length ?? 0) * 100 + (r.suspect?.length ?? 0) * 10 - (r.unresolved ? -1 : 0);
results.sort((a, b) => score(b) - score(a));

if (asJson) {
  console.log(JSON.stringify({ generatedFrom: 'moat', maxAgeDays: MAX_AGE_DAYS, threads: results, staleSkipped }, null, 2));
  process.exit(0);
}

const age = (m) => (m === UNKNOWN_AGE ? 'edad?' : m >= 1440 ? `${Math.round(m / 1440)}d` : m >= 60 ? `${Math.round(m / 60)}h` : `${m}m`);
console.log('═'.repeat(64));
console.log('  DEBT SWEEP — deuda desde el MOAT (no desde notificaciones de FB)');
console.log('═'.repeat(64));
console.log(`  ${results.length} threads con deuda abierta · barridos en vivo · tope ${MAX_AGE_DAYS}d\n`);
if (staleSkipped.length) {
  console.log(`⏳ VIEJOS (> ${MAX_AGE_DAYS}d) — ${staleSkipped.length} hilo(s) con deuda abierta en el moat que NO se abren:`);
  for (const s of staleSkipped) console.log(`     ${s.thread_id} (${s.slug ?? '?'}) · última ${s.newestDate} (${s.ageDays}d) · ${s.moatActors.join(', ')}`);
  console.log('     → ciérralos en el moat (close-outcomes / reflex apply como silent), no los reabras.\n');
}

for (const r of results) {
  if (r.unresolved) {
    console.log(`⚠️  ${r.thread_id} (${r.slug ?? '?'}) — NO registrado en data/threads.json`);
    console.log(`     corré thread-extract una vez para auto-registrarlo · moat: ${r.moatActors.join(', ')}\n`);
    continue;
  }
  if (r.error) {
    console.log(`❌ ${r.thread_id} (${r.slug ?? '?'}) — extract falló: ${r.error}`);
    console.log(`     moat: ${r.moatActors.join(', ')}\n`);
    continue;
  }
  const hot = r.owes.length ? '🔴' : r.suspect.length ? '🟡' : '🟢';
  console.log(`${hot} ${r.thread_id} (${r.slug ?? '?'}) · ${r.turns} turnos`);
  if (!r.complete) {
    const c = r.completeness ?? {};
    const why = [
      c.pendingExpandButtons ? `${c.pendingExpandButtons} sub-hilo(s) sin abrir` : null,
      c.missingReplies ? `faltan ${c.missingReplies} réplicas prometidas` : null,
      c.truncatedComments ? `${c.truncatedComments} comentario(s) cortados` : null,
    ].filter(Boolean).join(' · ');
    console.log(`     ⚠️  EXTRACCIÓN INCOMPLETA (${why}) — la deuda de abajo NO es confiable`);
  }
  for (const o of r.owes) console.log(`     OWES  ${o.author}  ${age(o.freshestMin)}${o.ageUnknown && o.neverAnswered ? ' (nunca contestada)' : ''}  opp${o.oppCount}/my${o.myCount}`);
  for (const s of r.suspect) console.log(`     susp  ${s.author}  ${age(s.freshestMin)}  opp${s.oppCount}/my${s.myCount}`);
  if (!r.owes.length && !r.suspect.length) console.log(`     (sin owes/suspect — deuda del moat probablemente pagada; candidato a reflex)`);
  console.log(`     moat: ${r.moatActors.join(', ')}\n`);
}

const hot = results.filter((r) => r.owes?.length).length;
console.log(`→ ${hot} thread(s) con OWES dura. "edad?" = raíz sin fechar (candidata, no fresca confirmada).`);
