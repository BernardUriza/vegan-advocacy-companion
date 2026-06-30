import { openScratchPage, ageMinutes, fmtAge } from './fb-lib.mjs';

const NOTIF_URL = 'https://www.facebook.com/notifications';
const asJson = process.argv.includes('--json');

const WEIGHT = {
  group_comment_mention: { tier: 'alto', label: 'te mencionaron' },
  group_comment: { tier: 'alto', label: 'comentaron tu post' },
  feedback_reaction_generic: { tier: 'bajo', label: 'reaccionaron' },
};

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
  const noise = rest.filter((i) => !i.post_id && !i.comment_id);
  const threads = rest.filter((i) => i.post_id || i.comment_id);

  const byKey = new Map();
  for (const i of threads) {
    const key = i.post_id || i.comment_id || i.text.slice(0, 24);
    if (!byKey.has(key)) byKey.set(key, { key, post_id: i.post_id, group_id: i.group_id, notifs: [] });
    byKey.get(key).notifs.push(i);
  }

  const groups = [...byKey.values()].map((g) => {
    const tiers = g.notifs.map((n) => WEIGHT[n.notif_t]?.tier || 'bajo');
    const tier = tiers.includes('alto') ? 'alto' : 'bajo';
    const freshest = Math.min(...g.notifs.map((n) => ageMinutes(n.text)));
    const hasReplyToReply = g.notifs.some((n) => n.reply_comment_id);
    const sorted = g.notifs.sort((a, b) => ageMinutes(a.text) - ageMinutes(b.text));
    const headline = sorted[0].text;
    const openUrl = sorted[0].openUrl; // abrir en la notif más fresca del hilo
    return { ...g, tier, freshestMin: freshest, hasReplyToReply, headline, openUrl };
  });

  // sort: alto first, then freshest, then reply-to-reply
  groups.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === 'alto' ? -1 : 1;
    if (a.freshestMin !== b.freshestMin) return a.freshestMin - b.freshestMin;
    return (b.hasReplyToReply ? 1 : 0) - (a.hasReplyToReply ? 1 : 0);
  });

  return { security, noise, groups };
}

async function main() {
  const { page, done } = await openScratchPage();
  try {
    await page.goto(NOTIF_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500); // let hydration settle
    const items = await page.evaluate(extractInPage);
    const { security, noise, groups } = group(items);

    if (asJson) {
      console.log(JSON.stringify({ generatedAtUrl: NOTIF_URL, security, noise, groups }, null, 2));
    } else {
      console.log(`\n=== HILOS (${groups.length}) — ordenados por deuda ===`);
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
