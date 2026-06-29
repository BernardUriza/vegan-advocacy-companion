// Etapa 3, PASO 0 (mecánica) — gate DETERMINISTA del MASTER PROMPT antes de seedearlo
// al coagent. El root fix de la humillación 2026-06-21: el welfarismo NO se decide en
// el draft (etapa 4), se decide en la JUGADA (etapa 3). Anna ganó porque el master
// prompt de las 13:01 le ordenó al coagent una jugada bienestarista palabra por palabra
// ("el daño innecesario importa en todos lados", "rol del daño: subproducto incidental
// vs propósito") y SIN el guardrail abolicionista que la regla manda. El cañón disparó
// la munición envenenada. Este gate truena ANTES de seedear.
//
// Qué caza (dos flags duras):
//   1. welfaristInPlay — léxico bienestarista en la JUGADA (fuera del guardrail y de las
//      citas verbatim del oponente). El detector vive en welfarist-axis.mjs (SSOT,
//      compartido con style-gate de etapa 4), corrido en español.
//   2. guardrailMissing / guardrailHollow — el master prompt DEBE traer el bloque
//      guardrail abolicionista delimitado; si falta o está hueco (no nombra el eje
//      propiedad/esclavitud contra el daño prohibido), es la defensa que el 21-jun no
//      se cumplió.
//
// Qué EXCLUYE antes de detectar (para no dar falsos positivos):
//   - El bloque guardrail delimitado: <!-- GUARDRAIL-ABOLICIONISTA --> ... <!-- /... -->
//     (ahí el léxico "harm/daño" es legítimo: se nombra para PROHIBIRLO).
//   - Las citas verbatim del oponente (líneas blockquote que empiezan con ">"): el
//     comentario del rival cita "harm" muchas veces y es contexto, no la jugada.
//
// Uso:
//   node seed-gate.mjs <master-prompt.md>          # tabla humana
//   node seed-gate.mjs <master-prompt.md> --json   # JSON
//
// Exit code: 1 si hay flags duras (no seedear, reformular la jugada); 0 si limpio.

import { readFileSync } from 'fs';
import { detectWelfaristAxis } from './welfarist-axis.mjs';
import { detectBiocentricAxis } from './biocentric-axis.mjs';

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

if (!file) {
  console.error('uso: node seed-gate.mjs <master-prompt.md> [--json]');
  process.exit(2);
}

let text;
try {
  text = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`no pude leer "${file}": ${e.message}`);
  process.exit(2);
}

const OPEN = /<!--\s*GUARDRAIL-ABOLICIONISTA\s*-->/i;
const CLOSE = /<!--\s*\/\s*GUARDRAIL-ABOLICIONISTA\s*-->/i;

// ------- 1. localizar y extraer el bloque guardrail -------
function extractGuardrail() {
  const om = text.match(OPEN);
  const cm = text.match(CLOSE);
  if (!om || !cm || cm.index < om.index) {
    return { present: false, body: '', rest: text };
  }
  const start = om.index + om[0].length;
  const end = cm.index;
  const body = text.slice(start, end);
  const rest = text.slice(0, om.index) + text.slice(cm.index + cm[0].length);
  return { present: true, body, rest };
}

// ¿el guardrail nombra el eje correcto (propiedad/esclavitud/abolicionista) contra el
// léxico prohibido (harm/daño)? Un bloque vacío o de relleno no cuenta.
function guardrailIsReal(body) {
  const hasAxis = /\b(esclav|propiedad|abolicionista|sujeto\s+pose[íi]do)/i.test(body);
  const namesForbidden = /\b(harm|da(?:ñ|n)o)\b/i.test(body);
  return hasAxis && namesForbidden;
}

// ------- 2. armar el texto-JUGADA: quitar guardrail + citas verbatim (>) -------
function stripQuotes(s) {
  return s
    .split('\n')
    .filter((l) => !/^\s*>/.test(l))
    .join('\n');
}

const guard = extractGuardrail();
const playText = stripQuotes(guard.rest);

// ------- 3. detectar welfarismo en la jugada (español, no-posicional, quantum blando) -------
const wa = detectWelfaristAxis(playText, { lang: 'es', positional: false, quantumHardAt: Infinity });
const ba = detectBiocentricAxis(playText, { lang: 'es' });

// ------- flags -------
const guardrailMissing = !guard.present;
const guardrailHollow = guard.present && !guardrailIsReal(guard.body);
const welfaristInPlay = wa.strongHits.length > 0;
const biocentricInPlay = ba.strongHits.length > 0;

const hardFlags = [];
if (welfaristInPlay) hardFlags.push('welfaristInPlay');
if (biocentricInPlay) hardFlags.push('biocentricInPlay');
if (guardrailMissing) hardFlags.push('guardrailMissing');
if (guardrailHollow) hardFlags.push('guardrailHollow');

const clean = hardFlags.length === 0;
const softNote = wa.quantumCount >= 3 ? `quantum x${wa.quantumCount} en la jugada (revisar que el daño vaya solo "al pasar")` : null;

const result = {
  file,
  clean,
  hardFlags,
  guardrail: { present: guard.present, real: guard.present && guardrailIsReal(guard.body) },
  welfaristInPlay,
  biocentricInPlay,
  strongHits: wa.strongHits,
  biocentricHits: ba.strongHits,
  quantumCountInPlay: wa.quantumCount,
  softNote,
};

if (asJson) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const mark = (b) => (b ? 'X' : '.');
  console.log(`seed-gate · ${file}`);
  console.log(clean ? 'LIMPIO (la jugada pasa — seedear al coagent)' : 'FLAGS DURAS → reformular la JUGADA antes de seedear (NO mandar al coagent)');
  console.log('');
  console.log(`[${mark(welfaristInPlay)}] welfaristInPlay   ${wa.strongHits.length ? 'EJE bienestarista en la jugada: ' + wa.strongHits.map((h) => `"${h}"`).join(', ') : 'eje no-bienestarista en la jugada (ok)'}`);
  console.log(`[${mark(biocentricInPlay)}] biocentricInPlay  ${ba.strongHits.length ? 'EJE biocéntrico en la jugada (usar SINTIENCIA): ' + ba.strongHits.map((h) => `"${h}"`).join(', ') : 'eje sensocéntrico en la jugada (ok)'}`);
  console.log(`[${mark(guardrailMissing)}] guardrailMissing  ${guard.present ? 'bloque guardrail presente' : 'FALTA el bloque <!-- GUARDRAIL-ABOLICIONISTA --> ... <!-- /GUARDRAIL-ABOLICIONISTA -->'}`);
  console.log(`[${mark(guardrailHollow)}] guardrailHollow   ${!guard.present ? '(n/a, falta el bloque)' : guardrailIsReal(guard.body) ? 'guardrail real (nombra eje propiedad/esclavitud vs daño)' : 'guardrail HUECO: no nombra el eje propiedad/esclavitud contra el daño prohibido'}`);
  if (softNote) console.log(`\nnota blanda (avisa, no falla): ${softNote}`);
}

process.exit(clean ? 0 : 1);
