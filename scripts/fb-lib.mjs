// Primitivas canónicas compartidas por los scripts del pipeline (Art. 6 — una
// sola fuente para conectar al Chrome de debug, abrir tab efímera en el contexto
// logueado, parsear antigüedad). NO navega las tabs de Bernard: siempre abre una
// tab nueva en el contexto existente y la cierra al terminar (no mata su Chrome).

import { chromium } from 'playwright-core';

export const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9333';

// Conexión CDP cruda compartida (Art. 6). Devuelve {browser, ctx}; el caller
// decide la política de cierre (efímera vs persistente).
async function connect() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const ctx = browser.contexts()[0];
  if (!ctx) {
    await browser.close().catch(() => {});
    throw new Error('no browser context on ' + CDP_URL + ' (¿Chrome de debug vivo? ver ~/CLAUDE.md)');
  }
  return { browser, ctx };
}

// Tab EFÍMERA: para leer/scrapear (etapas 1-2). Se cierra al terminar. Uso:
//   const { page, done } = await openScratchPage();
//   try { ... } finally { await done(); }
export async function openScratchPage() {
  const { browser, ctx } = await connect();
  const page = await ctx.newPage();
  const done = async () => {
    await page.close().catch(() => {});
    await browser.close().catch(() => {}); // detacha CDP, NO mata el Chrome de Bernard
  };
  return { browser, ctx, page, done };
}

// Tab PERSISTENTE: para la PREPARACIÓN de escritura (etapa 4). Deja la tab VIVA
// con el composer cargado y solo detacha el CDP del script — la página NO se
// cierra. Claude+MCP la retoma por URL (`list_pages`→`select_page`) para
// re-verificar y hacer el Enter irreversible (firewall Art. 4: lo reversible se
// scriptea, el acto irreversible se queda en Claude). Uso:
//   const { page, detach } = await openPersistentPage();
//   ... preparar draft ...; await detach();   // tab queda abierta
export async function openPersistentPage() {
  const { browser, ctx } = await connect();
  const page = await ctx.newPage();
  const detach = async () => {
    await browser.close().catch(() => {}); // suelta el CDP; la tab persiste abierta
  };
  return { browser, ctx, page, detach };
}

// Centinela de "no pude fechar esto". Debe ser mayor que CUALQUIER edad real: el viejo
// 99999 equivalía a 69 días, así que un comentario de 3 meses (129600 min) se ordenaba
// como MÁS viejo que lo desconocido y contaminaba la deuda. Se compara por identidad
// (=== UNKNOWN_AGE), nunca por umbral.
export { UNKNOWN_AGE, MAX_AGE_DAYS, MAX_AGE_MIN, isStaleMinutes, isStaleDate } from './freshness.mjs';
import { UNKNOWN_AGE } from './freshness.mjs';

const UNIT_MINUTES = { minute: 1, hour: 60, day: 1440, week: 10080, month: 43200, year: 525600 };
const SHORT_MINUTES = { m: 1, h: 60, d: 1440, w: 10080, y: 525600 };

// "3h", "27m", "1w", "15 minutes ago", "3 hours ago", "2 days ago", "a week ago",
// "about an hour ago", "a few seconds ago" → minutos (UNKNOWN_AGE si no parsea).
// Entiende AMBOS renders de FB: el compacto ("15m", "1w") del link de timestamp y el de
// palabra completa ("15 minutes ago") del aria-label — el desajuste entre ambos era el
// bug que tiraba la deuda a [?]. Semanas/meses/años se agregaron el 2026-07-08: sin
// ellos, TODO comentario de ≥1 semana caía al centinela y su deuda se volvía inordenable.
export function ageMinutes(text) {
  const t = text || '';
  if (/a few seconds|just now|\bnow\b/i.test(t)) return 0;
  if (/about an hour|an hour ago/i.test(t)) return 60;
  // "a week" / "a week ago" — el "ago" es opcional porque el productor (walkArticles)
  // captura solo la cantidad+unidad, sin el sufijo.
  const article = t.match(/\ban?\s+(minute|hour|day|week|month|year)\b/i);
  if (article) return UNIT_MINUTES[article[1].toLowerCase()];
  const long = t.match(/(\d+)\s*(second|minute|hour|day|week|month|year)s?\b/i);
  if (long) return long[2].toLowerCase() === 'second' ? 0 : +long[1] * UNIT_MINUTES[long[2].toLowerCase()];
  const short = t.match(/(\d+)\s*([mhdwy])\b/);
  if (!short) return UNKNOWN_AGE;
  return +short[1] * SHORT_MINUTES[short[2]];
}

