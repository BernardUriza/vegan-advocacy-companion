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

import { openScratchPage, ageMinutes, fmtAge, UNKNOWN_AGE, expandAllInPage } from './fb-lib.mjs';
import { registerThread } from './db.mjs';

const url = process.argv.find((a) => a.startsWith('http'));
const asJson = process.argv.includes('--json');
const ME = process.env.ME || 'Bernard Uriza Orozco';

if (!url) {
  console.error('uso: node thread-extract.mjs "<openUrl>" [--json]');
  process.exit(1);
}

// Auto-registrar el thread (thread_id -> group_id) para el debt-sweep: la openUrl
// que recibimos YA trae el grupo, así el registro nunca se desactualiza.
try {
  const m = url.match(/\/groups\/(\d+)\/posts\/(\d+)/);
  if (m) registerThread({ thread_id: m[2], group_id: m[1] });
} catch {}

// El expand-all vive en fb-lib (`expandAllInPage`, SSOT — Art. 6). Estaba duplicado aquí y
// en comment-prepare, y la copia de allá se quedó vieja: no cazaba el render
// "X replied · N Replies", así que un target dentro de un sub-hilo colapsado daba
// "target article not found" (2026-07-08).

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
  const { page, done } = await openScratchPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    const exp = await page.evaluate(expandAllInPage);
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
    const unansweredRoots = buildUnansweredRoots(turns, ME, postIsMine);
    // Completitud (Art. 2). Un total plausible sobre un hilo a medias fue el bug que hizo
    // reportar deuda YA PAGADA (mine:0 cuando en realidad era mine:2). Tres formas de estar
    // truncado, y cualquiera basta — ninguna es suficiente sola:
    //   · quedaron botones de expandir sin abrir,
    //   · FB prometió más réplicas de las que extrajimos (el testigo externo),
    //   · quedaron cuerpos de comentario cortados en "See more" (el argumento del oponente).
    const foundReplies = turns.filter((t) => t.target).length;
    const missingReplies = Math.max(0, exp.promisedReplies - foundReplies);
    const incomplete = exp.pending > 0 || missingReplies > 0 || exp.truncatedRemaining > 0;
    const undatedTurns = turns.filter((t) => ageMinutes(t.ageStr) === UNKNOWN_AGE).length;

    const out = {
      url,
      me: ME,
      postOwner: postOwner || '(no detectado — asumido mío)',
      postIsMine,
      expand: exp,
      complete: !incomplete,
      completeness: {
        pendingExpandButtons: exp.pending,
        promisedReplies: exp.promisedReplies,
        foundReplies,
        missingReplies,
        truncatedComments: exp.truncatedRemaining,
        undatedTurns,
      },
      counts: { rawArticles: raw.length, uniqueTurns: turns.length },
      turns,
      debt,
      unansweredRoots,
    };

    if (asJson) {
      console.log(JSON.stringify(out, null, 2));
    } else {
      console.log(`\n=== HILO (${turns.length} turnos únicos; ${raw.length} articles crudos) ===`);
      console.log(
        `expand: ${exp.clicked} clicks en ${exp.rounds} rondas · ${exp.articles} articles` +
          ` · réplicas ${foundReplies}/${exp.promisedReplies} prometidas` +
          ` · ${exp.expandedText} "See more" abiertos${incomplete ? '' : ' · COMPLETO'}`
      );
      if (incomplete) {
        const why = [
          exp.pending > 0 ? `${exp.pending} sub-hilo(s) sin abrir` : null,
          missingReplies > 0 ? `faltan ${missingReplies} réplicas que FB prometió` : null,
          exp.truncatedRemaining > 0 ? `${exp.truncatedRemaining} comentario(s) cortados en "See more"` : null,
        ].filter(Boolean).join(' · ');
        console.log(`  ⚠️  EXTRACCIÓN INCOMPLETA (${why}). La deuda de abajo NO es confiable — re-corré o confirmá en vivo (Art. 2).`);
      }
      if (undatedTurns) console.log(`  ⏳ ${undatedTurns}/${turns.length} turnos SIN FECHAR — su deuda se surfacea como ambigua, no como pagada.`);
      console.log('');
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

main().catch((e) => {
  console.error('thread-extract FALLO:', e.message);
  process.exit(1);
});
