import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, mkdirSync, symlinkSync, utimesSync } from 'node:fs';
import { draftSha } from './seed-coagent.mjs';
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

// ---------- style-gate: coma dentro de la comilla ----------

test('style-gate: coma DENTRO de la comilla bloquea (copiado de ChatGPT)', () => {
  assert.equal(runGate('style-gate.mjs', clean('When the reason is "fuck that bird," the rest is a label. ')), 1);
  assert.equal(runGate('style-gate.mjs', clean('When the reason is \u201cfuck that bird,\u201d the rest is a label. ')), 1);
});

test('style-gate: coma FUERA de la comilla y comilla que abre tras coma pasan', () => {
  assert.equal(runGate('style-gate.mjs', clean('When the reason is "fuck that bird", the rest is a label. You said, "that bird" first. ')), 0);
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

// ---------- style-gate: modo LOTE (cierre clonado, 2026-09-28) ----------

const Q = (subj, pron) => `The setup does not matter here and neither does the rest. ${FILLER.repeat(4)}So the question is still sitting there: if there's someone in ${subj}, what makes it legitimate for ${pron} to exist as somebody's property?`;
function runBatch(bodies) {
  const files = bodies.map((b, i) => { const f = join(TMP, `batch-${i}-${Math.abs(hash(b))}.txt`); writeFileSync(f, b, 'utf8'); return f; });
  try { execFileSync('node', [resolve(HERE, 'style-gate.mjs'), ...files], { stdio: 'pipe' }); return 0; } catch (e) { return e.status; }
}

test('style-gate lote: la misma pregunta final con el sujeto cambiado bloquea (exit 1)', () => {
  assert.equal(runBatch([Q('a pig', 'her'), Q('him', 'him')]), 1);
});

test('style-gate lote: cierres con las palabras de cada interlocutor pasan (exit 0)', () => {
  assert.equal(runBatch([
    `${FILLER.repeat(6)}Which of those two relations are you defending, the one with Ralph or the one with the piglet?`,
    `${FILLER.repeat(6)}Paper says who owns. When did it ever say why anyone gets to?`,
  ]), 0);
});

// ---------- coagent-provenance-gate: etapa 0 sin apply, cierre clonado ----------
// El hook lee CLAUDE_PROJECT_DIR: se le da un proyecto falso con .coagent/ y un symlink a
// scripts/ (importa seed-coagent.mjs y closer-clone.mjs desde ahí).

const GATE = resolve(HERE, '..', '.claude', 'hooks', 'coagent-provenance-gate.mjs');
const STAGE_CMD = (bodyFile) => `node scripts/${'comment-prepare'}.mjs --url "https://www.facebook.com/groups/1/posts/999/" --author "X" --anchor "y" --body-file ${bodyFile}`;
function fakeProject() {
  const dir = mkdtempSync(join(tmpdir(), 'prov-'));
  mkdirSync(join(dir, '.coagent'));
  symlinkSync(HERE, join(dir, 'scripts'));
  return dir;
}
function runProvenance(dir, bodyFile) {
  const r = spawnSync('node', [GATE], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: STAGE_CMD(bodyFile) } }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  return { status: r.status, stderr: r.stderr };
}

test('provenance-gate: packets del reflex más nuevos que el marcador bloquean con la razón', () => {
  const dir = fakeProject();
  const body = join(dir, 'body.txt');
  writeFileSync(body, Q('a pig', 'her'));
  writeFileSync(join(dir, '.coagent', 'reflex-packets.json'), '[]');
  const r = runProvenance(dir, body);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /etapa 0 \(reflex\) emitida pero NO aplicada/);
});

test('provenance-gate: con el marcador reflex-applied posterior, la guarda de etapa 0 pasa (cae a la del recibo)', () => {
  const dir = fakeProject();
  const body = join(dir, 'body.txt');
  writeFileSync(body, Q('a pig', 'her'));
  writeFileSync(join(dir, '.coagent', 'reflex-packets.json'), '[]');
  const old = new Date(Date.now() - 60000);
  utimesSync(join(dir, '.coagent', 'reflex-packets.json'), old, old);
  writeFileSync(join(dir, '.coagent', 'reflex-applied.json'), '{}');
  const r = runProvenance(dir, body);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no hay recibo de consulta/);
});