export function fmtAge(min) {
  if (min === UNKNOWN_AGE) return '?';
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

// expandAllInPage — SSOT del expand-all de un hilo de FB (Art. 6). Corre DENTRO de la
// página (`page.evaluate(expandAllInPage)`), así que es autocontenida: sin imports, sin
// closures externos. La usan thread-extract (para leer el hilo completo) y comment-prepare
// (para que el comentario target no siga colapsado). Vivía DUPLICADA en ambos, y la copia
// de comment-prepare se quedó vieja: no cazaba el render (b), así que un target dentro de
// un sub-hilo colapsado daba "target article not found" (2026-07-08).
//
// Devuelve { clicked, rounds, expandedText, articles, pending, truncatedRemaining }.
// `pending > 0` = quedaron sub-hilos sin abrir → la extracción está truncada.
export async function expandAllInPage() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (b) => (b.innerText || '').replace(/\s+/g, ' ').trim();
  // FB tiene DOS renders del botón de expandir réplicas y solo uno empieza con "View":
  //   a) "View all 3 replies" / "View 1 reply" / "View more replies"
  //   b) "Bernard Uriza Orozco replied · 4 Replies"
  const EXPAND =
    /^(View all \d+ repl|View more repl|View previous repl|View \d+ repl|View \d+ more comment|\d+ repl(y|ies)$)/i;
  const REPLIED = / replied\s+·\s+\d+\s+Repl(y|ies)$/i;
  // Detrás del post abierto sigue montado el FEED, con sus propios botones (ocultos).
  // Clickearlos expandía hilos ajenos. `checkVisibility()` es el chequeo real; offsetParent
  // es fallback para Chrome viejo, pero da falso-oculto en `position: fixed`.
  const visible = (b) =>
    typeof b.checkVisibility === 'function'
      ? b.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
      : b.offsetParent !== null;
  const buttons = () => [...document.querySelectorAll('div[role="button"]')].filter(visible);
  const find = () => buttons().filter((b) => { const t = norm(b); return EXPAND.test(t) || REPLIED.test(t); });
  // "See more" trunca el cuerpo de un comentario largo: el argumento del oponente vive ahí,
  // y un anchor a mitad de texto no existe en el DOM hasta abrirlo.
  const findSeeMore = () =>
    [...document.querySelectorAll('div[role="article"] div[role="button"]')].filter(
      (b) => visible(b) && /^See more$/i.test(norm(b))
    );
  // Un SOLO disparo de click: dispatchEvent('click') + b.click() daba DOS activaciones, y
  // sobre un botón toggle eso abre y vuelve a cerrar la rama.
  const press = (b) => {
    b.scrollIntoView({ block: 'center' });
    for (const type of ['mouseover', 'mousedown', 'mouseup']) {
      b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
    }
    if (typeof b.click === 'function') b.click();
    else b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  };
  const articleCount = () => document.querySelectorAll('div[role="article"]').length;
  const promisedReplies = find()
    .map((b) => norm(b).match(/(?:^View all (\d+) repl|^View (\d+) repl|·\s+(\d+)\s+Repl(?:y|ies)$)/i))
    .filter(Boolean)
    .reduce((sum, m) => sum + +(m[1] || m[2] || m[3] || 0), 0);
  // Expandir un nivel REVELA los botones del siguiente. Se para solo cuando NADA se mueve:
  // ni el hilo crece ni el set de botones cambia, dos rondas seguidas.
  let clicked = 0, stagnant = 0, prevArticles = -1, prevBtns = -1, rounds = 0;
  for (; rounds < 25; rounds++) {
    const btns = find();
    if (!btns.length) break;
    for (const b of btns) { press(b); clicked++; }
    await sleep(1400);
    const nowArticles = articleCount();
    const nowBtns = find().length;
    stagnant = nowArticles === prevArticles && nowBtns === prevBtns ? stagnant + 1 : 0;
    prevArticles = nowArticles;
    prevBtns = nowBtns;
    if (stagnant >= 2) break;
  }
  let expandedText = 0;
  for (let round = 0; round < 5; round++) {
    const more = findSeeMore();
    if (!more.length) break;
    for (const b of more) { press(b); expandedText++; }
    await sleep(600);
  }
  return {
    clicked,
    rounds,
    expandedText,
    articles: articleCount(),
    promisedReplies,
    pending: find().length,
    truncatedRemaining: findSeeMore().length,
  };
}

