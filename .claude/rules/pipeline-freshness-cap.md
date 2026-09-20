# Pipeline Freshness Cap — el pipeline NUNCA abre nada de más de 7 días

Regla dura de mecánica (2026-09-19, Bernard: *"está el pipe abriendo mensajes de hace
más de 5 semanas, eso nunca debe pasar!"*). Gobierna las etapas 0, 0.5 y 1
([outcome-reflex], [notification-agrupation] / `debt-sweep`) y cualquier script que
decida por sí solo QUÉ hilo abrir.

## La ley

1. **Tope default: 7 días. Techo absoluto: 14.** Un hilo, una notificación o una
   interacción del moat más vieja que el tope **no se abre, no se emite, no entra a la
   lista de deuda**. Se lista aparte como `⏳ VIEJOS` (sin `openUrl`) y punto.
2. **Por qué:** el norte es el lector silencioso ([[reply-output-style]]). Un debate de
   hace semanas ya no tiene lurker vivo — FB lo enterró en el feed. Reabrirlo quema tabs
   en el Chrome de Bernard, tokens, y su atención en deuda que ya no educa a nadie.
3. **El único camino a un hilo viejo es un replylink de Bernard** (modo single): él
   decide; el pipeline no. Subir el tope por encima del techo está bloqueado por hook.
4. **Edad desconocida ≠ vieja** (Art. 2). `UNKNOWN_AGE` y fechas que no parsean se
   tratan como candidatas a confirmar, nunca como viejas — la misma honestidad que ya
   gobierna la tabla de deuda.
5. **La deuda vieja del moat se CIERRA, no se reabre.** Un `pending`/`goalpost` de hace
   meses se cierra por edad (`close-outcomes` / `reflex apply` como `silent`), y el
   sweep lo lista para eso. Reabrirlo "a ver si contestaron" es la falla.

## Dónde vive (SSOT + consumidores)

| Pieza | Qué hace |
|---|---|
| `scripts/freshness.mjs` | **SSOT**: `MAX_AGE_DAYS` (7), `HARD_CEILING_DAYS` (14), `isStaleMinutes`, `isStaleDate`, `resolveMaxAgeDays` (`--max-age-days N` / `VEGAN_MAX_AGE_DAYS`, recortado al techo). `fb-lib.mjs` lo re-exporta. |
| `notif-scan.mjs` | los grupos con `freshestMin` > tope salen de `groups` a `stale` (sin `openUrl`) |
| `db.getOpenDebtThreads()` | filtra por la interacción abierta más reciente; `{ includeStale: true }` los devuelve marcados (`stale`, `newestDate`, `ageDays`) |
| `debt-sweep.mjs` | los `stale` se listan como VIEJOS y **no se extraen** (cero tabs) |
| `reflex.mjs emit` | omite interacciones y transcripts (`mtime`) fuera del tope — de 59 packets a 2 |
| `thread-extract.mjs` | reporta `stale` / `freshestTurnMin` (ya abrió; el caller lo ve) |
| `.claude/hooks/pipeline-freshness-cap.mjs` | PreToolUse Bash: deniega `--max-age-days` > 14, `VEGAN_MAX_AGE_DAYS` > 14 o `--all-ages`/`--no-age-cap` sobre esos scripts |

Tests: `node --test scripts/freshness.test.mjs scripts/hooks.freshness.test.mjs`.

## Por qué existe

2026-09-19, corrida en lote: `notif-scan` listó notifs de 5 semanas (Urantia,
Antinatalismo), `debt-sweep` arrancó a reabrir en el Chrome de Bernard hilos de **junio**
(CarolAnn/Matt/Anna con `goalpost` del 16-jun) y `reflex emit` sacó 59 packets hasta
junio. Ningún script tenía un filtro de edad: el `UNKNOWN_AGE` cuidaba que lo sin fechar
no se ordenara mal, pero nadie cuidaba que lo fechado viejo no se abriera. Bernard lo
paró a media corrida. Ver [[notification-agrupation]] (0.5 debt-sweep),
[[outcome-reflex]] y `00-constitution` Art. 8 (su atención y su Chrome).
