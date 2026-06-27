#!/usr/bin/env node
// seed-coagent.mjs — RECIBO DE CONSULTA del coagent (etapa 3), el artefacto de
// procedencia que exige `.claude/hooks/coagent-provenance-gate.mjs` antes de que
// `comment-prepare.mjs` stagee un reply a Facebook.
//
// Por qué (2026-06-21): una regla es salteable — Claude saltó la etapa 3 (coagent)
// y posteó a mano un draft bienestarista. El root fix NO es escanear el contenido
// (eso es trabajo de LLM: style-gate + el check x/y del coagent); es probar de forma
// DETERMINISTA que la etapa 3 ocurrió: que hubo un master prompt con frameworks
// anotados + guardrail abolicionista, que pasó el seed-gate, y que el draft que se va
// a postear ES el que devolvió el coagent (sha). El hook exige este recibo; el harness
// lo ejecuta, no Claude, así que no se puede saltar.
//
// Recordatorio del handoff (ver coagent-advise.md): insult-gpt NO es oráculo vegano
// (da bienestarismo); es enforcer de consistencia. El master se le da como x={marco
// abolicionista} + y={candidata} y se le pide la y coherente con x.
//
// Ciclo en dos fases (el draft llega DESPUÉS de sembrar):
//   1. seed     → valida master (frameworks+guardrail) + seed-gate pass, escribe el
//                 recibo PARCIAL {status:'seeded'}. (El tecleo CDP en ChatGPT es G.41;
//                 hoy lo siembra el skill /coagent y esto estampa el recibo.)
//   2. finalize → tras leer el draft del coagent, estampa draft_sha {status:'consulted'}.
//
// Uso:
//   node seed-coagent.mjs seed     --post-id <id> --author "<A>" --master <master.md>
//   node seed-coagent.mjs finalize --post-id <id> --draft <draft.txt>
//   node seed-coagent.mjs show     --post-id <id>

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveUserPath } from './paths.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const COAGENT_DIR = resolve(ROOT, '.coagent');

const GUARDRAIL_OPEN = '<!-- GUARDRAIL-ABOLICIONISTA -->';
const GUARDRAIL_CLOSE = '<!-- /GUARDRAIL-ABOLICIONISTA -->';

// sha estable del cuerpo del draft (ignora trailing whitespace, normaliza CRLF)
export function draftSha(text) {
  const norm = text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  return createHash('sha256').update(norm, 'utf8').digest('hex').slice(0, 16);
}

let _ids = null;
function frameworkIds() {
  if (_ids) return _ids;
  const f = JSON.parse(readFileSync(resolve(ROOT, 'data/frameworks.json'), 'utf8'));
  const arr = Array.isArray(f) ? f : f.frameworks || Object.values(f);
  _ids = arr.map((x) => x && x.id).filter(Boolean);
  return _ids;
}

// valida que el master sea apto para el coagent: guardrail presente + ≥1 framework anotado
export function validateMaster(text) {
  const guardrail = text.includes(GUARDRAIL_OPEN) && text.includes(GUARDRAIL_CLOSE);
  const frameworks = frameworkIds().filter((id) => text.includes(id));
  const problems = [];
  if (!guardrail) problems.push('falta el bloque GUARDRAIL-ABOLICIONISTA');
  if (frameworks.length === 0) problems.push('no hay NINGÚN framework anotado (ids de data/frameworks.json)');
  return { guardrail, frameworks, problems };
}

