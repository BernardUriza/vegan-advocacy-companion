import { readFileSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readTactics } from './db.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS_MD_DIR = resolve(ROOT, 'analysis/actors');

const errors = [];

const actors = readActors();
const tactics = readTactics();
const tacticIds = new Set(tactics.map(t => t.id));
const actorIds = new Set(actors.map(a => a.user_id).filter(Boolean));

// 1. No actor references a tactic that doesn't exist
for (const a of actors) {
  for (const t of a.tactics) {
    if (!tacticIds.has(t)) errors.push(`actor "${a.name}" references undefined tactic "${t}"`);
  }
}

// 2. No tactic claims an actor who doesn't list it back (bidirectional consistency)
const byId = Object.fromEntries(actors.map(a => [a.user_id, a]));
for (const t of tactics) {
  for (const uid of t.actors_known) {
    const a = byId[uid];
    if (!a) errors.push(`tactic "${t.id}" claims unknown actor user_id "${uid}"`);
    else if (!a.tactics.includes(t.id)) errors.push(`tactic "${t.id}" claims actor "${a.name}" but actor does not list it`);
  }
}

// 3. Required fields present + unique user_ids
const seen = new Set();
for (const a of actors) {
  for (const field of ['name', 'bando', 'verdict', 'register']) {
    if (!a[field]) errors.push(`actor "${a.name ?? '(no name)'}" missing required field "${field}"`);
  }
  if (a.user_id) {
    if (seen.has(a.user_id)) errors.push(`duplicate user_id "${a.user_id}" (${a.name})`);
    seen.add(a.user_id);
  }
}

// 4. fallacy_type_id, if set, is a known backend fallacy id
const KNOWN_FALLACIES = new Set([
  'appeal_to_tradition', 'appeal_to_nature', 'ad_hominem', 'straw_man', 'false_equivalence',
]);
for (const t of tactics) {
  if (t.fallacy_type_id && !KNOWN_FALLACIES.has(t.fallacy_type_id)) {
    errors.push(`tactic "${t.id}" references unknown fallacy_type_id "${t.fallacy_type_id}"`);
  }
}

// 5. Drift warning: a dossier markdown exists with a user_id absent from the JSON SSOT
let mdWarnings = 0;
try {
  for (const file of readdirSync(ACTORS_MD_DIR)) {
    if (!file.endsWith('.md') || file === 'README.md') continue;
    const body = readFileSync(resolve(ACTORS_MD_DIR, file), 'utf8');
    const m = body.match(/user_id:\*\*\s*([0-9]+)/);
    if (m && !actorIds.has(m[1])) {
      console.warn(`WARN: ${file} has user_id ${m[1]} not present in data/actors.json (regenerate or migrate)`);
      mdWarnings++;
    }
  }
} catch {
  // analysis/actors dir optional
}

if (errors.length) {
  console.error(`\nDATA VALIDATION FAILED (${errors.length} error${errors.length > 1 ? 's' : ''}):`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

console.log(`✓ data integrity OK — ${actors.length} actors, ${tactics.length} tactics${mdWarnings ? `, ${mdWarnings} md drift warning(s)` : ''}`);
