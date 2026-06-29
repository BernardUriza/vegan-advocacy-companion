// SSOT del detector de EJE BIOCÉNTRICO (kill-list de [[sentiocentrism-not-biocentrism]]).
// Somos SENSOCENTRISTAS, no biocentristas: el criterio de estatus moral es la
// SINTIENCIA (un sujeto que siente / tiene experiencias), NO la VIDA. Enmarcar la
// pregunta en "living being / living individual / una vida / valor de la vida"
// concede el biocentrismo y abre el flanco plant-sentience ("las plantas también
// están vivas"). El fix es nombrar al SUJETO SINTIENTE: "sentient being", "a subject
// who feels", "someone with experiences / a point of view".
//
// Hermano de welfarist-axis.mjs (ese caza el eje del DAÑO; este caza el eje de la
// VIDA). Mismos tres consumidores, una sola fuente por eje (Art. 6): style-gate
// (draft en), lint-prose (cualquier prosa), seed-gate (master es).

// El sustantivo biocéntrico usado como criterio de quién-cuenta = tell inequívoco.
export const STRONG_EN = [
  /\bliving\s+(beings?|individuals?|creatures?|things?|organisms?|entit(?:y|ies))\b/i,
  /\b(respect|reverence|sanctity|value|worth)\s+(for|of)\s+(all\s+)?life\b/i,
  /\ball\s+life\s+(is|has|matters|deserves|is\s+sacred)\b/i,
  /\bright\s+to\s+life\b/i,
];

export const STRONG_ES = [
  /\bseres?\s+vivos?\b/i,
  /\bindividuos?\s+vivos?\b/i,
  /\bcosas?\s+vivas?\b/i,
  /\bentidad(?:es)?\s+vivas?\b/i,
  /\b(respeto|reverencia|santidad|valor)\s+(a|de|por)\s+(toda\s+)?la\s+vida\b/i,
  /\bderecho\s+a\s+la\s+vida\b/i,
];

// "vida/life" suelto: señal blanda (idioms como "take a life", "su propia vida"
// son legítimos — la posesiva describe la experiencia del sujeto, no el criterio).
// No dispara hard por sí solo; solo informa.
export const SOFT = [
  /\b(a|one|another|every|each|any)\s+(single\s+)?life\b/i,
  /\buna\s+vida\b/i,
];

// Excluir la posesiva: "its own life", "their lives", "su propia vida" = experiencia
// del sujeto (sensocéntrico correcto), NO criterio biocéntrico.
const POSSESSIVE_LIFE = /\b(its?|their|his|her|your|my|own|su|sus)\s+(own\s+)?(life|lives|vida)\b/i;

export function detectBiocentricAxis(text, { lang = 'en' } = {}) {
  const STRONG = lang === 'es' ? [...STRONG_EN, ...STRONG_ES] : STRONG_EN;
  const strongHits = STRONG.map((re) => (text.match(re) || [])[0]).filter(Boolean);

  let softCount = 0;
  for (const re of SOFT) {
    for (const m of text.matchAll(new RegExp(re.source, 'gi'))) {
      const around = text.slice(Math.max(0, m.index - 12), m.index + m[0].length + 4);
      if (!POSSESSIVE_LIFE.test(around)) softCount += 1;
    }
  }

  const hard = strongHits.length > 0;
  return {
    name: 'biocentricAxis',
    hard,
    lang,
    strongHits,
    softCount,
    evidence: [
      ...strongHits.map((h) => `strong:"${h}" → usar "sentient being / conscious being / sujeto sintiente / ser con conciencia"`),
      softCount ? `vida-suelta x${softCount} (revisar: ¿criterio o experiencia del sujeto?)` : null,
    ].filter(Boolean),
  };
}
