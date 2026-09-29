// Rotación y sorteo de frameworks por target (etapa 3). Lógica pura: sin disco ni Chrome.
// Política en data/vocab.json (rotation); CLI en framework-pick.mjs; la valida seed-coagent finalize.

const SELF_DISCIPLINE = 'auto-disciplina';
const FALLBACK_FAMILY = 'estatus-sujeto';

export function isGoodFaith(actor, policy) {
  if (!actor) return false;
  const gf = policy.good_faith.value;
  return gf.register.includes(actor.register) || gf.verdict.includes(actor.verdict) || gf.tone.includes(actor.tone);
}

export function exposureOf(actor) {
  const previous = (actor?.interactions ?? []).filter(i => !i.misattributed);
  return { exposure_n: previous.length + 1, previous_framework: previous.at(-1)?.framework ?? null };
}

export function rankCandidates(actor, frameworks, blocked) {
  const tactics = new Set(actor?.tactics ?? []);
  const weapons = frameworks.filter(f => f.family !== SELF_DISCIPLINE && !blocked.includes(f.id));
  const scored = weapons
    .map(f => ({ id: f.id, family: f.family, hits: (f.related_tactics ?? []).filter(t => tactics.has(t)).length }))
    .filter(c => c.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.id.localeCompare(b.id));
  if (!scored.length) {
    return weapons.filter(f => f.family === FALLBACK_FAMILY).map(f => ({ id: f.id, family: f.family, hits: 0 }));
  }
  return scored;
}

export function distinctFamilies(candidates, k) {
  const out = [];
  const seen = new Set();
  for (const c of candidates) {
    if (seen.has(c.family)) continue;
    seen.add(c.family);
    out.push(c);
    if (out.length === k) break;
  }
  return out;
}

export function planPick({ actor, frameworks, policy, rng = Math.random }) {
  const { exposure_n, previous_framework } = exposureOf(actor);
  const blocked = exposure_n >= policy.rotate_from_exposure.value && previous_framework ? [previous_framework] : [];
  const shortlist = distinctFamilies(rankCandidates(actor, frameworks, blocked), policy.top_k.value);
  const goodFaith = isGoodFaith(actor, policy);
  const draw = rng();
  const randomized = goodFaith && shortlist.length > 1 && draw < policy.randomize_rate.value;
  const base = { exposure_n, previous_framework, blocked, good_faith: goodFaith, shortlist, draw };
  if (!randomized) return { ...base, assignment: 'chosen', framework: null, propensity: null };
  const i = Math.min(shortlist.length - 1, Math.floor(rng() * shortlist.length));
  return { ...base, assignment: 'randomized', framework: shortlist[i].id, propensity: 1 / shortlist.length };
}

export function pickProblems(pick, frameworkId, frameworks) {
  if (!pick) return ['no hay recibo de framework-pick para este target: corre `node scripts/framework-pick.mjs` antes del master'];
  const f = frameworks.find(x => x.id === frameworkId);
  if (!f) return [`framework "${frameworkId}" no existe en data/frameworks.json`];
  const problems = [];
  if (f.family === SELF_DISCIPLINE) problems.push(`"${frameworkId}" es auto-disciplina: informa cómo se escribe, no se despliega`);
  if (pick.blocked.includes(frameworkId)) problems.push(`"${frameworkId}" fue el framework de la reply anterior a este target y va en la exposición ${pick.exposure_n}: entrada nueva obligatoria`);
  if (pick.assignment === 'randomized' && frameworkId !== pick.framework) problems.push(`este target salió SORTEADO a "${pick.framework}"; desplegar otro rompe la comparación`);
  return problems;
}
