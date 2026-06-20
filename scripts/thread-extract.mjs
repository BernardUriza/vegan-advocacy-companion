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

import { openScratchPage, ageMinutes, fmtAge } from './fb-lib.mjs';

const url = process.argv.find((a) => a.startsWith('http'));
const asJson = process.argv.includes('--json');
const ME = process.env.ME || 'Bernard Uriza Orozco';

if (!url) {
  console.error('uso: node thread-extract.mjs "<openUrl>" [--json]');
  process.exit(1);
}

// ---- corre DENTRO de la página: expandir todo (idempotente, hasta estable) ----
async function expandAll() {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const find = () =>
    [...document.querySelectorAll('div[role="button"]')].filter((b) =>
      /^(View all \d+ repl|View more repl|View previous repl|View \d+ repl|View \d+ more comment)/i.test(
        (b.innerText || '').trim()
      )
    );
  let clicked = 0;
  for (let round = 0; round < 8; round++) {
    const btns = find();
    if (!btns.length) break;
    for (const b of btns) {
      b.scrollIntoView({ block: 'center' });
      for (const type of ['mouseover', 'mousedown', 'mouseup', 'click']) {
        b.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }
      clicked++;
    }
    await sleep(1400);
  }
  return { clicked, remaining: find().length };
}

// ---- corre DENTRO de la página: walk de los articles ----
function walkArticles(ME) {
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
  const arts = [...document.querySelectorAll('div[role="article"]')];
  const rows = [];
  for (const a of arts) {
    const label = a.getAttribute('aria-label') || '';
    if (!label) continue; // articles vacíos (header/media)
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
    const ulink = a.querySelector('a[href*="/user/"]');
    let user_id = null;
    if (ulink) {
      const mm = ulink.href.match(/\/user\/(\d+)/);
      if (mm) user_id = mm[1];
    }
    const isMine = !!a.querySelector('[aria-label^="Edit or delete"]') || author === ME;
    // edad — agnóstico al render de FB (espaciado "1m Like Reply" o pegado
    // "4hLikeReply"): el timestamp del comentario va justo antes de su fila Like/Reply.
    const ageStr = (() => {
      if (/a few seconds|just now/i.test(label) || /a few seconds|just now/i.test(text)) return 'a few seconds';
      const inLabel = label.match(/(\d+\s*(?:minute|hour|day)s?|about an hour|an hour)\s*ago/i);
      if (inLabel) return inLabel[1];
      const inText = text.match(/(\d+)\s*([mhd])\s*(?=Like|Reply)/i);
      if (inText) return inText[1] + inText[2];
      return '';
    })();
    rows.push({ author, user_id, target, isMine, label: label.slice(0, 90), ageStr, text });
  }
  return { postOwner, rows };
}

function normKey(r) {
  // FB re-renderiza el subárbol enfocado en dos variantes (espaciada y pegada:
  // "Frank Teuton Ants…" vs "Frank TeutonAnts…"). Quitar TODO whitespace colapsa
  // ambas a la misma key → dedup real.
  const head = r.text
    .replace(/·\s*Follow/gi, '')
    .replace(/\s+/g, '')
    .slice(0, 90)
    .toLowerCase();
  return (r.user_id || r.author) + '|' + (r.target || '') + '|' + head;
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
    const clearlyAnswered = e.myFresh < e.oppFresh - MARGIN;
    const suspect = !hardDebt && e.kind === 'reply' && !clearlyAnswered;
    if (hardDebt || suspect) {
      debt.push({ author, user_id: e.user_id, freshestMin: e.oppFresh, owes: !suspect, suspect, kind: e.kind, oppCount: e.oppCount, myCount: e.myCount });
    }
  }
  // reply (activa) antes que root; suspect junto a su reply; dentro, por frescura.
  debt.sort((a, b) => (a.kind === b.kind ? a.freshestMin - b.freshestMin : a.kind === 'reply' ? -1 : 1));
  return debt;
}

async function main() {
  const { page, done } = await openScratchPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const exp = await page.evaluate(expandAll);
    await page.waitForTimeout(800);
    const walked = await page.evaluate(walkArticles, ME);
    const raw = walked.rows;
    // dueño del post: lo detectado, o asumir MÍO (el pipeline corre sobre mis posts
    // desde notificaciones) cuando no se pudo leer — y reportarlo (Art. 2).
    const postOwner = walked.postOwner || '';
    const postIsMine = postOwner ? postOwner === ME : true;

    // dedup
    const seen = new Set();
    const turns = [];
    for (const r of raw) {
      const k = normKey(r);
      if (seen.has(k)) continue;
      seen.add(k);
      turns.push(r);
    }

    const debt = buildDebt(turns, ME, postIsMine);
    const out = {
      url,
      me: ME,
      postOwner: postOwner || '(no detectado — asumido mío)',
      postIsMine,
      expand: exp,
      counts: { rawArticles: raw.length, uniqueTurns: turns.length },
      turns,
      debt,
    };

    if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`\n=== HILO (${turns.length} turnos únicos; ${raw.length} articles crudos) ===`);
      console.log(`expand: ${exp.clicked} clicks, ${exp.remaining} botones sin ceder (suelen ser de posts vecinos)\n`);
      for (const t of turns) {
        const who = t.isMine ? '🟦 YO' : '⬜ ' + t.author;
        const to = t.target ? ` → ${t.target}` : ' (raíz)';
        console.log(`${who}${to}  [${fmtAge(ageMinutes(t.ageStr))}]`);
        console.log(`   ${t.text.slice(0, 120)}`);
      }
      console.log(`\n=== DEUDA (post de ${postOwner || '?'}${postIsMine ? ' · TUYO' : ' · NO tuyo → raíces no cuentan'}) ===`);
      console.log('  reply = te contestó tu reply (back-and-forth) · root = comentario raíz a tu post sin contestar');
      if (!debt.length) console.log('  (ninguna — contestaste todo lo dirigido a ti)');
      for (const d of debt) {
        const tag = d.kind === 'reply' ? '↩️ reply' : '🌱 root ';
        const sus = d.suspect ? ' ⚠️ AMBIGUA (verificar en vivo: él ' + d.oppCount + ' vs tú ' + d.myCount + ')' : '';
        console.log(`  🔴 ${tag}  ${d.author} (uid ${d.user_id || '?'}) — [${fmtAge(d.freshestMin)}]${sus}`);
      }
      const top = debt[0];
      if (top) console.log(`\n→ Deuda top: ${top.author} [${fmtAge(top.freshestMin)}] (${top.kind}) — candidata a jugada (decide con el dossier).`);
    }
  } finally {
    await done();
  }
}

main().catch((e) => {
  console.error('thread-extract FALLO:', e.message);
  process.exit(1);
});
