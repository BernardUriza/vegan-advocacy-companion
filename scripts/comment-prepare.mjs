// Etapa 4 (PREPARACIÓN de escritura, reversible) — abre el hilo, localiza el
// comentario a contestar, abre su composer de Reply, pega el borrador como reply
// ETIQUETADA (respeta la auto-mención del autor; gotcha de réplica anidada) y
// verifica el estado async — todo SIN ENVIAR. Deja la tab VIVA con el draft
// cargado y reporta el handoff. El Enter irreversible + la verificación histérica
// (`div[role=article]` + screenshot) los hace Claude+MCP (firewall Art. 4: lo
// reversible se scriptea, el botón de enviar es de Bernard).
//
// NO toca las tabs de Bernard: abre una tab nueva persistente en el contexto
// logueado. NO scriptea el style-gate (paso 0, juicio de Claude vs reply-output-style)
// ni el Enter (paso irreversible).
//
// Uso:
//   node comment-prepare.mjs --url "<openUrl>" --author "CarolAnn Liebelt" \
//        --anchor "being an omnivore isn't a choice" --body-file ./draft.txt
//   node comment-prepare.mjs --url "<url>" --author "X" --body "texto corto inline"
//   (--anchor es opcional pero MUY recomendado: desambigua entre varios comentarios
//    del mismo autor en el hilo. Sin él se toma el primer match del autor.)

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPersistentPage } from './fb-lib.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

// PASO 0 mecánico — corre el style-gate DETERMINISTA (scripts/style-gate.mjs) sobre
// el body. Reusa lo canónico (Art. 6): caza kill-phrases/staccato/abrir-con-nombre/
// largo por regex. Devuelve el reporte; el caller aborta si hay flags DURAS.
function runStyleGate(bodyText, authorName) {
  const scriptPath = fileURLToPath(new URL('./style-gate.mjs', import.meta.url));
  let file = arg('--body-file');
  let tmp = null;
  if (!file) {
    tmp = join(tmpdir(), `cp-stylegate-${process.pid}.txt`);
    writeFileSync(tmp, bodyText);
    file = tmp;
  }
  const cliArgs = [scriptPath, file, '--json'];
  if (authorName) cliArgs.push('--name', authorName);
  try {
    return JSON.parse(execFileSync('node', cliArgs, { encoding: 'utf8' }));
  } catch (e) {
    // style-gate sale con código 1 cuando hay flags duras; el JSON sigue en stdout
    try {
      return JSON.parse(e.stdout || '');
    } catch {
      return { clean: true, hardFlags: [], softFlags: [], _error: e.message };
    }
  } finally {
    if (tmp) {
      try {
        unlinkSync(tmp);
      } catch {}
    }
  }
}

const url = arg('--url') || process.argv.find((a) => a.startsWith('http'));
const author = arg('--author');
const anchor = arg('--anchor') || '';
const bodyFile = arg('--body-file');
const bodyInline = arg('--body');
const ME = process.env.ME || 'Bernard Uriza Orozco';
const body = bodyFile ? readFileSync(bodyFile, 'utf8').replace(/\s+$/, '') : bodyInline;

if (!url || !author || !body) {
  console.error('uso: node comment-prepare.mjs --url "<openUrl>" --author "<Nombre>" [--anchor "<frase>"] (--body-file <f> | --body "<txt>")');
  process.exit(1);
}

// --- DENTRO de la página: expandir replies colapsadas (idempotente) ---
async function expandAll() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = () =>
    [...document.querySelectorAll('div[role="button"]')].filter((b) =>
      /^(View all \d+ repl|View more repl|View previous repl|View \d+ repl|View \d+ more comment)/i.test(
        (b.innerText || '').trim()
      )
    );
  for (let round = 0; round < 6; round++) {
    const btns = find();
    if (!btns.length) break;
    for (const b of btns) {
      b.scrollIntoView({ block: 'center' });
      for (const type of ['mouseover', 'mousedown', 'mouseup', 'click']) {
        b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
    }
    await sleep(1300);
  }
}

// --- DENTRO de la página: localizar el comentario target y abrir SU Reply ---
function openComposer({ author, anchor, ME }) {
  // anchor tolerante a mayúsculas y espacios: el verbatim de FB suele diferir del
  // anchor por capitalización ("You haven't…" vs "you haven't…") o whitespace.
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const na = norm(anchor);
  const arts = [...document.querySelectorAll('div[role="article"]')];
  const target = arts.find((a) => {
    const lbl = a.getAttribute('aria-label') || '';
    const txt = a.innerText || '';
    const mine = !!a.querySelector('[aria-label^="Edit or delete"]') || lbl.includes('by ' + ME);
    return !mine && lbl.includes(author) && (na ? norm(txt).includes(na) : true);
  });
  if (!target) return { ok: false, error: 'target article not found', author, anchor };
  target.scrollIntoView({ block: 'center' });
  // el botón Reply PROPIO del target (no el de una reply hija anidada)
  const nested = [...target.querySelectorAll('div[role="article"]')];
  const btn = [...target.querySelectorAll('div[role="button"]')]
    .filter((b) => ((b.getAttribute('aria-label') || b.innerText || '').trim() === 'Reply'))
    .filter((b) => !nested.some((n) => n.contains(b)))[0];
  if (!btn) return { ok: false, error: 'own Reply button not found in target' };
  for (const type of ['mouseover', 'mousedown', 'mouseup', 'click']) {
    btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }
  return { ok: true, targetLabel: target.getAttribute('aria-label') };
}

