// Etapa 2 (mecánica) — abre un hilo de FB, EXPANDE todo, camina los
// `div[role="article"]` y devuelve el árbol del hilo + una tabla de deuda
// determinista. NO decide la jugada ni redacta — eso es juicio (Claude + los
// dossiers). Acelera la parte cara: el expand-all + walk que de otro modo quema
// ~6 round-trips del MCP.
//
// Uso:
//   node thread-extract.mjs "<openUrl>"            # tabla humana
//   node thread-extract.mjs "<openUrl>" --json     # JSON (transcript + deuda)
//   ME="Bernard Uriza Orozco" node thread-extract.mjs ...   # override del dueño
//
// El <openUrl> lo sirve notif-scan.mjs (campo `openUrl` / línea "abrir:").

import { pathToFileURL } from 'url';
import { existsSync, readFileSync, writeFileSync, renameSync } from 'fs';
import { openScratchPage, ageMinutes, fmtAge, UNKNOWN_AGE, expandAllInPage, MAX_AGE_DAYS, isStaleMinutes, readThreadRoot } from './fb-lib.mjs';
import { registerThread } from './db.mjs';
import { parseReactionCount, sumPostReactionLabels } from './lurker.mjs';
import { canonicalPostUrl } from './thread-identity.mjs';

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
const url = process.argv.find((a) => a.startsWith('http'));
const asJson = process.argv.includes('--json');
const outFile = (() => { const i = process.argv.indexOf('--out'); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null; })();
const ME = process.env.ME || 'Bernard Uriza Orozco';
let stage = 'connect';

if (isMain && !url) {
  console.error('uso: node thread-extract.mjs "<openUrl>" [--json]');
  process.exit(1);
}

// Auto-registrar el thread (thread_id -> group_id) para el debt-sweep: la openUrl
// que recibimos YA trae el grupo, así el registro nunca se desactualiza.
if (isMain) {
  try {
    const m = url.match(/\/groups\/(\d+)\/posts\/(\d+)/);
    if (m) registerThread({ thread_id: m[2], group_id: m[1] });
  } catch {}
}

// El expand-all vive en fb-lib (`expandAllInPage`, SSOT — Art. 6). Estaba duplicado aquí y
// en comment-prepare, y la copia de allá se quedó vieja: no cazaba el render
// "X replied · N Replies", así que un target dentro de un sub-hilo colapsado daba
// "target article not found" (2026-07-08).

