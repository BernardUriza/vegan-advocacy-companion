// Toda cita entre comillas de un draft tiene que existir verbatim en lo que el oponente escribió
// (transcripts, moat, hilos guardados). Uso: node scripts/quote-check.mjs <draft.txt> [--quote-ok "<frag>"]...

import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const MIN_WORDS = 4;

export const normalize = (s) =>
  String(s || '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

export function extractQuotes(text) {
  const flat = String(text || '').replace(/[“”]/g, '"');
  return [...flat.matchAll(/"([^"\n]+)"/g)]
    .map((m) => m[1].trim().replace(/[.,;:!?]+$/, ''))
    .filter((q) => q.split(/\s+/).length >= MIN_WORDS);
}

export function verifyQuotes(text, corpus, allowed = []) {
  const hay = normalize(corpus);
  const ok = new Set(allowed.map(normalize));
  return extractQuotes(text).map((q) => ({ quote: q, found: ok.has(normalize(q)) || hay.includes(normalize(q)) }));
}

export function loadCorpus(root = ROOT) {
  const parts = [];
  const coagent = resolve(root, '.coagent');
  if (existsSync(coagent)) {
    for (const f of readdirSync(coagent).filter((f) => /^tx-.*\.json$/.test(f))) {
      try {
        const j = JSON.parse(readFileSync(resolve(coagent, f), 'utf8'));
        if (j.root?.text) parts.push(j.root.text);
        for (const t of j.turns || []) parts.push(t.text || '');
      } catch {}
    }
  }
  const actors = resolve(root, 'data/actors.json');
  if (existsSync(actors)) {
    for (const a of JSON.parse(readFileSync(actors, 'utf8'))) for (const i of a.interactions || []) parts.push(i.their_move || '');
  }
  const threads = resolve(root, 'analysis/threads');
  if (existsSync(threads)) for (const f of readdirSync(threads).filter((f) => f.endsWith('.md'))) parts.push(readFileSync(resolve(threads, f), 'utf8'));
  return parts.join('\n');
}

export function quoteOkArgs(argv) {
  const out = [];
  argv.forEach((a, i) => { if (a === '--quote-ok' && argv[i + 1]) out.push(argv[i + 1]); });
  return out;
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const file = process.argv[2];
  if (!file) { console.error('uso: node scripts/quote-check.mjs <draft.txt> [--quote-ok "<frag>"]...'); process.exit(1); }
  const res = verifyQuotes(readFileSync(resolve(file), 'utf8'), loadCorpus(), quoteOkArgs(process.argv));
  for (const r of res) console.log(`${r.found ? 'OK' : 'XX'}  "${r.quote}"`);
  const bad = res.filter((r) => !r.found);
  if (bad.length) { console.error(`\n${bad.length} cita(s) sin fuente verbatim: corrígelas contra el transcript o márcalas con --quote-ok si no son cita.`); process.exit(1); }
  console.log(`\nLIMPIO — ${res.length} cita(s) verificadas verbatim`);
}
