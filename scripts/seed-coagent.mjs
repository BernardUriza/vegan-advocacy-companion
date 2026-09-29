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
//                 recibo PARCIAL {status:'seeded'} con master_sha.
//   1b. insert  → transporta ESE master (sha del recibo) al composer de ChatGPT por CDP,
//                 SIN enviar; deja la tab viva. El Send lo hace Claude+MCP (G.41).
//   1c. read    → lee la respuesta del coagent tras el seed, por estabilidad de contenido.
//   2. finalize → tras leer el draft del coagent, estampa draft_sha {status:'consulted'}.
//
// Uso:
//   node seed-coagent.mjs seed     --post-id <id> --author "<A>" --master <master.md>
//   node seed-coagent.mjs insert   --post-id <id> --master <master.md> [--url <chat url>]
//   node seed-coagent.mjs read     --phrase "<frase única del seed>" [--url <chat url>] [--out <f>]
//   node seed-coagent.mjs finalize --post-id <id> --draft <draft.txt> --author "<A>" --framework <id>
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

// insert solo transporta un master que YA pasó por `seed` (mismo sha): nunca uno sin gate.
export function insertProblems(receipt, masterText) {
  if (!receipt) return ['no hay recibo parcial — corre `seed` primero'];
  const p = [];
  if (receipt.seed_gate !== 'pass') p.push('el recibo no tiene seed_gate=pass');
  if (!receipt.master_sha) p.push('recibo sin master_sha (legacy) — re-corre `seed`');
  else if (receipt.master_sha !== draftSha(masterText)) p.push(`el master cambió tras el seed (sha ${draftSha(masterText)} ≠ recibo ${receipt.master_sha}) — re-corre seed-gate + \`seed\``);
  return p;
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
    master_sha: draftSha(text),
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
  const framework = arg('--framework');
  if (!postId || !draft || !author || !framework) die('uso: seed-coagent.mjs finalize --post-id <id> --draft <file> --author "<A>" --framework <id>  (autor y framework son obligatorios: el autor liga el draft a su interacción y el framework se valida contra framework-pick)');
  const rp = receiptPath(postId);
  if (!existsSync(rp)) die(`no hay recibo parcial para ${postId} — corre \`seed\` primero (no saltes la consulta).`);
  const { readPick } = await import('./framework-pick.mjs');
  const { pickProblems } = await import('./framework-rotation.mjs');
  const pick = readPick(postId, author);
  const allFrameworks = JSON.parse(readFileSync(resolve(ROOT, 'data/frameworks.json'), 'utf8'));
  const rotation = pickProblems(pick, framework, allFrameworks);
  if (rotation.length) die('FINALIZE BLOQUEADO por la rotación de frameworks:\n  - ' + rotation.join('\n  - '));
  const r = JSON.parse(readFileSync(rp, 'utf8'));
  // normaliza el shape legacy single-draft a drafts[]
  if (!Array.isArray(r.drafts)) r.drafts = r.draft_sha ? [{ author: r.author ?? null, draft_sha: r.draft_sha, draft_file: r.draft_file ?? null, consulted_at: r.consulted_at ?? null }] : [];
  const draftPath = resolveUserPath(draft, ROOT);
  const sha = draftSha(readFileSync(draftPath, 'utf8'));
  // upsert por sha: varios targets del mismo post acumulan, no se pisan
  const i = r.drafts.findIndex((d) => d.draft_sha === sha);
  const entry = {
    author, draft_sha: sha, draft_file: draftPath,
    consulted_at: i >= 0 && r.drafts[i].consulted_at ? r.drafts[i].consulted_at : nowIso(),
    framework, exposure_n: pick.exposure_n, assignment: pick.assignment, propensity: pick.propensity,
  };
  if (i >= 0) r.drafts[i] = entry; else r.drafts.push(entry);
  r.status = 'consulted';
  r.consulted_at = entry.consulted_at;
  delete r.draft_sha; delete r.draft_file; delete r.author; // canónico vive en drafts[]
  writeFileSync(rp, JSON.stringify(r, null, 2) + '\n');
  console.log(`✓ recibo CONSULTADO: ${rp} (${r.drafts.length} draft(s) en el post)`);
  console.log(`  draft_sha: ${sha}${author ? ` (${author})` : ''} — ya puedes stagear con comment-prepare --body-file ${draftPath}`);
} else if (cmd === 'insert') {
  const postId = arg('--post-id');
  const master = arg('--master');
  if (!postId || !master) die('uso: seed-coagent.mjs insert --post-id <id> --master <master.md> [--url <chat url>]');
  const masterPath = resolveUserPath(master, ROOT);
  const text = readFileSync(masterPath, 'utf8');
  const rp = receiptPath(postId);
  const receipt = existsSync(rp) ? JSON.parse(readFileSync(rp, 'utf8')) : null;
  const problems = insertProblems(receipt, text);
  if (problems.length) die('INSERT BLOQUEADO:\n  - ' + problems.join('\n  - '));
  const T = await import('./coagent-transport.mjs');
  const { openPersistentPage } = await import('./fb-lib.mjs');
  const target = T.resolveCoagentUrl({ url: arg('--url'), root: ROOT });
  if (!target.url) die(target.error);
  const out = (o, code) => { console.log(JSON.stringify(o, null, 2)); process.exit(code); };
  const { page, detach } = await openPersistentPage();
  const fail = async (o, code) => { await page.close().catch(() => {}); await detach(); out({ ok: false, url: target.url, ...o }, code); };
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await T.waitForComposer(page).catch(() => {});
    const href = page.url();
    if (!T.hrefMatches(target.url, href)) await fail({ stage: 'href', pageUrl: href, error: 'la tab no está en el chat del coagent resuelto' }, 2);
    if ((await page.$(T.COMPOSER)) === null) await fail({ stage: 'composer', pageUrl: href, error: `no aparece ${T.COMPOSER} (¿sesión de ChatGPT? ¿DOM cambió?)` }, 2);
    const lines = T.nonEmptyLines(text);
    const meta = { postId, sha: draftSha(text), lines };
    const attempts = [];
    let pasted = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      pasted = await T.pasteSeed(page, text, meta, { chunk: Number(arg('--chunk')) || 1500 });
      if (!pasted.ok) {
        const ours = !pasted.existing || pasted.existing.startsWith(T.nonEmptyLines(text)[0]);
        const cleared = ours ? await T.clearComposer(page) : { cleared: false, note: 'borrador ajeno (no es un seed nuestro): no se toca' };
        await fail({ stage: 'paste', pageUrl: href, ...pasted, cleared, attempts }, 2);
      }
      const cmp = T.compareLines(text, (await T.settleComposer(page)) || '');
      if (cmp.ok) break;
      const cleared = await T.clearComposer(page);
      attempts.push({ attempt, compare: cmp, cleared });
      if (attempt === 2 || !cleared.cleared) await fail({ stage: 'verify', pageUrl: href, attempts }, 3);
    }
    await detach();
    out({
      ok: true,
      url: target.url,
      urlSource: target.source,
      pageUrl: href,
      postId,
      masterSha: meta.sha,
      chunks: pasted.chunks,
      retried: attempts,
      lines: { count: lines.length, first: lines[0], last: lines[lines.length - 1] },
      nextStep: `NO se envió nada. Claude+MCP: list_pages → select_page la tab en ${href} (si hay varias, la que tenga window.__seed.sha === '${meta.sha}') → en UN evaluate_script: assert location.href (${T.isBaseGptUrl(target.url) ? `GPT ${T.gptIdOf(target.url)}, sin /c/` : `contiene ${T.chatIdOf(target.url)}`}), assert que las líneas no vacías de document.querySelector('${T.COMPOSER}').innerText (normalizadas: trim + espacios colapsados) son idénticas en orden a window.__seed.lines (${lines.length}), y solo entonces [...document.querySelectorAll('form button')].find(b => b.getAttribute('aria-label') === 'Send').click(). En llamada aparte: la frase única del seed aparece 1 sola vez (no re-enviar si ya está). Luego: node scripts/seed-coagent.mjs read --url <location.href tras el envío> --phrase "<frase única del seed>" --out <respuesta.md> (espera por estabilidad).`,
    }, 0);
  } catch (e) {
    await fail({ stage: 'exception', error: e.message }, 1);
  }
} else if (cmd === 'read') {
  const phrase = arg('--phrase');
  if (!phrase) die('uso: seed-coagent.mjs read --phrase "<frase única del seed>" [--url <chat url>] [--out <file>] [--timeout-s N]');
  const T = await import('./coagent-transport.mjs');
  const { openScratchPage } = await import('./fb-lib.mjs');
  const target = T.resolveCoagentUrl({ url: arg('--url'), root: ROOT });
  if (!target.url) die(target.error);
  const outFile = arg('--out') ? resolveUserPath(arg('--out'), ROOT) : null;
  const timeout = (Number(arg('--timeout-s')) || 240) * 1000;
  const { page, done } = await openScratchPage();
  let res;
  try {
    await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    const href = page.url();
    if (!T.hrefMatches(target.url, href)) res = { ok: false, stage: 'href', pageUrl: href, error: 'la tab no está en el chat pedido' };
    else if (!(await T.waitForSeedText(page, phrase))) res = { ok: false, stage: 'seed', pageUrl: href, error: 'la frase no aparece en el chat' };
    else res = { pageUrl: href, ...(await T.readReplyWhenStable(page, phrase, { timeout })) };
  } finally {
    await done();
  }
  if (res.ok && outFile) {
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, res.reply + '\n');
  }
  const { reply, ...rest } = res;
  console.log(JSON.stringify({ url: target.url, ...rest, chars: reply ? reply.length : 0, head: reply ? reply.slice(0, 200) : null, out: res.ok ? outFile : null, ...(outFile ? {} : { reply }) }, null, 2));
  process.exit(res.ok ? 0 : 3);
} else if (cmd === 'show') {
  const postId = arg('--post-id');
  const rp = receiptPath(postId);
  if (!existsSync(rp)) die(`(sin recibo) ${rp}`);
  console.log(readFileSync(rp, 'utf8'));
} else {
  die('comandos: seed | insert | read | finalize | show');
}
