#!/usr/bin/env node
// PreToolUse (Bash): un `cd scripts` suelto deja el cwd de la sesión en scripts/ y el gate de envío
// busca el registro de canales ahí (2026-10-02, tercera vez). Se permite solo dentro de un subshell.

import { readFileSync } from 'fs';

export function strayScriptsCd(cmd) {
  let s = String(cmd || '');
  let prev;
  do { prev = s; s = s.replace(/\([^()]*\)/g, ' '); } while (s !== prev);
  return /(^|&&|;|\|\||\n)\s*cd\s+(\S*\/)?scripts\/?(?=\s|&&|;|$)/.test(s);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  let payload = {};
  try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
  if (strayScriptsCd(payload?.tool_input?.command)) {
    process.stderr.write([
      'CWD-ROOT: `cd scripts` suelto deja la sesión parada en scripts/ y el siguiente envío falla (el gate resuelve el registro de canales desde el cwd).',
      'Corre desde la raíz: `node scripts/<x>.mjs …`. Si de verdad necesitas estar en scripts/ (tests), usa un subshell: `(cd scripts && node --test *.test.mjs)`.',
    ].join('\n') + '\n');
    process.exit(2);
  }
  process.exit(0);
}
