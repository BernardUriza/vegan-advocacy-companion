import { writeFileSync, renameSync, existsSync, readFileSync, unlinkSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readTactics, readFrameworks } from './db.mjs';

// JSON is the canonical source of truth (Art. 6). This regenerates the
// human-readable dossier cards under analysis/actors/ from data/actors.json.
// Edit the JSON, run this, commit both. Do NOT hand-edit the generated .md —
// changes there are overwritten on the next run.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'analysis/actors');

let tactics = [];
let frameworks = [];
let tacticById = {};

// Same lookup logic as db.getFrameworksByTactic: a framework counters a tactic
// when its related_tactics includes that tactic id.
function frameworksByTactic(tacticId) {
  return frameworks.filter(f => (f.related_tactics ?? []).includes(tacticId));
}

export function slug(name) {
  return (name ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function dossierFilenames(actorList) {
  const base = actorList.map(a => slug(a.name) || a.user_id);
  const count = new Map();
  for (const b of base) count.set(b, (count.get(b) ?? 0) + 1);
  const collided = new Set([...count].filter(([, n]) => n > 1).map(([b]) => b));
  const files = actorList.map((a, k) => `${collided.has(base[k]) ? `${base[k]}-${a.user_id}` : base[k]}.md`);
  return { files, collided: [...collided] };
}

export const GENERATED_MARK = 'GENERATED from `data/actors.json` by `scripts/gen-dossiers.mjs`';

function writeAtomic(path, text) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

function renderActor(a) {
  const lines = [];
  lines.push(`# ${a.name}`);
  lines.push('');
  lines.push(`> ${GENERATED_MARK}. Do not hand-edit — edit the JSON and regenerate.`);
  lines.push('');
  lines.push(`- **user_id:** ${a.user_id ?? '(pendiente)'}`);
  if (a.profile_url) lines.push(`- **Perfil:** ${a.profile_url}`);
  lines.push(`- **Bando:** ${a.bando}`);
  lines.push(`- **Veredicto:** ${a.verdict} · **Registro:** ${a.register}`);
  lines.push(`- **Postura núcleo:** ${a.postura_nucleo}`);
  lines.push('');
  lines.push('## Análisis');
  lines.push('');
  lines.push(a.analisis);
  lines.push('');
  lines.push('## Tácticas');
  lines.push('');
  if (a.tactics.length === 0) {
    lines.push('_(ninguna registrada)_');
  } else {
    for (const tid of a.tactics) {
      const t = tacticById[tid];
      if (!t) { lines.push(`- **${tid}** _(táctica no definida)_`); continue; }
      lines.push(`- **${t.name}** (\`${tid}\`) — ${t.definition}`);
      lines.push(`  - _Contra:_ ${t.canonical_counter}`);
    }
  }
  lines.push('');
  lines.push('## Counter-arsenal');
  lines.push('');
  lines.push('> Munición candidata por táctica (`getFrameworksByTactic`). Surfaceo, NO la jugada — etapa-3 elige UN solo framework respetando su `attack_surface`.');
  lines.push('');
  if (a.tactics.length === 0) {
    lines.push('_(sin tácticas → sin counter-frameworks)_');
  } else {
    let anyCounter = false;
    for (const tid of a.tactics) {
      const t = tacticById[tid];
      const counters = frameworksByTactic(tid);
      if (counters.length === 0) continue;
      anyCounter = true;
      lines.push(`- **${t ? t.name : tid}** (\`${tid}\`)`);
      for (const f of counters) {
        lines.push(`  - \`${f.id}\` → _deploy as:_ ${f.deploy_as}`);
      }
    }
    if (!anyCounter) lines.push('_(ninguna táctica tiene counter-framework registrado)_');
  }
  lines.push('');
  lines.push('## Qué NO hacer');
  lines.push('');
  lines.push(a.what_not_to_do);
  lines.push('');
  lines.push('## Log de interacciones');
  lines.push('');
  if (a.interactions.length === 0) {
    lines.push('_(sin interacciones registradas)_');
  } else {
    for (const i of a.interactions) {
      lines.push(`### Hilo \`${i.thread_id}\` — ${i.date} · outcome: **${i.outcome}**`);
      lines.push(`- **Su jugada:** ${i.their_move}`);
      lines.push(`- **Nuestra respuesta:** ${i.our_reply_summary}`);
      lines.push('');
    }
  }
  lines.push(`_Hilos: ${a.threads.join(', ') || '—'}_`);
  lines.push('');
  return lines.join('\n');
}

function main() {
  const actors = readActors();
  tactics = readTactics();
  frameworks = readFrameworks();
  tacticById = Object.fromEntries(tactics.map(t => [t.id, t]));
  const { files, collided } = dossierFilenames(actors);
  actors.forEach((a, k) => writeAtomic(resolve(OUT_DIR, files[k]), renderActor(a)));
  const written = new Set(files);
  const removed = [];
  for (const b of collided) {
    const stale = resolve(OUT_DIR, `${b}.md`);
    if (written.has(`${b}.md`) || !existsSync(stale)) continue;
    if (!readFileSync(stale, 'utf8').includes(GENERATED_MARK)) continue;
    unlinkSync(stale);
    removed.push(`${b}.md`);
  }
  console.log(`✓ regenerated ${files.length} dossier(s) under analysis/actors/`);
  if (collided.length) console.log(`  slug collisions suffixed with -<user_id>: ${collided.join(', ')}`);
  if (removed.length) console.log(`  removed stale unsuffixed dossier(s): ${removed.join(', ')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
