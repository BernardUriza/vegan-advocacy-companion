#!/usr/bin/env node
// PreToolUse hook — GATE DE PROCEDENCIA del coagent (root fix 2026-06-21).
//
// NO escanea contenido (juzgar bienestarismo es trabajo de LLM: el style-gate de
// etapa 4 + el check x/y del coagent). El hook prueba, de forma DETERMINISTA y NO
// salteable (lo ejecuta el harness, no Claude), que la ETAPA 3 ocurrió antes de
// stagear un reply: que hubo un master prompt con frameworks anotados + guardrail,
// que pasó el seed-gate, y que el draft a postear ES el que devolvió el coagent.
//
// Antes de `comment-prepare.mjs --url <U> --body-file <D>`:
//   1. deriva post_id de --url.
//   2. exige el recibo .coagent/<post_id>.consult.json (lo emite seed-coagent.mjs).
//   3. recibo.status == 'consulted', seed_gate == 'pass', frameworks.length > 0.
//   4. re-valida el master (no confía en el recibo a ciegas — Art. 2).
//   5. sha(--body-file) == recibo.draft_sha (el draft staged ES el del coagent).
//   6. recibo fresco (< 24h).
// Cualquier falla → exit 2 (bloquea, stderr → Claude). OK → exit 0.

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || resolve(HERE, '..', '..');
const FRESH_MS = 24 * 60 * 60 * 1000;

function block(lines) {
  process.stderr.write((Array.isArray(lines) ? lines.join('\n') : lines) + '\n');
  process.exit(2);
}
function abs(p) {
  if (isAbsolute(p)) return p;
  const fromCwd = resolve(process.cwd(), p);
  if (existsSync(fromCwd)) return fromCwd;
  return resolve(PROJECT_DIR, p);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || payload.toolName || '';
const command = payload.tool_input?.command || payload.toolInput?.command || '';

// solo la invocación real de comment-prepare, no menciones sueltas (grep/cat/git)
if (toolName !== 'Bash' || !/node\s+[^|;&]*comment-prepare\.mjs/.test(command)) process.exit(0);

const urlM = command.match(/--url[=\s]+(?:"([^"]+)"|'([^']+)'|([^\s"'|;&]+))/);
const bodyM = command.match(/--body-file[=\s]+(?:"([^"]+)"|'([^']+)'|([^\s"'|;&]+))/);
const url = urlM && (urlM[1] || urlM[2] || urlM[3]);
const bodyFile = bodyM && (bodyM[1] || bodyM[2] || bodyM[3]);

if (!url) block('GATE PROCEDENCIA: comment-prepare sin --url; no puedo derivar el post_id para hallar el recibo del coagent.');
if (!bodyFile) block('GATE PROCEDENCIA: comment-prepare sin --body-file; el draft debe venir de etapa 3 en un archivo.');

const pidM = url.match(/(?:posts\/|post_id=|multi_permalinks=|story_fbid=)(\d+)/);
if (!pidM) block(`GATE PROCEDENCIA: no pude derivar post_id de --url "${url}".`);
const postId = pidM[1];

const receiptFile = resolve(PROJECT_DIR, '.coagent', `${postId}.consult.json`);
if (!existsSync(receiptFile)) {
  block([
    `GATE PROCEDENCIA — STAGING BLOQUEADO: no hay recibo de consulta para el hilo ${postId}.`,
    'La etapa 3 (coagent) NO se ejecutó. NO redactes el reply a mano.',
    'Flujo: compón el master (x={marco abolicionista}, y={candidata}) → seed-gate →',
    `  node scripts/seed-coagent.mjs seed --post-id ${postId} --author "<A>" --master <master.md>`,
    '  (siembra al coagent, lee la y abolicionista, guárdala) →',
    `  node scripts/seed-coagent.mjs finalize --post-id ${postId} --draft <draft.txt>`,
    'Ver .claude/rules/coagent-advise.md.',
  ]);
}

let r;
try {
  r = JSON.parse(readFileSync(receiptFile, 'utf8'));
} catch (e) {
  block(`GATE PROCEDENCIA: recibo ilegible (${e.message}). Fail-closed.`);
}

if (r.status !== 'consulted') block(`GATE PROCEDENCIA: recibo en estado "${r.status}" — falta finalize tras leer el draft del coagent.`);
if (r.seed_gate !== 'pass') block('GATE PROCEDENCIA: el master no pasó el seed-gate (recibo.seed_gate != pass).');
if (!Array.isArray(r.frameworks) || r.frameworks.length === 0) block('GATE PROCEDENCIA: el master no tenía frameworks anotados.');

// re-validar el master en disco (no confiar en el recibo — Art. 2)
let validateMaster, draftSha;
try {
  ({ validateMaster, draftSha } = await import(resolve(PROJECT_DIR, 'scripts/seed-coagent.mjs')));
} catch (e) {
  block(`GATE PROCEDENCIA: no pude cargar seed-coagent.mjs (${e.message}). Fail-closed.`);
}
try {
  const masterText = readFileSync(abs(r.master), 'utf8');
  const v = validateMaster(masterText);
  if (v.problems.length) block('GATE PROCEDENCIA: el master del recibo ya no es válido:\n  - ' + v.problems.join('\n  - '));
} catch (e) {
  block(`GATE PROCEDENCIA: no pude releer el master "${r.master}" (${e.message}). Fail-closed.`);
}

// el draft staged DEBE ser el que devolvió el coagent
let bodyText;
try {
  bodyText = readFileSync(abs(bodyFile), 'utf8');
} catch (e) {
  block(`GATE PROCEDENCIA: no pude leer --body-file "${bodyFile}" (${e.message}). Fail-closed.`);
}
const bodySha = draftSha(bodyText);
// varios targets pueden compartir un post → el recibo guarda drafts[]; el body-file debe
// ser UNO de los drafts consultados. Normaliza el shape legacy single-draft.
const drafts = Array.isArray(r.drafts) && r.drafts.length
  ? r.drafts
  : (r.draft_sha ? [{ draft_sha: r.draft_sha, consulted_at: r.consulted_at }] : []);
const match = drafts.find((d) => d.draft_sha === bodySha);
if (!match) {
  block([
    'GATE PROCEDENCIA — STAGING BLOQUEADO: el draft a postear NO es ninguno de los que devolvió el coagent para este hilo.',
    `  sha(body-file)=${bodySha}  recibo.drafts=[${drafts.map((d) => d.draft_sha).join(', ')}]`,
    'Si editaste el draft a mano tras la consulta, vuelve a pasarlo por el coagent (x/y) y re-finaliza.',
  ]);
}

const consultedAt = Date.parse(match.consulted_at || r.consulted_at || '');
if (!consultedAt || Date.now() - consultedAt > FRESH_MS) {
  block(`GATE PROCEDENCIA: recibo viejo (consulted_at=${match.consulted_at || r.consulted_at}). Re-consulta al coagent para este hilo.`);
}

process.exit(0);
