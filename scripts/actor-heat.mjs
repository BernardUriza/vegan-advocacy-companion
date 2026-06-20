import { readActors } from './db.mjs';

// actor-heat — score de "heat" por actor para priorizar el lote (etapa-1/2).
// Pura lectura de actors.json: combina freshness (interacción más reciente),
// leverage (verdict) y persuadibilidad (register/bando). Más heat = atender antes.
// NO decide la jugada (eso es la tabla de deuda + dossiers); solo ordena el lote.

const HALF_LIFE_DAYS = 14; // freshness se reduce a la mitad cada 14 días

// leverage: a quién mover el dial educa a más lurkers
const LEVERAGE = {
  audiencia: 1.0,        // se debate ante galería — máxima palanca sobre el lurker
  persuadible: 0.85,     // mover a esta persona es la conversión real
  aliado: 0.45,          // refuerza, no convierte
  pozo_sin_fondo: 0.25,  // no se mueve; solo vale por el lurker
  troll_no_enganchar: 0.05,
};

// persuadibilidad por registro de respuesta
const REGISTER_PERSUADE = {
  compasivo: 1.0,        // herida/buena fe → mueve
  filo: 0.7,             // mala fe/escudo → educa al lurker, no convierte al rival
  wit: 0.6,
  any: 0.5,
  na: 0.3,
  ignorar: 0.1,
  no_enganchar: 0.1,
};

const BANDO_PERSUADE = {
  ambiguo: 1.0,          // sin postura fija → el más movible
  'anti-vegan': 0.6,
  'pro-vegan': 0.4,
  aliado: 0.4,
};

const NOW = Date.now();
const DAY = 86400000;

function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = Date.parse(dateStr);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (NOW - t) / DAY);
}

function freshnessScore(actor) {
  const dates = (actor.interactions ?? []).map(i => i.date).filter(Boolean);
  if (dates.length === 0) return { score: 0, ageDays: null };
  const ages = dates.map(daysSince).filter(d => d !== null);
  if (ages.length === 0) return { score: 0, ageDays: null };
  const ageDays = Math.min(...ages); // la interacción más reciente
  const score = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  return { score, ageDays };
}

function heatFor(actor) {
  const { score: fresh, ageDays } = freshnessScore(actor);
  const leverage = LEVERAGE[actor.verdict] ?? 0.3;
  const persuade = (REGISTER_PERSUADE[actor.register] ?? 0.4) * (BANDO_PERSUADE[actor.bando] ?? 0.5);
  // freshness pondera el conjunto: un actor sin interacciones aún tiene un piso
  // bajo (no es deuda viva), pero leverage*persuade lo deja en el ranking.
  const heat = (0.2 + 0.8 * fresh) * leverage * persuade;
  return { heat, fresh, ageDays, leverage, persuade };
}

const ranked = readActors()
  .map(a => ({ actor: a, ...heatFor(a) }))
  .sort((x, y) => y.heat - x.heat);

const fmtAge = d => (d === null ? '—' : d < 1 ? `${Math.round(d * 24)}h` : `${d.toFixed(1)}d`);
const pad = (s, n) => String(s).padEnd(n).slice(0, n - 1) + ' ';

console.log('ACTOR HEAT — prioridad de lote (heat alto = atender antes)\n');
console.log(`${pad('#', 4)}${pad('heat', 7)}${pad('fresh', 7)}${pad('lev', 6)}${pad('pers', 6)}${pad('age', 6)}${pad('verdict', 18)}${pad('reg', 14)}name`);
console.log('-'.repeat(100));
ranked.forEach((r, i) => {
  console.log(
    pad(i + 1, 4) +
    pad(r.heat.toFixed(3), 7) +
    pad(r.fresh.toFixed(2), 7) +
    pad(r.leverage.toFixed(2), 6) +
    pad(r.persuade.toFixed(2), 6) +
    pad(fmtAge(r.ageDays), 6) +
    pad(r.actor.verdict, 18) +
    pad(r.actor.register, 14) +
    r.actor.name
  );
});
