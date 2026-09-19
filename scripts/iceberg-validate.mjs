#!/usr/bin/env node
// Valida iceberg/data.js contra el moat: ids de tactics/frameworks existen, `from` apunta a nodos de nivel <= propio.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
globalThis.window = {};
await import(join(root, 'iceberg/data.js'));
const d = window.ICEBERG;
const tactics = new Set(JSON.parse(readFileSync(join(root, 'data/tactics.json'))).map(t => t.id));
const frameworks = new Set(JSON.parse(readFileSync(join(root, 'data/frameworks.json'))).map(f => f.id));
const ids = new Map(d.nodes.map(n => [n.id, n]));
const errors = [];
for (const n of d.nodes) {
  if (!d.levels.some(l => l.id === n.level)) errors.push(`${n.id}: nivel ${n.level} no existe`);
  for (const f of n.from || []) {
    const p = ids.get(f);
    if (!p) errors.push(`${n.id}: from '${f}' no existe`);
    else if (p.level > n.level) errors.push(`${n.id}: from '${f}' está más abajo (${p.level} > ${n.level})`);
  }
  for (const t of n.tactics || []) if (!tactics.has(t)) errors.push(`${n.id}: táctica '${t}' no está en data/tactics.json`);
  for (const f of n.frameworks || []) if (!frameworks.has(f)) errors.push(`${n.id}: framework '${f}' no está en data/frameworks.json`);
}
const seen = new Set();
for (const n of d.nodes) { if (seen.has(n.id)) errors.push(`id duplicado ${n.id}`); seen.add(n.id); }
console.log(`iceberg-validate · ${d.nodes.length} nodos · ${d.levels.length} niveles`);
for (const e of errors) console.log('  ✗', e);
console.log(errors.length ? `✗ ${errors.length} error(es)` : '✓ LIMPIO');
process.exit(errors.length ? 1 : 0);
