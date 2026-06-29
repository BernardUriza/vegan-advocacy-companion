#!/usr/bin/env node
// lint-prose.mjs — corre el detector welfarista (SSOT: welfarist-axis.mjs) sobre
// CUALQUIER prosa generada en el proyecto, no solo los drafts del coagent.
//
// El gap que cierra (2026-06-27): el seed-gate solo lintea masters de etapa-3.
// Texto que Claude genera en otros contextos (contraataques anticipados, ejemplos,
// borradores ad-hoc) nunca pasaba por el filtro — y filtró "feels pain" (harm-framing)
// en un contraataque post-run. Este lint es el mismo detector, aplicable a un archivo
// o a stdin, para que NINGUNA prosa con audiencia de lurker escape el eje abolicionista.
//
// Uso:
//   node scripts/lint-prose.mjs <archivo.txt> [--lang en|es]
//   echo "..." | node scripts/lint-prose.mjs --lang en
//
// Excluye (como el seed-gate): líneas blockquote (">"), citas verbatim del oponente,
// y bloques GUARDRAIL-ABOLICIONISTA (ahí nombrar "harm/pain" es legítimo: se nombra
// para prohibirlo). Lo que queda es la PROSA PORTANTE — la que el lurker lee como tu voz.
//
// exit 0 = LIMPIO · exit 1 = FLAG (welfarismo en el eje)

import { readFileSync } from 'fs';
import { detectWelfaristAxis } from './welfarist-axis.mjs';
import { detectBiocentricAxis } from './biocentric-axis.mjs';

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const lang = arg('--lang', 'en');
const langIdx = process.argv.indexOf('--lang');
const file = process.argv.slice(2).find((a, i) => {
  const absIdx = i + 2;
  if (a.startsWith('--')) return false;
  if (langIdx >= 0 && absIdx === langIdx + 1) return false; // es el valor de --lang
  return true;
});

let raw;
if (file) {
  raw = readFileSync(file, 'utf8');
} else if (!process.stdin.isTTY) {
  raw = readFileSync(0, 'utf8');
} else {
  console.error('uso: node scripts/lint-prose.mjs <archivo> [--lang en|es]  (o pipe por stdin)');
  process.exit(2);
}

// strip blockquotes (citas del oponente) y bloques guardrail (naming-to-prohibit)
const prose = raw
  .replace(/<!--\s*GUARDRAIL-ABOLICIONISTA\s*-->[\s\S]*?<!--\s*\/GUARDRAIL-ABOLICIONISTA\s*-->/gi, ' ')
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('>'))
  .join('\n');

const wa = detectWelfaristAxis(prose, { lang, positional: true, quantumHardAt: 2 });
const ba = detectBiocentricAxis(prose, { lang });

const label = file || '(stdin)';
console.log(`lint-prose · ${label} · lang=${lang}`);
if (!wa.hard && !ba.hard) {
  console.log('LIMPIO — eje no-bienestarista y sensocéntrico en la prosa portante (ok)');
  process.exit(0);
}
if (wa.hard) {
  console.log('FLAG — welfarismo en el eje de la prosa:');
  for (const e of wa.evidence) console.log(`  - ${e}`);
  console.log('Reescribe el eje a PROPIEDAD/ESCLAVITUD (¿qué convierte a un quién en un qué poseíble?).');
  console.log('El daño/pain/cruelty solo se menciona al pasar — jamás como eje portante (ver abolitionist-framing).');
}
if (ba.hard) {
  console.log('FLAG — biocentrismo en el eje de la prosa (somos SENSOCENTRISTAS):');
  for (const e of ba.evidence) console.log(`  - ${e}`);
  console.log('No enmarques en "living being / la vida": el criterio es la SINTIENCIA, no la vida.');
  console.log('Usa "sentient being / a subject who feels / sujeto sintiente" (ver sentiocentrism-not-biocentrism).');
}
process.exit(1);
