#!/usr/bin/env node
// receipt-shots.mjs — screenshots RESALTADOS de comentarios ajenos (recibos de procedencia).
//
// Cuando un oponente acusa "nadie hizo ese argumento", el recibo es el comentario de
// quien SÍ lo hizo, verbatim y visible. Este script abre cada hilo (tab efímera, sesión
// logueada), expande todo, localiza el comentario por autor + frase, envuelve la frase en
// <mark> amarillo y captura el div[role=article] a PNG. Solo lectura sobre FB.
//
//   node receipt-shots.mjs --spec recibos.json --out .coagent/receipts/<lote>
//
// spec: [{ "slug", "url", "author", "phrases": ["..."], "where": "Open Debates 3 · 6d" }]
// Salida: <out>/<slug>.png + <out>/index.json (slug, label, permalink, hits, where).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { openScratchPage, expandAllInPage } from './fb-lib.mjs';

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : null;
}

function markInPage({ author, phrases }) {
  const norm = (s) => (s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ');
  const visible = (el) => (typeof el.checkVisibility === 'function' ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) : el.offsetParent !== null);
  document.documentElement.classList.remove('__fb-dark-mode');
  document.documentElement.classList.add('__fb-light-mode');
  const arts = [...document.querySelectorAll('div[role="article"]')]
    .filter(visible)
    .filter((a) => (a.getAttribute('aria-label') || '').includes(`by ${author}`))
    .filter((a) => phrases.every((p) => norm(a.innerText).toLowerCase().includes(norm(p).toLowerCase())))
    .sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
  const art = arts[0];
  if (!art) return { ok: false, error: 'article not found', author };
  const nested = [...art.querySelectorAll('div[role="article"]')];
  const walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (!nested.some((n) => n.contains(walker.currentNode))) nodes.push(walker.currentNode);
  const wrap = (node, start, end) => {
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, end);
    const m = document.createElement('mark');
    m.style.cssText = 'background:#ffe95c;color:#000;padding:0 2px;border-radius:2px';
    range.surroundContents(m);
  };
  const hits = [];
  for (const p of phrases) {
    const np = norm(p).toLowerCase();
    let hit = 'miss';
    for (const n of nodes) {
      const t = n.nodeValue || '';
      const nt = norm(t).toLowerCase();
      const i = nt.indexOf(np);
      if (i < 0) continue;
      if (nt.length === t.length) { wrap(n, i, i + np.length); hit = 'exact'; }
      else { wrap(n, 0, t.length); hit = 'node'; }
      break;
    }
    hits.push(hit);
  }
  // La captura es la BURBUJA del comentario (autor + texto + fila Like/Reply), no el
  // article entero: ese arrastra las réplicas anidadas y sale más alto que el viewport.
  nested.forEach((n) => { n.style.display = 'none'; });
  const authorLink = [...art.querySelectorAll('a')].find((a) => (a.textContent || '').trim() === author);
  const marks = [...art.querySelectorAll('mark')];
  let bubble = marks.length ? marks[0].parentElement : art;
  while (bubble && bubble !== art && !(authorLink && bubble.contains(authorLink))) bubble = bubble.parentElement;
  (bubble || art).setAttribute('data-recibo', '1');
  (bubble || art).scrollIntoView({ block: 'center' });
  const r = (bubble || art).getBoundingClientRect();
  const rect = { x: r.x, y: r.y, width: r.width, height: r.height, dpr: window.devicePixelRatio || 1, vw: window.innerWidth, vh: window.innerHeight };
  const link = [...art.querySelectorAll('a[href*="comment_id="]')].map((a) => a.href.split('&__cft__')[0])[0] || null;
  return { ok: true, hits, permalink: link, label: art.getAttribute('aria-label'), rect };
}

async function main() {
  const spec = JSON.parse(readFileSync(resolve(arg('--spec')), 'utf8'));
  const out = resolve(arg('--out') || '.coagent/receipts');
  mkdirSync(out, { recursive: true });
  const index = [];
  for (const item of spec) {
    const { page, done } = await openScratchPage();
    try {
      await page.emulateMedia({ colorScheme: 'light' });
      await page.goto(item.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      for (let round = 0; round < 3; round++) {
        const exp = await page.evaluate(expandAllInPage);
        await page.waitForTimeout(1200);
        if (!exp || (exp.clicked === 0 && exp.expandedText === 0)) break;
      }
      const marked = await page.evaluate(markInPage, { author: item.author, phrases: item.phrases });
      if (!marked.ok) {
        index.push({ ...marked, slug: item.slug, ok: false });
        console.error(`[miss] ${item.slug}: ${marked.error}`);
        continue;
      }
      await page.waitForTimeout(600);
      const file = resolve(out, `${item.slug}.png`);
      // Captura del VIEWPORT + recorte por getBoundingClientRect (mismo sistema de coordenadas).
      // El element-screenshot de Playwright salía desplazado en el diálogo de FB (2026-09-27).
      try {
        const rect = await page.evaluate(() => {
          const el = document.querySelector('[data-recibo="1"]');
          el.scrollIntoView({ block: 'center' });
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height, dpr: window.devicePixelRatio || 1, vw: window.innerWidth, vh: window.innerHeight };
        });
        await page.waitForTimeout(400);
        const full = resolve(out, `${item.slug}.viewport.png`);
        await page.screenshot({ path: full, timeout: 15000 });
        const py = `from PIL import Image\nim=Image.open(${JSON.stringify(full)})\nd=${rect.dpr}\nx0=max(0,int(${rect.x}*d));y0=max(0,int(${rect.y}*d));x1=min(im.width,int((${rect.x}+${rect.width})*d));y1=min(im.height,int((${rect.y}+${rect.height})*d))\nim.crop((x0,y0,x1,y1)).save(${JSON.stringify(file)})\nprint(x1-x0,y1-y0)`;
        execFileSync('python3', ['-c', py]);
        marked.rect = rect;
      } catch (e) {
        index.push({ ...marked, slug: item.slug, ok: false, error: `screenshot: ${e.message.split('\n')[0]}` });
        console.error(`[miss] ${item.slug}: screenshot falló: ${e.message.split('\n')[0]}`);
        continue;
      }
      index.push({ slug: item.slug, ok: true, file, where: item.where, ...marked });
      console.error(`[ok] ${item.slug}: ${marked.label} hits=${marked.hits.join(',')}`);
    } finally {
      await done();
    }
  }
  writeFileSync(resolve(out, 'index.json'), JSON.stringify(index, null, 2));
  console.log(JSON.stringify({ ok: index.every((i) => i.ok), out, shots: index.length, misses: index.filter((i) => !i.ok).map((i) => i.slug) }));
}

main().catch((e) => { console.error(e); process.exit(1); });
