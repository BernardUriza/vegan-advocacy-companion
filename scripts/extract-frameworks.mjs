import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFrameworks, readTactics, upsertFramework } from './db.mjs';

// extract-frameworks — reusable FAN-OUT extraction scaffold (Stage F).
//
// PATTERN (read a transcript/source → extract framework objects → merge into
// data/frameworks.json with dedup-by-id + invalid-related_tactics filtering).
// JSON is the SSOT (Art. 6); analysis/frameworks/README.md is GENERATED from it
// by gen-frameworks.mjs. This script is the INGEST side: it takes already-built
// framework objects (built by Claude reading a source — the JUDGMENT step that is
// NOT scripted) and merges them safely through db.mjs's atomic upsert.
//
// USAGE (programmatic — import from another extractor or a REPL):
//   import { mergeFrameworks } from './extract-frameworks.mjs';
//   const result = mergeFrameworks(newFrameworkObjects);   // dryRun=false writes via upsertFramework
//
// USAGE (CLI smoke / inspect a source's char budget before extracting):
//   node extract-frameworks.mjs --source "doctrine/rag/<file>.md"   # prints lines/chars
//
// The schema each framework object MUST carry (mirrors data/frameworks.json):
//   id            kebab-case, unique across the whole array (the dedup key)
//   name          human title
//   author        the source's author (e.g. "Marshall Rosenberg (NVC)")
//   tradition     lineage label (e.g. "registro compasivo / comunicación no violenta")
//   definition    what the concept IS
//   enables       what deploying it buys you in a thread
//   register      "compasivo" | "filo" (the reply-output-style register it serves)
//   attack_surface honest risk: where it backfires / who attacks it
//   deploy_as     "marco" | "auto-disciplina-del-activista" | "auto-disciplina del activista" | …
//   source_ref    path to the doctrine/rag source it was extracted from
//   related_tactics  ONLY ids that resolve in data/tactics.json — invalid ids are FILTERED, not erased
//
// HARD RULES this scaffold enforces (so a bad extraction can't poison the SSOT):
//   1. dedup by id      — a new object whose id already exists is SKIPPED (existing wins; Art. 5: never clobber).
//   2. tactic filter    — related_tactics entries absent from tactics.json are DROPPED with a warning
//                         (keeps validate-data.mjs green; a typo'd tactic id never lands).
//   3. required fields   — an object missing a required field is REJECTED (reported, not written).
//   4. atomic write      — delegated to db.mjs upsertFramework (temp-file + rename, deploy-safe).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const REQUIRED = ['id', 'name', 'author', 'definition', 'enables', 'attack_surface', 'deploy_as'];

/**
 * Merge new framework objects into data/frameworks.json safely.
 * @param {object[]} incoming  framework objects to add
 * @param {{dryRun?: boolean}} [opts]
 * @returns {{added: string[], skippedDup: string[], rejected: {id:string, why:string}[], droppedTactics: {id:string, tactic:string}[]}}
 */
export function mergeFrameworks(incoming, { dryRun = false } = {}) {
  const seenIds = new Set(readFrameworks().map(f => f.id));
  const tacticIds = new Set(readTactics().map(t => t.id));

  const added = [];
  const skippedDup = [];
  const rejected = [];
  const droppedTactics = [];

  for (const fw of incoming) {
    const missing = REQUIRED.filter(k => !fw[k]);
    if (missing.length) {
      rejected.push({ id: fw.id ?? '(no id)', why: `missing required field(s): ${missing.join(', ')}` });
      continue;
    }
    if (seenIds.has(fw.id)) {
      skippedDup.push(fw.id);
      continue;
    }
    const cleaned = { ...fw };
    cleaned.related_tactics = Array.isArray(cleaned.related_tactics)
      ? cleaned.related_tactics.filter(t => {
          const ok = tacticIds.has(t);
          if (!ok) droppedTactics.push({ id: fw.id, tactic: t });
          return ok;
        })
      : [];

    if (!dryRun) upsertFramework(cleaned);
    seenIds.add(cleaned.id);
    added.push(cleaned.id);
  }

  return { added, skippedDup, rejected, droppedTactics };
}

// CLI smoke: inspect a source's size (the cheap pre-extraction budget check).
function main() {
  const argv = process.argv.slice(2);
  const srcIdx = argv.indexOf('--source');
  if (srcIdx !== -1 && argv[srcIdx + 1]) {
    const path = resolve(ROOT, argv[srcIdx + 1]);
    const text = readFileSync(path, 'utf8');
    console.log(`source: ${argv[srcIdx + 1]}`);
    console.log(`  lines: ${text.split('\n').length}  chars: ${text.length}`);
    console.log('  → read it, build framework objects per the schema above, then call mergeFrameworks(objs).');
    return;
  }
  console.log('extract-frameworks: import { mergeFrameworks } and pass framework objects.');
  console.log('  or: node extract-frameworks.mjs --source "doctrine/rag/<file>.md"  (size smoke)');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
