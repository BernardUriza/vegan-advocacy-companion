#!/usr/bin/env node
// PreToolUse hook — GATE DE PUBLICACIÓN POR MCP (root fix 2026-08-07).
//
// Hermano de coagent-provenance-gate.mjs, que sólo cubre `comment-prepare.mjs` vía
// Bash — o sea, sólo las REPLIES. El agujero que cierra este hook: un POST RAÍZ
// publicado manejando Chrome por MCP (evaluate_script que pega el texto y clickea
// "Post") no pasaba por NINGÚN backstop. La ruta desprotegida era además la de mayor
// alcance: una reply llega al hilo, un post raíz llega a los 12.6K del grupo.
//
// Qué exige, igual que su hermano: que la ETAPA 3 haya ocurrido. NO juzga contenido
// (eso es el style-gate + el check x/y del coagent); prueba procedencia.
//
//   - script que PEGA texto largo en un composer de FB  -> el sha de ese texto debe
//     matchear un draft de algún recibo .coagent/*.consult.json consultado y fresco.
//   - script que CLICKEA publicar (Post / Enviar / Reply) -> debe existir al menos un
//     recibo consultado, con seed_gate pass y frameworks, fresco (< 24h).
//
// Fail-closed en lo ambiguo, pero deliberadamente silencioso ante scripts de LECTURA
// (los evaluate_script de verificación son la mitad del Art. 2 y no deben estorbarse).

