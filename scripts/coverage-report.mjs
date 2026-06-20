import { readTactics, readFrameworks } from './db.mjs';

const tactics = readTactics();
const frameworks = readFrameworks();

// ── 1. Arsenal coverage: which tactics have ≥1 framework countering them ──────
const counterCount = new Map(tactics.map(t => [t.id, []]));
for (const f of frameworks) {
  for (const tid of f.related_tactics ?? []) {
    if (counterCount.has(tid)) counterCount.get(tid).push(f.id);
  }
}

const rows = tactics.map(t => ({
  id: t.id,
  name: t.name,
  frameworks: counterCount.get(t.id),
  n: counterCount.get(t.id).length,
}));

// gaps (0 counters) first, then ascending by count, then by id
rows.sort((a, b) => a.n - b.n || a.id.localeCompare(b.id));

const gaps = rows.filter(r => r.n === 0);
const covered = rows.filter(r => r.n > 0);

console.log('═══════════════════════════════════════════════════════════════');
console.log(' ARSENAL COVERAGE — tactics × frameworks that counter them');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`${tactics.length} tactics · ${frameworks.length} frameworks · ${gaps.length} gap(s)\n`);

if (gaps.length) {
  console.log('── GAPS (0 frameworks counter this tactic) ──');
  for (const r of gaps) console.log(`  ✗ [0]  ${r.id}  — ${r.name}`);
  console.log('');
}

console.log('── COVERED (≥1 framework) ──');
for (const r of covered) {
  console.log(`  ✓ [${r.n}]  ${r.id}`);
  console.log(`         ${r.frameworks.join(', ')}`);
}

// ── 2. Near-dup audit: frameworks with very similar names/definitions ─────────
const STOP = new Set([
  'el','la','los','las','un','una','de','del','que','y','o','en','a','es','no',
  'se','su','sus','con','por','para','al','lo','como','más','the','of','to','is',
  'as','it','not','this','that','vegano','veganismo','animal','animales','antiespecismo',
  'especismo','violencia','moral','etica',
]);

function tokens(s) {
  return new Set(
    (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9 ]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP.has(w))
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

const prepped = frameworks.map(f => ({
  id: f.id,
  name: f.name,
  author: f.author,
  nameTok: tokens(f.name),
  defTok: tokens(`${f.definition} ${f.enables}`),
  tactics: new Set(f.related_tactics ?? []),
}));

// A blended score surfaces conceptual twins better than a single field:
//   name overlap weighs heaviest (a coined twin shares vocabulary), the
//   definition/enables overlap corroborates, and shared related_tactics is a
//   weak tie-breaker (two frameworks countering the same tactics often overlap).
// A pair is only a near-dup candidate if its NAMES share vocabulary; a high
// shared-tactic score alone (two distinct frameworks countering the same one
// tactic) is NOT duplication, so we gate on a minimum name overlap before the
// blended score is even considered.
const NAME_W = 0.55, DEF_W = 0.35, TAC_W = 0.10;
const MIN_NAME_SIM = 0.10;
const FLAG_THRESHOLD = 0.13;
const suspects = [];
for (let i = 0; i < prepped.length; i++) {
  for (let j = i + 1; j < prepped.length; j++) {
    const a = prepped[i], b = prepped[j];
    const nameSim = jaccard(a.nameTok, b.nameTok);
    const defSim = jaccard(a.defTok, b.defTok);
    const tacSim = jaccard(a.tactics, b.tactics);
    const score = NAME_W * nameSim + DEF_W * defSim + TAC_W * tacSim;
    if (nameSim >= MIN_NAME_SIM && score >= FLAG_THRESHOLD) {
      suspects.push({ a, b, nameSim, defSim, tacSim, score });
    }
  }
}
suspects.sort((x, y) => y.score - x.score);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(' NEAR-DUP AUDIT — suspicious framework pairs (human review only)');
console.log('═══════════════════════════════════════════════════════════════');
if (!suspects.length) {
  console.log('  (no pairs above threshold)');
} else {
  console.log(`  ${suspects.length} pair(s) flagged — NOT deleted, review by hand\n`);
  for (const s of suspects) {
    console.log(`  ~ score=${s.score.toFixed(2)}  (name=${s.nameSim.toFixed(2)} def=${s.defSim.toFixed(2)} tactics=${s.tacSim.toFixed(2)})`);
    console.log(`      ${s.a.id}  [${s.a.author}]`);
    console.log(`      ${s.b.id}  [${s.b.author}]`);
  }
}
console.log('');