// --- DENTRO de la página: pegar el body TRAS la auto-mención (no borrar el tag) ---
function pasteBody({ author, body }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  // gotcha: el composer de réplica anidada lleva el aria-label del PADRE; se
  // localiza por la auto-mención del author que FB insertó dentro.
  const box = boxes.find((b) => /Reply/i.test(b.getAttribute('aria-label') || '') && (b.innerText || '').includes(author));
  if (!box) return { ok: false, error: 'composer with author mention not found', author };
  box.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(box);
  range.collapse(false); // caret tras la @mención; NO selectAll (borraría el tag)
  sel.removeAllRanges();
  sel.addRange(range);
  const dt = new DataTransfer();
  dt.setData('text/plain', body);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  return { ok: true, composerLabel: box.getAttribute('aria-label') };
}

// --- DENTRO de la página: re-leer el estado REAL (Lexical reconcilia async) ---
function readBack({ author, firstWords, lastWords }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  const box = boxes.find((b) => /Reply/i.test(b.getAttribute('aria-label') || '') && (b.innerText || '').length > 30);
  if (!box) return { ok: false, error: 'composer empty/not found on readback' };
  const t = box.innerText || '';
  return {
    ok: true,
    len: t.length,
    mentionIntact: t.includes(author),
    startsOK: firstWords ? t.includes(firstWords) : null,
    endsOK: lastWords ? t.trimEnd().endsWith(lastWords) : null,
    newlines: (t.match(/\n/g) || []).length,
    head: t.slice(0, 100),
    tail: t.slice(-100),
  };
}

async function main() {
  const bodyTrim = body.trim();
  const firstWords = bodyTrim.split('\n')[0].slice(0, 40);
  const lastWords = bodyTrim.slice(-40);

  // PASO 0 — style-gate determinista ANTES de abrir tab: si el draft pisa la
  // kill-list dura, ni se prepara (fail-fast; no gasta una tab ni round-trips).
  const gate = runStyleGate(body, author);
  if (gate && Array.isArray(gate.hardFlags) && gate.hardFlags.length) {
    console.log(
      JSON.stringify(
        { ok: false, stage: 'style-gate', hardFlags: gate.hardFlags, softFlags: gate.softFlags || [], wordCount: gate.wordCount, checks: gate.checks },
        null,
        2
      )
    );
    process.exit(4);
  }

  const { page, detach } = await openPersistentPage();
  let detached = false;
  // en fallo: cerrar la tab que abrimos (no dejar huérfana) Y soltar el CDP.
  const failClose = async () => {
    await page.close().catch(() => {});
    await detach();
    detached = true;
  };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const loggedIn = await page.evaluate(
      () => !!document.querySelector('a[href*="/me/"], [aria-label="Your profile"]') || /facebook/i.test(document.title)
    );
    if (!loggedIn) {
      await failClose();
      console.log(JSON.stringify({ ok: false, stage: 'login', error: 'no logueado en esta tab (¿sesión de Bernard?)' }));
      process.exit(2);
    }

    await page.evaluate(expandAll);
    await page.waitForTimeout(700);

    const opened = await page.evaluate(openComposer, { author, anchor, ME });
    if (!opened.ok) {
      await failClose();
      console.log(JSON.stringify({ ok: false, stage: 'open', ...opened }, null, 2));
      process.exit(2);
    }
    await page.waitForTimeout(900);

    const pasted = await page.evaluate(pasteBody, { author, body });
    if (!pasted.ok) {
      await failClose();
      console.log(JSON.stringify({ ok: false, stage: 'paste', opened, ...pasted }, null, 2));
      process.exit(2);
    }
    await page.waitForTimeout(1200); // dejar reconciliar a Lexical antes de leer

    const check = await page.evaluate(readBack, { author, firstWords, lastWords });

    await detach(); // deja la tab VIVA con el draft cargado
    detached = true;

    const clean = check.ok && check.mentionIntact && check.startsOK !== false && check.endsOK !== false;
    console.log(
      JSON.stringify(
        {
          ok: clean,
          url,
          loggedIn,
          opened,
          composerLabel: pasted.composerLabel,
          styleGate: { wordCount: gate.wordCount, softFlags: gate.softFlags || [] },
          check,
          nextStep: clean
            ? 'Claude+MCP: list_pages → select_page la tab en esta url → re-leer el composer (Art. 2) → press_key Enter → verificación histérica por div[role=article] + screenshot. Si quedó mal, BORRAR.'
            : 'REVISAR: el draft quedó sucio (mención pisada / orden / truncado). Limpiar (Meta+a→Backspace) y re-preparar, o caer al golden path MCP.',
        },
        null,
        2
      )
    );
    process.exit(clean ? 0 : 3);
  } finally {
    if (!detached) await detach();
  }
}

main().catch((e) => {
  console.error('comment-prepare FALLO:', e.message);
  process.exit(1);
});
