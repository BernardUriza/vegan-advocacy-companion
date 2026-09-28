// Scout de hilos AJENOS (etapa 1, paso 0.7): lógica pura, sin playwright. El driver es
// scout-feeds.mjs. Surfacea candidatos donde nadie carga el marco; la jugada sigue siendo de etapa 3.

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { UNKNOWN_AGE } from './freshness.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const ME = 'Bernard Uriza Orozco';
export const SCOUT_MAX_AGE_MIN = 48 * 60;

// "Sunday, September 27, 2026 at 2:22 PM" (tooltip del link de la hora) → minutos de edad.
export function ageMinutesFromTooltip(tip, now = Date.now()) {
  const m = (tip || '').replace(/[\u202f\u00a0]/g, ' ').match(/([A-Z][a-z]+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2} [AP]M)/);
  if (!m) return UNKNOWN_AGE;
  const t = Date.parse(`${m[1]} ${m[2]}`);
  return Number.isFinite(t) ? Math.max(0, Math.round((now - t) / 60000)) : UNKNOWN_AGE;
}

export function readGroupsRegistry(path = resolve(ROOT, '.claude/destinatarios-canales.txt')) {
  const lines = readFileSync(path, 'utf8').split('\n');
  const names = lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const idsLine = lines.find((l) => /^#\s*ids:/.test(l)) || '';
  const ids = [...idsLine.matchAll(/\d{10,}/g)].map((m) => m[0]);
  return ids.map((id, i) => ({ id, name: names[i] ?? null }));
}

// Pistas de táctica por léxico del preview: orientan la lectura, no la sustituyen.
const HINTS = {
  naturalismo: /\b(natural|omnivore|omnivores|canine|canines|evolved|evolution|ancestors|food chain|circle of life)\b/i,
  crop_deaths_flip: /\b(crop deaths?|field mice|combine|harvest(ing)? kills|insects? (you )?(kill|poison)|pesticides?)\b/i,
  relativismo_moral: /\b(subjective|opinion|who are you to|your morals?|my morals?|personal choice)\b/i,
  futility_no_clean_option: /\b(hypocrit\w*|no such thing as|impossible to|you still|your phone|your car)\b/i,
  plant_sentience_equivalence: /\b(plants? (feel|scream|have feelings)|plant sentience|plants are alive)\b/i,
  predator_comparison: /\b(lions?|wolves|wolf|predators?|orcas?|sharks?) (eat|kill|hunt)/i,
  species_hierarchy: /\b(apex|dominant species|top of the|superior|dominion|not equal)\b/i,
  insulto_ad_hominem: /\b(delusional|cult|psychosis|mental (health|illness)|soy ?boys?|malnourished)\b/i,
  welfare_rhetoric: /\b(humane(ly)?|free[- ]range|grass[- ]fed|regenerative|ethical(ly)? (raised|sourced))\b/i,
  propiedad_como_proteccion: /\b(for their own good|would go extinct|wouldn't exist|they'd die out)\b/i,
  apelacion_normal: /\b(normal|everyone eats|always have|tradition)\b/i,
};

export function tacticsHint(text, known = null) {
  const hits = Object.entries(HINTS).filter(([, re]) => re.test(text || '')).map(([id]) => id);
  return known ? hits.filter((id) => known.has(id)) : hits;
}

// Un post ajeno, fresco, donde Bernard NO ha participado y que ya tiene conversación.
export function isCandidate(p, { threadsKnown = new Set(), maxAgeMin = SCOUT_MAX_AGE_MIN } = {}) {
  if (!p.post_id) return { ok: false, why: 'sin permalink' };
  if (p.author === ME) return { ok: false, why: 'post mío' };
  if (p.bernardCommented) return { ok: false, why: 'ya comenté' };
  if (threadsKnown.has(p.post_id)) return { ok: false, why: 'ya respondí ahí (moat)' };
  if (p.ageMin === UNKNOWN_AGE) return { ok: false, why: 'edad desconocida' };
  if (p.ageMin > maxAgeMin) return { ok: false, why: 'viejo' };
  if (!p.comments && !p.reactions) return { ok: false, why: 'sin actividad' };
  return { ok: true };
}

// Actividad primero (los comentarios son debate; las reacciones, lurkers), frescura como desempate.
export function score(p) {
  const fresh = Math.max(0, 1 - p.ageMin / SCOUT_MAX_AGE_MIN);
  return Math.round((p.comments * 3 + p.reactions + p.tactics_hint.length * 2 + fresh) * 100) / 100;
}

export function rank(posts, opts = {}) {
  const kept = [];
  const dropped = [];
  for (const p of posts) {
    const v = isCandidate(p, opts);
    if (v.ok) kept.push({ ...p, score: score(p) });
    else dropped.push({ post_id: p.post_id, author: p.author, why: v.why });
  }
  kept.sort((a, b) => b.score - a.score);
  return { kept, dropped };
}
