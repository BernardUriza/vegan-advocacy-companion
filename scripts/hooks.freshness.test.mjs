import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.claude', 'hooks', 'pipeline-freshness-cap.mjs');
const run = (command) => spawnSync('node', [HOOK], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });

test('plain pipeline invocations pass', () => {
  for (const c of [
    'cd scripts && node notif-scan.mjs --json',
    'node debt-sweep.mjs',
    'node reflex.mjs emit',
    'node thread-extract.mjs "https://www.facebook.com/groups/1/posts/2/" --json',
    'node notif-scan.mjs --max-age-days 14',
    'VEGAN_MAX_AGE_DAYS=3 node debt-sweep.mjs --json',
    'ls scripts',
  ]) assert.equal(run(c).status, 0, c);
});

test('asking for more than the ceiling is denied (exit 2) with the reason on stderr', () => {
  for (const c of [
    'node notif-scan.mjs --max-age-days 35',
    'node debt-sweep.mjs --max-age-days=15',
    'VEGAN_MAX_AGE_DAYS=60 node reflex.mjs emit',
    'node thread-extract.mjs "u" --all-ages',
    'node debt-sweep.mjs --no-age-cap',
  ]) {
    const r = run(c);
    assert.equal(r.status, 2, c);
    assert.match(r.stderr, /TOPE DE FRESCURA/);
  }
});

test('a non-pipeline command mentioning 35 days is not the hook\'s business', () => {
  assert.equal(run('echo "--max-age-days 35 in a doc"').status, 0);
});
