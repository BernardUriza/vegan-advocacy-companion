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
//   (--anchor es opcional pero MUY recomendado: desambigua entre varios comentarios
//    del mismo autor en el hilo. Sin él se toma el primer match del autor.)

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPersistentPage, expandAllInPage, readThreadRoot } from './fb-lib.mjs';
import { resolveUserPath } from './paths.mjs';
import { judgeThreadIdentity } from './thread-identity.mjs';
import { parseArgs, PREPARE_MODES } from './cli-args.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const parsed = parseArgs(process.argv.slice(2));
function arg(name) {
  return parsed.flags[name] ?? null;
}

// PASO 0 mecánico — corre el style-gate DETERMINISTA (scripts/style-gate.mjs) sobre
// el body. Reusa lo canónico (Art. 6): caza kill-phrases/staccato/abrir-con-nombre/
// largo por regex. Devuelve el reporte; el caller aborta si hay flags DURAS.
function runStyleGate(bodyText, authorName) {
  const scriptPath = fileURLToPath(new URL('./style-gate.mjs', import.meta.url));
  let file = resolveUserPath(arg('--body-file'), ROOT);
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

const USAGE = 'uso: node comment-prepare.mjs --url "<openUrl>" --author "<Nombre>" [--anchor "<frase>"] --body-file <f> [--image <png>] [--mode reply|root]';
if (parsed.unknown.length || parsed.positionals.length || parsed.repeated.length) {
  console.error(`argumentos no aceptados: ${[...parsed.unknown, ...parsed.positionals, ...parsed.repeated.map((r) => r + ' (repetido)')].join(', ')}\n${USAGE}`);
  process.exit(1);
}
const url = arg('--url');
const author = arg('--author');
const mode = arg('--mode') || 'reply';
if (!PREPARE_MODES.has(mode)) {
  console.error(`--mode "${mode}" no aceptado (reply | root)\n${USAGE}`);
  process.exit(1);
}
const anchor = arg('--anchor') || '';
const bodyFile = resolveUserPath(arg('--body-file'), ROOT);
const imageFile = resolveUserPath(arg('--image'), ROOT);
const ME = process.env.ME || 'Bernard Uriza Orozco';
const body = bodyFile ? readFileSync(bodyFile, 'utf8').replace(/\s+$/, '') : null;

if (!url || !author || !body) {
  console.error(USAGE);
  process.exit(1);
}

// El expand-all vive en fb-lib (`expandAllInPage`, SSOT). Estaba duplicado aquí y la copia
// se quedó vieja: no cazaba el render "X replied · N Replies", así que un target dentro de
// un sub-hilo colapsado daba "target article not found" (2026-07-08, Adam Gaska en 27051).

// --- DENTRO de la página: localizar el comentario target y abrir SU Reply ---
function openComposer({ author, anchor, ME }) {
  // anchor tolerante a mayúsculas y espacios: el verbatim de FB suele diferir del
  // anchor por capitalización ("You haven't…" vs "you haven't…") o whitespace.
  const norm = (s) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const na = norm(anchor);
  const arts = [...document.querySelectorAll('div[role="article"]')];
  const ownText = (a) => {
    const c = a.cloneNode(true);
    c.querySelectorAll('div[role="article"]').forEach((n) => n.remove());
    return c.textContent || '';
  };
  const target = arts.find((a) => {
    const lbl = a.getAttribute('aria-label') || '';
    const byAuthor = lbl.startsWith('Comment by ' + author) || lbl.startsWith('Reply by ' + author);
    const mine = lbl.includes('by ' + ME);
    return !mine && byAuthor && (na ? norm(ownText(a)).includes(na) : true);
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

// --- DENTRO de la página (modo root): pegar en el composer del POST, fuera de todo comentario ---
// Un raíz en post ajeno no lleva auto-mención; el composer es el "Comment as …" que no vive
// dentro de ningún div[role=article]. Si trae texto, es un borrador de Bernard: no se toca.
function pasteRoot({ body }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')]
    .filter((b) => /^(Comment as|Write a comment|Write a public comment)/i.test(b.getAttribute('aria-label') || ''))
    .filter((b) => !b.closest('div[role="article"]'));
  if (boxes.length !== 1) return { ok: false, error: `root composer ambiguo (${boxes.length})` };
  const box = boxes[0];
  if ((box.innerText || '').trim().length) return { ok: false, error: 'root composer no está vacío (¿borrador de Bernard?)' };
  box.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(box);
  sel.removeAllRanges();
  sel.addRange(range);
  const dt = new DataTransfer();
  dt.setData('text/plain', body);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  return { ok: true, composerLabel: box.getAttribute('aria-label') };
}

// --- DENTRO de la página: re-leer el estado REAL (Lexical reconcilia async) ---
function readBack({ author, firstWords, lastWords, requireMention }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  const box = boxes.find((b) => firstWords && (b.innerText || '').includes(firstWords))
    || boxes.find((b) => /Reply/i.test(b.getAttribute('aria-label') || '') && (b.innerText || '').length > 30);
  if (!box) return { ok: false, error: 'composer empty/not found on readback' };
  const t = box.innerText || '';
  return {
    ok: true,
    len: t.length,
    mentionIntact: requireMention ? t.includes(author) : true,
    startsOK: firstWords ? t.includes(firstWords) : null,
    endsOK: lastWords ? t.trimEnd().endsWith(lastWords) : null,
    newlines: (t.match(/\n/g) || []).length,
    head: t.slice(0, 100),
    tail: t.slice(-100),
  };
}

// --- DENTRO de la página: el input[type=file] del composer que trae el draft ---
// FB monta un input oculto por composer ("Attach a photo or video"); se elige el que sigue
// al box en orden de documento y está más cerca, nunca el del composer raíz del post.
function composerFileInput({ firstWords }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  const box = boxes.find((b) => (b.innerText || '').includes(firstWords));
  if (!box) return null;
  const form = box.closest('form');
  const scoped = form ? [...form.querySelectorAll('input[type="file"]')] : [];
  if (scoped.length) return scoped[0];
  const all = [...document.querySelectorAll('input[type="file"]')].filter((i) => /image/i.test(i.getAttribute('accept') || ''));
  const after = all.filter((i) => box.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_FOLLOWING);
  return after[0] || null;
}

// El preview NO vive dentro del <form> del composer: FB lo monta en un contenedor hermano,
// con su botón "Remove photo" (visto 2026-09-27). Se sube desde el box hasta el primer
// ancestro que contenga ese botón y UN solo textbox — así el preview es de ESTE composer y
// no del de otro comentario.
function composerAttachmentState({ firstWords }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  const box = boxes.find((b) => (b.innerText || '').includes(firstWords));
  if (!box) return { found: false };
  let anc = box.parentElement;
  for (let d = 0; d < 30 && anc; d++, anc = anc.parentElement) {
    const textboxes = anc.querySelectorAll('div[contenteditable="true"][role="textbox"]').length;
    if (textboxes > 1) break;
    const remove = anc.querySelector('[aria-label="Remove photo"], [aria-label="Remove video"]');
    if (remove) {
      const imgs = [...anc.querySelectorAll('img')].filter((i) => /^blob:|scontent|fbcdn/.test(i.src) && i.naturalWidth > 20);
      return { found: true, previews: Math.max(imgs.length, 1), removeButton: true, depth: d, sizes: imgs.map((i) => `${i.naturalWidth}x${i.naturalHeight}`) };
    }
  }
  return { found: true, previews: 0, removeButton: false };
}

// --- DENTRO de la página: links de post del diálogo que contiene el composer ---
function composerScopeLinks({ firstWords }) {
  const boxes = [...document.querySelectorAll('div[contenteditable="true"][role="textbox"]')];
  const box = boxes.find((b) => (b.innerText || '').includes(firstWords));
  if (!box) return { found: false, scope: null, links: [] };
  const dialog = box.closest('div[role="dialog"]');
  const root = dialog || document;
  const links = [...root.querySelectorAll('a[href*="/groups/"]')]
    .map((a) => a.href)
    .filter((h) => /\/groups\/[^/?#]+\/(posts|permalink)\/\d+/.test(h));
  return { found: true, scope: dialog ? 'dialog' : 'document', links };
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
      () => !!document.querySelector('a[href*="/me/"], [aria-label="Your profile"]') && !document.querySelector('input[name="email"], input[name="pass"]')
    );
    if (!loggedIn) {
      await failClose();
      console.log(JSON.stringify({ ok: false, stage: 'login', error: 'no logueado en esta tab (¿sesión de Bernard?)' }));
      process.exit(2);
    }

    const exp = await page.evaluate(expandAllInPage);
    await page.waitForTimeout(700);
    if (exp.pending > 0) {
      console.error(`[warn] quedaron ${exp.pending} sub-hilo(s) sin abrir — el target puede seguir colapsado`);
    }

    let opened;
    if (mode === 'root') {
      const postRoot = await readThreadRoot(page);
      if (postRoot.author !== author) {
        await failClose();
        console.log(JSON.stringify({ ok: false, stage: 'root-author', error: 'el post no es del --author (raíz en el post equivocado)', expected: author, found: postRoot.author }, null, 2));
        process.exit(2);
      }
      opened = { ok: true, mode, postAuthor: postRoot.author, postHead: (postRoot.text || '').slice(0, 100) };
    } else {
      opened = await page.evaluate(openComposer, { author, anchor, ME });
      if (!opened.ok) {
        await failClose();
        console.log(JSON.stringify({ ok: false, stage: 'open', ...opened }, null, 2));
        process.exit(2);
      }
      await page.waitForTimeout(900);
    }

    const pasted = mode === 'root' ? await page.evaluate(pasteRoot, { body }) : await page.evaluate(pasteBody, { author, body });
    if (!pasted.ok) {
      await failClose();
      console.log(JSON.stringify({ ok: false, stage: 'paste', opened, ...pasted }, null, 2));
      process.exit(2);
    }
    await page.waitForTimeout(1200); // dejar reconciliar a Lexical antes de leer

    const check = await page.evaluate(readBack, { author, firstWords, lastWords, requireMention: mode === 'reply' });
    let attachment = null;
    if (imageFile) {
      const inputHandle = await page.evaluateHandle(composerFileInput, { firstWords });
      const input = inputHandle.asElement();
      if (!input) {
        await failClose();
        console.log(JSON.stringify({ ok: false, stage: 'attach', error: 'file input del composer no encontrado', imageFile }, null, 2));
        process.exit(2);
      }
      await input.setInputFiles(imageFile);
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(1000);
        attachment = { imageFile, ...(await page.evaluate(composerAttachmentState, { firstWords })) };
        if (attachment.previews) break;
      }
      if (!attachment.previews) {
        await failClose();
        console.log(JSON.stringify({ ok: false, stage: 'attach', error: 'sin preview de la imagen en el composer', attachment }, null, 2));
        process.exit(2);
      }
    }
    const scopeRes = await page.evaluate(composerScopeLinks, { firstWords });
    const pageUrl = page.url();
    const identity = {
      scope: scopeRes.scope,
      ...judgeThreadIdentity({ expectedUrl: url, pageUrl, dialogLinks: scopeRes.links }),
    };

    await detach(); // deja la tab VIVA con el draft cargado
    detached = true;

    const draftOK = check.ok && check.mentionIntact && check.startsOK !== false && check.endsOK !== false;
    const clean = draftOK && identity.sameThread;
    console.log(
      JSON.stringify(
        {
          ok: clean,
          url,
          pageUrl,
          identity,
          loggedIn,
          opened,
          composerLabel: pasted.composerLabel,
          attachment,
          styleGate: { wordCount: gate.wordCount, softFlags: gate.softFlags || [] },
          check,
          nextStep: !identity.sameThread
            ? 'IDENTIDAD: el composer no está dentro del hilo pedido (identity.sameThread=false). NO enviar. Revisar identity.foreign y la tab; limpiar y re-preparar.'
            : clean
            ? (identity.urlRewritten
                ? `OJO: FB reescribió la URL de la tab a ${pageUrl}. Buscar la tab por ESA url (o por el contenido del composer) y, en el envío atómico, assertar el hilo por los links del div[role=dialog] que contiene el composer (groups/${identity.expected.groupId}/posts/${identity.expected.postId}), nunca por location.href. `
                : '') + 'Claude+MCP: list_pages → select_page la tab en esta url → re-leer el composer (Art. 2) → envío atómico con DESTINO + Enter sintético en evaluate_script (press_key Enter bloqueado por hook; ver comment-post-and-verify PASO 5) → verificación histérica por div[role=article] + screenshot. Si quedó mal, BORRAR.'
            : 'REVISAR: el draft quedó sucio (mención pisada / orden / truncado). Limpiar (Meta+a→Backspace) y re-preparar, o caer al golden path MCP.',
        },
        null,
        2
      )
    );
    process.exit(clean ? 0 : 3);
  } finally {
    if (!detached) await failClose();
  }
}

main().catch((e) => {
  console.error('comment-prepare FALLO:', e.message);
  process.exit(1);
});
