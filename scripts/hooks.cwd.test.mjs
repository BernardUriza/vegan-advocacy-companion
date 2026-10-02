import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { strayScriptsCd } from '../.claude/hooks/cwd-root-guard.mjs';

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '../.claude/hooks/cwd-root-guard.mjs');
const run = (command) => spawnSync('node', [HOOK], { input: JSON.stringify({ tool_input: { command } }) }).status;

test('deniega el cd suelto a scripts/ (relativo o absoluto, al inicio o encadenado)', () => {
  assert.equal(strayScriptsCd('cd scripts && node notif-scan.mjs --json'), true);
  assert.equal(strayScriptsCd('cd /Users/x/Documents/vegan-advocacy-companion/scripts && node a.mjs'), true);
  assert.equal(strayScriptsCd('date; cd scripts/ ; ls'), true);
  assert.equal(run('cd scripts && node notif-scan.mjs'), 2);
});

test('deja pasar subshell, raíz y menciones que no son cd a scripts', () => {
  assert.equal(strayScriptsCd('(cd scripts && node --test *.test.mjs)'), false);
  assert.equal(strayScriptsCd('cd /Users/x/Documents/vegan-advocacy-companion && node scripts/notif-scan.mjs'), false);
  assert.equal(strayScriptsCd('grep -n cd scripts/CLAUDE.md'), false);
  assert.equal(strayScriptsCd('cd scripts-old && ls'), false);
  assert.equal(run('node scripts/notif-scan.mjs --json'), 0);
});
