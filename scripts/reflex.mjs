#!/usr/bin/env node
// reflex.mjs — STAGE 0 del vegan-pipeline: el reflex de "qué tenemos hasta ahora".
//
// Por qué (2026-06-21, Bernard): el outcome —sobre todo `conceded`— NO se debe
// clasificar con keywords (frágiles: se pierden "your right" con typo, "you prove
// valid points", y peor: una concesión que vive en el `their_move` queda marcada
// `silent` por el heurístico de anchor). El `conceded` es la mina de oro en un
// terreno desolado: rarísimo y valiosísimo. Lo juzga un LLM leyendo el ARCO COMPLETO,
// no un regex. Este reflex corre al inicio de cada `/vegan-pipeline`: re-lee los hilos,
// cierra/re-juzga outcomes con el LLM, marca conceded, y enriquece nota por framework.
//
// Frontera Art. 4: la MECÁNICA es script (juntar el arco, escribir el SSOT); el JUICIO
// (qué outcome, qué aprendió el framework) es del LLM = Claude. Por eso es 2 fases:
//   1. emit  → arma packets {arco verbatim + interacciones} → .coagent/reflex-packets.json
//   2. (Claude lee, juzga, escribe .coagent/reflex-verdicts.json)
//   3. apply → escribe los verdicts al SSOT vía db.updateInteractionOutcome (puede
//              SOBRESCRIBIR un outcome viejo mal clasificado por keywords).
//
// Uso:
//   node reflex.mjs emit  [--tx-dir ../.coagent] [--out ../.coagent/reflex-packets.json]
//   node reflex.mjs apply --verdicts ../.coagent/reflex-verdicts.json [--dry-run]
import { readFileSync, writeFileSync, renameSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, updateInteractionOutcome } from './db.mjs';
import { resolveUserPath } from './paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const COAGENT = resolve(ROOT, '.coagent');

function arg(flag, def) {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
// path del usuario contra el CWD; default del repo contra ROOT
function fileArg(flag, defRelToRoot) {
  const v = arg(flag);
  return v ? resolveUserPath(v, ROOT) : resolve(ROOT, defRelToRoot);
}
function writeAtomic(path, data) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}
function threadIdOf(doc) {
  if (doc.post_id) return String(doc.post_id);
  const m = String(doc.url || '').match(/\/posts\/(\d+)/) || String(doc.url || '').match(/post_id=(\d+)/);
  return m ? m[1] : null;
}

const cmd = process.argv[2];

if (cmd === 'emit') {
  const txDir = fileArg('--tx-dir', '.coagent');
  const out = fileArg('--out', '.coagent/reflex-packets.json');
  // index transcripts por thread_id
  const tx = {};
  for (const f of readdirSync(txDir).filter((f) => f.startsWith('tx-') && f.endsWith('.json'))) {
    try {
      const doc = JSON.parse(readFileSync(resolve(txDir, f), 'utf8'));
      const tid = threadIdOf(doc);
      if (tid && Array.isArray(doc.turns)) tx[tid] = doc;
    } catch { /* skip */ }
  }

  const packets = [];
  for (const actor of readActors()) {
    const byThread = {};
    for (const it of actor.interactions ?? []) {
      if (!it.framework) continue; // sin framework no hay nada que atribuir al moat
      (byThread[it.thread_id] = byThread[it.thread_id] || []).push(it);
    }
    for (const [tid, its] of Object.entries(byThread)) {
      const doc = tx[tid];
      if (!doc) continue; // sin transcript fresco no se puede juzgar el arco
      const exchange = doc.turns
        .filter((t) => t.author === actor.name || t.isMine || t.target === actor.name)
        .map((t) => ({ who: t.isMine ? 'BERNARD' : t.author, target: t.target || null, age: t.ageStr || '', text: (t.text || '').trim() }));
      packets.push({
        user_id: actor.user_id,
        name: actor.name,
        thread_id: tid,
        interactions: its.map((it) => ({
          date: it.date,
          framework: it.framework,
          their_move: it.their_move,
          our_reply_summary: it.our_reply_summary,
          current_outcome: it.outcome ?? 'pending',
        })),
        exchange,
      });
    }
  }
  writeAtomic(out, packets);
  const nInt = packets.reduce((s, p) => s + p.interactions.length, 0);
  console.log(`✓ emit: ${packets.length} packets (${nInt} interacciones con framework) → ${out}`);
  console.log('  Claude: lee el arco de cada packet, juzga outcome (conceded/engaged/silent/escalated/goalpost)');
  console.log('  + una nota corta por framework (qué aterrizó / por qué), y escribe .coagent/reflex-verdicts.json:');
  console.log('  [{ user_id, thread_id, date, needle (substring del their_move), outcome, note, evidence }]');
} else if (cmd === 'apply') {
  const vf = fileArg('--verdicts', '.coagent/reflex-verdicts.json');
  const dry = process.argv.includes('--dry-run');
  const verdicts = JSON.parse(readFileSync(vf, 'utf8'));
  const OUTCOMES = new Set(['conceded', 'engaged', 'silent', 'escalated', 'goalpost', 'pending']);
  const errs = [];
  const ok = [];
  for (const v of verdicts) {
    if (!OUTCOMES.has(v.outcome)) { errs.push(`outcome inválido "${v.outcome}" (${v.user_id}/${v.thread_id})`); continue; }
    try {
      if (!dry) updateInteractionOutcome(v.user_id, v.thread_id, v.date ?? null, v.needle, { outcome: v.outcome, evidence: v.evidence, note: v.note });
      else {
        // validar match en dry-run sin escribir
        const a = readActors().find((x) => x.user_id === v.user_id);
        const deburr = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const c = (a?.interactions || []).filter((i) => i.thread_id === v.thread_id && (v.date ? i.date === v.date : true) && deburr(i.their_move).includes(deburr(v.needle)));
        if (c.length !== 1) throw new Error(`match no único (${c.length})`);
      }
      ok.push(`${v.outcome.padEnd(9)} ${v.user_id} t=${v.thread_id} «${(v.needle || '').slice(0, 40)}»`);
    } catch (e) { errs.push(`${v.user_id}/${v.thread_id} needle="${v.needle}": ${e.message}`); }
  }
  if (errs.length) { console.error(`ABORT-worthy: ${errs.length} errores${dry ? '' : ' (algunos sí se escribieron antes del error)'}:`); for (const e of errs) console.error('  - ' + e); }
  console.log(`\n${dry ? '(dry-run) ' : ''}${ok.length} verdicts ${dry ? 'validados' : 'escritos'}:`);
  for (const o of ok) console.log('  ✓ ' + o);
} else {
  console.error('uso: node reflex.mjs emit | apply --verdicts <file> [--dry-run]');
  process.exit(1);
}
