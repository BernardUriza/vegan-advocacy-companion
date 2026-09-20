import { openScratchPage, ageMinutes, fmtAge, MAX_AGE_DAYS, isStaleMinutes } from './fb-lib.mjs';

const NOTIF_URL = 'https://www.facebook.com/notifications';
const asJson = process.argv.includes('--json');
const MAX_PAGINATE_ROUNDS = 25;

const WEIGHT = {
  group_comment_mention: { tier: 'alto', label: 'te mencionaron' },
  group_comment: { tier: 'alto', label: 'comentaron tu post' },
  mentions_comment: { tier: 'alto', label: 'comentaron donde te etiquetaron' },
  feed_comment: { tier: 'alto', label: 'comentaron tu contenido' },
  feedback_reaction_generic: { tier: 'bajo', label: 'reaccionaron' },
};

// FB emite RELLENO ALGORÍTMICO bajo los mismos notif_t que las menciones reales:
// "X highlighted a comment/post for you to check out" y "mentioned you AND OTHER
// FOLLOWERS" son difusión sugerida, no deuda. Y "tagged everyone in a comment" es
// spam de grupo. Sin este filtro el ranking arranca por spam de La Grupa y entierra
// la deuda real de debate (medido 2026-08-07: 39 "menciones", solo 5 eran deuda).
const FILLER_TEXT = [
  /tagged everyone in a comment/i,
  /highlighted a (comment|post) for you to check out/i,
  /mentioned you and other followers/i,
  /tagged you in a photo/i,
];
const isFiller = (text) => FILLER_TEXT.some((re) => re.test(text));

function extractInPage() {
  const out = [];
  const seen = new Set();
  const links = [...document.querySelectorAll('a[href*="notif_t="], a[href*="/posts/"]')];
  for (const a of links) {
    if (seen.has(a.href)) continue;
    seen.add(a.href);
    const u = new URL(a.href);
    const p = u.searchParams;
    const txt = (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    if (!txt) continue;
    // post_id puede venir como query param (lo más común en notifs de grupo),
    // como multi_permalinks, o en el path /posts/<id>. Antes solo se leían los
    // dos últimos → post_id salía null y agrupaba por comment_id (mismo post en
    // varias filas). Leer el query param primero es el fix raíz.
    const mPosts = u.pathname.match(/\/posts\/(\d+)/);
    // multi_permalinks AGREGA varios post_id separados por coma cuando FB junta
    // "N personas comentaron en tus publicaciones" en una sola notif. Antes la
    // lista pegada entraba como post_id/key basura y rompía el openUrl (deuda
    // invisible). story_fbid cubre los posts que no traen post_id. Tomar el 1ro.
    const rawPost = p.get('post_id') || p.get('multi_permalinks') || p.get('story_fbid') || (mPosts ? mPosts[1] : null);
    const post_id = rawPost ? rawPost.split(',')[0] : null;
    const mGroup = u.pathname.match(/\/groups\/(\d+)/);
    const group_id = mGroup ? mGroup[1] : p.get('group_id') || null;
    const comment_id = p.get('comment_id');
    const reply_comment_id = p.get('reply_comment_id');
    // URL canónica para abrir en el comentario exacto (etapa 2 navega directo, sin MCP)
    let openUrl = a.href;
    if (group_id && post_id) {
      const q = new URLSearchParams();
      if (comment_id) q.set('comment_id', comment_id);
      if (reply_comment_id) q.set('reply_comment_id', reply_comment_id);
      const qs = q.toString();
      openUrl = `https://www.facebook.com/groups/${group_id}/posts/${post_id}/${qs ? '?' + qs : ''}`;
    }
    out.push({
      post_id,
      group_id,
      notif_t: p.get('notif_t'),
      comment_id,
      reply_comment_id,
      href: a.href,
      openUrl,
      text: txt.slice(0, 160),
    });
  }
  return out;
}

function group(items) {
  const security = items.filter((i) => i.notif_t === 'approve_from_another_device');
  const rest = items.filter((i) => i.notif_t !== 'approve_from_another_device');
  // RUIDO no-deuda: notifs sin post NI comment que abrir (page_user_activity,
  // marketplace_*, seguidores de página, mensajes) — no son hilos de debate.
  // Antes entraban a la lista de deuda con key basura ("UnreadVeganismo…",
  // post_id null, sin openUrl). Separarlas para que no contaminen la deuda real.
  const noise = rest.filter((i) => (!i.post_id && !i.comment_id) || isFiller(i.text));
  const threads = rest.filter((i) => (i.post_id || i.comment_id) && !isFiller(i.text));

  const byKey = new Map();
  for (const i of threads) {
    const key = i.post_id || i.comment_id || i.text.slice(0, 24);
    if (!byKey.has(key)) byKey.set(key, { key, post_id: i.post_id, group_id: i.group_id, notifs: [] });
    byKey.get(key).notifs.push(i);
  }

  const allGroups = [...byKey.values()].map((g) => {
    const tiers = g.notifs.map((n) => WEIGHT[n.notif_t]?.tier || 'bajo');
    const tier = tiers.includes('alto') ? 'alto' : 'bajo';
    const freshest = Math.min(...g.notifs.map((n) => ageMinutes(n.text)));
    const hasReplyToReply = g.notifs.some((n) => n.reply_comment_id);
    const sorted = g.notifs.sort((a, b) => ageMinutes(a.text) - ageMinutes(b.text));
    const headline = sorted[0].text;
    const openUrl = sorted[0].openUrl; // abrir en la notif más fresca del hilo
    return { ...g, tier, freshestMin: freshest, hasReplyToReply, headline, openUrl };
  });

  // TOPE DE FRESCURA: un hilo cuya notif más fresca ya pasó MAX_AGE_DAYS no entra a la
  // lista de deuda — se reporta aparte, sin openUrl para abrir. Edad desconocida NO es
  // vieja (candidata a confirmar). Ver .claude/rules/pipeline-freshness-cap.md.
  const stale = allGroups.filter((g) => isStaleMinutes(g.freshestMin));
  const groups = allGroups.filter((g) => !isStaleMinutes(g.freshestMin));

  // sort: alto first, then freshest, then reply-to-reply
  groups.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'alto' ? -1 : 1;
    if (a.freshestMin !== b.freshestMin) return a.freshestMin - b.freshestMin;
    return (b.hasReplyToReply ? 1 : 0) - (a.hasReplyToReply ? 1 : 0);
  });
  stale.sort((a, b) => a.freshestMin - b.freshestMin);

  return { security, noise, groups, stale, maxAgeDays: MAX_AGE_DAYS };
}

