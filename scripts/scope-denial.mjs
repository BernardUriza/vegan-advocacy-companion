// SSOT del detector de MOLDE REPETIDO en la concesión-y-redirección (2026-10-03).
// "That proves you paid. It proves fuck-all about whether she's yours" es la jugada central del
// proyecto (conceder el hecho, negar que pruebe la conclusión) y NO se bloquea: no es el pivote
// de negación. Lo que se lee a fórmula es el mismo par de verbos en dos replies del mismo lote.
// Investigación: analysis/research/2026-10-03-afirmar-luego-negar-y-nombre-del-salto.md

const VERBS = 'prove|show|tell|explain|describe|say|mean|answer|settle|establish';
const AFFIRM = new RegExp(`\\b(${VERBS})s?\\b`, 'i');
const NEG_BEFORE = new RegExp(`\\b(?:does\\s+not|doesn['’]t|do\\s+not|don['’]t|never|can['’]t|cannot)\\s+(?:yet\\s+|even\\s+)?(${VERBS})\\b`, 'i');
const NEG_AFTER = new RegExp(`\\b(${VERBS})s?\\s+(?:nothing|fuck-all|damn\\s+all|a\\s+damn\\s+thing|none\\s+of)`, 'i');
const NEG_SUBJECT = new RegExp(`^(?:neither|none|nothing)\\b[^.!?]*?\\b(${VERBS})s?\\b`, 'i');

function sentencesOf(text) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?]["')\]]?)\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function denialVerb(sentence) {
  const m = sentence.match(NEG_BEFORE) || sentence.match(NEG_AFTER) || sentence.match(NEG_SUBJECT);
  return m ? m[1].toLowerCase() : null;
}

function affirmVerb(sentence) {
  const stripped = sentence.replace(new RegExp(NEG_BEFORE.source, 'gi'), ' ').replace(new RegExp(NEG_AFTER.source, 'gi'), ' ');
  const m = stripped.match(AFFIRM);
  return m ? m[1].toLowerCase() : null;
}

export function detectScopeDenials(text) {
  const sentences = sentencesOf(text);
  const hits = [];
  for (let i = 0; i < sentences.length; i++) {
    const deny = denialVerb(sentences[i]);
    if (!deny) continue;
    const affirm = affirmVerb(sentences[i]) || (i > 0 ? affirmVerb(sentences[i - 1]) : null);
    if (!affirm) continue;
    const snippet = (affirmVerb(sentences[i]) ? sentences[i] : `${sentences[i - 1]} ${sentences[i]}`).slice(0, 170);
    hits.push({ template: `${affirm}>${deny}`, snippet });
  }
  return hits;
}

export function detectScopeDenialRepeats(drafts) {
  const items = drafts.map((d) => ({ name: d.name, hits: detectScopeDenials(d.text) }));
  const pairs = [];
  for (let i = 0; i < items.length; i++) {
    for (let k = i + 1; k < items.length; k++) {
      for (const a of items[i].hits) {
        const b = items[k].hits.find((h) => h.template === a.template);
        if (b) pairs.push({ a: items[i].name, b: items[k].name, template: a.template, snippetA: a.snippet, snippetB: b.snippet });
      }
    }
  }
  const withMove = items.filter((it) => it.hits.length).length;
  return { name: 'scopeDenialRepeat', hard: pairs.length > 0, soft: pairs.length === 0 && withMove >= 2, count: pairs.length, draftsWithMove: withMove, pairs };
}
