// SSOT de la letanía de propiedad ("breeds her, sells her, decides when she dies") repetida en el lote.
// Nació 2026-10-26: salió en 3 de 4 drafts del lote 1026A y en 2 de 4 del 1016A; una vez es jugada, dos es molde.

const CATEGORIES = {
  breed: /\b(?:breed(?:s|ing)?|bred)\b/i,
  own: /\b(?:owned|owns\s+her|own\s+her|as\s+(?:\w+['’]s\s+)?property)\b/i,
  sell: /\b(?:sell(?:s|ing)?|sold|sale)\b/i,
  kill: /\b(?:kill(?:s|ed|ing)?|slaughter(?:ed)?|dies|the\s+day\s+she)\b/i,
};
const MIN_CATEGORIES = 3;

function sentencesOf(text) {
  return (text || '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?]["')\]]?)\s+/).map((s) => s.trim()).filter(Boolean);
}

export function detectOwnershipLitanies(text) {
  const hits = [];
  for (const sentence of sentencesOf(text)) {
    const cats = Object.entries(CATEGORIES).filter(([, re]) => re.test(sentence)).map(([k]) => k);
    if (cats.length >= MIN_CATEGORIES) hits.push({ categories: cats, snippet: sentence.slice(0, 170) });
  }
  return hits;
}

export function detectOwnershipLitanyRepeats(drafts) {
  const items = drafts.map((d) => ({ name: d.name, hits: detectOwnershipLitanies(d.text) })).filter((it) => it.hits.length);
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let k = i + 1; k < items.length; k++) {
      pairs.push({ a: items[i].name, b: items[k].name, snippetA: items[i].hits[0].snippet, snippetB: items[k].hits[0].snippet });
    }
  }
  return { name: 'ownershipLitanyRepeat', hard: pairs.length > 0, count: pairs.length, draftsWithLitany: items.length, pairs };
}
