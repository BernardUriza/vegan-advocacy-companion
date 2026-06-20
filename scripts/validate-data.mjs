import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readTactics, readFrameworks } from './db.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS_MD_DIR = resolve(ROOT, 'analysis/actors');

const errors = [];
const warnings = [];

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

// 4b. Frameworks: unique ids, required fields, and related_tactics must resolve
const frameworks = readFrameworks();
const seenFw = new Set();
for (const f of frameworks) {
  for (const field of ['id', 'name', 'author', 'definition', 'enables', 'attack_surface', 'deploy_as']) {
    if (!f[field]) errors.push(`framework "${f.id ?? '(no id)'}" missing required field "${field}"`);
  }
  if (f.id) {
    if (seenFw.has(f.id)) errors.push(`duplicate framework id "${f.id}"`);
    seenFw.add(f.id);
  }
  for (const t of f.related_tactics ?? []) {
    if (!tacticIds.has(t)) errors.push(`framework "${f.id}" references undefined tactic "${t}"`);
  }
}

// 4c. WARN: a framework with empty related_tactics is an orphan in the arsenal —
// getFrameworksByTactic can never surface it, so it's unreachable counter-ammo.
for (const f of frameworks) {
  if (!(f.related_tactics ?? []).length) {
    warnings.push(`framework "${f.id}" has empty related_tactics — orphan, unreachable via getFrameworksByTactic`);
  }
}

// 4d. WARN: a tactic that NO framework counters is a coverage gap — when an actor
// deploys it, stage-2/3 finds no counter-framework to surface.
const counteredTactics = new Set();
for (const f of frameworks) {
  for (const t of f.related_tactics ?? []) counteredTactics.add(t);
}
for (const t of tactics) {
  if (!counteredTactics.has(t.id)) {
    warnings.push(`tactic "${t.id}" is countered by no framework — arsenal coverage gap`);
  }
}

// 4e. ERROR: a framework's source_ref must point to a file that exists on disk
// (relative to ROOT), or the citation is dangling.
for (const f of frameworks) {
  if (f.source_ref && !existsSync(resolve(ROOT, f.source_ref))) {
    errors.push(`framework "${f.id}" source_ref does not exist on disk: "${f.source_ref}"`);
  }
}

// 4f. ERROR: deploy_as must start with one of the 3 valid values (suffixes like
// "marco (con cautela)" / "auto-disciplina-del-activista" are allowed).
const VALID_DEPLOY_AS = ['marco', 'premisa_portante', 'auto-disciplina'];
for (const f of frameworks) {
  if (f.deploy_as && !VALID_DEPLOY_AS.some(v => f.deploy_as.startsWith(v))) {
    errors.push(`framework "${f.id}" deploy_as "${f.deploy_as}" does not start with one of {${VALID_DEPLOY_AS.join(', ')}}`);
  }
}

// 4g. WARN: the moat-attribution gap. Every posted reply deployed a framework
// (etapa-3 picks one); an interaction WITHOUT a `framework` id means that deploy
// is invisible to framework-stats/getFrameworkWinRate, so the effectiveness moat
// can never populate. This is LOUD on purpose — the silent gap that kept the moat
// empty across many runs was a missing field nobody flagged.
let missingFw = 0, missingFwClosed = 0;
for (const a of actors) {
  for (const it of a.interactions ?? []) {
    if (!it.framework) {
      missingFw++;
      if ((it.outcome ?? 'pending') !== 'pending') missingFwClosed++;
    }
  }
}
if (missingFw) {
  warnings.push(`${missingFw} interaction(s) lack a "framework" id (moat-attribution gap — invisible to framework-stats)${missingFwClosed ? `; ${missingFwClosed} of them are already CLOSED, so their effectiveness is lost permanently` : ''}`);
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

if (warnings.length) {
  console.warn(`\nDATA WARNINGS (${warnings.length} — signals, not failures):`);
  for (const w of warnings) console.warn('  WARN: ' + w);
}

if (errors.length) {
  console.error(`\nDATA VALIDATION FAILED (${errors.length} error${errors.length > 1 ? 's' : ''}):`);
  for (const e of errors) console.error('  ✗ ' + e);
  process.exit(1);
}

const warnNote = warnings.length ? `, ${warnings.length} data warning(s)` : '';
console.log(`✓ data integrity OK — ${actors.length} actors, ${tactics.length} tactics, ${frameworks.length} frameworks${warnNote}${mdWarnings ? `, ${mdWarnings} md drift warning(s)` : ''}`);