// readThreadRoot(page) — extrae el POST RAÍZ real de un hilo de FB, NO el primer
// comentario. (Bug visto: `thread-extract.mjs#walkArticles` camina solo los
// `div[role="article"]`, que en FB son los COMENTARIOS; el post raíz NO es un
// `div[role="article"]` — es la "story" del feed/dialog. El walk nunca lo captura,
// así que el "root" del transcript terminaba siendo el primer comentario.)
//
// Razonamiento de selectores (necesita VERIFICACIÓN EN VIVO — diferida; el
// worktree no puede tocar FB):
//   1. AUTOR + título: FB rotula el contenedor de la story con un heading
//      "<Autor>'s Post" (`h2`/`[role="heading"]`); en vista de permalink/dialog,
//      ese rótulo está en el `aria-label` del `[role="dialog"]`. Es el MISMO
//      heuristic que `walkArticles` ya usa para `postOwner` — aquí lo reutilizamos
//      para anclar la story y de paso devolver al autor.
//   2. CUERPO: el texto del post vive bajo `[data-ad-rendering-role="story_message"]`
//      (o el legacy `[data-ad-comet-preview="message"]`). Ese contenedor es exclusivo
//      del cuerpo de la story — NO aparece en los comentarios — así que es el ancla
//      más limpia para el cuerpo del post. Fallbacks razonados si FB cambia el
//      atributo: el `[role="article"]` de NIVEL SUPERIOR (el que NO está anidado
//      dentro de otro article ni es un comentario con botón Reply propio) — en
//      algunos renders la story SÍ es un article, pero es el contenedor que envuelve
//      a TODOS los comentarios, no uno hermano de ellos.
//   3. EDAD del post: el primer link de timestamp ("3h"/"June 16 at…") dentro de la
//      story, distinto de los timestamps de los comentarios. Se parsea con ageMinutes.
//
// Devuelve { ok, author, user_id, ageStr, ageMin, text, via } — `via` dice qué
// selector pegó (para auditar en vivo cuál sobrevive). Pensado para correr DENTRO
// de la página vía `page.evaluate(readThreadRoot)` igual que `walkArticles`.
//
// USO (en thread-extract.mjs, cuando se cablee tras verificación en vivo):
//   const root = await page.evaluate(readThreadRootInPage);   // función serializable
// Esta export es la versión node-side que recibe `page` y delega el evaluate, para
// que el caller no tenga que reimplementar el cuerpo serializable.
export async function readThreadRoot(page) {
  return page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();

    // (1) autor + ancla de la story desde el heading "<Autor>'s Post"
    let author = '';
    let storyRoot = null;
    const heading = [...document.querySelectorAll('h2,[role="heading"]')].find((x) =>
      /['’]s Post$/.test((x.textContent || '').trim())
    );
    if (heading) {
      author = (heading.textContent || '').replace(/['’]s Post$/, '').trim();
      // sube hasta el contenedor de la story (el que contiene el story_message)
      storyRoot =
        heading.closest('[role="article"]') ||
        heading.closest('[role="dialog"]') ||
        document.body;
    }
    if (!author) {
      const dlg = document.querySelector('[role="dialog"]');
      const al = (dlg && dlg.getAttribute('aria-label')) || '';
      const mm = al.match(/^(.+?)['’]s Post/);
      if (mm) {
        author = mm[1].trim();
        storyRoot = dlg;
      }
    }
    const scope = storyRoot || document;

    // (2) cuerpo del post — el story_message es exclusivo del cuerpo de la story
    let bodyEl =
      scope.querySelector('[data-ad-rendering-role="story_message"]') ||
      scope.querySelector('[data-ad-comet-preview="message"]') ||
      document.querySelector('[data-ad-rendering-role="story_message"]') ||
      document.querySelector('[data-ad-comet-preview="message"]');
    let via = bodyEl ? 'story_message' : null;

    // fallback: el article de nivel superior que NO es un comentario (no tiene
    // botón Reply propio fuera de articles anidados). Es el contenedor de la story.
    if (!bodyEl) {
      const arts = [...document.querySelectorAll('div[role="article"]')];
      const topLevel = arts.find((a) => {
        const lbl = a.getAttribute('aria-label') || '';
        // un comentario lleva "Comment by"/"Reply by"; la story no.
        return lbl && !/^(Comment|Reply) by /i.test(lbl);
      });
      if (topLevel) {
        bodyEl = topLevel;
        via = 'top_level_article';
      }
    }

    // (3) user_id del autor: primer link de perfil dentro del scope de la story
    let user_id = null;
    const ulink = scope.querySelector('a[href*="/user/"]') || document.querySelector('a[href*="/user/"]');
    if (ulink) {
      const mm = ulink.href.match(/\/user\/(\d+)/);
      if (mm) user_id = mm[1];
    }

    // edad del post: primer timestamp dentro del scope (link con "h"/"m"/"June…").
    let ageStr = '';
    const tlink = [...scope.querySelectorAll('a[href*="/posts/"], abbr, a[role="link"]')]
      .map((x) => clean(x.getAttribute('aria-label') || x.textContent))
      .find((s) => /\b\d+\s*[mhd]\b|ago|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i.test(s));
    if (tlink) ageStr = tlink;

    const text = bodyEl ? clean(bodyEl.innerText) : '';
    return {
      ok: !!(author || text),
      author: author || null,
      user_id,
      ageStr: ageStr || null,
      text,
      via: via || 'none',
    };
  });
}
