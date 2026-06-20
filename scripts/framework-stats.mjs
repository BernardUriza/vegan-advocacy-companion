import { readActors, readFrameworks } from './db.mjs';

// Efectividad por framework (el moat). Barre data/actors.json, agrega por el
// campo `framework` de cada interacción, y reporta deploys + conteo por outcome.
// Frameworks con 0 deploys = "sin probar". JSON es el SSOT (Art. 6).

const OUTCOMES = ['conceded', 'engaged', 'silent', 'escalated', 'goalpost', 'pending'];

const actors = readActors();
const frameworks = readFrameworks();

const stats = new Map();
for (const f of frameworks) {
  stats.set(f.id, { id: f.id, name: f.name, deploys: 0, ...Object.fromEntries(OUTCOMES.map(o => [o, 0])) });
}

for (const actor of actors) {
  for (const it of actor.interactions ?? []) {
    if (!it.framework) continue;
    const s = stats.get(it.framework);
    if (!s) continue;
    s.deploys++;
    if (it.outcome && OUTCOMES.includes(it.outcome)) s[it.outcome]++;
  }
}

const rows = [...stats.values()].sort((a, b) => b.deploys - a.deploys || a.name.localeCompare(b.name));

const tested = rows.filter(r => r.deploys > 0);
const untested = rows.filter(r => r.deploys === 0);

const header = ['Framework', 'deploys', ...OUTCOMES];
const widths = header.map(h => h.length);
const display = tested.map(r => [r.name, String(r.deploys), ...OUTCOMES.map(o => String(r[o]))]);
for (const row of display) row.forEach((cell, i) => { widths[i] = Math.max(widths[i], cell.length); });

const pad = (cell, i, alignRight) => alignRight ? cell.padStart(widths[i]) : cell.padEnd(widths[i]);
const fmtRow = (cells) => cells.map((c, i) => pad(c, i, i !== 0)).join('  ');

console.log('Efectividad por framework — ordenado por deploys\n');
console.log(fmtRow(header));
console.log(widths.map(w => '-'.repeat(w)).join('  '));
for (const row of display) console.log(fmtRow(row));

if (!tested.length) console.log('(ningún framework desplegado todavía)');

console.log(`\nProbados: ${tested.length} · Sin probar: ${untested.length} de ${rows.length}`);
if (untested.length) {
  console.log('\nSin probar (0 deploys):');
  console.log('  ' + untested.map(r => r.name).join(', '));
}