export function runSeedGate(masterPath) {
  const r = spawnSync('node', [resolve(ROOT, 'scripts/seed-gate.mjs'), masterPath], { encoding: 'utf8' });
  return { pass: r.status === 0, code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

export function receiptPath(postId) {
  return resolve(COAGENT_DIR, `${postId}.consult.json`);
}

function nowIso() {
  return new Date().toISOString();
}

function arg(flag) {
  const a = process.argv.slice(3);
  const i = a.findIndex((x) => x === flag || x.startsWith(flag + '='));
  if (i < 0) return null;
  const v = a[i].includes('=') ? a[i].split('=').slice(1).join('=') : a[i + 1];
  return v ?? null;
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
const cmd = isMain ? process.argv[2] : null;

if (!isMain) {
  // importado (p.ej. por el hook) — solo exporta, no corre CLI
} else if (cmd === 'seed') {
  const postId = arg('--post-id');
  const author = arg('--author');
  const master = arg('--master');
  if (!postId || !master) die('uso: seed-coagent.mjs seed --post-id <id> --author "<A>" --master <file>');

  const masterPath = resolveUserPath(master, ROOT);
  const text = readFileSync(masterPath, 'utf8');
  const v = validateMaster(text);
  if (v.problems.length) die('MASTER INVÁLIDO para el coagent:\n  - ' + v.problems.join('\n  - '));

  const gate = runSeedGate(masterPath);
  if (!gate.pass) die(`seed-gate FALLÓ (exit ${gate.code}) — reformula la jugada antes de sembrar:\n${gate.out}`);

  mkdirSync(COAGENT_DIR, { recursive: true });
  const rp = receiptPath(postId);
  // PRESERVA los drafts ya consultados de este post (varios targets comparten el recibo
  // keyed por post_id): un segundo `seed` para el mismo hilo NO debe borrar el draft que
  // ya finalizó un target anterior. Normaliza el shape legacy single-draft.
  const prev = existsSync(rp) ? JSON.parse(readFileSync(rp, 'utf8')) : null;
  const drafts = Array.isArray(prev?.drafts) ? prev.drafts
    : (prev?.draft_sha ? [{ author: prev.author ?? null, draft_sha: prev.draft_sha, draft_file: prev.draft_file ?? null, consulted_at: prev.consulted_at ?? null }] : []);
  const receipt = {
    status: drafts.length ? 'consulted' : 'seeded',
    post_id: postId,
    master: masterPath,
    frameworks: v.frameworks,
    guardrail: v.guardrail,
    seed_gate: 'pass',
    seeded_at: nowIso(),
    drafts,
  };
  writeFileSync(rp, JSON.stringify(receipt, null, 2) + '\n');
  console.log(`✓ recibo PARCIAL escrito: ${rp}` + (drafts.length ? ` (preserva ${drafts.length} draft(s) ya consultado(s) del post)` : ''));
  console.log(`  frameworks anotados: ${v.frameworks.join(', ')}`);
  console.log(`  author sembrado: ${author || '(sin etiqueta)'} — múltiples targets del mismo post comparten este recibo (drafts[]).`);
  console.log('  siembra el master al coagent (x={marco}, y={candidata}), lee la y abolicionista, guárdala y corre `finalize`.');
} else if (cmd === 'finalize') {
  const postId = arg('--post-id');
  const draft = arg('--draft');
  const author = arg('--author');
  if (!postId || !draft) die('uso: seed-coagent.mjs finalize --post-id <id> --draft <file> [--author "<A>"]');
  const rp = receiptPath(postId);
  if (!existsSync(rp)) die(`no hay recibo parcial para ${postId} — corre \`seed\` primero (no saltes la consulta).`);
  const r = JSON.parse(readFileSync(rp, 'utf8'));
  // normaliza el shape legacy single-draft a drafts[]
  if (!Array.isArray(r.drafts)) r.drafts = r.draft_sha ? [{ author: r.author ?? null, draft_sha: r.draft_sha, draft_file: r.draft_file ?? null, consulted_at: r.consulted_at ?? null }] : [];
  const draftPath = resolveUserPath(draft, ROOT);
  const sha = draftSha(readFileSync(draftPath, 'utf8'));
  // upsert por sha: varios targets del mismo post acumulan, no se pisan
  const entry = { author: author || null, draft_sha: sha, draft_file: draftPath, consulted_at: nowIso() };
  const i = r.drafts.findIndex((d) => d.draft_sha === sha);
  if (i >= 0) r.drafts[i] = entry; else r.drafts.push(entry);
  r.status = 'consulted';
  r.consulted_at = entry.consulted_at;
  delete r.draft_sha; delete r.draft_file; delete r.author; // canónico vive en drafts[]
  writeFileSync(rp, JSON.stringify(r, null, 2) + '\n');
  console.log(`✓ recibo CONSULTADO: ${rp} (${r.drafts.length} draft(s) en el post)`);
  console.log(`  draft_sha: ${sha}${author ? ` (${author})` : ''} — ya puedes stagear con comment-prepare --body-file ${draftPath}`);
} else if (cmd === 'show') {
  const postId = arg('--post-id');
  const rp = receiptPath(postId);
  if (!existsSync(rp)) die(`(sin recibo) ${rp}`);
  console.log(readFileSync(rp, 'utf8'));
} else {
  die('comandos: seed | finalize | show');
}
