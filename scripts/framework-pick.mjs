// framework-pick — etapa 3, ANTES del master: exposición, framework bloqueado y sorteo por target.
//   node scripts/framework-pick.mjs --post-id <id> --author "<nombre exacto>" [--user-id <id>]
// Escribe .coagent/picks/<post_id>-<slug>.json una sola vez: re-correrlo devuelve el mismo pick,
// para que nadie re-sortee hasta que salga el framework que quería. `finalize --framework` lo valida.
// Una interacción nueva registrada al target (su exposición cambió) consume el pick y el siguiente se re-planea.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { randomInt } from 'crypto';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readActors, readFrameworks, readVocab } from './db.mjs';
import { planPick, isStalePick } from './framework-rotation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PICKS_DIR = resolve(ROOT, '.coagent/picks');

export function authorSlug(author) {
  return author.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function pickPath(postId, author) {
  return resolve(PICKS_DIR, `${postId}-${authorSlug(author)}.json`);
}

export function readPick(postId, author) {
  const p = pickPath(postId, author);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

function resolveActor(actors, author, userId) {
  if (userId) return actors.find(a => a.user_id === userId) ?? null;
  const byName = actors.filter(a => a.name === author);
  if (byName.length > 1) throw new Error(`"${author}" coincide con ${byName.length} actores; pasa --user-id`);
  return byName[0] ?? null;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const arg = (flag) => { const i = process.argv.indexOf(flag); return i > 0 ? process.argv[i + 1] : null; };
  const postId = arg('--post-id');
  const author = arg('--author');
  if (!postId || !author) {
    console.error('uso: framework-pick.mjs --post-id <id> --author "<nombre exacto>" [--user-id <id>]');
    process.exit(1);
  }
  const actor = resolveActor(readActors(), author, arg('--user-id'));
  const existing = readPick(postId, author);
  if (existing && !isStalePick(existing, actor)) {
    console.log(JSON.stringify({ ...existing, reused: true }, null, 2));
    process.exit(0);
  }
  const rng = () => randomInt(0, 1_000_000) / 1_000_000;
  const plan = planPick({ actor, frameworks: readFrameworks(), policy: readVocab().rotation, rng });
  const pick = { post_id: postId, author, user_id: actor?.user_id ?? null, picked_at: new Date().toISOString(), ...plan };
  mkdirSync(PICKS_DIR, { recursive: true });
  writeFileSync(pickPath(postId, author), JSON.stringify(pick, null, 2) + '\n');
  console.log(JSON.stringify(pick, null, 2));
}
