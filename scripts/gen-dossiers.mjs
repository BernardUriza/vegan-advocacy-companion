import { writeFileSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readTactics } from './db.mjs';

// JSON is the canonical source of truth (Art. 6). This regenerates the
// human-readable dossier cards under analysis/actors/ from data/actors.json.
// Edit the JSON, run this, commit both. Do NOT hand-edit the generated .md —
// changes there are overwritten on the next run.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'analysis/actors');

const actors = readActors();
const tactics = readTactics();
const tacticById = Object.fromEntries(tactics.map(t => [t.id, t]));

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function writeAtomic(path, text) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

function renderActor(a) {
  const lines = [];
  lines.push(`# ${a.name}`);
  lines.push('');
  lines.push('> GENERATED from `data/actors.json` by `scripts/gen-dossiers.mjs`. Do not hand-edit — edit the JSON and regenerate.');
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

let count = 0;
for (const a of actors) {
  const path = resolve(OUT_DIR, `${slug(a.name)}.md`);
  writeAtomic(path, renderActor(a));
  count++;
}

console.log(`✓ regenerated ${count} dossier(s) under analysis/actors/`);
