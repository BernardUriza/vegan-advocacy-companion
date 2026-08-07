import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectWelfaristAxis } from './welfarist-axis.mjs';
import { detectBiocentricAxis } from './biocentric-axis.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TMP = mkdtempSync(join(tmpdir(), 'gates-'));

// Los gates son procesos con exit code: 0 = pasa, 1 = flags duras. El exit code es
// el contrato real (un pipeline lo consume), así que se testea el PROCESO, no solo
// la función. El bug del tricolon vivió meses porque la tabla decía [X] y el proceso
// salía 0 — solo un test del exit code lo caza.
function runGate(gate, body, extraArgs = []) {
  const file = join(TMP, `${gate}-${Math.abs(hash(body))}.txt`);
  writeFileSync(file, body, 'utf8');
  try {
    execFileSync('node', [resolve(HERE, gate), file, ...extraArgs], { stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status;
  }
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

const FILLER = 'The claim about ownership has to answer to the one it is made about, and so far nobody in this thread has tried to do that in plain words. ';
const clean = (extra = '') => `A title over someone who has a point of view is what needs defending here. ${extra}${FILLER.repeat(6)}`;

// ---------- style-gate: tricolon ----------

test('style-gate: un tricolon aislado NO bloquea (uso humano)', () => {
  const body = clean('The claim rests on habit, profit, and story. ');
  assert.equal(runGate('style-gate.mjs', body), 0);
});

test('style-gate: DOS tricolones bloquean (es un molde, kill-list)', () => {
  const body = clean('The claim rests on habit, profit, and story. It shows up in the auction, the truck, and the line. ');
  assert.equal(runGate('style-gate.mjs', body), 1, 'tricolon repetido debe dar exit 1, no solo pintar [X]');
});

// ---------- style-gate: kill phrases y formato ----------

test('style-gate: kill-phrase literal bloquea', () => {
  assert.equal(runGate('style-gate.mjs', clean("Let's unpack this. ")), 1);
});

test('style-gate: emoji y markdown bloquean', () => {
  assert.equal(runGate('style-gate.mjs', clean('Ownership is **the** point. ')), 1, 'bold debe bloquear');
  assert.equal(runGate('style-gate.mjs', clean('That is the point 🙂 ')), 1, 'emoji debe bloquear');
});

test('style-gate: abrir con el vocativo del destinatario bloquea', () => {
  assert.equal(runGate('style-gate.mjs', `Scott James, ${clean()}`), 1);
});

test('style-gate: un draft limpio pasa', () => {
  assert.equal(runGate('style-gate.mjs', clean()), 0);
});

// ---------- ejes (las dos reglas duras de fondo) ----------

test('welfarist-axis: el eje del daño se caza en ambos idiomas', () => {
  assert.ok(detectWelfaristAxis('this is unnecessary harm', { lang: 'en' }).hard);
  assert.ok(detectWelfaristAxis('el rol del daño incidental', { lang: 'es' }).hard);
  assert.ok(detectWelfaristAxis('humanely slaughtered animals', { lang: 'en' }).hard);
});

test('welfarist-axis: propiedad/esclavitud NO dispara falso positivo', () => {
  const r = detectWelfaristAxis('What justifies a title over someone who has a point of view?', { lang: 'en' });
  assert.equal(r.hard, false, `no debe flaguear el eje abolicionista: ${r.evidence.join(', ')}`);
});

test('biocentric-axis: "living being" como criterio se caza; la posesiva no', () => {
  assert.ok(detectBiocentricAxis('what makes one living individual property', { lang: 'en' }).hard);
  assert.equal(
    detectBiocentricAxis('someone who experiences its own life from the inside', { lang: 'en' }).hard,
    false,
    'la posesiva "its own life" es sensocéntrica correcta, no debe bloquear',
  );
});

test('style-gate: el eje biocéntrico bloquea el draft entero', () => {
  assert.equal(runGate('style-gate.mjs', clean('What makes it right for one living being to own another? ')), 1);
});

// ---------- seed-gate: el guardrail no es opcional ----------

const GUARD = `<!-- GUARDRAIL-ABOLICIONISTA -->
EJE INNEGOCIABLE: propiedad/esclavitud, el animal es un sujeto poseído. PROHIBIDO
redactar el eje como daño innecesario o unnecessary harm.
<!-- /GUARDRAIL-ABOLICIONISTA -->`;
const PLAY = 'La jugada: nombrar el título de propiedad sobre un sujeto que siente y preguntar qué lo justifica.\n';

test('seed-gate: master sin guardrail NO pasa', () => {
  assert.equal(runGate('seed-gate.mjs', PLAY), 1);
});

test('seed-gate: guardrail hueco (no nombra el eje) NO pasa', () => {
  const hollow = `${PLAY}\n<!-- GUARDRAIL-ABOLICIONISTA -->\nSé cuidadoso.\n<!-- /GUARDRAIL-ABOLICIONISTA -->`;
  assert.equal(runGate('seed-gate.mjs', hollow), 1);
});

test('seed-gate: master con guardrail real y jugada limpia pasa', () => {
  assert.equal(runGate('seed-gate.mjs', `${PLAY}\n${GUARD}`), 0);
});

test('seed-gate: welfarismo en la JUGADA bloquea aunque el guardrail esté', () => {
  const poisoned = `La jugada: conceder que hay daño innecesario también en las cosechas.\n\n${GUARD}`;
  assert.equal(runGate('seed-gate.mjs', poisoned), 1);
});

test('seed-gate: el léxico DENTRO del guardrail no cuenta como jugada', () => {
  assert.equal(runGate('seed-gate.mjs', `${PLAY}\n${GUARD}`), 0, 'nombrar "daño" para prohibirlo es legítimo');
});
