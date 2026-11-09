// Autor que apaga los comentarios de su post queda vetado: no se vuelve a comentar en un post suyo.
// Lógica pura; el store vive en db.mjs (data/post-author-vetoes.json). Regla: notification-agrupation.

export const VETO_REASONS = ['comments_off', 'manual'];

const COMMENTS_OFF_RE = /^(.{1,80}?) turned off commenting for this post\.?$/;

export function parseCommentsOff(pageText) {
  for (const raw of String(pageText || '').split('\n')) {
    const m = raw.replace(/ /g, ' ').trim().match(COMMENTS_OFF_RE);
    if (m) return { off: true, by: m[1].trim(), notice: m[0] };
  }
  return { off: false, by: null, notice: null };
}

const sameName = (a, b) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export function findVeto(vetoes, { user_id = null, name = null } = {}) {
  return (vetoes || []).find((v) => (user_id && v.user_id && String(v.user_id) === String(user_id)) || sameName(v.name, name)) ?? null;
}

export function upsertVeto(vetoes, { user_id = null, name, reason = 'comments_off', thread_id = null, since, evidence = null }) {
  if (!name) throw new Error('veto sin nombre de autor');
  if (!VETO_REASONS.includes(reason)) throw new Error(`reason "${reason}" fuera de ${VETO_REASONS.join(' | ')}`);
  const list = [...(vetoes || [])];
  const prev = findVeto(list, { user_id, name });
  const threads = [...new Set([...(prev?.threads ?? []), ...(thread_id ? [String(thread_id)] : [])])];
  const next = { user_id: prev?.user_id ?? (user_id ? String(user_id) : null), name: prev?.name ?? name, reason: prev?.reason ?? reason, since: prev?.since ?? since, threads, evidence: prev?.evidence ?? evidence };
  if (prev) list[list.indexOf(prev)] = next; else list.push(next);
  return { list, entry: next, created: !prev };
}

export function vetoProblems(vetoes) {
  const errors = [];
  for (const v of vetoes || []) {
    if (!v.name) errors.push('veto sin name');
    if (!VETO_REASONS.includes(v.reason)) errors.push(`veto "${v.name}" reason="${v.reason}" fuera de ${VETO_REASONS.join(' | ')}`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.since || '')) errors.push(`veto "${v.name}" sin since YYYY-MM-DD`);
  }
  return errors;
}
