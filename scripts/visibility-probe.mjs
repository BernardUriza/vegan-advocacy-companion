#!/usr/bin/env node
// Prueba barata de visibilidad (Gemini 2026-10-05): ¿mis replies se ven SIN sesión? Dos lecturas por grupo
// del registro: la privacidad del grupo (con la sesión de Bernard, tab efímera) y, si es público, el
// permalink de un post con replies mías abierto en un contexto incógnito nuevo del mismo Chrome (sin
// cookies), buscando una frase de cada reply. Solo lectura; nada se publica ni se clickea.
//
// Uso: node scripts/visibility-probe.mjs --post <post_id> --phrase "<frase de una reply mía>" [--phrase ...]

import { chromium } from 'playwright-core';
import { CDP_URL, openScratchPage } from './fb-lib.mjs';
import { readThreads } from './db.mjs';

const args = process.argv.slice(2);
const post = args[args.indexOf('--post') + 1];
const phrases = args.flatMap((a, i) => (a === '--phrase' ? [args[i + 1]] : []));
if (!post || !phrases.length) { console.error('uso: visibility-probe.mjs --post <post_id> --phrase "<frase>" [--phrase ...]'); process.exit(1); }

const gid = readThreads()[post]?.group_id;
if (!gid) { console.error(`post ${post} no está en data/threads.json`); process.exit(1); }
const permalink = `https://www.facebook.com/groups/${gid}/posts/${post}/`;

const { page, done } = await openScratchPage({ deadlineMs: 120000, stage: 'privacy' });
await page.goto(`https://www.facebook.com/groups/${gid}/about`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const privacy = await page.evaluate(() => (document.body.innerText.match(/\b(Public|Private)\b\s*(group)?/i) || [])[0] || null);
const groupName = await page.title();
await done();

const browser = await chromium.connectOverCDP(CDP_URL);
const anon = await browser.newContext();
const ap = await anon.newPage();
let anonymous = { status: null, loginWall: null, found: {} };
try {
  const resp = await ap.goto(permalink, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await ap.waitForTimeout(6000);
  const body = await ap.evaluate(() => document.body.innerText);
  anonymous = {
    status: resp?.status() ?? null,
    url: ap.url(),
    loginWall: /^\s*Log In/i.test(body),
    commentsRendered: /\b(Reply|Like)\b/.test(body),
    found: Object.fromEntries(phrases.map((p) => [p, body.includes(p)])),
    bodyChars: body.length,
    bodyHead: body.replace(/\s+/g, ' ').slice(0, 300),
  };
} finally {
  await anon.close();
  await browser.close();
}
console.log(JSON.stringify({ gid, groupName, privacy, permalink, anonymous }, null, 2));
