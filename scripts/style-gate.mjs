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
//   node style-gate.mjs a.txt b.txt c.txt                 # LOTE: además caza cierres clonados
//
// Exit code: 1 si hay flags DURAS (hard:true) en cualquier draft o entre drafts
// (closerClone), 0 si limpio. Las flags blandas (wordCount fuera de rango, tricolon,
// staccato moderado, cierre parecido) avisan pero no fallan.

import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import { detectWelfaristAxis } from './welfarist-axis.mjs';
import { detectBiocentricAxis } from './biocentric-axis.mjs';
import { detectCloserClones } from './closer-clone.mjs';
import { detectScopeDenialRepeats } from './scope-denial.mjs';

// kill-phrases literales de la kill-list (case-insensitive)
const OPENERS = new Set(['no', 'yes', 'sure', 'look', 'well', 'okay', 'ok', 'right', 'fine', 'fair', 'granted', 'agreed', 'true', 'exactly', 'honestly', 'again', 'so', 'and', 'but', 'still', 'nope', 'yeah', 'mate']);
// Sin --name, vocativo = nombre de alguien del moat: "Les," bloquea, "Thanks," y "Phones," no.
let actorNames;
function knownActorNames() {
  if (actorNames !== undefined) return actorNames;
  try {
    const raw = JSON.parse(readFileSync(new URL('../data/actors.json', import.meta.url), 'utf8'));
    actorNames = new Set();
    for (const actor of Array.isArray(raw) ? raw : raw.actors || []) {
      const full = (actor.name || '').trim().toLowerCase();
      if (!full) continue;
      actorNames.add(full);
      actorNames.add(full.split(/\s+/)[0]);
    }
  } catch {
    actorNames = null;
  }
  return actorNames;
}

const ACRONYMS =new Set(['USDA', 'NSW', 'NASA', 'CDC', 'FAO', 'EPA', 'NHS', 'UNAM', 'IPCC', 'USA', 'OECD', 'DEFRA', 'RSPCA', 'PETA', 'WHO']);

const KILL_PHRASES = [
  "Let's unpack",
  "It's worth noting",
  'At the end of the day',
  "Here's the thing",
  "that's a label, not an argument",
  'a label, not an argument',
  'is standing in for the answer',
  // frases estériles/diplomáticas (regla 2026-09-27: registro filo profano, nada curricular)
  'I would respectfully disagree',
  'respectfully disagree',
  'raises an interesting point',
  'argument may overlook',
  'with all due respect',
  'I appreciate your perspective',
  'I hear you',
];

// El registro filo es profano por default (2026-09-27); sin brazo, un draft con cero groserías avisa.
// Con `voice` (el brazo que sorteó framework-pick, voice_trial 2026-10-05) el check se vuelve contrato:
// profano exige el mínimo del trial, limpio exige cero. El juicio de registro (filo vs compasivo) sigue
// siendo del LLM; por eso sin brazo nunca es hard.
const PROFANITY = /\b(fuck(ing|ed|s)?|fuck-all|bullshit|damn|hell|no shit|what the fuck|crap|ass)\b/gi;
export function countProfanity(text) {
  return (text.match(PROFANITY) || []).length;
}