import { readFileSync, existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = process.env.CLAUDE_PROJECT_DIR || resolve(HERE, '..', '..');
const COAGENT_DIR = join(PROJECT_DIR, '.coagent');
const FRESH_MS = 24 * 60 * 60 * 1000;

function block(lines) {
  process.stderr.write((Array.isArray(lines) ? lines.join('\n') : lines) + '\n');
  process.exit(2);
}

let payload;
try {
  payload = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}

const toolName = payload.tool_name || payload.toolName || '';
if (!/chrome-devtools__evaluate_script/.test(toolName)) process.exit(0);

const src = payload.tool_input?.function || payload.toolInput?.function || '';
if (!src) process.exit(0);

const touchesFacebookComposer =
  /Create post|aria-label="Reply to|Reply to \$\{|role="textbox"|contenteditable/i.test(src);
const clicksPublish =
  (/\.click\(\)/.test(src) && /\b(Post|Publicar|Enviar|Comment|Reply)\b/.test(src)) ||
  (/KeyboardEvent\(\s*['"]key(down|press)['"]/.test(src) && /['"]Enter['"]|keyCode\s*:\s*13/.test(src));
const pastesText = /ClipboardEvent|insertText/.test(src);

if (!touchesFacebookComposer || !(clicksPublish || pastesText)) process.exit(0);

// ---- cargar recibos de consulta frescos ----
function freshReceipts() {
  if (!existsSync(COAGENT_DIR)) return [];
  const out = [];
  for (const f of readdirSync(COAGENT_DIR)) {
    if (!f.endsWith('.consult.json')) continue;
    let r;
    try {
      r = JSON.parse(readFileSync(join(COAGENT_DIR, f), 'utf8'));
    } catch {
      continue;
    }
    if (r.status !== 'consulted' || r.seed_gate !== 'pass') continue;
    if (!Array.isArray(r.frameworks) || r.frameworks.length === 0) continue;
    const drafts = Array.isArray(r.drafts) && r.drafts.length
      ? r.drafts
      : (r.draft_sha ? [{ draft_sha: r.draft_sha, consulted_at: r.consulted_at }] : []);
    const fresh = drafts.filter((d) => {
      const at = Date.parse(d.consulted_at || r.consulted_at || '');
      return at && Date.now() - at <= FRESH_MS;
    });
    if (fresh.length) out.push({ file: f, drafts: fresh, frameworks: r.frameworks });
  }
  return out;
}

const receipts = freshReceipts();

const HOWTO = [
  'Flujo (etapa 3, .claude/rules/coagent-advise.md):',
  '  0. node scripts/framework-pick.mjs --post-id <id> --author "<A>"   # exposición, bloqueo y sorteo',
  '  1. compón el master con el framework que permita el pick, en .coagent/',
  '  2. node scripts/seed-gate.mjs <master.md>          # debe salir LIMPIO',
  '  3. node scripts/seed-coagent.mjs seed --post-id <id> --author "<A>" --master <master.md>',
  '  4. siembra al coagent, lee su respuesta, guárdala como draft',
  '  5. node scripts/seed-coagent.mjs finalize --post-id <id> --draft <draft.txt> --author "<A>" --framework <id>',
];

if (!receipts.length) {
  block([
    'GATE PUBLICACIÓN MCP — BLOQUEADO: vas a publicar en Facebook por MCP y no hay',
    'ningún recibo de consulta al coagent fresco (< 24h) con seed_gate=pass.',
    'La etapa 3 NO se ejecutó. NO redactes el post/reply a mano.',
    '',
    ...HOWTO,
  ]);
}

// Si el script trae el TEXTO a publicar, exigir que sea uno de los drafts consultados.
if (pastesText) {
  let shaOf, longLiterals;
  try {
    ({ draftSha: shaOf } = await import(resolve(PROJECT_DIR, 'scripts/seed-coagent.mjs')));
    ({ longLiterals } = await import(resolve(PROJECT_DIR, 'scripts/publish-literals.mjs')));
  } catch (e) {
    block(`GATE PUBLICACIÓN MCP: no pude cargar seed-coagent.mjs / publish-literals.mjs (${e.message}). Fail-closed.`);
  }
  const literals = longLiterals(src);
  if (literals.some((l) => l.dynamic)) {
    block('GATE PUBLICACIÓN MCP — BLOQUEADO: el texto a pegar se arma con ${…}; pégalo como literal completo para que su sha se pueda verificar.');
  }
  if (!literals.length) {
    block([
      'GATE PUBLICACIÓN MCP — BLOQUEADO: el script pega texto pero no trae el texto como literal (≥120 chars).',
      'Sin literal no hay sha que verificar (window.__draft, JSON.stringify o variables no cuentan): pega el draft consultado literal.',
    ]);
  }
  // Si el script nombra el hilo (/posts/<id>, el assert de href), el draft tiene que ser de
  // ESE post: un draft consultado para otro post pasaba el gate pegado donde fuera.
  const postIds = [...new Set([...src.matchAll(/\/posts\/(\d+)/g)].map((m) => m[1]))];
  if (postIds.length > 1) block(`GATE PUBLICACIÓN MCP — BLOQUEADO: el script nombra ${postIds.length} posts (${postIds.join(', ')}); un paste va a un solo hilo.`);
  const scoped = postIds.length ? receipts.filter((r) => r.file === `${postIds[0]}.consult.json`) : receipts;
  if (postIds.length && !scoped.length) {
    block(`GATE PUBLICACIÓN MCP — BLOQUEADO: no hay recibo de consulta fresco para el post ${postIds[0]} que el script está tocando.`);
  }
  const known = new Set(scoped.flatMap((r) => r.drafts.map((d) => d.draft_sha)));
  const unknown = literals.filter((l) => !known.has(shaOf(l.text)));
  if (unknown.length) {
    block([
      'GATE PUBLICACIÓN MCP — BLOQUEADO: el texto que estás pegando NO es ninguno de',
      'los drafts que devolvió el coagent (sha no matchea ningún recibo fresco).',
      `  sha(s) del script: ${unknown.map((l) => shaOf(l.text)).join(', ')}`,
      `  drafts consultados: ${[...known].join(', ')}`,
      'Si lo editaste tras la consulta, re-finaliza:',
      '  node scripts/seed-coagent.mjs finalize --post-id <id> --draft <draft.txt> --author "<A>" --framework <id>',
    ]);
  }
}

process.exit(0);
