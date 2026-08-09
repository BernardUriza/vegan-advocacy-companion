import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9333';
const CHAT_ID = '6a435111-a164-83e8-87ab-5f820921ecee';
const master = readFileSync('../.coagent/master-prompt-batch.md', 'utf8');

const browser = await chromium.connectOverCDP(CDP_URL);
let target = null;
for (const ctx of browser.contexts()) {
  for (const p of ctx.pages()) {
    if (p.url().includes(CHAT_ID)) { target = p; break; }
  }
  if (target) break;
}
if (!target) { console.log(JSON.stringify({ ok: false, error: 'no coagent tab' })); await browser.close(); process.exit(1); }

const res = await target.evaluate((text) => {
  const el = document.querySelector('#prompt-textarea');
  if (!el) return { ok: false, error: 'no #prompt-textarea' };
  el.focus();
  document.execCommand('selectAll');
  document.execCommand('delete');
  document.execCommand('insertText', false, text);
  return { ok: true, len: el.innerText.length, href: location.href };
}, master);

console.log(JSON.stringify(res));
await browser.close();
