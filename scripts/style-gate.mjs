// Etapa 4, paso 0 (mecánica) — pre-filtro DETERMINISTA de un borrador contra la
// kill-list de [[reply-output-style]]. NO reemplaza el juicio LLM de tono ("vuelve
// al hueso", registro compasivo/mordaz, performar tres metas): lo PRE-FILTRA. Caza
// lo que se puede cazar con regex —kill-phrases literales, staccato, abrir-con-nombre,
// largo, tricolon, emojis/markdown/grito— para que el juicio caro arranque ya limpio
// de los tells obvios. Ver scripts/STYLE-GATE.md.
//
// Uso:
//   node style-gate.mjs <draft.txt>                       # tabla humana
//   node style-gate.mjs <draft.txt> --json                # JSON
//   node style-gate.mjs <draft.txt> --name "Scott James"  # flag si abre con ese nombre
//
// Exit code: 1 si hay flags DURAS (hard:true), 0 si limpio. Las flags blandas
// (wordCount fuera de rango, tricolon, staccato moderado) avisan pero no fallan.

import { readFileSync } from 'fs';
import { detectWelfaristAxis } from './welfarist-axis.mjs';
import { detectBiocentricAxis } from './biocentric-axis.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));
const nameIdx = args.indexOf('--name');
const name = nameIdx >= 0 ? args[nameIdx + 1] : null;

if (!file) {
  console.error('uso: node style-gate.mjs <draft.txt> [--json] [--name "Nombre"]');
  process.exit(2);
}

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`no pude leer "${file}": ${e.message}`);
  process.exit(2);
}

// kill-phrases literales de la kill-list (case-insensitive)
const KILL_PHRASES = [
  "Let's unpack",
  "It's worth noting",
  'At the end of the day',
  "Here's the thing",
  "that's a label, not an argument",
  'a label, not an argument',
  'is standing in for the answer',
];

// ------- helpers de segmentación -------
const lines = text.split('\n');
const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean);
// oraciones: corte por . ! ? seguido de espacio/fin (aproximación pragmática)
const sentences = text
  .replace(/\n+/g, ' ')
  .split(/(?<=[.!?])\s+/)
  .map((s) => s.trim())
  .filter(Boolean);
