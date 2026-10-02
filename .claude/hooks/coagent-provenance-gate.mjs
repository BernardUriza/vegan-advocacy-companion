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
//   7. (2026-09-27) UNA invocación por comando: dos `node …comment-prepare.mjs` en el mismo
//      Bash stagearon el mismo draft en dos tabs (un `| head` cerró el pipe y node siguió).
//   8. (2026-09-27) recibos en imagen: si el draft anuncia screenshots/imagen adjunta
//      ("Screenshots attached", "see the screenshot", "image attached"), exige --image con un
//      archivo existente; un reply que promete evidencia y sale sin ella es fake-green.
// Cualquier falla → exit 2 (bloquea, stderr → Claude). OK → exit 0.

import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
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

// Cualquier mención (glob, comillas partidas, variable) cae aquí; lo que no se pueda parsear
// como UNA invocación limpia se bloquea (fail-closed, 2026-09-28: `--body-file=x --body y` pasaba).
if (toolName !== 'Bash' || !/comment[\s"'\\_-]*prep/i.test(command)) process.exit(0);

let parseArgs, shellTokens, PREPARE_MODES;
try {
  ({ parseArgs, shellTokens, PREPARE_MODES } = await import(resolve(PROJECT_DIR, 'scripts/cli-args.mjs')));
} catch (e) {
  block(`GATE PROCEDENCIA: no pude cargar cli-args.mjs (${e.message}). Fail-closed.`);
}
const unparseable = (why) => block([
  `GATE PROCEDENCIA — STAGING BLOQUEADO: invocación de comment-prepare no verificable (${why}).`,
  'Forma única aceptada: node <ruta>/comment-prepare.mjs --url "<url>" --author "<A>" [--anchor "<f>"] --body-file <ruta ABSOLUTA> [--image <ruta ABSOLUTA>] [--mode reply|root]',
  'Sin pipes, sin $()/backticks/globs, sin --body inline, sin forma --flag=valor ambigua con otra copia del flag, una invocación por comando.',
  'Para depurar el hook: escribe el payload JSON a un archivo y pásalo por stdin (ver comment-post-and-verify, FALLA→FIX).',
  'Si solo querías LEERLO o greppearlo (no stagear): usa la herramienta Read, o nombra la ruta con glob (`scripts/comment-*.mjs`), nunca el nombre completo.',
]);
const tokens = shellTokens(command);
if (!tokens) unparseable('comillas sin cerrar');
const isScript = (t) => typeof t === 'string' && /(^|\/)comment-prepare\.mjs$/.test(t);
const scriptIdx = tokens.map((t, i) => (isScript(t) ? i : -1)).filter((i) => i >= 0);
if (scriptIdx.length !== 1) {
  block([
    `GATE PROCEDENCIA — STAGING BLOQUEADO: ${scriptIdx.length} invocaciones reconocibles de comment-prepare en el comando.`,
    'Una por comando: cada corrida abre una tab persistente con el draft; dos corridas = dos tabs con el mismo reply (2026-09-27, Les M).',
    'Si solo querías LEERLO o greppearlo (no stagear): usa la herramienta Read, o nombra la ruta con glob (`scripts/comment-*.mjs`), nunca el nombre completo.',
  ]);
}
const si = scriptIdx[0];
if (tokens[si - 1] !== 'node') unparseable('el script no se invoca como `node <ruta>/comment-prepare.mjs`');
const mentions = tokens.filter((t, i) => i !== si && typeof t === 'string' && /comment[\s_-]*prep/i.test(t));
if (mentions.length) unparseable(`otra mención de comment-prepare en el comando: ${mentions.join(', ')}`);
const dangerous = tokens.find((t) => typeof t === 'object' && '`$(){}*?<>'.includes(t.op));
if (dangerous) unparseable(`operador de shell "${dangerous.op}" (sustitución/glob/redirección)`);
let end = si + 1;
while (end < tokens.length && typeof tokens[end] === 'string') end++;
const tail = tokens.slice(end);
if (tail.some((t) => typeof t === 'object' && t.op === '|')) {
  block([
    'GATE PROCEDENCIA — STAGING BLOQUEADO: comment-prepare va pipeado.',
    'Corre la invocación sola y lee el JSON completo: es el handoff (ok, check, identity, attachment, nextStep).',
  ]);
}
const { flags, positionals, unknown, repeated } = parseArgs(tokens.slice(si + 1, end));
if (unknown.length) unparseable(`flags no aceptados: ${unknown.join(', ')}`);
if (positionals.length) unparseable(`argumentos sueltos: ${positionals.join(' ').slice(0, 120)}`);
if (repeated.length) unparseable(`flags repetidos: ${repeated.join(', ')}`);
const url = flags['--url'];
const bodyFile = flags['--body-file'];
const imageFile = flags['--image'];
if (!url) block('GATE PROCEDENCIA: comment-prepare sin --url; no puedo derivar el post_id para hallar el recibo del coagent.');
if (!bodyFile) block('GATE PROCEDENCIA: comment-prepare sin --body-file; el draft debe venir de etapa 3 en un archivo.');
if (!flags['--author']) block('GATE PROCEDENCIA: comment-prepare sin --author.');
if (flags['--mode'] != null && !PREPARE_MODES.has(flags['--mode'])) unparseable(`--mode "${flags['--mode']}" (solo reply o root)`);
if (!isAbsolute(bodyFile)) block(`GATE PROCEDENCIA: --body-file "${bodyFile}" no es ruta absoluta; el hook y el script podrían leer archivos distintos.`);
if (imageFile && !isAbsolute(imageFile)) block(`GATE PROCEDENCIA: --image "${imageFile}" no es ruta absoluta.`);

const pidM = url.match(/(?:posts\/|post_id=|multi_permalinks=|story_fbid=)(\d+)/);
if (!pidM) block(`GATE PROCEDENCIA: no pude derivar post_id de --url "${url}".`);
const postId = pidM[1];

// etapa 0 a medias (2026-09-28): `reflex emit` corrió (13 packets) y nadie escribió ni aplicó
// verdicts; el lote salió sin re-juzgar el moat. La etapa termina en `apply`, que deja
// .coagent/reflex-applied.json; packets más nuevos que el marcador = etapa 0 incompleta.
const packetsFile = resolve(PROJECT_DIR, '.coagent', 'reflex-packets.json');
const appliedFile = resolve(PROJECT_DIR, '.coagent', 'reflex-applied.json');
if (existsSync(packetsFile)) {
  const packetsMtime = statSync(packetsFile).mtimeMs;
  const appliedAt = existsSync(appliedFile) ? statSync(appliedFile).mtimeMs : 0;
  if (appliedAt < packetsMtime) {
    block([
      'GATE PROCEDENCIA — STAGING BLOQUEADO: etapa 0 (reflex) emitida pero NO aplicada.',
      `  ${packetsFile} es más nuevo que ${existsSync(appliedFile) ? appliedFile : '(sin marcador reflex-applied.json)'}.`,
      'Juzga los packets (Claude, arco completo → .coagent/reflex-verdicts.json) y corre',
      '  node scripts/reflex.mjs apply --verdicts .coagent/reflex-verdicts.json',
      'El emit no es la etapa; la etapa termina en apply (ver .claude/rules/outcome-reflex.md).',
    ]);
  }
}

// el draft staged DEBE ser el que devolvió el coagent (se compara por sha más abajo)
let bodyText;
try {
  bodyText = readFileSync(abs(bodyFile), 'utf8');
} catch (e) {
  block(`GATE PROCEDENCIA: no pude leer --body-file "${bodyFile}" (${e.message}). Fail-closed.`);
}

// cierre clonado (2026-09-28): siete replies con la misma pregunta final, varias en el mismo
// hilo con minutos de diferencia. Se compara el cierre del body-file con el de cada draft
// consultado en las últimas 24h (cualquier post) cuyo archivo siga en disco.
let detectCloserClones;
try {
  ({ detectCloserClones } = await import(resolve(PROJECT_DIR, 'scripts/closer-clone.mjs')));
} catch (e) {
  block(`GATE PROCEDENCIA: no pude cargar closer-clone.mjs (${e.message}). Fail-closed.`);
}
{
  const coagentDir = resolve(PROJECT_DIR, '.coagent');
  const bodyAbs = abs(bodyFile);
  const peers = [];
  for (const f of (existsSync(coagentDir) ? readdirSync(coagentDir) : []).filter((f) => f.endsWith('.consult.json'))) {
    let rec;
    try { rec = JSON.parse(readFileSync(resolve(coagentDir, f), 'utf8')); } catch { continue; }
    for (const d of Array.isArray(rec.drafts) ? rec.drafts : []) {
      const at = Date.parse(d.consulted_at || '');
      if (!d.draft_file || !at || Date.now() - at > FRESH_MS) continue;
      const p = abs(d.draft_file);
      if (p === bodyAbs || !existsSync(p)) continue;
      peers.push({ name: `${d.author || '?'} (${f.replace('.consult.json', '')})`, text: readFileSync(p, 'utf8') });
    }
  }
  if (peers.length) {
    const r = detectCloserClones([{ name: 'ESTE', text: bodyText }, ...peers]);
    const clones = r.pairs.filter((p) => p.hard && (p.a === 'ESTE' || p.b === 'ESTE'));
    if (clones.length) {
      block([
        'GATE PROCEDENCIA — STAGING BLOQUEADO: CIERRE CLONADO. Este draft termina igual que reply(s) ya consultadas en las últimas 24h:',
        ...clones.map((p) => `  ↔ ${p.a === 'ESTE' ? p.b : p.a}  lcs=${p.lcs} run=${p.run}\n     «${p.closerA.slice(0, 110)}»\n     «${p.closerB.slice(0, 110)}»`),
        'El mismo cierre en varias replies se lee como bot ante el lurker (y confirma el sello "blatant use of ai").',
        'Replantea la pregunta del título con las palabras de ESTE interlocutor, re-consulta (x/y) y re-finaliza. Ver reply-output-style.md.',
      ]);
    }
  }
}

const receiptFile = resolve(PROJECT_DIR, '.coagent', `${postId}.consult.json`);
if (!existsSync(receiptFile)) {
  block([
    `GATE PROCEDENCIA — STAGING BLOQUEADO: no hay recibo de consulta para el hilo ${postId}.`,
    'La etapa 3 (coagent) NO se ejecutó. NO redactes el reply a mano.',
    `Flujo: node scripts/framework-pick.mjs --post-id ${postId} --author "<A>" →`,
    '  compón el master con el framework que permita el pick → seed-gate →',
    `  node scripts/seed-coagent.mjs seed --post-id ${postId} --author "<A>" --master <master.md>`,
    '  (siembra al coagent, lee su respuesta, guárdala) →',
    `  node scripts/seed-coagent.mjs finalize --post-id ${postId} --draft <draft.txt> --author "<A>" --framework <id>`,
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
  if (r.master_sha && draftSha(masterText) !== r.master_sha) {
    block(`GATE PROCEDENCIA: el master cambió después del seed (sha ${draftSha(masterText)} ≠ recibo ${r.master_sha}); re-corre seed-gate + seed.`);
  }
} catch (e) {
  block(`GATE PROCEDENCIA: no pude releer el master "${r.master}" (${e.message}). Fail-closed.`);
}

const bodySha = draftSha(bodyText);

// recibos en imagen: lo que el texto promete, el composer lo tiene que llevar (Art. 2)
const promisesImage = /screenshots?\s+(are\s+)?attached|attached\s+screenshots?|see\s+(the\s+)?(attached\s+)?(screenshots?|image|collage)|image\s+attached|collage\s+attached|highlights\s+mine|capturas?\s+adjuntas?|imagen\s+adjunta/i.test(bodyText);
if (promisesImage && !imageFile) {
  block([
    'GATE PROCEDENCIA — STAGING BLOQUEADO: el draft anuncia screenshots/imagen adjunta pero el comando no trae --image.',
    'Arma el collage (scripts/receipt-shots.mjs → scripts/receipt-collage.py) y pásalo con --image <png>,',
    'o quita la promesa del texto. Un reply que promete evidencia y sale sin ella es fake-green.',
  ]);
}
if (imageFile && !existsSync(abs(imageFile))) {
  block(`GATE PROCEDENCIA — STAGING BLOQUEADO: --image "${imageFile}" no existe en disco.`);
}
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
