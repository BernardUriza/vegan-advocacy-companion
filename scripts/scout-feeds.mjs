// Etapa 1, paso 0.7 — SCOUT: barre el feed cronológico de los grupos del registro y surfacea
// posts AJENOS frescos con conversación donde Bernard no ha entrado. SOLO LECTURA: ninguna
// acción que escriba en FB; el único "click" es el hover que resuelve el permalink.
//   node scout-feeds.mjs [--json] [--group <gid>] [--max-age-h 48] [--scroll 8] [--debug]

import { openScratchPage, fmtAge } from './fb-lib.mjs';
import { readActors, readTactics } from './db.mjs';
import { sumPostReactionLabels } from './lurker.mjs';
import { ME, ageMinutesFromTooltip, readGroupsRegistry, tacticsHint, rank, SCOUT_MAX_AGE_MIN } from './scout.mjs';
import { UNKNOWN_AGE } from './freshness.mjs';

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : null; };
const asJson = argv.includes('--json');
const debug = argv.includes('--debug');
const onlyGroup = arg('--group');
const maxAgeMin = Math.min(SCOUT_MAX_AGE_MIN, (Number(arg('--max-age-h')) || 48) * 60);
const scrolls = Math.min(12, Number(arg('--scroll')) || 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (base) => base + Math.random() * base * 0.6;

// FB virtualiza el feed: las unidades salen del DOM al seguir bajando. Se etiquetan por huella
// (autor + arranque del texto) y se procesan MIENTRAS están renderizadas, no al final.
function tagUnits(seen) {
  const feed = document.querySelector('[role="feed"]');
  if (!feed) return [];
  const clean = (t) => (t || '').replace(/^(Facebook\s*)+/, '').replace(/\s+/g, ' ').trim();
  const out = [];
  for (const u of feed.children) {
    const act = u.querySelector('[aria-label^="Actions for this post by "]');
    if (!act) continue;
    const key = act.getAttribute('aria-label') + '|' + clean(u.innerText).slice(0, 80);
    if (seen.includes(key)) continue;
    u.setAttribute('data-scout', key);
    out.push(key);
  }
  return out;
}

function timeAnchorOf(key) {
  const u = document.querySelector(`[data-scout="${CSS.escape(key)}"]`);
  if (!u) return null;
  return [...u.querySelectorAll('a[href]')].find((a) => !a.closest('div[role="article"]') && /^\?__cft__/.test(a.getAttribute('href')) && !(a.innerText || '').trim()) || null;
}

function readUnit({ key, me }) {
  const u = document.querySelector(`[data-scout="${CSS.escape(key)}"]`);
  if (!u) return null;
  const COMMENT_ART = 'div[role="article"][aria-label^="Comment by"], div[role="article"][aria-label^="Reply by"]';
  const clean = (t) => (t || '').replace(/^(Facebook\s*)+/, '').replace(/\s+/g, ' ').trim();
  const author = key.split('|')[0].replace('Actions for this post by ', '');
  const ulink = [...u.querySelectorAll('a[href*="/user/"]')].find((a) => !a.closest('div[role="article"]'));
  const user_id = ulink ? (ulink.href.match(/\/user\/(\d+)/) || [])[1] ?? null : null;
  const reactionLabels = [...u.querySelectorAll('[aria-label]')].filter((e) => !e.closest(COMMENT_ART)).map((e) => e.getAttribute('aria-label'));
  const commentLabels = [...u.querySelectorAll(COMMENT_ART)].map((a) => a.getAttribute('aria-label'));
  const moreComments = (u.innerText.match(/(?:View (?:all )?)?(\d+) (?:more )?comments?\b/i) || [])[1];
  const msg = u.querySelector('[data-ad-preview="message"], [data-ad-comet-preview="message"]');
  const mine = new RegExp(`^(Comment|Reply) by ${me.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} `);
  return {
    author, user_id, reactionLabels, commentLabels,
    comments: Math.max(commentLabels.length, +(moreComments || 0)),
    bernardCommented: commentLabels.some((l) => mine.test(l)),
    preview: clean(msg ? msg.innerText : u.innerText).slice(0, 300),
  };
}

async function readPost(page, group, key, known) {
  const h = await page.evaluateHandle(timeAnchorOf, key);
  const el = h.asElement();
  let post_id = null, ageMin = UNKNOWN_AGE, tips = [];
  if (el) {
    await el.scrollIntoViewIfNeeded().catch(() => {});
    await el.hover({ timeout: 4000 }).catch(() => {});
    for (let w = 0; w < 6 && ageMin === UNKNOWN_AGE; w++) {
      await sleep(400);
      const r = await page.evaluate((a) => ({ href: a.href, tips: [...document.querySelectorAll('[role="tooltip"]')].map((t) => t.innerText) }), el);
      post_id = (r.href.match(/\/posts\/(\d+)/) || [])[1] ?? post_id;
      tips = r.tips;
      ageMin = ageMinutesFromTooltip(r.tips.find((t) => / at \d{1,2}:\d{2}[\s\u202f\u00a0][AP]M/.test(t)));
    }
    await page.mouse.move(5, 5);
  }
  const u = await page.evaluate(readUnit, { key, me: ME });
  if (debug) console.error(`[scout] ${group.id} post=${post_id} age=${ageMin === UNKNOWN_AGE ? '?' : ageMin} unit=${!!u} tips=${JSON.stringify(tips)}`);
  if (!u) return null;
  return {
    group: group.name, group_id: group.id, post_id, openUrl: post_id ? `https://www.facebook.com/groups/${group.id}/posts/${post_id}/` : null,
    author: u.author, user_id: u.user_id, ageMin, comments: u.comments, reactions: sumPostReactionLabels(u.reactionLabels) ?? 0,
    bernardCommented: u.bernardCommented || u.author === ME, preview: u.preview, tactics_hint: tacticsHint(u.preview, known),
  };
}

async function scoutGroup(group, known) {
  const { page, done } = await openScratchPage();
  const posts = [];
  const seen = [];
  try {
    await page.goto(`https://www.facebook.com/groups/${group.id}/?sorting_setting=CHRONOLOGICAL`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await sleep(jitter(4000));
    for (let s = 0; s <= scrolls; s++) {
      const fresh = await page.evaluate(tagUnits, seen);
      for (const key of fresh) {
        seen.push(key);
        const p = await readPost(page, group, key, known);
        if (p) posts.push(p);
      }
      if (s === scrolls) break;
      await page.evaluate(() => window.scrollBy(0, 1600));
      await page.mouse.wheel(0, 400);
      await sleep(jitter(1500));
    }
  } finally {
    await done();
  }
  const byId = new Map();
  for (const p of posts) if (!byId.has(p.post_id ?? Symbol())) byId.set(p.post_id ?? Symbol(), p);
  return [...byId.values()];
}

const groups = readGroupsRegistry().filter((g) => !onlyGroup || g.id === onlyGroup);
const threadsKnown = new Set(readActors().flatMap((a) => (a.interactions || []).map((i) => String(i.thread_id))));
const known = new Set(readTactics().map((t) => t.id));
const all = [];
for (const g of groups) {
  all.push(...await scoutGroup(g, known));
  if (g !== groups[groups.length - 1]) await sleep(jitter(3000));
}
const { kept, dropped } = rank(all, { threadsKnown, maxAgeMin });

if (asJson) {
  console.log(JSON.stringify({ scannedAt: new Date().toISOString(), groups: groups.map((g) => g.id), pageLoads: groups.length, seen: all.length, candidates: kept, dropped }, null, 2));
} else {
  console.log(`SCOUT — ${all.length} posts vistos en ${groups.length} grupo(s) (${groups.length} cargas) · tope ${fmtAge(maxAgeMin)} · ${kept.length} candidato(s)\n`);
  for (const p of kept) {
    console.log(`${String(p.score).padStart(6)}  [${fmtAge(p.ageMin)}] ${p.author} · ${p.group} · 💬${p.comments} 👍${p.reactions}${p.tactics_hint.length ? ' · hint: ' + p.tactics_hint.join(',') : ''}`);
    console.log(`        "${p.preview.slice(0, 140)}"`);
    console.log(`        abrir: ${p.openUrl}`);
  }
  const why = {};
  for (const d of dropped) why[d.why] = (why[d.why] || 0) + 1;
  console.log(`\ndescartados: ${Object.entries(why).map(([k, v]) => `${k} ${v}`).join(' · ') || 'ninguno'}`);
}
