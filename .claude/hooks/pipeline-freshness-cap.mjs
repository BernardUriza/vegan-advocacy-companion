#!/usr/bin/env node
// PreToolUse hook (Bash) — TOPE DE FRESCURA del vegan-pipeline (2026-09-19).
//
// Los scripts ya recortan solos (scripts/freshness.mjs); este hook cierra la única
// puerta que queda: pedir explícitamente un tope mayor al techo. Deniega (exit 2)
// cualquier invocación de notif-scan / debt-sweep / reflex emit / thread-extract que
// lleve `--max-age-days N` o `VEGAN_MAX_AGE_DAYS=N` con N > HARD_CEILING_DAYS, o una
// bandera de "sin tope". Todo lo demás pasa (exit 0). Ver
// .claude/rules/pipeline-freshness-cap.md.

import { readFileSync } from 'fs';

const HARD_CEILING_DAYS = 14;
const SCRIPT_RE = /\b(notif-scan|debt-sweep|reflex|thread-extract)\.mjs\b/;
const NO_CAP_RE = /--(all-ages|no-age-cap|no-freshness-cap|ignore-age)\b/;

function block(lines) {
  process.stderr.write(lines.join('\n') + '\n');
  process.exit(2);
}

let payload = {};
try { payload = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
const cmd = String(payload?.tool_input?.command || '');
if (!SCRIPT_RE.test(cmd)) process.exit(0);

if (NO_CAP_RE.test(cmd)) {
  block([
    'TOPE DE FRESCURA (pipeline-freshness-cap): el pipeline no corre sin tope de edad.',
    `Máximo permitido: --max-age-days ${HARD_CEILING_DAYS} (default 7). Un hilo más viejo ya no tiene lurker.`,
  ]);
}

const asks = [];
for (const m of cmd.matchAll(/--max-age-days[= ]+(\d+(?:\.\d+)?)/g)) asks.push(+m[1]);
for (const m of cmd.matchAll(/VEGAN_MAX_AGE_DAYS=(\d+(?:\.\d+)?)/g)) asks.push(+m[1]);
const over = asks.filter((n) => n > HARD_CEILING_DAYS);
if (over.length) {
  block([
    `TOPE DE FRESCURA (pipeline-freshness-cap): pediste ${over.join(', ')} días; el techo es ${HARD_CEILING_DAYS}.`,
    'Un hilo de más de dos semanas no se reabre desde el pipeline. Si Bernard quiere uno específico, lo da como replylink (modo single), no subiendo el tope.',
  ]);
}
process.exit(0);
