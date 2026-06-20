// pipeline-status — dashboard de SOLO LECTURA de la capa de datos (data/*.json).
// Pura lectura vía db.mjs: NO toca Chrome, NO toca la red, NO escribe nada. Es el
// panel de control del pipeline (Art. 2: reporta el estado real de la data, sin
// gráficos chafos). Responde tres preguntas:
//   1. ¿Dónde hay DEUDA real? (interacciones con outcome pending/goalpost: el
//      oponente movió postes o quedó en el aire — sigue abierto).
//   2. ¿Qué FRAMEWORKS están sin probar? (frameworks que ningún interaction ha
//      desplegado todavía — arsenal en el estante).
//   3. ¿Cómo se reparte el tablero? (actores por bando / verdict / register).
//
// Uso:
//   node pipeline-status.mjs           # tabla humana
//   node pipeline-status.mjs --json    # JSON para pipear

import { readActors, readFrameworks, readTactics } from './db.mjs';

const asJson = process.argv.includes('--json');

// outcomes que dejan el intercambio ABIERTO (deuda viva). 'silent'/'engaged' se
// consideran cerrados: el oponente no devolvió o el hilo siguió sin deuda.
const OPEN_OUTCOMES = new Set(['pending', 'goalpost']);

function tally(items, key) {
  const m = new Map();
  for (const it of items) {
    const k = it[key] || '(sin valor)';
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ [key]: k, count: n }));
}

function build() {
  const actors = readActors();
  const frameworks = readFrameworks();
  const tactics = readTactics();

  const allInteractions = actors.flatMap((a) =>
    (a.interactions || []).map((i) => ({ ...i, actor: a.name, actor_user_id: a.user_id, actor_bando: a.bando, actor_verdict: a.verdict }))
  );

  // 1. DEUDA: interacciones con outcome abierto, frescas primero (por fecha desc).
  const openDebt = allInteractions
    .filter((i) => OPEN_OUTCOMES.has(i.outcome))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));

  // 2. FRAMEWORKS sin probar: un framework está "probado" si ALGÚN interaction lo
  //    desplegó (interaction.framework === framework.id). Lo demás está en el estante.
  const deployedFwIds = new Set(allInteractions.map((i) => i.framework).filter(Boolean));
  const untestedFrameworks = frameworks.filter((f) => !deployedFwIds.has(f.id));
  const testedFrameworks = frameworks.filter((f) => deployedFwIds.has(f.id));

  // 3. Reparto del tablero.
  const byBando = tally(actors, 'bando');
  const byVerdict = tally(actors, 'verdict');
  const byRegister = tally(actors, 'register');

  // Actores con hilos pero sin NINGUNA interacción registrada: perfilados pero
  // nunca contestados (candidatos a primera jugada).
  const profiledNotEngaged = actors
    .filter((a) => (a.threads || []).length && !(a.interactions || []).length)
    .map((a) => ({ name: a.name, user_id: a.user_id, bando: a.bando, verdict: a.verdict, threads: (a.threads || []).length }));

  return {
    totals: {
      actors: actors.length,
      frameworks: frameworks.length,
      tactics: tactics.length,
      interactions: allInteractions.length,
      frameworks_tested: testedFrameworks.length,
      frameworks_untested: untestedFrameworks.length,
      open_debt: openDebt.length,
    },
    openDebt,
    deployedFrameworks: [...deployedFwIds],
    untestedFrameworks: untestedFrameworks.map((f) => ({ id: f.id, name: f.name, author: f.author, deploy_as: f.deploy_as })),
    byBando,
    byVerdict,
    byRegister,
    profiledNotEngaged,
  };
}

function bar(rows, keyName) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return rows
    .map((r) => {
      const label = String(r[keyName]).padEnd(20);
      const blocks = '█'.repeat(Math.round((r.count / max) * 24)) || '▏';
      return `  ${label} ${String(r.count).padStart(3)}  ${blocks}`;
    })
    .join('\n');
}

function printHuman(d) {
  const t = d.totals;
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  PIPELINE STATUS — capa de datos (solo lectura, sin Chrome)');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(
    `  ${t.actors} actores · ${t.tactics} tácticas · ${t.frameworks} frameworks · ${t.interactions} interacciones`
  );

  console.log(`\n── DEUDA ABIERTA (${t.open_debt}) — outcome pending/goalpost, sigue vivo ──`);
  if (!d.openDebt.length) {
    console.log('  (ninguna — todo lo registrado quedó cerrado: silent/engaged)');
  } else {
    for (const i of d.openDebt) {
      const fw = i.framework ? ` · fw=${i.framework}` : '';
      console.log(`  🔴 [${i.date}] ${i.actor} (${i.actor_bando}/${i.actor_verdict}) — outcome=${i.outcome}${fw}`);
      console.log(`     su jugada: ${(i.their_move || '').slice(0, 110)}`);
    }
  }

  console.log(`\n── FRAMEWORKS sin probar (${t.frameworks_untested}/${t.frameworks}) — arsenal en el estante ──`);
  if (d.deployedFrameworks.length) {
    console.log(`  desplegados al menos 1 vez: ${d.deployedFrameworks.join(', ')}`);
  } else {
    console.log('  desplegados al menos 1 vez: (ninguno)');
  }
  console.log(`  sin desplegar: ${t.frameworks_untested}. Primeros 12:`);
  for (const f of d.untestedFrameworks.slice(0, 12)) {
    console.log(`    · ${f.id} (${f.author || '?'}, ${f.deploy_as})`);
  }
  if (d.untestedFrameworks.length > 12) console.log(`    … y ${d.untestedFrameworks.length - 12} más`);

  console.log('\n── ACTORES por BANDO ──');
  console.log(bar(d.byBando, 'bando'));
  console.log('\n── ACTORES por VERDICT ──');
  console.log(bar(d.byVerdict, 'verdict'));
  console.log('\n── ACTORES por REGISTER ──');
  console.log(bar(d.byRegister, 'register'));

  console.log(`\n── PERFILADOS sin contestar (${d.profiledNotEngaged.length}) — tienen hilo, cero interacciones ──`);
  if (!d.profiledNotEngaged.length) {
    console.log('  (ninguno)');
  } else {
    for (const a of d.profiledNotEngaged) {
      console.log(`  · ${a.name} (${a.bando}/${a.verdict}) — ${a.threads} hilo(s)`);
    }
  }
  console.log('');
}

const data = build();
if (asJson) {
  console.log(JSON.stringify(data, null, 2));
} else {
  printHuman(data);
}
