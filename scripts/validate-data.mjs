import { readFileSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readTactics, readFrameworks, readVocab, vocabViolations, interactionProblems } from './db.mjs';
import { dossierFilenames, GENERATED_MARK } from './gen-dossiers.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS_MD_DIR = resolve(ROOT, 'analysis/actors');

const errors = [];
const warnings = [];

const actors = readActors();
const vocab = readVocab();
const tactics = readTactics();
const tacticIds = new Set(tactics.map(t => t.id));
const actorIds = new Set(actors.map(a => a.user_id).filter(Boolean));

// 1. No actor references a tactic that doesn't exist
for (const a of actors) {
  for (const t of a.tactics) {
    if (!tacticIds.has(t)) errors.push(`actor "${a.name}" references undefined tactic "${t}"`);
  }
}

// 2. Who uses a tactic is derived from actor.tactics (db.getActorsByTactic); a stored reverse index drifted once (130 pairs)
for (const t of tactics) {
  if ('actors_known' in t) errors.push(`tactic "${t.id}" stores actors_known; derive it with getActorsByTactic instead`);
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
  errors.push(...vocabViolations(a, vocab));
  errors.push(...interactionProblems(a, vocab));
  const threads = new Set(a.threads ?? []);
  for (const i of a.interactions ?? []) {
    if (i.thread_id && !threads.has(i.thread_id)) errors.push(`actor "${a.name}" has an interaction in thread ${i.thread_id} missing from threads[]`);
  }
}

// 4. fallacy_type_id, if set, is a known backend fallacy id
const KNOWN_FALLACIES = new Set([
  'appeal_to_tradition', 'appeal_to_nature', 'ad_hominem', 'straw_man', 'false_equivalence',
  'category_error',
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
  errors.push(...vocabViolations(f, vocab, 'framework'));
  if (f.id) {
    if (seenFw.has(f.id)) errors.push(`duplicate framework id "${f.id}"`);
    seenFw.add(f.id);
  }
  for (const t of f.related_tactics ?? []) {
    if (!tacticIds.has(t)) errors.push(`framework "${f.id}" references undefined tactic "${t}"`);
  }
}
const frameworkIds = new Set(frameworks.map(f => f.id).filter(Boolean));

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
    } else if (!frameworkIds.has(it.framework)) {
      // 4h. ERROR (hard): the `framework` field holds a value that is NOT a real
      // framework id (commonly a TACTIC id like deflexion_estetica) → silently
      // invisible to framework-stats, so it pollutes the moat while LOOKING
      // attributed. The gap that kept the moat empty hid here; this fails loud.
      const asTactic = tacticIds.has(it.framework) ? ' (this is a TACTIC id, not a framework)' : '';
      errors.push(`actor "${a.name}" interaction [${it.thread_id ?? '?'} ${it.date ?? '?'}] framework "${it.framework}" is not a known framework id${asTactic}`);
    }
  }
}
// 4i. Optional lurker signal (lurker-sweep): if present, a non-negative integer plus a parseable timestamp.
for (const a of actors) {
  for (const it of a.interactions ?? []) {
    const where = `actor "${a.name}" interaction [${it.thread_id ?? '?'} ${it.date ?? '?'}]`;
    const hasR = it.lurker_reactions !== undefined, hasT = it.lurker_checked_at !== undefined;
    if (hasR && !(Number.isInteger(it.lurker_reactions) && it.lurker_reactions >= 0)) errors.push(`${where} lurker_reactions must be a non-negative integer, got ${JSON.stringify(it.lurker_reactions)}`);
    if (hasT && !Number.isFinite(Date.parse(it.lurker_checked_at))) errors.push(`${where} lurker_checked_at is not a parseable date: ${JSON.stringify(it.lurker_checked_at)}`);
    if (hasR !== hasT) errors.push(`${where} lurker_reactions and lurker_checked_at must be set together`);
  }
}
if (missingFw) {
  warnings.push(`${missingFw} interaction(s) lack a "framework" id (moat-attribution gap — invisible to framework-stats)${missingFwClosed ? `; ${missingFwClosed} of them are already CLOSED, so their effectiveness is lost permanently` : ''}`);
}

// 4j. Interaction shape: outcome enum, YYYY-MM-DD date, draft_sha required from 2026-09-28 on.
const OUTCOMES = new Set(['pending', 'conceded', 'engaged', 'silent', 'escalated', 'goalpost']);
const DRAFT_SHA_SINCE = '2026-09-28';
let missingSha = 0;
for (const a of actors) {
  for (const it of a.interactions ?? []) {
    const where = `actor "${a.name}" (${a.user_id}) interaction [${it.thread_id ?? '?'} ${it.date ?? '?'}]`;
    if (it.outcome !== undefined && !OUTCOMES.has(it.outcome)) warnings.push(`${where} outcome "${it.outcome}" is not one of {${[...OUTCOMES].join(', ')}}`);
    const dateOk = typeof it.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(it.date);
    if (!dateOk) warnings.push(`${where} date ${JSON.stringify(it.date)} does not match YYYY-MM-DD`);
    else if (it.date >= DRAFT_SHA_SINCE && !it.draft_sha) { missingSha++; warnings.push(`${where} lacks draft_sha (required for interactions dated ${DRAFT_SHA_SINCE}+; run moat-link-drafts)`); }
  }
}

// 4k. Dossier filenames: slug collisions get a -<user_id> suffix (gen-dossiers); a final-name clash would overwrite.
const { files: dossierFiles, collided } = dossierFilenames(actors);
for (const b of collided) {
  const who = actors.filter((a, k) => dossierFiles[k].startsWith(`${b}-`)).map(a => a.user_id);
  warnings.push(`dossier slug "${b}" is shared by ${who.length} actors (${who.join(', ')}) — gen-dossiers writes ${b}-<user_id>.md for each`);
}
const fileSeen = new Map();
dossierFiles.forEach((f, k) => {
  if (fileSeen.has(f)) errors.push(`dossier filename "${f}" collides for actors ${fileSeen.get(f)} and ${actors[k].user_id} — one dossier would overwrite the other`);
  else fileSeen.set(f, actors[k].user_id);
});

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
    } else if (body.includes(GENERATED_MARK) && !fileSeen.has(file)) {
      console.warn(`WARN: ${file} is a generated dossier that gen-dossiers no longer writes (stale; regenerate removes collided ones)`);
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
