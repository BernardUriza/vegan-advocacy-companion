// SSOT del detector de CIERRE CLONADO (regla 2026-09-28, [[reply-output-style]]).
// Un lote de replies que cierran con la misma frase ("what makes it legitimate for her
// to exist as somebody's property?") se lee como bot, sobre todo cuando varias caen en el
// MISMO hilo con minutos de diferencia y una de ellas contesta al sello "blatant use of
// ai". La pregunta del título se replantea con las palabras de cada interlocutor, nunca
// igual dos veces. Lo consumen style-gate (modo lote, varios archivos) y el hook
// coagent-provenance-gate (el body-file contra los drafts ya consultados y frescos).
//
// El "cierre" es la PREGUNTA final cuando la hay (el movimiento que cierra el reply), y si
// no, las dos últimas oraciones. La medida principal es la subsecuencia común más larga
// (LCS) relativa al cierre más corto, con stopwords incluidas: el molde vive justo en
// "what makes it legitimate for … to exist as … property".

const WH = /^(what|why|how|who|whose|which|where|when)$/;
const AUX = /^(does|do|is|are|can|could|would|should|did)$/;

export function normalizeCloser(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\p{L}\p{N}'\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentencesOf(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function closerOf(text) {
  const sentences = sentencesOf(text);
  if (!sentences.length) return '';
  const tail = sentences.slice(-3);
  const question = [...tail].reverse().find((s) => /\?["')\]]?$/.test(s));
  if (question) {
    const words = question.split(' ');
    const wh = words.findIndex((w) => WH.test(normalizeCloser(w)));
    const at = wh >= 0 ? wh : words.findIndex((w) => AUX.test(normalizeCloser(w)));
    return at > 0 ? words.slice(at).join(' ') : question;
  }
  return sentences.slice(-2).join(' ');
}

const toks = (s) => normalizeCloser(s).split(' ').filter(Boolean);

export function jaccard(a, b) {
  const A = new Set(toks(a)), B = new Set(toks(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

export function longestCommonRun(a, b) {
  const A = toks(a), B = toks(b);
  let best = 0;
  const prev = new Array(B.length + 1).fill(0);
  for (let i = 1; i <= A.length; i++) {
    for (let j = B.length; j >= 1; j--) {
      prev[j] = A[i - 1] === B[j - 1] ? prev[j - 1] + 1 : 0;
      if (prev[j] > best) best = prev[j];
    }
  }
  return best;
}

export function lcsRatio(a, b) {
  const A = toks(a), B = toks(b);
  if (!A.length || !B.length) return 0;
  const dp = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = 1; i <= A.length; i++) {
    for (let j = 1; j <= B.length; j++) {
      dp[i][j] = A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[A.length][B.length] / Math.min(A.length, B.length);
}

export const CLONE_HARD = { lcs: 0.7, run: 8 };
export const CLONE_SOFT = { lcs: 0.45, run: 5 };

export function compareClosers(a, b) {
  const lcs = +lcsRatio(a, b).toFixed(2);
  const run = longestCommonRun(a, b);
  const hard = lcs >= CLONE_HARD.lcs || run >= CLONE_HARD.run;
  const soft = !hard && (lcs >= CLONE_SOFT.lcs || run >= CLONE_SOFT.run);
  return { lcs, run, jaccard: +jaccard(a, b).toFixed(2), hard, soft };
}

// drafts: [{ name, text }] → { name:'closerClone', hard, soft, count, pairs, closers }
export function detectCloserClones(drafts) {
  const items = drafts.map((d) => ({ name: d.name, closer: closerOf(d.text) }));
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let k = i + 1; k < items.length; k++) {
      const c = compareClosers(items[i].closer, items[k].closer);
      if (c.hard || c.soft) pairs.push({ a: items[i].name, b: items[k].name, closerA: items[i].closer, closerB: items[k].closer, ...c });
    }
  }
  const hard = pairs.some((p) => p.hard);
  return { name: 'closerClone', hard, soft: !hard && pairs.some((p) => p.soft), count: pairs.length, pairs, closers: items };
}
