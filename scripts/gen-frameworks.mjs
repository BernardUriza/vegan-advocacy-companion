import { writeFileSync, renameSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFrameworks, readTactics, getFrameworkWinRate } from './db.mjs';

// JSON is the canonical source of truth (Art. 6). This regenerates the
// human-readable arsenal index under analysis/frameworks/ from data/frameworks.json.
// Edit the JSON, run this, commit both. Do NOT hand-edit the generated .md —
// changes there are overwritten on the next run.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'analysis/frameworks');
const OUT = resolve(OUT_DIR, 'README.md');

const frameworks = readFrameworks();
const tacticById = Object.fromEntries(readTactics().map(t => [t.id, t]));

function writeAtomic(path, text) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, text, 'utf8');
  renameSync(tmp, path);
}

function anchor(id) {
  return id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Efectividad (el moat): deploys + outcome dominante por framework, leído de
// data/actors.json vía getFrameworkWinRate. 0 deploys = "sin probar".
const OUTCOME_KEYS = ['conceded', 'engaged', 'silent', 'escalated', 'goalpost', 'pending'];
function effectivenessCell(id) {
  const wr = getFrameworkWinRate(id);
  if (!wr.deploys) return 'sin probar';
  const dominant = OUTCOME_KEYS
    .map(k => [k, wr[k]])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const tag = dominant ? `${dominant[0]} ×${dominant[1]}` : 'sin outcome';
  return `${wr.deploys} deploy${wr.deploys > 1 ? 's' : ''} · ${tag}`;
}

const byAuthor = {};
for (const f of frameworks) (byAuthor[f.author] ??= []).push(f);

const lines = [];
lines.push('# Arsenal de frameworks — vista generada');
lines.push('');
lines.push('> GENERATED from `data/frameworks.json` by `scripts/gen-frameworks.mjs`. Do not hand-edit — edit the JSON and regenerate.');
lines.push('');
lines.push(`**${frameworks.length} frameworks** de **${Object.keys(byAuthor).length} autores.** Cada uno es un concepto/jugada deployable; \`deploy_as\` y \`attack_surface\` gobiernan CÓMO usarlo (marco, nunca premisa portante salvo que sea inatacable; varios son auto-disciplina del activista, no armas).`);
lines.push('');

lines.push('## Resumen');
lines.push('');
lines.push('| Framework | Autor | deploy_as | Registro | Efectividad (actors.json) |');
lines.push('|---|---|---|---|---|');
for (const f of frameworks) {
  lines.push(`| [${f.name}](#${anchor(f.id)}) | ${f.author.split(' ')[0]} ${f.author.split(' ')[1] ?? ''} | ${f.deploy_as} | ${f.register} | ${effectivenessCell(f.id)} |`);
}
lines.push('');

lines.push('## Por táctica del oponente — qué desplegar');
lines.push('');
lines.push('Índice inverso: el contrincante usa la táctica de la izquierda → considera estos frameworks (cada uno con su `attack_surface`; ver detalle abajo).');
lines.push('');
const byTactic = {};
for (const f of frameworks) for (const tid of f.related_tactics ?? []) (byTactic[tid] ??= []).push(f);
const tacticsSorted = Object.keys(byTactic).sort((a, b) => byTactic[b].length - byTactic[a].length);
lines.push('| Táctica del oponente | Frameworks que la contrarrestan |');
lines.push('|---|---|');
for (const tid of tacticsSorted) {
  const t = tacticById[tid];
  const label = t ? `**${t.name}** (\`${tid}\`)` : `\`${tid}\``;
  const fwList = byTactic[tid].map(f => `[${f.name}](#${anchor(f.id)})`).join(' · ');
  lines.push(`| ${label} | ${fwList} |`);
}
lines.push('');

for (const [author, fs] of Object.entries(byAuthor)) {
  lines.push(`## ${author}`);
  lines.push('');
  for (const f of fs) {
    lines.push(`### ${f.name}`);
    lines.push(`<a id="${anchor(f.id)}"></a>`);
    lines.push('');
    lines.push(`- **id:** \`${f.id}\` · **tradición:** ${f.tradition}`);
    lines.push(`- **deploy_as:** ${f.deploy_as} · **registro:** ${f.register}`);
    lines.push('');
    lines.push(`**Qué es:** ${f.definition}`);
    lines.push('');
    lines.push(`**Habilita:** ${f.enables}`);
    lines.push('');
    lines.push(`**⚠️ attack_surface:** ${f.attack_surface}`);
    lines.push('');
    if (f.related_tactics?.length) {
      const refs = f.related_tactics.map(tid => {
        const t = tacticById[tid];
        return t ? `\`${tid}\` (${t.name})` : `\`${tid}\` _(no def)_`;
      });
      lines.push(`**Contrarresta tácticas:** ${refs.join(' · ')}`);
      lines.push('');
    }
    lines.push(`_Fuente: ${f.source_ref}_`);
    lines.push('');
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeAtomic(OUT, lines.join('\n'));
console.log(`✓ regenerated arsenal index (${frameworks.length} frameworks) at analysis/frameworks/README.md`);