test('provenance-gate: un cierre clonado contra un draft consultado hoy bloquea', () => {
  const dir = fakeProject();
  const peer = join(dir, 'peer.txt');
  writeFileSync(peer, Q('him', 'him'));
  writeFileSync(join(dir, '.coagent', '111.consult.json'), JSON.stringify({ status: 'consulted', drafts: [{ author: 'Kirk', draft_sha: 'x', draft_file: peer, consulted_at: new Date().toISOString() }] }));
  const body = join(dir, 'body.txt');
  writeFileSync(body, Q('a pig', 'her'));
  const r = runProvenance(dir, body);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /CIERRE CLONADO/);
  assert.match(r.stderr, /Kirk \(111\)/);
});

test('provenance-gate: un cierre distinto al del draft consultado hoy no dispara la guarda de clones', () => {
  const dir = fakeProject();
  const peer = join(dir, 'peer.txt');
  writeFileSync(peer, Q('him', 'him'));
  writeFileSync(join(dir, '.coagent', '111.consult.json'), JSON.stringify({ status: 'consulted', drafts: [{ author: 'Kirk', draft_sha: 'x', draft_file: peer, consulted_at: new Date().toISOString() }] }));
  const body = join(dir, 'body.txt');
  writeFileSync(body, `${FILLER.repeat(6)}Paper says who owns. When did it ever say why anyone gets to?`);
  const r = runProvenance(dir, body);
  assert.equal(r.status, 2);
  assert.doesNotMatch(r.stderr, /CIERRE CLONADO/);
  assert.match(r.stderr, /no hay recibo de consulta/);
});

const CP = 'comment-' + 'prepare';
function runCmd(dir, command) {
  const r = spawnSync('node', [GATE], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  return { status: r.status, stderr: r.stderr };
}
function consultedProject(bodyText) {
  const dir = fakeProject();
  const body = join(dir, 'body.txt');
  writeFileSync(body, bodyText);
  const master = join(dir, 'master.md');
  const masterText = 'master\n<!-- GUARDRAIL-ABOLICIONISTA -->\nEJE: PROPIEDAD/ESCLAVITUD, no harm ni daño.\n<!-- /GUARDRAIL-ABOLICIONISTA -->\n`algo-a-alguien-sujeto-derecho`\n';
  writeFileSync(master, masterText);
  writeFileSync(join(dir, '.coagent', '999.consult.json'), JSON.stringify({ status: 'consulted', seed_gate: 'pass', frameworks: ['algo-a-alguien-sujeto-derecho'], master, master_sha: draftSha(masterText), drafts: [{ author: 'X', draft_sha: draftSha(bodyText), draft_file: body, consulted_at: new Date().toISOString() }] }));
  return { dir, body, master };
}
const URL999 = '"https://www.facebook.com/groups/1/posts/999/"';
const STEER = `${FILLER.repeat(6)}So what does the steer lack, in your own words?`;

test('provenance-gate: una invocación limpia con recibo fresco y sha correcto PASA (exit 0)', () => {
  const { dir, body } = consultedProject(STEER);
  const r = runCmd(dir, `cd ${dir}/scripts && node ${CP}.mjs --url ${URL999} --author "X" --anchor "y" --body-file ${body}; cd ${dir}`);
  assert.equal(r.status, 0, r.stderr);
});

test('provenance-gate: el bypass --body-file=aprobado --body "a mano" se bloquea', () => {
  const { dir, body } = consultedProject(STEER);
  const r = runCmd(dir, `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file=${body} --body "HAND WRITTEN"`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /flags no aceptados: --body/);
});

test('provenance-gate: --url=<post con recibo> más una URL suelta de otro post se bloquea', () => {
  const { dir, body } = consultedProject(STEER);
  const r = runCmd(dir, `node scripts/${CP}.mjs --url=${URL999} "https://www.facebook.com/groups/1/posts/555/" --author "X" --body-file ${body}`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /argumentos sueltos/);
});

test('provenance-gate: glob, sustitución y pipe se bloquean (fail-closed)', () => {
  const { dir, body } = consultedProject(STEER);
  for (const cmd of [
    `node scripts/comment-prep*.mjs --url ${URL999} --author "X" --body-file ${body}`,
    `node "scripts/${CP}".mjs --url ${URL999} --author "X" --body-file $(cat /tmp/x)`,
    `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file ${body} | head -5`,
  ]) {
    assert.equal(runCmd(dir, cmd).status, 2, cmd);
  }
});

test('provenance-gate: --body-file relativo se bloquea', () => {
  const { dir } = consultedProject(STEER);
  const r = runCmd(dir, `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file body.txt`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /no es ruta absoluta/);
});

test('provenance-gate: un master editado después del seed se bloquea por master_sha', () => {
  const { dir, body, master } = consultedProject(STEER);
  writeFileSync(master, readFileSync(master, 'utf8') + '\njugada nueva metida después del seed\n');
  const r = runCmd(dir, `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file ${body}`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /el master cambió después del seed/);
});

test('provenance-gate: --mode root pasa; un --mode desconocido se bloquea', () => {
  const { dir, body } = consultedProject(STEER);
  assert.equal(runCmd(dir, `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file ${body} --mode root`).status, 0);
  const r = runCmd(dir, `node scripts/${CP}.mjs --url ${URL999} --author "X" --body-file ${body} --mode sideways`);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /solo reply o root/);
});

