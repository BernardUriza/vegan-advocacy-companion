import { readFileSync, writeFileSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS_PATH = resolve(ROOT, 'data/actors.json');
const TACTICS_PATH = resolve(ROOT, 'data/tactics.json');

export function readActors() {
  return JSON.parse(readFileSync(ACTORS_PATH, 'utf8'));
}

export function readTactics() {
  return JSON.parse(readFileSync(TACTICS_PATH, 'utf8'));
}

// Atomic write: serialize to a temp file then rename. rename(2) is atomic on the
// same filesystem, so a concurrent reader never sees a half-written/truncated
// file, and the last writer wins cleanly instead of corrupting the JSON.
function writeJsonAtomic(path, data) {
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, path);
}

export function getActor(userId) {
  if (!userId) return null;
  return readActors().find(a => a.user_id === userId) ?? null;
}

export function getTactic(tacticId) {
  return readTactics().find(t => t.id === tacticId) ?? null;
}

export function upsertActor(actor) {
  const actors = readActors();
  const idx = actors.findIndex(a => a.user_id === actor.user_id);
  if (idx >= 0) {
    actors[idx] = { ...actors[idx], ...actor };
  } else {
    actors.push(actor);
  }
  writeJsonAtomic(ACTORS_PATH, actors);
  return actors[idx >= 0 ? idx : actors.length - 1];
}

export function appendInteraction(userId, interaction) {
  const actors = readActors();
  const actor = actors.find(a => a.user_id === userId);
  if (!actor) throw new Error(`Actor ${userId} not found`);
  actor.interactions.push(interaction);
  writeJsonAtomic(ACTORS_PATH, actors);
  return actor;
}

export function getActorsByTactic(tacticId) {
  return readActors().filter(a => a.tactics.includes(tacticId));
}

export function getActorsForThread(threadId) {
  return readActors().filter(a => a.threads.includes(threadId));
}

export function getDossierSummary(userId) {
  const actor = getActor(userId);
  if (!actor) return null;
  const tactics = readTactics().filter(t => actor.tactics.includes(t.id));
  return {
    actor,
    tacticDetails: tactics,
    counters: tactics.map(t => ({ tactic: t.id, canonical_counter: t.canonical_counter, what_not_to_do: t.what_not_to_do })),
  };
}
