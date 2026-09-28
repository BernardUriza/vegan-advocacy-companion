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

// La URL de una notificación (?comment_id=…&reply_comment_id=…) hace que FB pinte el post
// ANCLADO al comentario y deje raíces sin cargar, sin botón "View more comments" que las
// prometa (2026-09-28: el raíz de Frank Teuton, 5h, no salió con `complete:true`; la URL
// limpia del post pintó las 8 raíces). Para EXTRAER se navega siempre a la URL canónica;
// el comment_id sigue sirviendo para localizar el target (comment-prepare) y para el moat.
export function canonicalPostUrl(url) {
  const { groupId, postId } = threadIdsFromUrl(url);
  if (!groupId || !postId) return url;
  return `https://www.facebook.com/groups/${groupId}/posts/${postId}/`;
}