async function exhaustFeed(page) {
  let rounds = 0;
  let lastCount = -1;
  while (rounds < MAX_PAGINATE_ROUNDS) {
    const count = await page.evaluate(
      () => document.querySelectorAll('a[href*="notif_t="], a[href*="/posts/"]').length,
    );
    const clicked = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('div[role="button"], span, a')].find((el) =>
        /see previous notifications|ver notificaciones anteriores/i.test((el.innerText || '').trim()),
      );
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!clicked) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
      const after = await page.evaluate(
        () => document.querySelectorAll('a[href*="notif_t="], a[href*="/posts/"]').length,
      );
      if (after === count && count === lastCount) return { rounds, exhausted: true, count: after };
      lastCount = count;
    } else {
      await page.waitForTimeout(2000);
    }
    rounds++;
  }
  const count = await page.evaluate(
    () => document.querySelectorAll('a[href*="notif_t="], a[href*="/posts/"]').length,
  );
  return { rounds, exhausted: false, count };
}

async function main() {
  const { page, done } = await openScratchPage();
  try {
    await page.goto(NOTIF_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500); // let hydration settle
    const feed = await exhaustFeed(page);
    const items = await page.evaluate(extractInPage);
    const { security, noise, groups, stale, maxAgeDays } = group(items);

    if (asJson) {
      console.log(JSON.stringify({ generatedAtUrl: NOTIF_URL, feed, maxAgeDays, security, noise, groups, stale: stale.map(({ openUrl, ...g }) => g) }, null, 2));
    } else {
      const feedNote = feed.exhausted
        ? `feed agotado (${feed.count} notifs, ${feed.rounds} rondas)`
        : `⚠️ FEED NO AGOTADO tras ${feed.rounds} rondas (${feed.count} notifs) — puede faltar deuda vieja`;
      console.log(`\n${feedNote}`);
      console.log(`\n=== HILOS (${groups.length}) — ordenados por deuda · tope ${maxAgeDays}d ===`);
      for (const g of groups) {
        const flag = g.tier === 'alto' ? '🔴' : '🟢';
        const rr = g.hasReplyToReply ? ' · reply-a-reply' : '';
        console.log(`${flag} [${fmtAge(g.freshestMin)}] post_id=${g.post_id || '(comment ' + g.key + ')'}${rr}`);
        console.log(`   ${g.headline}`);
        if (g.openUrl) console.log(`   abrir: ${g.openUrl}`);
      }
      if (security.length) {
        console.log(`\n⚠️  SEGURIDAD (NO es hilo): ${security.length}× approve_from_another_device — intento(s) de login. Revisa sesión/2FA.`);
      }
      if (noise.length) {
        console.log(`\nℹ️  RUIDO no-deuda (${noise.length}, fuera de la lista): ${noise.map((n) => n.notif_t).join(', ')}`);
      }
      if (stale.length) {
        console.log(`\n⏳ VIEJOS (> ${maxAgeDays}d, ${stale.length} hilos, NO se abren): ${stale.map((g) => `${fmtAge(g.freshestMin)} ${g.post_id || g.key}`).join(' · ')}`);
      }
      const top = groups.find((g) => g.tier === 'alto');
      if (top) {
        console.log(`\n→ Empezar por: post_id=${top.post_id || top.key} (${fmtAge(top.freshestMin)})`);
        if (top.openUrl) console.log(`  ${top.openUrl}`);
      }
    }
  } finally {
    await done();
  }
}

main().catch((e) => {
  console.error('notif-scan FALLO:', e.message);
  process.exit(1);
});