// ---------- mcp-publish-gate: texto verificable por sha, Enter sintético = publicar ----------
const MCP_GATE = resolve(HERE, '..', '.claude', 'hooks', 'mcp-publish-gate.mjs');
function runMcp(dir, fn) {
  const r = spawnSync('node', [MCP_GATE], { input: JSON.stringify({ tool_name: 'mcp__chrome-devtools__evaluate_script', tool_input: { function: fn } }), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  return { status: r.status, stderr: r.stderr };
}
const PASTE = (lit) => `() => { const box = document.querySelector('div[contenteditable="true"][role="textbox"]'); const text = ${lit}; const dt = new DataTransfer(); dt.setData('text/plain', text); box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt })); }`;

test('publish-literals: extrae literales largos en backticks, comillas dobles y simples; marca ${} como dinámico', async () => {
  const { longLiterals } = await import('./publish-literals.mjs');
  const long = 'x'.repeat(130);
  assert.equal(longLiterals('const a = `' + long + '`;')[0].text, long);
  assert.equal(longLiterals('const a = "' + long + '\\nfin";')[0].text, long + '\nfin');
  assert.equal(longLiterals("const a = '" + long + "';")[0].text, long);
  assert.equal(longLiterals('const a = `' + long + '${b}`;')[0].dynamic, true);
  assert.equal(longLiterals('const DESTINO = "Vegans V\'s Meat Eaters";').length, 0);
});

test('mcp-publish-gate: pegar el draft consultado como literal PASA; como comillas dobles también', () => {
  const { dir } = consultedProject(STEER);
  assert.equal(runMcp(dir, PASTE('`' + STEER + '`')).status, 0);
  assert.equal(runMcp(dir, PASTE(JSON.stringify(STEER))).status, 0);
});

test('mcp-publish-gate: el draft de un post pegado en OTRO post se bloquea; en el suyo pasa', () => {
  const { dir } = consultedProject(STEER);
  const onPost = (pid) => `() => { if (!location.href.startsWith('https://www.facebook.com/groups/1/posts/${pid}/')) return; ${PASTE('`' + STEER + '`').slice(6)} }`;
  assert.equal(runMcp(dir, onPost('999')).status, 0);
  const r = runMcp(dir, onPost('555'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /post 555/);
});

test('mcp-publish-gate: texto a mano en comillas dobles (antes pasaba) se bloquea', () => {
  const { dir } = consultedProject(STEER);
  const r = runMcp(dir, PASTE(JSON.stringify(FILLER.repeat(3) + 'hand written')));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /NO es ninguno de/);
});

test('mcp-publish-gate: pegar desde window.__draft o con ${} no es verificable y se bloquea', () => {
  const { dir } = consultedProject(STEER);
  assert.equal(runMcp(dir, PASTE('window.__draft')).status, 2);
  assert.equal(runMcp(dir, PASTE('`' + STEER + '${x}`')).status, 2);
});

test('mcp-publish-gate: el Enter sintético en un composer cuenta como publicar y exige recibo', () => {
  const dir = fakeProject();
  const fn = `() => { const box = document.querySelector('div[contenteditable="true"][role="textbox"]'); box.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', code:'Enter', keyCode:13, bubbles:true })); }`;
  const r = runMcp(dir, fn);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ningún recibo de consulta/);
});

// ---------- style-gate: falsos positivos que la propia regla recomienda ----------
test('style-gate: abrir con "No," o "Sure," no es vocativo; abrir con un nombre sí', () => {
  const open = (first) => `${first} ${FILLER.repeat(6)}`;
  assert.equal(runGate('style-gate.mjs', open("No, that doesn't follow.")), 0);
  assert.equal(runGate('style-gate.mjs', open('Sure, crops kill animals.')), 0);
  assert.equal(runGate('style-gate.mjs', open("Les, I don't think that follows.")), 1);
});

test('style-gate: kill-phrase con límite de palabra ("I hear your point" no es "I hear you") y acrónimos no son grito', () => {
  assert.equal(runGate('style-gate.mjs', clean('I hear your point about the USDA rules. ')), 0);
  assert.equal(runGate('style-gate.mjs', clean('I hear you. ')), 1);
});
