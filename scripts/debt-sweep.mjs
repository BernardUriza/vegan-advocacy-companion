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

import { spawnSync } from 'child_process';
import { dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { getOpenDebtThreads, getThreadMeta, threadOpenUrl } from './db.mjs';
import { UNKNOWN_AGE, MAX_AGE_DAYS } from './freshness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const asJson = process.argv.includes('--json');
const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

export function stderrTail(text, lines = 8) {
  return (text || '').trim().split('\n').slice(-lines).join('\n');
}

function extractThread(url) {
  const r = spawnSync('node', ['thread-extract.mjs', url, '--json'], { cwd: HERE, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8' });
  if (r.status !== 0 || r.error) {
    const err = new Error(`thread-extract salió ${r.status ?? r.error?.code}`);
    err.stderrTail = stderrTail(r.stderr);
    throw err;
  }
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    const err = new Error('thread-extract no devolvió JSON: ' + e.message);
    err.stderrTail = stderrTail(r.stderr);
    throw err;
  }
}

// Sin turnos o con complete:false la extracción NO prueba nada: su deuda vacía no es "pagada".
export function classifyExtraction(d) {
  const turns = d?.turns?.length ?? 0;
  if (d?.unavailable) return { status: 'unavailable', reasons: ['el post ya no está disponible'] };
  if (turns === 0) return { status: 'failed', reasons: ['cero turnos extraídos'] };
  if (d.complete === false) {
    const c = d.completeness ?? {};
    const reasons = [
      c.emptyExtraction ? 'extracción vacía' : null,
      c.pendingExpandButtons ? `${c.pendingExpandButtons} sub-hilo(s) sin abrir` : null,
      c.missingReplies ? `faltan ${c.missingReplies} réplicas prometidas` : null,
      c.truncatedComments ? `${c.truncatedComments} comentario(s) cortados` : null,
    ].filter(Boolean);
    return { status: 'incomplete', reasons: reasons.length ? reasons : ['complete:false'] };
  }
  return { status: 'ok', reasons: [] };
}

export function sweepExitCode(results) {
  const attempted = results.filter((r) => !r.unresolved);
  if (!attempted.length) return 0;
  return attempted.every((r) => r.error || r.extraction === 'failed' || r.extraction === 'incomplete') ? 2 : 0;
}

function sweep() {
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
      const verdict = classifyExtraction(d);
      const owes = (d.debt ?? []).filter((x) => x.owes);
      const suspect = (d.debt ?? []).filter((x) => x.suspect && !x.owes);
      results.push({
        thread_id,
        slug: meta?.slug ?? null,
        url,
        // `complete` viene de thread-extract: si la extracción quedó truncada, la deuda de este
        // hilo NO es confiable y el sweep debe decirlo en vez de servirla como dato duro (Art. 2).
        complete: d.complete !== false && verdict.status === 'ok',
        extraction: verdict.status,
        extractionReasons: verdict.reasons,
        completeness: d.completeness ?? null,
        turns: d.turns?.length ?? 0,
        moatActors,
        owes: owes.map((x) => ({ author: x.author, user_id: x.user_id, freshestMin: x.freshestMin, ageUnknown: !!x.ageUnknown, neverAnswered: !!x.neverAnswered, oppCount: x.oppCount, myCount: x.myCount })),
        suspect: suspect.map((x) => ({ author: x.author, user_id: x.user_id, freshestMin: x.freshestMin, ageUnknown: !!x.ageUnknown, neverAnswered: !!x.neverAnswered, oppCount: x.oppCount, myCount: x.myCount })),
      });
    } catch (e) {
      results.push({ thread_id, slug: meta?.slug ?? null, url, error: String(e.message || e).slice(0, 200), stderrTail: e.stderrTail ?? null, moatActors, extraction: 'failed' });
    }
  }
  return { results, staleSkipped };
}

export function report({ results, staleSkipped }, { json = asJson } = {}) {
  const score = (r) => (r.owes?.length ?? 0) * 100 + (r.suspect?.length ?? 0) * 10 - (r.unresolved ? -1 : 0);
  results.sort((a, b) => score(b) - score(a));

  if (json) {
    console.log(JSON.stringify({ generatedFrom: 'moat', maxAgeDays: MAX_AGE_DAYS, threads: results, staleSkipped }, null, 2));
    return;
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
      console.log(`❌ ${r.thread_id} (${r.slug ?? '?'}) — EXTRACCIÓN FALLIDA: ${r.error} — candidato a re-correr`);
      if (r.stderrTail) console.log(r.stderrTail.split('\n').map((l) => `     │ ${l}`).join('\n'));
      console.log(`     moat: ${r.moatActors.join(', ')}\n`);
      continue;
    }
    const hot = r.owes.length ? '🔴' : r.suspect.length ? '🟡' : r.extraction === 'ok' ? '🟢' : '🟠';
    console.log(`${hot} ${r.thread_id} (${r.slug ?? '?'}) · ${r.turns} turnos`);
    if (r.extraction === 'failed' || r.extraction === 'incomplete') {
      const tag = r.extraction === 'failed' ? 'EXTRACCIÓN FALLIDA' : 'EXTRACCIÓN INCOMPLETA';
      console.log(`     ⚠️  ${tag} (${r.extractionReasons.join(' · ')}) — la deuda de abajo NO es confiable; candidato a re-correr`);
    }
    for (const o of r.owes) console.log(`     OWES  ${o.author}  ${age(o.freshestMin)}${o.ageUnknown && o.neverAnswered ? ' (nunca contestada)' : ''}  opp${o.oppCount}/my${o.myCount}`);
    for (const s of r.suspect) console.log(`     susp  ${s.author}  ${age(s.freshestMin)}  opp${s.oppCount}/my${s.myCount}`);
    if (!r.owes.length && !r.suspect.length) {
      if (r.extraction === 'ok') console.log(`     (sin owes/suspect — deuda del moat probablemente pagada; candidato a reflex)`);
      else if (r.extraction === 'unavailable') console.log(`     (post no disponible — cerrar la deuda en el moat)`);
      else console.log(`     (sin owes/suspect en una extracción NO confiable — NO es deuda pagada; re-correr)`);
    }
    console.log(`     moat: ${r.moatActors.join(', ')}\n`);
  }

  const hot = results.filter((r) => r.owes?.length).length;
  console.log(`→ ${hot} thread(s) con OWES dura. "edad?" = raíz sin fechar (candidata, no fresca confirmada).`);
  const bad = results.filter((r) => r.error || r.extraction === 'failed' || r.extraction === 'incomplete').length;
  if (bad) console.log(`→ ${bad} hilo(s) con EXTRACCIÓN FALLIDA/INCOMPLETA — re-correr antes de tratarlos como pagados.`);
}

if (isMain) {
  const swept = sweep();
  report(swept);
  const code = sweepExitCode(swept.results);
  if (code) console.error(`debt-sweep: TODAS las extracciones fallaron o quedaron incompletas (exit ${code}).`);
  process.exitCode = code;
}
