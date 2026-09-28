// Identidad del hilo donde quedó el composer, independiente de la URL de la tab.
// FB puede abrir el post como diálogo sobre OTRO grupo y reescribir location.href
// (visto 2026-09-27 en VEGANnoyance: /groups/894315013991654/permalink/28496461986683585/).
// La verdad es el diálogo que contiene el composer, no la barra de direcciones.

const POST_RE = /\/groups\/([^/?#]+)\/(?:posts|permalink)\/(\d+)/;
const QUERY_POST_RE = /[?&](?:post_id|multi_permalinks|story_fbid)=(\d+)/;

export function threadIdsFromUrl(url) {
  if (!url) return { groupId: null, postId: null };
  const m = String(url).match(POST_RE);
  if (m) return { groupId: m[1], postId: m[2] };
  const g = String(url).match(/\/groups\/([^/?#]+)/);
  const q = String(url).match(QUERY_POST_RE);
  return { groupId: g ? g[1] : null, postId: q ? q[1] : null };
}

export function judgeThreadIdentity({ expectedUrl, pageUrl, dialogLinks = [] }) {
  const expected = threadIdsFromUrl(expectedUrl);
  const page = threadIdsFromUrl(pageUrl);
  const seen = dialogLinks.map(threadIdsFromUrl).filter((x) => x.postId);
  const sameThread = seen.some((x) => x.postId === expected.postId && x.groupId === expected.groupId);
  const urlRewritten = page.postId !== expected.postId || page.groupId !== expected.groupId;
  const foreign = [...new Set(seen.filter((x) => x.postId !== expected.postId).map((x) => `${x.groupId}/${x.postId}`))];
  return { expected, page, urlRewritten, sameThread, dialogPosts: seen.length, foreign };
}