const words = (text.match(/[\p{L}\p{N}']+/gu) || []);
const wordCount = words.length;

// ------- check: kill phrases -------
function checkKillPhrases() {
  const hits = [];
  const lower = text.toLowerCase();
  for (const p of KILL_PHRASES) {
    let from = 0;
    const needle = p.toLowerCase();
    while (true) {
      const at = lower.indexOf(needle, from);
      if (at < 0) break;
      hits.push({ phrase: p, index: at, context: text.slice(at, at + p.length + 24).replace(/\n/g, ' ') });
      from = at + needle.length;
    }
  }
  return { name: 'killPhrases', hard: hits.length > 0, count: hits.length, evidence: hits };
}

// ------- check: staccato (cada frase en su propio renglón) -------
// señal: muchas líneas no vacías que son UNA sola oración terminada en . ! ?
function checkStaccato() {
  let soloSentenceLines = 0;
  const offenders = [];
  for (const l of nonEmptyLines) {
    // ¿la línea es exactamente una oración (un solo terminador final, sin internos)?
    const internalBreaks = (l.match(/[.!?]\s+\S/g) || []).length;
    const endsSentence = /[.!?]["')\]]?$/.test(l);
    if (endsSentence && internalBreaks === 0 && l.split(/\s+/).length >= 3) {
      soloSentenceLines++;
      if (offenders.length < 6) offenders.push(l.slice(0, 70));
    }
  }
  const total = nonEmptyLines.length || 1;
  const ratio = +(soloSentenceLines / total).toFixed(2);
  // hard cuando la mayoría de las líneas son frases sueltas Y hay varias (no un draft de 1-2 líneas)
  const hard = ratio >= 0.6 && soloSentenceLines >= 4;
  return {
    name: 'staccato',
    hard,
    staccatoRatio: ratio,
    soloSentenceLines,
    totalNonEmptyLines: total,
    evidence: offenders,
  };
}

// ------- check: abrir el cuerpo con el nombre del destinatario -------
function checkOpensWithName() {
  const firstLine = (nonEmptyLines[0] || '').trim();
  // primeras 1-3 palabras seguidas de coma (vocativo): "Scott," / "Scott James," / "Les M,"
  const vocativeMatch = firstLine.match(/^([A-Z][\w'’.-]+(?:\s+[A-Z][\w'’.-]+){0,2}),/);
  let hard = false;
  let matched = null;
  if (vocativeMatch) {
    matched = vocativeMatch[1];
    if (name) {
      // flag si el vocativo coincide con (o empieza por) el nombre dado
      const n = name.toLowerCase();
      const m = matched.toLowerCase();
      hard = m === n || n.startsWith(m) || m.startsWith(n.split(/\s+/)[0]);
    } else {
      // sin --name: cualquier vocativo Nombre, al inicio es sospechoso
      hard = true;
    }
  }
  return { name: 'opensWithName', hard, vocative: matched, providedName: name, firstLine: firstLine.slice(0, 80) };
}

// ------- check: word count fuera de 150-350 -------
function checkWordCount() {
  const low = wordCount < 150;
  const high = wordCount > 350;
  return {
    name: 'wordCount',
    hard: false,
    soft: low || high,
    wordCount,
    range: '150-350',
    flag: low ? 'too_short' : high ? 'too_long' : 'ok',
  };
}

// ------- check: tricolon repetido ("X, Y, and Z") -------
function checkTricolon() {
  // patrón de lista de tres con "and"/"or" antes del último: "a, b, and c".
  // cada ítem puede traer 1-3 palabras (artículos/adjetivos): "the supplements, the
  // priorities, and the traditions" → tricolon.
  const item = "[\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+){0,2}";
  const re = new RegExp(`${item},\\s+${item},\\s+(?:and|or)\\s+${item}`, 'giu');
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    hits.push(m[0].replace(/\s+/g, ' '));
  }
  // soft siempre; hard solo si se repite (>=2) — un molde, no un uso aislado
  return { name: 'tricolon', hard: false, soft: hits.length >= 1, repeated: hits.length >= 2, count: hits.length, evidence: hits.slice(0, 6) };
}

// ------- check: emojis / **bold** / MAYÚSCULAS-grito -------
function checkEmojiOrMarkdown() {
  const emojiRe = /\p{Extended_Pictographic}/gu;
  const emojis = [...(text.match(emojiRe) || [])];
  const bold = [...(text.match(/\*\*[^*\n]+\*\*/g) || []), ...(text.match(/__[^_\n]+__/g) || [])];
  // grito: palabra de 3+ letras toda en mayúsculas (permite acrónimos cortos B12, CNV, IFS de <=3)
  const shoutWords = [...(text.match(/\b[A-Z]{4,}\b/g) || [])];
  const headings = [...(text.match(/^#{1,6}\s+.+$/gm) || [])];
  const hard = emojis.length > 0 || bold.length > 0 || shoutWords.length > 0 || headings.length > 0;
  return {
    name: 'emojiOrMarkdown',
    hard,
    emojis,
    bold,
    shoutWords,
    headings,
  };
}

// ------- check: framing BIENESTARISTA como eje (kill-list de [[abolitionist-framing]]) -------
// El detector vive en welfarist-axis.mjs (SSOT, compartido con seed-gate de etapa 3).
// Etapa 4 (draft inglés): la posición importa (el eje aterriza en apertura/cierre) y
// quantum>=2 es eje. Política idéntica a la histórica.
const checks = [
  checkKillPhrases(),
  checkStaccato(),
  checkOpensWithName(),
  checkWordCount(),
  checkTricolon(),
  checkEmojiOrMarkdown(),
  detectWelfaristAxis(text, { lang: 'en', positional: true, quantumHardAt: 2 }),
  detectBiocentricAxis(text, { lang: 'en' }),
];

const hardFlags = checks.filter((c) => c.hard).map((c) => c.name);
const softFlags = checks.filter((c) => !c.hard && c.soft).map((c) => c.name);
const clean = hardFlags.length === 0;

const result = {
  file,
  clean,
  wordCount,
  hardFlags,
  softFlags,
  checks,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const mark = (b) => (b ? 'X' : '.');
  console.log(`style-gate · ${file}`);
  console.log(`palabras: ${wordCount}  ·  ${clean ? 'LIMPIO (pasa al juicio LLM)' : 'FLAGS DURAS → reformular antes del juicio'}`);
  console.log('');
  console.log(`[${mark(checks[0].hard)}] killPhrases       ${checks[0].count} match(es)${checks[0].count ? ': ' + checks[0].evidence.map((h) => `"${h.phrase}"`).join(', ') : ''}`);
  console.log(`[${mark(checks[1].hard)}] staccato          ratio ${checks[1].staccatoRatio} (${checks[1].soloSentenceLines}/${checks[1].totalNonEmptyLines} líneas frase-suelta)`);
  console.log(`[${mark(checks[2].hard)}] opensWithName     ${checks[2].vocative ? `vocativo "${checks[2].vocative}"` : 'sin vocativo inicial'}`);
  console.log(`[${checks[3].soft ? '~' : '.'}] wordCount         ${checks[3].wordCount} (${checks[3].flag})`);
  console.log(`[${checks[4].repeated ? 'X' : checks[4].soft ? '~' : '.'}] tricolon          ${checks[4].count} ocurrencia(s)${checks[4].count ? ': ' + checks[4].evidence.join(' | ') : ''}`);
  console.log(`[${mark(checks[5].hard)}] emojiOrMarkdown   emojis:${checks[5].emojis.length} bold:${checks[5].bold.length} grito:${checks[5].shoutWords.length} headings:${checks[5].headings.length}`);
  console.log(`[${mark(checks[6].hard)}] welfaristAxis     ${checks[6].evidence.length ? checks[6].evidence.join(' | ') : 'eje no-bienestarista (ok)'}`);
  console.log(`[${mark(checks[7].hard)}] biocentricAxis    ${checks[7].evidence.length ? checks[7].evidence.join(' | ') : 'eje sensocéntrico (ok)'}`);
  if (softFlags.length) console.log(`\nflags blandas (avisan, no fallan): ${softFlags.join(', ')}`);
}

process.exit(clean ? 0 : 1);
