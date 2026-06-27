// SSOT del detector de EJE BIENESTARISTA (kill-list de [[abolitionist-framing]]).
// El eje de un argumento debe ser PROPIEDAD/ESCLAVITUD (sujeto poseído), NO la
// CANTIDAD o el ROL del daño. Redactar sobre el quantum del daño concede el terreno
// y pierde al lurker.
//
// Dos consumidores, una sola fuente (Art. 6):
//   - style-gate.mjs  (etapa 4): sobre el DRAFT en inglés; la posición importa
//     (el eje aterriza en apertura/cierre). Política: lang 'en', positional, quantum>=2.
//   - seed-gate.mjs   (etapa 3): sobre la JUGADA del master prompt en español; doc
//     largo sin estructura de reply. Política: lang 'es', no-posicional, quantum blando.

// distinciones bienestaristas inequívocas — núcleo compartido (ya bilingüe en parte)
export const STRONG_CORE = [
  /\bunnecessary harm\b/i,
  /\bavoidable harm\b/i,
  /\bneedless harm\b/i,
  /\b(reduce|reducing|less|least|minimi[sz]e|minimizing|more|added|additional)\s+harm\b/i,
  /\bby-?product\b/i,
  /\bda(?:ñ|n)o\s+(?:innecesario|evitable)\b/i,
  /\bsufrimiento\s+evitable\b/i,
  /\b(?:two|both)\s+interests\b/i,
  /\binterests?\s+on\s+the\s+scale\b/i,
  /\bon\s+the\s+scale\b/i,
  /\bfeels?\s+(?:no\s+)?pain\b/i,
  /\bpain-?free\b/i,
  /\bpainless(?:ly)?\b/i,
  /\bhumane(?:ly)?\s+(?:slaughter|kill|killed|killing|death|raised)\b/i,
  /\bsiente\s+dolor\b/i,
  /\bsin\s+dolor\b/i,
  /\bindoloro\b/i,
  /\bsacrificio\s+humanitario\b/i,
];

// welfarismo en ESPAÑOL — como Claude escribe la JUGADA en el master prompt.
// Estas son las distinciones que envenenaron A2 (crop_deaths) el 2026-06-21.
export const STRONG_ES_EXTRA = [
  /\brol\s+del\s+da(?:ñ|n)o\b/i,
  /\bsubproducto\s+incidental\b/i,
  /\bda(?:ñ|n)o\s+incidental\b/i,
  /\bincidental\s+vs\.?\s+prop(?:ó|o)sito\b/i,
  /\bda(?:ñ|n)o\s+intencional\b/i,
  /\b(menos|m(?:á|a)s|menor|mayor|reducir|reduce|reducimos|minimizar|minimiza)\s+(el\s+)?da(?:ñ|n)o\b/i,
  /\bcantidad\s+de\s+da(?:ñ|n)o\b/i,
  /\bconteo\s+(total\s+)?de\s+da(?:ñ|n)o\b/i,
  /\bdos\s+intereses\b/i,
  /\ben\s+la\s+balanza\b/i,
];

// léxico de cantidad/quantum de daño — señal de deriva, no prueba por sí solo
export const QUANTUM = [
  /\bharm(?:s|ful|ing)?\b/i,
  /\bsuffering\b/i,
  /\bda(?:ñ|n)o(?:s)?\b/i,
  /\bda(?:ñ|n)ar\b/i,
  /\bsufrimiento\b/i,
  /\bpain\b/i,
  /\bcruel(?:ty|ly)?\b/i,
  /\bhumane(?:ly)?\b/i,
  /\bwelfare\b/i,
  /\bcompassion(?:ate)?\b/i,
  /\bkindness\b/i,
  /\bdolor\b/i,
  /\bcrueldad\b/i,
  /\bbienestar\b/i,
  /\bcompasi(?:ó|o)n\b/i,
];

function splitSentences(text) {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Detecta el eje bienestarista en `text`.
// opts:
//   lang        'en' (STRONG_CORE) | 'es' (STRONG_CORE + STRONG_ES_EXTRA)
//   positional  true  → cuenta quantum en apertura/cierre hacia hard (draft)
//   quantumHardAt  N  → quantumCount >= N dispara hard; Infinity lo desactiva (master)
export function detectWelfaristAxis(text, { lang = 'en', positional = true, quantumHardAt = 2 } = {}) {
  const STRONG = lang === 'es' ? [...STRONG_CORE, ...STRONG_ES_EXTRA] : STRONG_CORE;
  const lower = text.toLowerCase();
  const sentences = splitSentences(text);

  const strongHits = STRONG.map((re) => (text.match(re) || [])[0]).filter(Boolean);

  let quantumCount = 0;
  for (const re of QUANTUM) quantumCount += (lower.match(new RegExp(re.source, 'gi')) || []).length;

  const first = (sentences[0] || '').toLowerCase();
  const last = (sentences[sentences.length - 1] || '').toLowerCase();
  const inOpening = positional && QUANTUM.some((re) => re.test(first));
  const inClosing = positional && QUANTUM.some((re) => re.test(last));

  const hard = strongHits.length > 0 || inOpening || inClosing || quantumCount >= quantumHardAt;

  return {
    name: 'welfaristAxis',
    hard,
    lang,
    strongHits,
    quantumCount,
    inOpening,
    inClosing,
    evidence: [
      ...strongHits.map((h) => `strong:"${h}"`),
      inOpening ? 'quantum-en-apertura' : null,
      inClosing ? 'quantum-en-cierre' : null,
      Number.isFinite(quantumHardAt) && quantumCount >= quantumHardAt ? `quantum x${quantumCount} (eje, no al pasar)` : null,
    ].filter(Boolean),
  };
}
