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

// "3h", "27m", "15 minutes ago", "3 hours ago", "2 days ago", "about an hour ago",
// "a few seconds ago" → minutos (99999 si no parsea). Entiende AMBOS renders de FB:
// el compacto ("15m") del link de timestamp y el de palabra completa ("15 minutes
// ago") del aria-label — el desajuste entre ambos era el bug que tiraba la deuda a [?].
export function ageMinutes(text) {
  const t = text || '';
  if (/a few seconds|just now|\bnow\b/i.test(t)) return 0;
  if (/about an hour|an hour ago/i.test(t)) return 60;
  const w = t.match(/(\d+)\s*(minute|hour|day)s?\b/i);
  if (w) {
    const n = +w[1];
    const u = w[2].toLowerCase();
    return u === 'minute' ? n : u === 'hour' ? n * 60 : n * 1440;
  }
  const m = t.match(/(\d+)\s*([mhd])\b/);
  if (!m) return 99999;
  const n = +m[1];
  return m[2] === 'm' ? n : m[2] === 'h' ? n * 60 : n * 1440;
}

export function fmtAge(min) {
  if (min >= 99999) return '?';
  return min < 60 ? `${min}m` : `${Math.round(min / 60)}h`;
}
