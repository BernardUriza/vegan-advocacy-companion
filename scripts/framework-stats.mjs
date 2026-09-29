import { readActors, readFrameworks } from './db.mjs';
import { jeffreysInterval } from './stats.mjs';

// Efectividad por FAMILIA y por framework, sin "win rate": conceded con su intervalo Jeffreys 95%,
// separando lo sorteado (comparable) de lo elegido a mano (sesgo de selección). Terceros antes que likes.
// Por qué: analysis/research/2026-09-28-monocultivo-frameworks-y-metrica-lurker.md

const OUTCOMES = ['conceded', 'engaged', 'silent', 'escalated', 'goalpost'];
const STANCES = ['apoyo', 'hostil', 'neutral', 'mixto', 'ninguno'];

const frameworks = readFrameworks();
const familyOf = Object.fromEntries(frameworks.map(f => [f.id, f.family]));
const nameOf = Object.fromEntries(frameworks.map(f => [f.id, f.name]));

const blank = () => ({ deploys: 0, pending: 0, randomized: 0, randomizedConceded: 0, lurkerMeasured: 0, likes: 0, ...Object.fromEntries([...OUTCOMES, ...STANCES].map(k => [k, 0])) });
const byFamily = new Map();
const byFramework = new Map();

for (const actor of readActors()) {
  for (const it of actor.interactions ?? []) {
    if (!it.framework || it.misattributed || !familyOf[it.framework]) continue;
    for (const [map, key] of [[byFamily, familyOf[it.framework]], [byFramework, it.framework]]) {
      if (!map.has(key)) map.set(key, blank());
      const s = map.get(key);
      s.deploys++;
      if (it.outcome === 'pending') s.pending++;
      else if (OUTCOMES.includes(it.outcome)) s[it.outcome]++;
      if (it.assignment === 'randomized') {
        s.randomized++;
        if (it.outcome === 'conceded') s.randomizedConceded++;
      }
      if (STANCES.includes(it.third_party_stance)) s[it.third_party_stance]++;
      if (Number.isInteger(it.lurker_reactions)) { s.lurkerMeasured++; s.likes += it.lurker_reactions; }
    }
  }
}

const pct = x => `${(x * 100).toFixed(1)}%`;
const interval = s => {
  const judged = s.deploys - s.pending;
  const { lo, hi } = jeffreysInterval(s.conceded, judged);
  return judged ? `${s.conceded}/${judged} [${pct(lo)}–${pct(hi)}]` : '—';
};
const randomizedCell = s => s.randomized ? `${s.randomizedConceded}/${s.randomized}` : '—';
const stanceCell = s => STANCES.filter(k => k !== 'ninguno' && s[k]).map(k => `${k} ${s[k]}`).join(' · ') || '—';

function table(title, rows, label) {
  console.log(`\n${title}\n`);
  const header = ['', 'deploys', 'conceded (IC95 Jeffreys)', 'sorteados c/n', 'terceros', 'likes/medidos'];
  const body = rows.map(([k, s]) => [label(k), String(s.deploys), interval(s), randomizedCell(s), stanceCell(s), `${s.likes}/${s.lurkerMeasured}`]);
  const w = header.map((h, i) => Math.max(h.length, ...body.map(r => r[i].length)));
  const fmt = r => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  console.log(fmt(header));
  console.log(w.map(n => '-'.repeat(n)).join('  '));
  for (const r of body) console.log(fmt(r));
}

const sortRows = map => [...map.entries()].sort((a, b) => b[1].deploys - a[1].deploys);
table('Por FAMILIA', sortRows(byFamily), k => k);
table('Por framework', sortRows(byFramework), k => (nameOf[k] ?? k).slice(0, 60));

const untested = frameworks.filter(f => f.family !== 'auto-disciplina' && !byFramework.has(f.id));
console.log(`\nLectura honesta: un intervalo que se traslapa con el de otra familia NO la supera. Solo "sorteados" compara`);
console.log(`causalmente; lo elegido a mano arrastra el sesgo de a quién se le desplegó. Likes = dato secundario.`);
console.log(`\nArmas sin desplegar: ${untested.length} de ${frameworks.filter(f => f.family !== 'auto-disciplina').length}`);
if (untested.length) console.log('  ' + untested.map(f => `${f.id} (${f.family})`).join(', '));
