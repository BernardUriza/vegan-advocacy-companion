import { readActors, readFrameworks, readVocab } from './db.mjs';
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

// Por VOZ: solo lo sorteado por voice_trial (profano vs filo limpio). Outcome primario: postura de
// terceros (apoyo vs hostil); secundarios: escalated, conceded, likes. El corte es mecánico: n por brazo
// contra readout_n / stop_n y stop_date (data/vocab.json → rotation.voice_trial).
const trial = readVocab().rotation.voice_trial?.value;
if (trial) {
  const byVoice = new Map(trial.arms.map(a => [a, blank()]));
  for (const actor of readActors()) {
    for (const it of actor.interactions ?? []) {
      if (it.misattributed || it.voice_assignment !== 'randomized' || !(it.date >= trial.since) || !byVoice.has(it.voice)) continue;
      const s = byVoice.get(it.voice);
      s.deploys++;
      if (it.outcome === 'pending') s.pending++;
      else if (OUTCOMES.includes(it.outcome)) s[it.outcome]++;
      if (STANCES.includes(it.third_party_stance)) s[it.third_party_stance]++;
      if (Number.isInteger(it.lurker_reactions)) { s.lurkerMeasured++; s.likes += it.lurker_reactions; }
    }
  }
  const ratio = (k, n) => n ? `${k}/${n} [${pct(jeffreysInterval(k, n).lo)}–${pct(jeffreysInterval(k, n).hi)}]` : '—';
  console.log(`\nPor VOZ (voice_trial desde ${trial.since}; solo sorteados; corte a ${trial.stop_n}/brazo o ${trial.stop_date})\n`);
  const header = ['brazo', 'n', 'apoyo/(apoyo+hostil)', 'escalated', 'conceded', 'terceros', 'likes/medidos'];
  const body = [...byVoice.entries()].map(([arm, s]) => {
    const judged = s.deploys - s.pending;
    return [arm, String(s.deploys), ratio(s.apoyo, s.apoyo + s.hostil), ratio(s.escalated, judged), ratio(s.conceded, judged), stanceCell(s), `${s.likes}/${s.lurkerMeasured}`];
  });
  const w = header.map((h, i) => Math.max(h.length, ...body.map(r => r[i].length)));
  const fmt = r => r.map((c, i) => (i === 0 ? c.padEnd(w[i]) : c.padStart(w[i]))).join('  ');
  console.log(fmt(header));
  console.log(w.map(n => '-'.repeat(n)).join('  '));
  for (const r of body) console.log(fmt(r));
  const minN = Math.min(...[...byVoice.values()].map(s => s.deploys));
  const stage = minN >= trial.stop_n ? `n alcanzado: CORTE, decide la doctrina` : minN >= trial.readout_n ? `lectura interina (≥${trial.readout_n}/brazo); el corte es a ${trial.stop_n}` : `recolectando: faltan ${trial.readout_n - minN} por brazo para la lectura interina`;
  const daysLeft = Math.ceil((new Date(trial.stop_date) - Date.now()) / 86400000);
  console.log(`\n${stage} · ${daysLeft >= 0 ? `${daysLeft} días hasta ${trial.stop_date}` : `stop_date ${trial.stop_date} ya pasó: CORTE`}. Si los intervalos de apoyo se traslapan al corte, el registro no mueve a terceros.`);
}

const untested = frameworks.filter(f => f.family !== 'auto-disciplina' && !byFramework.has(f.id));
console.log(`\nLectura honesta: un intervalo que se traslapa con el de otra familia NO la supera. Solo "sorteados" compara`);
console.log(`causalmente; lo elegido a mano arrastra el sesgo de a quién se le desplegó. Likes = dato secundario.`);
console.log(`\nArmas sin desplegar: ${untested.length} de ${frameworks.filter(f => f.family !== 'auto-disciplina').length}`);
if (untested.length) console.log('  ' + untested.map(f => `${f.id} (${f.family})`).join(', '));
