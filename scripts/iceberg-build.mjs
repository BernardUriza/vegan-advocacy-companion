#!/usr/bin/env node
// Genera iceberg/moat.js (derivado, NO SSOT) con nombres/definiciones de tácticas y frameworks
// que la página necesita para mostrar chips legibles sin fetch (funciona desde file://).
// Corre iceberg-validate primero: un data.js roto no se publica.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const v = spawnSync(process.execPath, [join(root, 'scripts/iceberg-validate.mjs')], { stdio: 'inherit' });
if (v.status !== 0) process.exit(v.status);
globalThis.window = {};
await import(join(root, 'iceberg/data.js'));
const used = { tactics: new Set(), frameworks: new Set() };
for (const n of window.ICEBERG.nodes) { (n.tactics || []).forEach(t => used.tactics.add(t)); (n.frameworks || []).forEach(f => used.frameworks.add(f)); }
const tactics = Object.fromEntries(JSON.parse(readFileSync(join(root, 'data/tactics.json'))).filter(t => used.tactics.has(t.id))
  .map(t => [t.id, { name: t.name, definition: t.definition, counter: t.canonical_counter || '' }]));
const frameworks = Object.fromEntries(JSON.parse(readFileSync(join(root, 'data/frameworks.json'))).filter(f => used.frameworks.has(f.id))
  .map(f => [f.id, { name: f.name, author: f.author || '', enables: f.enables || '', definition: f.definition || '' }]));
const out = `// GENERADO por scripts/iceberg-build.mjs desde data/tactics.json + data/frameworks.json — no editar a mano.\nwindow.ICEBERG_MOAT = ${JSON.stringify({ tactics, frameworks }, null, 1)};\n`;
writeFileSync(join(root, 'iceberg/moat.js'), out);
console.log(`iceberg-build · moat.js: ${Object.keys(tactics).length} tácticas · ${Object.keys(frameworks).length} frameworks`);
