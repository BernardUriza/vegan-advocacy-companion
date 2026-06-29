import { readFileSync, writeFileSync, renameSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ACTORS_PATH = resolve(ROOT, 'data/actors.json');
const TACTICS_PATH = resolve(ROOT, 'data/tactics.json');
const FRAMEWORKS_PATH = resolve(ROOT, 'data/frameworks.json');
const THREADS_PATH = resolve(ROOT, 'data/threads.json');

export function readActors() {
  return JSON.parse(readFileSync(ACTORS_PATH, 'utf8'));
}

export function readTactics() {
  return JSON.parse(readFileSync(TACTICS_PATH, 'utf8'));
}

export function readFrameworks() {
  return JSON.parse(readFileSync(FRAMEWORKS_PATH, 'utf8'));
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

export function getFramework(frameworkId) {
  return readFrameworks().find(f => f.id === frameworkId) ?? null;
}

export function getFrameworksByAuthor(author) {
  return readFrameworks().filter(f => f.author === author);
}

export function getFrameworksByTactic(tacticId) {
  return readFrameworks().filter(f => (f.related_tactics ?? []).includes(tacticId));
}

export function upsertFramework(framework) {
  const frameworks = readFrameworks();
  const idx = frameworks.findIndex(f => f.id === framework.id);
  if (idx >= 0) {
    frameworks[idx] = { ...frameworks[idx], ...framework };
  } else {
    frameworks.push(framework);
  }
  writeJsonAtomic(FRAMEWORKS_PATH, frameworks);
  return frameworks[idx >= 0 ? idx : frameworks.length - 1];
}

export function upsertActor(actor) {
  const actors = readActors();
  const idx = actors.findIndex(a => a.user_id === actor.user_id);
  if (idx >= 0) {
    actors[idx] = { ...actors[idx], ...actor };
  } else {
    actors.push({ tactics: [], threads: [], interactions: [], ...actor });
  }
  writeJsonAtomic(ACTORS_PATH, actors);
  return actors[idx >= 0 ? idx : actors.length - 1];
}

export function appendInteraction(userId, interaction) {
  const actors = readActors();
  const actor = actors.find(a => a.user_id === userId);
  if (!actor) throw new Error(`Actor ${userId} not found`);
  (actor.interactions ??= []).push(interaction);
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

// --- outcome-loop accessors (append-only; do not touch the functions above) ---

// Lists every interaction still marked outcome="pending" across all actors,
// flattened with the actor identity and the interaction's thread/framework so the
// outcome-loop knows exactly which memory rows are still write-only (never closed).
export function getPendingInteractions() {
  const pending = [];
  for (const actor of readActors()) {
    for (const it of actor.interactions ?? []) {
      if ((it.outcome ?? 'pending') === 'pending') {
        pending.push({
          user_id: actor.user_id,
          name: actor.name,
          thread_id: it.thread_id,
          date: it.date,
          framework: it.framework ?? null,
          their_move: it.their_move,
          our_reply_summary: it.our_reply_summary,
        });
      }
    }
  }
  return pending;
}

// Closes the outcome of an existing pending interaction (matched by actor user_id
// + thread_id) by writing the classified outcome. APPEND-only on the field level:
// only mutates the `outcome` (and an optional `outcome_evidence` note) of an
// interaction that is currently "pending"; never rewrites their_move /
// our_reply_summary / framework, and never re-closes an already-closed one.
export function closeOutcome(userId, threadId, outcome, evidence) {
  const actors = readActors();
  const actor = actors.find(a => a.user_id === userId);
  if (!actor) throw new Error(`Actor ${userId} not found`);
  const it = (actor.interactions ?? []).find(
    x => x.thread_id === threadId && (x.outcome ?? 'pending') === 'pending'
  );
  if (!it) return null;
  it.outcome = outcome;
  if (evidence) it.outcome_evidence = evidence;
  writeJsonAtomic(ACTORS_PATH, actors);
  return { user_id: userId, thread_id: threadId, outcome, evidence: evidence ?? null };
}

// Escritura PRECISA y RE-JUZGABLE de un outcome (el reflex LLM la usa). A diferencia
// de closeOutcome (que solo toca la PRIMERA pending del actor-hilo), esta apunta a UNA
// interacción exacta por (user_id, thread_id, date, needle de their_move) y PUEDE
// sobrescribir un outcome ya escrito — porque el LLM re-juzga el arco completo y a veces
// corrige un veredicto viejo del heurístico de keywords (ej. una concesión que estaba
// en el `their_move` y quedó mal marcada `silent`). Aborta si el match no es único.
export function updateInteractionOutcome(userId, threadId, dateOrNeedle, needle, fields) {
  const actors = readActors();
  const actor = actors.find(a => a.user_id === userId);
  if (!actor) throw new Error(`Actor ${userId} not found`);
  const deburr = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const date = needle === undefined ? null : dateOrNeedle;
  const nd = needle === undefined ? dateOrNeedle : needle;
  const cand = (actor.interactions ?? []).filter(
    x => x.thread_id === threadId && (date ? x.date === date : true) && deburr(x.their_move).includes(deburr(nd))
  );
  if (cand.length !== 1) throw new Error(`match no único (${cand.length}) para ${userId}/${threadId} needle="${nd}"`);
  const it = cand[0];
  if (fields.outcome) {
    // Guard del oro (root fix 2026-06-27): `conceded` es la mina de oro rara del moat.
    // Re-juzgar entre outcomes débiles es libre, pero degradar un conceded a algo más
    // débil debe ser DELIBERADO — sin esto, un verdict equivocado del reflex lo borra en
    // silencio (lo que le pasó a Bowman en el commit 0333190). Rehúsa salvo force:true (Art. 5).
    if (it.outcome === 'conceded' && fields.outcome !== 'conceded' && !fields.force) {
      throw new Error(
        `REHÚSA degradar conceded→${fields.outcome} para ${userId}/${threadId} (needle="${nd}"): ` +
        `conceded es oro raro del moat; pasa force:true en el verdict para sobrescribirlo a propósito (Art. 5)`
      );
    }
    it.outcome = fields.outcome;
  }
  if (fields.evidence) it.outcome_evidence = fields.evidence;
  if (fields.note) it.outcome_note = fields.note;
  writeJsonAtomic(ACTORS_PATH, actors);
  return { user_id: userId, thread_id: threadId, outcome: it.outcome, note: it.outcome_note ?? null };
}

// Efectividad de un framework (el moat): agrega los outcomes de cada interacción
// de todos los actores donde se desplegó ese framework. Devuelve {deploys, ...outcomes}.
export function getFrameworkWinRate(frameworkId) {
  const result = { deploys: 0, conceded: 0, engaged: 0, silent: 0, escalated: 0, goalpost: 0, pending: 0 };
  if (!frameworkId) return result;
  for (const actor of readActors()) {
    for (const interaction of actor.interactions ?? []) {
      if (interaction.framework !== frameworkId) continue;
      result.deploys++;
      const o = interaction.outcome;
      if (o && o !== 'deploys' && Object.prototype.hasOwnProperty.call(result, o)) result[o]++;
    }
  }
  return result;
}

// getDossierSummary + the counter-arsenal surfaced from the actor's tactics in a
// single read, so etapa-3 ([[coagent-advise]]) fetches everything it needs in one
// call. `arsenal` is the deduped (by framework id) union of getFrameworksByTactic
// over the actor's tactics; `arsenalByTactic` keeps the per-tactic breakdown.
export function getDossierSummaryWithArsenal(userId) {
  const summary = getDossierSummary(userId);
  if (!summary) return null;
  const frameworks = readFrameworks();
  const arsenalById = new Map();
  const arsenalByTactic = summary.actor.tactics.map(tacticId => {
    const counters = frameworks.filter(f => (f.related_tactics ?? []).includes(tacticId));
    for (const f of counters) if (!arsenalById.has(f.id)) arsenalById.set(f.id, f);
    return { tactic: tacticId, frameworks: counters.map(f => ({ id: f.id, deploy_as: f.deploy_as, attack_surface: f.attack_surface })) };
  });
  return {
    ...summary,
    arsenal: [...arsenalById.values()].map(f => ({ id: f.id, name: f.name, enables: f.enables, deploy_as: f.deploy_as, attack_surface: f.attack_surface, related_tactics: f.related_tactics })),
    arsenalByTactic,
  };
}

// --- thread registry (thread_id -> group_id/slug) -------------------------------
// La deuda real vive en el moat, NO en las notificaciones de FB (lossy: agrega y
// vence). Para barrer la deuda independiente del embudo (debt-sweep.mjs) hace falta
// reconstruir la openUrl de cada thread, y para eso el group_id. El moat referencia
// thread_ids pero nunca guardó su grupo; este registro es esa tabla faltante. Se
// auto-popula desde thread-extract.mjs en CADA extracción (ya recibe la URL con el
// grupo), así nunca se desactualiza.

function readThreads() {
  try {
    return JSON.parse(readFileSync(THREADS_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function getThreadMeta(threadId) {
  return readThreads()[threadId] ?? null;
}

export function registerThread({ thread_id, group_id, slug }) {
  if (!thread_id || !group_id) return null;
  const threads = readThreads();
  const prev = threads[thread_id] ?? {};
  threads[thread_id] = { thread_id, group_id, slug: slug ?? prev.slug ?? null };
  writeJsonAtomic(THREADS_PATH, threads);
  return threads[thread_id];
}

// Construye la openUrl canónica de un thread desde el registro (null si no está
// registrado todavía — corré thread-extract una vez para auto-registrarlo).
export function threadOpenUrl(threadId) {
  const meta = getThreadMeta(threadId);
  if (!meta?.group_id) return null;
  return `https://www.facebook.com/groups/${meta.group_id}/posts/${threadId}/`;
}

// Threads con deuda ABIERTA (cualquier interacción pending|goalpost), uno por
// thread_id con la lista de actores/outcomes. Esta es la fuente de verdad del
// debt-sweep — NO las notificaciones. A diferencia de getPendingInteractions()
// (solo pending), incluye goalpost (sigue vivo: el oponente movió el poste).
export function getOpenDebtThreads() {
  const OPEN = new Set(['pending', 'goalpost']);
  const byThread = new Map();
  for (const actor of readActors()) {
    for (const it of actor.interactions ?? []) {
      if (!OPEN.has(it.outcome ?? 'pending')) continue;
      const tid = it.thread_id;
      if (!byThread.has(tid)) byThread.set(tid, { thread_id: tid, actors: [] });
      byThread.get(tid).actors.push({
        user_id: actor.user_id,
        name: actor.name,
        outcome: it.outcome ?? 'pending',
        date: it.date,
        framework: it.framework ?? null,
      });
    }
  }
  return [...byThread.values()];
}