// ---- corre DENTRO de la página: walk de los articles ----
function walkArticles({ ME, postId }) {
  // dueño del post: el heading/dialog "X's Post" o el primer link de autor del post.
  // En MI post, un comentario raíz de un oponente está dirigido a mi pregunta = deuda.
  let postOwner = '';
  const heading = [...document.querySelectorAll('h2,[role="heading"]')]
    .map((x) => (x.textContent || '').trim())
    .find((s) => /['’]s Post$/.test(s));
  if (heading) postOwner = heading.replace(/['’]s Post$/, '').trim();
  if (!postOwner) {
    const dlg = document.querySelector('[role="dialog"]');
    const al = (dlg && dlg.getAttribute('aria-label')) || '';
    const mm = al.match(/^(.+?)['’]s Post/);
    if (mm) postOwner = mm[1].trim();
  }
  const COMMENT_ART = 'div[role="article"][aria-label^="Comment by"], div[role="article"][aria-label^="Reply by"]';
  const POST_REACTION = /^(Like|Love|Care|Haha|Wow|Sad|Angry): .*\b(people|person)\b/;
  const ownComment = (a) => !!postId && !!a.querySelector(`a[href*="/posts/${postId}/"]`);
  let postReactionLabels = [];
  const anchor = [...document.querySelectorAll(COMMENT_ART)].find(ownComment);
  const scope = anchor?.closest('[role="dialog"]') ?? null;
  // El post abre como dialog y la página de ATRÁS (feed) sigue cargando comentarios de
  // otros posts: el walk se acota al dialog; sin dialog, a todo el documento.
  const arts = [...(scope ?? document).querySelectorAll('div[role="article"]')];
  for (let p = anchor?.parentElement; p; p = p === scope ? null : p.parentElement) {
    if ([...p.querySelectorAll(COMMENT_ART)].some((a) => !ownComment(a))) break;
    const ls = [...p.querySelectorAll('[aria-label]')]
      .filter((e) => POST_REACTION.test(e.getAttribute('aria-label')) && !e.closest(COMMENT_ART))
      .map((e) => e.getAttribute('aria-label'));
    if (ls.length) { postReactionLabels = ls; break; }
  }
  // Tras expandir, FB a veces monta debajo los comentarios de OTRO post del feed;
  // sin este filtro entraban al árbol y a la tabla de deuda (visto 2026-09-27).
  const foreignComment = (a) => !!postId && [...a.querySelectorAll('a[href*="comment_id="]')]
    .some((l) => { const mm = l.href.match(/\/posts\/(\d+)/); return mm && mm[1] !== postId; });
  const rows = [];
  let foreignDropped = 0;
  for (const a of arts) {
    const label = a.getAttribute('aria-label') || '';
    if (!label) continue; // articles vacíos (header/media)
    if (foreignComment(a)) { foreignDropped++; continue; }
    // autor + target desde el aria-label
    // "Comment by X N ago" | "Reply by X to Y's reply/comment N ago"
    let author = null,
      target = null;
    let m = label.match(/^Comment by (.+?) (?:\d|about|a few|an? )/);
    if (m) author = m[1].trim();
    m = label.match(/^Reply by (.+?) to (.+?)'s (?:reply|comment)/);
    if (m) {
      author = m[1].trim();
      target = m[2].trim();
    }
    if (!author) continue;
    // texto PROPIO del comentario: clonar y quitar los articles anidados (replies
    // hijas), si no el innerText del padre se traga el texto y el timestamp de sus
    // hijos → edad corrompida (un padre "heredando" el "a few seconds" de un hijo).
    const clone = a.cloneNode(true);
    clone.querySelectorAll('div[role="article"]').forEach((n) => n.remove());
    const text = (clone.innerText || '').replace(/\s+/g, ' ').trim();
    const reactionLabels = [...clone.querySelectorAll('[aria-label]')]
      .map((e) => e.getAttribute('aria-label'))
      .filter((l) => /reaction|reacted/i.test(l));
    const ulink = a.querySelector('a[href*="/user/"]');
    let user_id = null;
    if (ulink) {
      const mm = ulink.href.match(/\/user\/(\d+)/);
      if (mm) user_id = mm[1];
    }
    const isMine = !!a.querySelector('[aria-label^="Edit or delete"]') || author === ME;
    // edad — agnóstico al render de FB (espaciado "1m Like Reply" o pegado
    // "4hLikeReply"): el timestamp del comentario va justo antes de su fila Like/Reply.
    // Las unidades DEBEN cubrir lo mismo que `ageMinutes` (semana/mes/año incluidas) y el
    // artículo ("a week ago"): este es el PRODUCTOR, y un `ageStr` vacío deja al parser
    // sin nada que parsear. Medido el 2026-07-08: sin week/month/year aquí, 46 de 52
    // turnos de un hilo salían sin fechar y su deuda se volvía invisible (Art. 2).
    const UNITS = '(?:second|minute|hour|day|week|month|year)';
    const ageStr = (() => {
      if (/a few seconds|just now/i.test(label) || /a few seconds|just now/i.test(text)) return 'a few seconds';
      const inLabel = label.match(new RegExp(`((?:\\d+|an?)\\s*${UNITS}s?|about an hour)\\s*ago`, 'i'));
      if (inLabel) return inLabel[1];
      const inText = text.match(/(\d+)\s*([mhdwy])\s*(?=Like|Love|Care|Haha|Wow|Sad|Angry|Reply|Edited)/i);
      if (inText) return inText[1] + inText[2];
      return '';
    })();
    // profundidad REAL en el DOM (0 = comentario raíz, 1 = reply al comentario, 2 = reply a una reply);
    // FB pinta las replies en lista plana bajo su raíz, así que el label solo distingue comment/reply
    let depth = 0;
    for (let p = a.parentElement; p; p = p.parentElement) if (p.getAttribute('role') === 'article') depth++;
    rows.push({ author, user_id, target, isMine, depth, label: label.slice(0, 90), ageStr, text, reactionLabels });
  }
  return { postOwner, rows, postReactionLabels, foreignDropped };
}

const AGE_TOKEN = String.raw`(?:\d+\s*(?:[smhdwy]|mo|yr)|a few seconds|just now)`;

// Cuerpo del comentario sin el encabezado "Autor · 3h" ni el trailer "LikeReply[Share][N]":
// la edad y el conteo de reacciones cambian entre pasadas y partían un mismo turno en dos.
export function turnBody(r) {
  let s = (r.text || '').replace(/·\s*Follow/gi, '').replace(/\s+/g, ' ').trim();
  const author = (r.author || '').replace(/\s+/g, '');
  if (author) {
    let i = 0, j = 0;
    while (i < s.length && j < author.length) {
      if (/\s/.test(s[i])) { i++; continue; }
      if (s[i] !== author[j]) break;
      i++; j++;
    }
    if (j === author.length) s = s.slice(i);
  }
  s = s.replace(new RegExp(String.raw`^[^·]{0,40}·\s*${AGE_TOKEN}(?:\s*ago)?\s*`, 'i'), '');
  s = s.replace(/(?:\s*(?:Edited|Top fan|Author))*\s*(?:\d+\s*[smhdwy]\s*)?Like\s*Reply\s*(?:Share)?\s*(?:Edited)?\s*\d*\s*$/i, '');
  s = s.replace(/[.…]*\s*See more\s*$/i, '');
  return s.trim();
}

export function normKey(r) {
  const head = turnBody(r).replace(/\s+/g, '').slice(0, 60).toLowerCase();
  return (r.user_id || r.author) + '|' + (r.target || '') + '|' + head;
}

// Une las filas de N pasadas: orden de la pasada canónica (la 1ra), la copia más LARGA gana
// (una truncada en "See more" pierde), y los turnos solo-anclados van tras su padre.
export function mergeTurns(passRows) {
  const out = [];
  const idx = new Map();
  passRows.forEach((rows, p) => {
    for (const r of rows || []) {
      const k = normKey(r);
      if (idx.has(k)) {
        const i = idx.get(k);
        if (turnBody(r).length > turnBody(out[i]).length) out[i] = r;
        continue;
      }
      let at = out.length;
      if (p > 0 && r.target) {
        let parent = -1;
        for (let i = out.length - 1; i >= 0; i--) if (out[i].author === r.target) { parent = i; break; }
        if (parent >= 0) {
          at = parent + 1;
          while (at < out.length && out[at].target === r.target && out[at].author !== r.target) at++;
        }
      }
      out.splice(at, 0, r);
      for (const [key, i] of idx) if (i >= at) idx.set(key, i + 1);
      idx.set(k, at);
    }
  });
  return out;
}

// --out une con el tx anterior: lo vivo manda, lo que solo estaba antes se conserva como `retained`
// (2026-10-02: una vista anclada pisó el "backyard chickens" de CarolAnn). Deuda y frescura usan solo lo vivo.
export function mergeWithPrior(liveTurns, priorTurns = []) {
  const live = new Set(liveTurns.map(normKey));
  const retained = priorTurns.filter((t) => !live.has(normKey(t))).map((t) => ({ ...t, retained: true }));
  return { turns: mergeTurns([liveTurns, retained]), retainedCount: retained.length };
}

// Completitud POR pasada y OR de las fallas: una pasada sana no borra lo que otra dejó sin abrir.
export function assessCompleteness(passes, turns, { unavailable = false } = {}) {
  const perPass = passes.map(({ e = {}, rows = [] }) => {
    const found = mergeTurns([rows]).filter((t) => t.target).length;
    const missing = Math.max(0, (e.promisedReplies || 0) - found);
    return { pending: e.pending || 0, truncated: e.truncatedRemaining || 0, promised: e.promisedReplies || 0, found, missing };
  });
  const max = (f) => perPass.reduce((m, x) => Math.max(m, x[f]), 0);
  const sum = (f) => passes.reduce((n, { e = {} }) => n + (e[f] || 0), 0);
  const foundReplies = turns.filter((t) => t.target).length;
  const pendingMax = max('pending');
  const truncatedMax = max('truncated');
  const missingMax = max('missing');
  const emptyExtraction = turns.length === 0 && !unavailable;
  const failedPasses = perPass.filter((x) => x.pending > 0 || x.truncated > 0 || x.missing > 0).length;
  const expand = {
    passes: passes.length,
    clickedSum: sum('clicked'),
    roundsMax: passes.reduce((m, { e = {} }) => Math.max(m, e.rounds || 0), 0),
    expandedTextSum: sum('expandedText'),
    articlesMax: passes.reduce((m, { e = {} }) => Math.max(m, e.articles || 0), 0),
    promisedRepliesMax: max('promised'),
    pendingMax,
    truncatedRemainingMax: truncatedMax,
    perPass,
  };
  return {
    complete: !(pendingMax > 0 || truncatedMax > 0 || missingMax > 0 || emptyExtraction),
    expand,
    completeness: {
      pendingExpandButtons: pendingMax,
      promisedReplies: max('promised'),
      foundReplies,
      missingReplies: missingMax,
      truncatedComments: truncatedMax,
      emptyExtraction,
      failedPasses,
    },
  };
}

function buildDebt(turns, ME, postIsMine) {
  // Deuda = un oponente me habló y no le he respondido (o me respondió más reciente
  // de lo que yo le contesté). DOS formas, ambas cuentan:
  //   reply: respondió a MI reply (target === ME) — back-and-forth activo.
  //   root : comentario raíz en MI post (sin target) — está dirigido a mi pregunta.
  // El bug viejo solo contaba 'reply' → ignoraba decenas de raíces sin contestar.
  // Margen anti-conservador: con edades gruesas ("1d" vs "23h") el agregado por-autor
  // no distingue a QUÉ rama contesté. Si el último del oponente NO es claramente más
  // viejo que mi último por este margen, NO asumo que lo contesté → surfaceo (suspect).
  const MARGIN = 180; // min
  const opps = new Map(); // author -> { oppFresh, myFresh, user_id, kind, oppCount, myCount }
  for (const t of turns) {
    const age = ageMinutes(t.ageStr);
    const isReplyToMe = !t.isMine && t.target === ME;
    const isRootOnMyPost = !t.isMine && !t.target && postIsMine;
    if (isReplyToMe || isRootOnMyPost) {
      const e = opps.get(t.author) || { oppFresh: Infinity, myFresh: Infinity, user_id: t.user_id, kind: 'root', oppCount: 0, myCount: 0 };
      e.oppCount++;
      if (age < e.oppFresh) {
        e.oppFresh = age;
        e.kind = isReplyToMe ? 'reply' : 'root';
      }
      e.user_id = e.user_id || t.user_id;
      opps.set(t.author, e);
    }
    if (t.isMine && t.target) {
      const e = opps.get(t.target) || { oppFresh: Infinity, myFresh: Infinity, user_id: null, kind: 'root', oppCount: 0, myCount: 0 };
      e.myFresh = Math.min(e.myFresh, age);
      e.myCount++;
      opps.set(t.target, e);
    }
  }
  const debt = [];
  for (const [author, e] of opps) {
    if (e.oppFresh === Infinity) continue; // nunca me habló (solo le contesté yo a un raíz suyo viejo)
    // raíz sin contestar (myFresh=Inf) o el oponente claramente más reciente → deuda dura.
    const hardDebt = e.oppFresh < e.myFresh;
    // reply ambigua: su último NO es claramente más viejo que el mío por el margen → verificar.
    // Con la edad del oponente DESCONOCIDA no se puede afirmar que lo contestaste: el centinela
    // (9e9) fingía ser un turno viejísimo y hacía `clearlyAnswered` verdadero, DROPEANDO deuda
    // real. Ejemplo medido: él responde "1w" (sin fechar) y tú "8 days" → él habló después, pero
    // 8 days < 9e9 y la deuda desaparecía de la tabla como si estuviera pagada (Art. 2).
    const oppAgeUnknown = e.oppFresh === UNKNOWN_AGE;
    const clearlyAnswered = !oppAgeUnknown && e.myFresh < e.oppFresh - MARGIN;
    const suspect = !hardDebt && e.kind === 'reply' && !clearlyAnswered;
    if (hardDebt || suspect) {
      // Honestidad (Art. 2): `freshestMin === UNKNOWN_AGE` NO es "recién llegado" ni una
      // edad — es "no pude fechar este turno". Se marca explícito para que la tabla y los
      // consumidores no lo lean como deuda fresca. `neverAnswered` dice POR QUÉ hay deuda
      // cuando la edad es inútil: nunca le respondí, lo cual es cierto sin importar la fecha.
      debt.push({
        author,
        user_id: e.user_id,
        freshestMin: e.oppFresh,
        ageUnknown: e.oppFresh === UNKNOWN_AGE,
        neverAnswered: e.myFresh === Infinity,
        owes: !suspect,
        suspect,
        kind: e.kind,
        oppCount: e.oppCount,
        myCount: e.myCount,
      });
    }
  }
  // reply (activa) antes que root; suspect junto a su reply; dentro, por frescura.
  debt.sort((a, b) => (a.kind === b.kind ? a.freshestMin - b.freshestMin : a.kind === 'reply' ? -1 : 1));
  return debt;
}

// Limpia el texto de un turno: quita el prefijo del autor y el trailer de engagement
// ("8hLikeReply", "1wLikeReply2", "Edited"). Devuelve el cuerpo real del comentario.
function cleanRootText(t) {
  let s = t.text || '';
  if (t.author && s.startsWith(t.author)) s = s.slice(t.author.length);
  s = s.replace(/\d+\s*[smhdwy]o?\s*(Like|Love|Care|Haha|Wow|Sad|Angry|Reply|Edited).*$/i, '');
  s = s.replace(/\s*(Like|Reply|Edited)\s*$/i, '');
  return s.trim();
}

// unansweredRoots = comentarios raíz SUSTANTIVOS en MI post que no he contestado, CON su
// texto verbatim. El gap que esto cierra: debt[] mezcla raíces sustantivas (Annabel) con
// Likes vacíos y memes (GIPHY) bajo un mismo blob owes:true, fácil de descartar a ciegas.
// Esta lista trae el cuerpo del comentario para que NUNCA se descarte sin leerlo (Art. 2),
// y filtra el ruido (Like vacío, GIPHY, solo-link) en vez de dejarlo mezclado.
function buildUnansweredRoots(turns, ME, postIsMine) {
  if (!postIsMine) return [];
  const answered = new Set(turns.filter((t) => t.isMine && t.target).map((t) => t.target));
  const out = [];
  for (const t of turns) {
    if (t.isMine || t.target || t.author === ME) continue; // solo raíces ajenas
    if (answered.has(t.author)) continue; // ya le contesté en otra rama
    const body = cleanRootText(t);
    if (body.length <= 15) continue; // Like vacío / sin cuerpo
    if (/^giphy$/i.test(body) || /^https?:\/\/\S+$/i.test(body)) continue; // meme / solo-link
    out.push({ author: t.author, user_id: t.user_id, freshestMin: ageMinutes(t.ageStr), ageStr: t.ageStr, text: body.slice(0, 400) });
  }
  out.sort((a, b) => a.freshestMin - b.freshestMin);
  return out;
}

async function main() {
  const { page, done } = await openScratchPage({ stage: () => stage });
  try {
    const navUrl = canonicalPostUrl(url);
    const postIdArg = { ME, postId: (url.match(/\/posts\/(\d+)/) || [])[1] || null };
    const pass = async (u) => {
      stage = `goto ${u}`;
      await page.goto(u, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      stage = `expand ${u}`;
      const e = await page.evaluate(expandAllInPage);
      await page.waitForTimeout(800);
      stage = `walk ${u}`;
      return { e, w: await page.evaluate(walkArticles, postIdArg), root: await readThreadRoot(page).catch(() => null) };
    };
    const passes = [await pass(navUrl)];
    const rootInfo = passes[0].root;
    if (navUrl !== url) passes.push(await pass(url));
    const walked = { rows: passes.flatMap(({ w }) => w.rows), postOwner: passes.map(({ w }) => w.postOwner).find(Boolean) || '', postReactionLabels: passes.map(({ w }) => w.postReactionLabels).find((l) => l && l.length) || passes[0].w.postReactionLabels, foreignDropped: passes.reduce((n, { w }) => n + (w.foreignDropped || 0), 0) };
    const unavailable = !walked.rows.length && await page.evaluate(() => /This content isn't available right now/i.test(document.body.innerText || ''));
    const withReactions = (rows) => rows.map(({ reactionLabels, ...r }) => ({ ...r, reactions: parseReactionCount({ labels: reactionLabels, text: r.text }) }));
    const passRows = passes.map(({ w }) => withReactions(w.rows));
    const raw = passRows.flat();
    const postReactions = sumPostReactionLabels(walked.postReactionLabels);
    const postOwner = walked.postOwner || '';
    const postIsMine = postOwner ? postOwner === ME : true;

    const turns = mergeTurns(passRows);

    const debt = buildDebt(turns, ME, postIsMine);
    const unansweredRoots = buildUnansweredRoots(turns, ME, postIsMine);
    const { complete, expand: exp, completeness } = assessCompleteness(
      passes.map(({ e }, i) => ({ e, rows: passRows[i] })), turns, { unavailable: !!unavailable });
    const incomplete = !complete;
    const { foundReplies, missingReplies } = completeness;
    const undatedTurns = turns.filter((t) => ageMinutes(t.ageStr) === UNKNOWN_AGE).length;
    // TOPE DE FRESCURA: edad del turno más fresco del hilo. `stale:true` = todo el hilo
    // pasó MAX_AGE_DAYS; el caller (debt-sweep / el pipeline) no debe trabajarlo.
    const datedMins = turns.map((t) => ageMinutes(t.ageStr)).filter((m) => m !== UNKNOWN_AGE);
    const freshestTurnMin = datedMins.length ? Math.min(...datedMins) : UNKNOWN_AGE;
    const stale = isStaleMinutes(freshestTurnMin);

    const out = {
      url,
      me: ME,
      postOwner: postOwner || '(no detectado — asumido mío)',
      postIsMine,
      expand: exp,
      complete,
      completeness: { ...completeness, undatedTurns },
      counts: { rawArticles: raw.length, uniqueTurns: turns.length, foreignDropped: walked.foreignDropped },
      freshestTurnMin,
      stale,
      unavailable: !!unavailable,
      navUrl,
      maxAgeDays: MAX_AGE_DAYS,
      postReactions,
      root: rootInfo && rootInfo.text ? { author: rootInfo.author, user_id: rootInfo.user_id, text: rootInfo.text, via: rootInfo.via } : null,
      turns,
      debt,
      unansweredRoots,
    };

    if (outFile) {
      let prior = [];
      if (existsSync(outFile)) { try { prior = JSON.parse(readFileSync(outFile, 'utf8')).turns || []; } catch {} }
      const merged = mergeWithPrior(turns, prior);
      out.turns = merged.turns;
      out.counts.retainedTurns = merged.retainedCount;
      writeFileSync(outFile + '.tmp', JSON.stringify(out, null, 2) + '\n');
      renameSync(outFile + '.tmp', outFile);
      console.log(JSON.stringify({ ok: true, out: outFile, liveTurns: turns.length, retainedTurns: merged.retainedCount, complete, stale }));
    } else if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`\n=== HILO (${turns.length} turnos únicos; ${raw.length} articles crudos) ===`);
      console.log(
        `expand (${exp.passes} pasadas): ${exp.clickedSum} clicks · ${exp.articlesMax} articles máx` +
          ` · réplicas ${foundReplies}/${exp.promisedRepliesMax} prometidas` +
          ` · ${exp.expandedTextSum} "See more" abiertos${incomplete ? '' : ' · COMPLETO'}`
      );
      if (incomplete) {
        const why = [
          completeness.emptyExtraction ? 'cero turnos extraídos (el hilo no está marcado como no disponible)' : null,
          exp.pendingMax > 0 ? `${exp.pendingMax} sub-hilo(s) sin abrir` : null,
          missingReplies > 0 ? `faltan ${missingReplies} réplicas que FB prometió` : null,
          exp.truncatedRemainingMax > 0 ? `${exp.truncatedRemainingMax} comentario(s) cortados en "See more"` : null,
        ].filter(Boolean).join(' · ');
        console.log(`  ⚠️  EXTRACCIÓN INCOMPLETA (${why}). La deuda de abajo NO es confiable — re-corré o confirmá en vivo (Art. 2).`);
      }
      if (undatedTurns) console.log(`  ⏳ ${undatedTurns}/${turns.length} turnos SIN FECHAR — su deuda se surfacea como ambigua, no como pagada.`);
      console.log('');
      for (const t of turns) {
        const who = t.isMine ? '🟦 YO' : '⬜ ' + t.author;
        const to = t.target ? ` → ${t.target}` : ' (raíz)';
        console.log(`${who}${to}  [${fmtAge(ageMinutes(t.ageStr))}]${t.reactions ? `  👍 ${t.reactions}` : ''}`);
        console.log(`   ${t.text.slice(0, 120)}`);
      }
      console.log(`\n=== DEUDA (post de ${postOwner || '?'}${postIsMine ? ' · TUYO' : ' · NO tuyo → raíces no cuentan'}) ===`);
      console.log('  reply = te contestó tu reply (back-and-forth) · root = comentario raíz a tu post sin contestar');
      if (!debt.length) console.log('  (ninguna — contestaste todo lo dirigido a ti)');
      for (const d of debt) {
        const tag = d.kind === 'reply' ? '↩️ reply' : '🌱 root ';
        const sus = d.suspect ? ' ⚠️ AMBIGUA (verificar en vivo: él ' + d.oppCount + ' vs tú ' + d.myCount + ')' : '';
        const unk = d.ageUnknown
          ? ` ⏳ SIN FECHAR${d.neverAnswered ? ' (deuda por nunca contestada, no por frescura)' : ' — confirmar antes de usar'}`
          : '';
        console.log(`  🔴 ${tag}  ${d.author} (uid ${d.user_id || '?'}) — [${fmtAge(d.freshestMin)}]${unk}${sus}`);
      }
      const dated = debt.filter((d) => !d.ageUnknown);
      const top = dated[0];
      if (top) console.log(`\n→ Deuda top: ${top.author} [${fmtAge(top.freshestMin)}] (${top.kind}) — candidata a jugada (decide con el dossier).`);
      else if (debt.length) console.log(`\n→ Sin deuda FECHADA: las ${debt.length} candidatas están sin fechar — confirmar en vivo antes de elegir jugada (Art. 2).`);
      if (postIsMine) {
        console.log(`\n=== RAÍCES SUSTANTIVAS SIN CONTESTAR en tu post (${unansweredRoots.length}) ===`);
        console.log('  el agregado "y N otros" las entierra; aquí van CON su texto — léelas, no las descartes a ciegas (Art. 2)');
        if (!unansweredRoots.length) console.log('  (ninguna — o todo es Like vacío/meme, o ya contestaste)');
        for (const r of unansweredRoots) {
          console.log(`  🌱 ${r.author} (uid ${r.user_id || '?'}) — [${fmtAge(r.freshestMin)}]`);
          console.log(`     "${r.text.slice(0, 200)}"`);
        }
      }
    }
  } finally {
    await done();
  }
}

if (isMain) {
  main().catch((e) => {
    console.error(`thread-extract FALLO (etapa: ${stage}):`, e.message);
    process.exit(1);
  });
}