export function analyzeDraft(text, { name = null, file = null, voice = null, profaneMin = 2 } = {}) {
  const PROFANE_MIN = profaneMin;
  const lines = text.split('\n');
  const nonEmptyLines = lines.map((l) => l.trim()).filter(Boolean);
  const words = (text.match(/[\p{L}\p{N}']+/gu) || []);
  const wordCount = words.length;

  function checkProfanity() {
    const hits = text.match(PROFANITY) || [];
    const n = hits.length;
    const hard = voice === 'limpio' && n > 0;
    const soft = voice === 'profano' ? n < PROFANE_MIN : voice === 'limpio' ? false : n === 0;
    return { name: 'profanityCount', hard, soft, voice, count: n, evidence: [...new Set(hits.map((h) => h.toLowerCase()))].slice(0, 6) };
  }

  function checkKillPhrases() {
    const hits = [];
    const lower = text.toLowerCase();
    for (const p of KILL_PHRASES) {
      const re = new RegExp('(?<![\\w’\'])' + p.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w’\'])', 'g');
      let m;
      while ((m = re.exec(lower)) !== null) {
        hits.push({ phrase: p, index: m.index, context: text.slice(m.index, m.index + p.length + 24).replace(/\n/g, ' ') });
      }
    }
    return { name: 'killPhrases', hard: hits.length > 0, count: hits.length, evidence: hits };
  }

  // staccato: muchas líneas no vacías que son UNA sola oración terminada en . ! ?
  function checkStaccato() {
    let soloSentenceLines = 0;
    const offenders = [];
    for (const l of nonEmptyLines) {
      const internalBreaks = (l.match(/[.!?]\s+\S/g) || []).length;
      const endsSentence = /[.!?]["')\]]?$/.test(l);
      if (endsSentence && internalBreaks === 0 && l.split(/\s+/).length >= 3) {
        soloSentenceLines++;
        if (offenders.length < 6) offenders.push(l.slice(0, 70));
      }
    }
    const total = nonEmptyLines.length || 1;
    const ratio = +(soloSentenceLines / total).toFixed(2);
    const hard = ratio >= 0.6 && soloSentenceLines >= 4;
    return { name: 'staccato', hard, staccatoRatio: ratio, soloSentenceLines, totalNonEmptyLines: total, evidence: offenders };
  }

  // abrir el cuerpo con el nombre del destinatario: "Scott," / "Scott James," / "Les M,"
  function checkOpensWithName() {
    const firstLine = (nonEmptyLines[0] || '').trim();
    const vocativeMatch = firstLine.match(/^([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]*){0,2}),/);
    let hard = false;
    let matched = null;
    if (vocativeMatch) {
      matched = vocativeMatch[1];
      if (name) {
        const n = name.toLowerCase();
        const m = matched.toLowerCase();
        hard = m === n || n.startsWith(m) || m.startsWith(n.split(/\s+/)[0]);
      } else {
        const m = matched.toLowerCase();
        const known = knownActorNames();
        hard = !OPENERS.has(m) && (known ? known.has(m) || known.has(m.split(/\s+/)[0]) : true);
      }
    }
    return { name: 'opensWithName', hard, vocative: matched, providedName: name, firstLine: firstLine.slice(0, 80) };
  }

  function checkWordCount() {
    const low = wordCount < 150;
    const high = wordCount > 350;
    return { name: 'wordCount', hard: false, soft: low || high, wordCount, range: '150-350', flag: low ? 'too_short' : high ? 'too_long' : 'ok' };
  }

  // tricolon "a, b, and c": soft con 1 (humano), HARD desde 2 (molde, kill-list). Estuvo
  // hard:false hardcodeado hasta 2026-08-07 y el check era decorativo.
  function checkTricolon() {
    const item = "[\\p{L}'’-]+(?:\\s+[\\p{L}'’-]+){0,2}";
    const re = new RegExp(`${item},\\s+${item},\\s+(?:and|or)\\s+${item}`, 'giu');
    const hits = [];
    let m;
    while ((m = re.exec(text)) !== null) hits.push(m[0].replace(/\s+/g, ' '));
    const repeated = hits.length >= 2;
    return { name: 'tricolon', hard: repeated, soft: hits.length === 1, repeated, count: hits.length, evidence: hits.slice(0, 6) };
  }

  // negar-luego-afirmar como pivote (regla dura 2026-06-30): ancla en la CÓPULA con sujeto
  // the/it/that, para no cazar la concesión-y-redirección ni el reframe-the-ask.
  function checkNegateThenAffirm() {
    const hits = [];
    const reCopula = /\b(?:the\s+[\p{L}'’-]+|it|that|this)\s+is\s+not\s+[\p{L}][\s\S]{1,110}?\b(?:the\s+[\p{L}'’-]+|it|that|this)\s+is\b(?!\s+not\b)/giu;
    const reContraction = /\bis\s*n[’']t\b[^.!?]{2,70}?[—,-]\s*(?:it|that|the)[’']?s\b/giu;
    // variantes que entregó el coagent el 2026-10-03 y pasaban: "He is not just X. He is Y", "It is not. It is Y", "It does not tell me X. It tells me Y"
    const rePronoun = /\b(he|she|they)\s+(?:is|are)\s+not\s+[\p{L}][\s\S]{1,110}?[.!?]\s+\1\s+(?:is|are)\b(?!\s+not\b)/giu;
    const reBare = /\b(it|that)\s+is\s+not[.!?]\s+\1\s+is\b(?!\s+not\b)/giu;
    const reDoSupport = /\b(it|that|this|he|she)\s+does\s+not\s+([\p{L}]+)\b[^.!?]{0,110}[.!?]\s+\1\s+\2s\b/giu;
    let m;
    for (const re of [reCopula, reContraction, rePronoun, reBare, reDoSupport]) {
      while ((m = re.exec(text)) !== null) hits.push(m[0].replace(/\s+/g, ' ').slice(0, 90));
    }
    const soft = [];
    const reAppos = /\b([\p{L}’'-]+),\s+not\s+(?!(?:toward|towards|for|to|in|into|on|of|with|within|at|by|from|the|a|an|as|about)\b)([\p{L}’'-]+)\b/giu;
    while ((m = reAppos.exec(text)) !== null) soft.push(m[0].replace(/\s+/g, ' '));
    return { name: 'negateThenAffirm', hard: hits.length > 0, soft: hits.length === 0 && soft.length > 0, count: hits.length, evidence: hits.slice(0, 4), softEvidence: soft.slice(0, 4) };
  }

  // Copiado literal de ChatGPT: la coma queda DENTRO de la comilla ("human food,"); Bernard la quiere fuera ("human food",).
  function checkCommaInsideQuote() {
    const hits = [...text.matchAll(/(\S{0,20}),(["”])(?=\s|$)/g)].map((m) => `${m[1]},${m[2]}`);
    return { name: 'commaInsideQuote', hard: hits.length > 0, count: hits.length, evidence: hits.slice(0, 4) };
  }

  function checkEmojiOrMarkdown() {
    const emojis = [...(text.match(/\p{Extended_Pictographic}/gu) || [])];
    const bold = [...(text.match(/\*\*[^*\n]+\*\*/g) || []), ...(text.match(/__[^_\n]+__/g) || [])];
    const shoutWords = [...(text.match(/\b[A-Z]{4,}\b/g) || [])].filter((w) => !ACRONYMS.has(w));
    const headings = [...(text.match(/^#{1,6}\s+.+$/gm) || [])];
    const hard = emojis.length > 0 || bold.length > 0 || shoutWords.length > 0 || headings.length > 0;
    return { name: 'emojiOrMarkdown', hard, emojis, bold, shoutWords, headings };
  }

  const checks = [
    checkKillPhrases(),
    checkStaccato(),
    checkOpensWithName(),
    checkWordCount(),
    checkTricolon(),
    checkEmojiOrMarkdown(),
    detectWelfaristAxis(text, { lang: 'en', positional: true, quantumHardAt: 2 }),
    detectBiocentricAxis(text, { lang: 'en' }),
    checkNegateThenAffirm(),
    checkProfanity(),
    checkCommaInsideQuote(),
  ];
  const hardFlags = checks.filter((c) => c.hard).map((c) => c.name);
  const softFlags = checks.filter((c) => !c.hard && c.soft).map((c) => c.name);
  return { file, clean: hardFlags.length === 0, wordCount, hardFlags, softFlags, checks };
}

function printDraft(result) {
  const { file, clean, wordCount, checks, softFlags } = result;
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
  console.log(`[${checks[8].hard ? 'X' : checks[8].soft ? '~' : '.'}] negateThenAffirm  ${checks[8].count ? 'pivote copular: ' + checks[8].evidence.map((h) => `"${h}"`).join(' | ') : checks[8].soft ? 'apositivo: ' + checks[8].softEvidence.join(' | ') : 'afirmativo (ok)'}`);
  const prof = checks.find((c) => c.name === 'profanityCount');
  const profNote = prof.voice === 'limpio' ? (prof.hard ? 'brazo LIMPIO con groserías → quítalas' : 'brazo limpio, cero (ok)')
    : prof.voice === 'profano' ? (prof.soft ? 'brazo PROFANO, faltan: pide el mínimo del trial' : 'brazo profano (ok)')
    : prof.count ? prof.evidence.join(', ') : 'cero: si el registro es filo, falta la voz profana';
  console.log(`[${prof.hard ? 'X' : prof.soft ? '~' : '.'}] profanityCount    ${prof.count} (${profNote})`);
  console.log(`[${mark(checks[10].hard)}] commaInsideQuote  ${checks[10].count ? checks[10].evidence.map((h) => `${h} → ${h.replace(/,(["”])$/, '$1,')}`).join(' | ') : 'coma fuera de la comilla (ok)'}`);
  if (softFlags.length) console.log(`\nflags blandas (avisan, no fallan): ${softFlags.join(', ')}`);
}

function printBatch(batch) {
  console.log(`\nstyle-gate · LOTE (${batch.closers.length} drafts)`);
  console.log(`[${batch.hard ? 'X' : batch.soft ? '~' : '.'}] closerClone       ${batch.count ? `${batch.count} par(es) con cierre parecido` : 'cada reply cierra con sus propias palabras (ok)'}`);
  for (const p of batch.pairs) {
    console.log(`    ${p.hard ? 'X' : '~'} ${p.a} ↔ ${p.b}  lcs=${p.lcs} run=${p.run}`);
    console.log(`        «${p.closerA.slice(0, 100)}»`);
    console.log(`        «${p.closerB.slice(0, 100)}»`);
  }
  if (batch.hard) console.log('  → el mismo cierre en varias replies se lee como bot ([[reply-output-style]]); replantea la pregunta con las palabras de cada interlocutor.');
  const scope = batch.scope;
  console.log(`[${scope.hard ? 'X' : scope.soft ? '~' : '.'}] scopeDenialRepeat ${scope.count ? `${scope.count} par(es) con el mismo molde de concesión` : scope.soft ? `${scope.draftsWithMove} drafts conceden-y-niegan con verbos distintos (ok, vigila la fórmula)` : 'la concesión-y-redirección no se repite (ok)'}`);
  for (const p of scope.pairs) {
    console.log(`    X ${p.a} ↔ ${p.b}  molde=${p.template}`);
    console.log(`        «${p.snippetA.slice(0, 110)}»`);
    console.log(`        «${p.snippetB.slice(0, 110)}»`);
  }
  if (scope.hard) console.log('  → conceder el hecho y negar la conclusión es la jugada; el MISMO par de verbos en dos replies del lote es fórmula. Cambia la entrada de una.');
}

async function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const nameIdx = args.indexOf('--name');
  const name = nameIdx >= 0 ? args[nameIdx + 1] : null;
  const voiceIdx = args.indexOf('--voice');
  const voice = voiceIdx >= 0 ? args[voiceIdx + 1] : null;
  if (voice && !['profano', 'limpio'].includes(voice)) {
    console.error(`--voice "${voice}": el brazo es profano | limpio (lo da framework-pick)`);
    process.exit(2);
  }
  const files = args.filter((a, i) => !a.startsWith('--') && !(nameIdx >= 0 && i === nameIdx + 1) && !(voiceIdx >= 0 && i === voiceIdx + 1));
  if (!files.length) {
    console.error('uso: node style-gate.mjs <draft.txt> [<draft2.txt> ...] [--json] [--name "Nombre"] [--voice profano|limpio]');
    process.exit(2);
  }
  const drafts = files.map((file) => {
    try {
      return { file, text: readFileSync(file, 'utf8') };
    } catch (e) {
      console.error(`no pude leer "${file}": ${e.message}`);
      process.exit(2);
    }
  });
  const profaneMin = voice ? (await import('./db.mjs')).readVocab().rotation.voice_trial.value.min_profanity : 2;
  const results = drafts.map((d) => analyzeDraft(d.text, { name, file: d.file, voice, profaneMin }));
  const named = drafts.map((d) => ({ name: d.file, text: d.text }));
  const batch = drafts.length >= 2 ? { ...detectCloserClones(named), scope: detectScopeDenialRepeats(named) } : null;
  const clean = results.every((r) => r.clean) && !(batch && (batch.hard || batch.scope.hard));

  if (asJson) {
    console.log(JSON.stringify(results.length === 1 && !batch ? results[0] : { clean, drafts: results, batch }, null, 2));
  } else {
    results.forEach((r, i) => { if (i) console.log(''); printDraft(r); });
    if (batch) printBatch(batch);
  }
  process.exit(clean ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
