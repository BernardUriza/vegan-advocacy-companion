# scripts/ — detalle de la automatización del pipeline

Se carga cuando lees un archivo de `scripts/`. El índice de una línea por script vive en el
`CLAUDE.md` raíz (lo que hace falta para CORRER el pipeline); aquí van los flags, los contratos
y los gotchas para MODIFICAR los scripts.

Todo script usa `playwright-core` + `connectOverCDP` al Chrome de debug (9333) sobre `fb-lib.mjs`.
Lo reversible se scriptea (scrapear, agrupar, expandir, walk, preparar el draft SIN enviar); el
juicio, el style-gate y el `Enter` que publica quedan en Claude+MCP con el GO de Bernard.

Tests: `node --test *.test.mjs` desde `scripts/` (133 al 2026-09-28). `node --test scripts/` no
sirve: toma el directorio como archivo y reporta un fallo falso.

## Scripts

| Script | Etapa | Qué hace | Lo invoca |
|---|---|---|---|
| `fb-lib.mjs` | — | **Lib canónica (Art. 6), todo script la importa.** Nunca toca las tabs de Bernard: siempre abre tab nueva en el contexto logueado. Mapeo método→caller abajo. | los demás scripts |
| `notif-scan.mjs` | 1 | Scrapea notificaciones, agrupa por `post_id` real, separa el ruido de seguridad, ordena por deuda y emite una `openUrl` por hilo. `--json` para pipear. | paso 0 de [notification-agrupation] |
| `debt-sweep.mjs` | 1 (0.5) | Deuda desde el MOAT, no desde FB (el embudo de notificaciones agrega y vence). Itera los `thread_id` con `pending`/`goalpost` (`getOpenDebtThreads`), reconstruye la `openUrl` vía `data/threads.json` (lo puebla `thread-extract`) y re-extrae en vivo reportando `owes:true`/`suspect`. `freshestMin 99999` = edad sin fechar (candidata, no fresca). Tope 7d: los `stale` se listan como VIEJOS y no se abren; se cierran con `close-outcomes --stale`. | paso 0.5 de [notification-agrupation] |
| `scout-feeds.mjs` | 1 (0.7) | Hilos AJENOS. Barre el feed cronológico de los grupos del registro (`destinatarios-canales.txt`), 1 carga por grupo, solo lectura (el único "click" es el hover que resuelve permalink y fecha); surfacea posts de otros < 48h con actividad donde Bernard no ha comentado ni están en el moat, ordenados por reacciones/comentarios/frescura + pista léxica de táctica. `comments` es PISO (solo los previews), `reactions` es la señal fiable. Lógica pura en `scout.mjs`. | paso 0.7 de [notification-agrupation] |
| `thread-extract.mjs` | 2 | Toma la `openUrl`, recorre la vista canónica y la anclada, expande todo, walk de `div[role=article]`, dedup de los 2 renders de FB, árbol padre→hijo + tabla de deuda. `--json` trae `root` (cuerpo del post raíz, sin edad a propósito) y `turns[]` (solo comentarios, sin `comment_id`). Watchdog global de 240 s (`THREAD_EXTRACT_TIMEOUT_MS`): si no termina, cierra su tab, nombra la etapa (`goto`/`expand`/`walk`) y sale con código 2 (2026-10-02: un `evaluate(expandAllInPage)` se quedó 30 min mudo; `evaluate` no tiene timeout propio). | paso 0 de [thread-actor-dossier] |
| `lurker-sweep.mjs` | 0 (moat) | Re-extrae los hilos frescos del moat, liga cada reply tuyo a su interacción por los drafts consultados (`.coagent/<post_id>.consult.json`; sin match único no escribe) y guarda las respuestas de terceros verbatim (`third_party_replies`, proxy primario que el reflex codifica en `third_party_stance`) más `lurker_reactions` (secundario: incluye la reacción del propio oponente). Empata por `draft_sha` cuando existe. `framework-stats` lo agrega. `--dry-run`, `--json`. | tras el reflex, en lote |
| `moat-link-drafts.mjs` | 0 (moat) | Backfill de `draft_sha` en interacciones (sin él el lurker-sweep no desambigua dos interacciones del mismo actor en el hilo). Propone por autor+hilo+día, desempata cronológico, ignora versiones superseded o no posteadas. `--since YYYY-MM-DD`, `--apply`. | al cerrar un lote con interacciones sin `draft_sha` |
| `comment-prepare.mjs` | 4 (prep) | Abre el hilo, localiza el comentario por `--author`+`--anchor`, abre su Reply y pega el `--body-file` como reply etiquetada (respeta la auto-mención; gotcha anidado). `--image <png>` adjunta con `setInputFiles` (el preview vive FUERA del `<form>`; se verifica por "Remove photo" del mismo contenedor). `--mode root`: comentario raíz en post ajeno; `--author` = autor del post, aborta (`root-author`) si es de otro, pega en el "Comment as …" fuera de todo comentario y no toca uno con texto. Verifica async y NO envía: deja la tab viva y reporta el handoff. | paso 0.5 de [comment-post-and-verify] |
| `receipt-shots.mjs` + `receipt-collage.py` | 2/3 | Recibos de procedencia en imagen: abre cada hilo, localiza el comentario por autor + frase, la envuelve en `<mark>` amarillo y captura la burbuja (viewport + recorte por `getBoundingClientRect`; el element-screenshot de Playwright sale desplazado en el diálogo). El collage apila los PNG con caption grupo·fecha y va como `--image`. Spec por lote en `.coagent/receipts/<lote>/spec.json`. | [provenance-accusation-defense] |
| `reflex.mjs` | 0 | `emit` arma packets de `.coagent/tx-*.json` (el arco es solo del actor: `actorArc`); Claude juzga → `.coagent/reflex-verdicts.json`; `apply` escribe vía `db.updateInteractionOutcome` y deja `.coagent/reflex-applied.json`. El gate bloquea el staging mientras los packets sean más nuevos que ese marcador: para inspeccionar después de un apply, emite a `--out <scratch>`. | etapa 0 de [outcome-reflex] |
| `framework-pick.mjs` + `framework-rotation.mjs` | 3 | ANTES del master, por target: `exposure_n`, framework bloqueado (desde la 3a exposición, el de la reply anterior), shortlist de 3 familias distintas por tácticas y sorteo del 25% en targets civiles/compasivos/persuadibles. Escribe `.coagent/picks/<post>-<slug>.json` una sola vez (no se re-sortea). Política en `data/vocab.json` → `rotation`. | [coagent-advise] |
| `seed-coagent.mjs` | 3 | Recibo de consulta (`seed`/`finalize --framework`, lo exigen los hooks; finalize rechaza un framework bloqueado, de auto-disciplina o distinto del sorteado) y transporte: `insert` pega el master gateado por trozos, verifica por arreglo de líneas y NO envía; `read` lee la respuesta por estabilidad. Lógica en `coagent-transport.mjs`. | [coagent-advise] |
| `close-outcomes.mjs` | 0 (fallback) | Cierre por keywords + guard de frescura, fallback offline del reflex. `--stale [--dry-run]` cierra como `silent` la deuda más vieja que el tope, sin transcript, guardando `closed_from`. | [outcome-reflex] / cierre de lote |
| `style-gate.mjs` / `seed-gate.mjs` / `lint-prose.mjs` | 3/4 | Gates deterministas de la prosa (kill-list, vocativo, staccato, eje welfarista/biocéntrico, cierre clonado en modo lote). Detectores SSOT: `welfarist-axis.mjs`, `biocentric-axis.mjs`, `closer-clone.mjs`. Ver `STYLE-GATE.md`, `SEED-GATE.md`. | etapas 3 y 4 |
| `validate-data.mjs` / `gen-dossiers.mjs` | — | Integridad de `data/*.json` y regeneración de `analysis/actors/*.md` (vista generada). | tras cualquier escritura al moat |

## `fb-lib.mjs` — método → caller

| Método | Qué entrega | Callers |
|---|---|---|
| `openScratchPage()` | tab efímera (`done()` la cierra), para leer | `notif-scan`, `thread-extract`, `seed-coagent read` |
| `openPersistentPage()` | tab persistente (`detach()` suelta el CDP, la tab sigue viva) para dejar el draft cargado | `comment-prepare`, `seed-coagent insert` |
| `readThreadRoot(page)` | autor, `user_id` y texto del post raíz. Su `ageStr` NO es confiable (toma el primer timestamp del scope, a veces de un comentario) | `thread-extract`, `comment-prepare --mode root` |
| `expandAllInPage` | expande "View more / N replies / See more" (SSOT; la copia vieja de `comment-prepare` no cazaba "X replied · N Replies") | `thread-extract`, `comment-prepare` |
| `ageMinutes(text)` / `fmtAge(min)` | minutos desde "15m"/"3h" y "15 minutes ago"; display | `thread-extract`, debt |
| `CDP_URL` | endpoint del Chrome de debug (`9333`, override `CDP_URL`) | todos |

## Contratos que ya mordieron

- `cli-args.mjs` es el parser compartido por `comment-prepare` y `.claude/hooks/coagent-provenance-gate.mjs`: un flag nuevo va en `PREPARE_FLAGS` y se valida en los dos. Tests en `gates.test.mjs`.
- Los hooks (`coagent-provenance-gate`, `mcp-publish-gate`, `pipeline-freshness-cap`) se prueban por stdin con un payload JSON en archivo, nunca poniendo el nombre del script en un comando Bash (el matcher es amplio a propósito).
- `db.mjs` es la única capa que escribe `data/actors.json`; `updateInteractionOutcome` rehúsa degradar un `conceded` sin `force:true`.
- `bando`/`verdict`/`register`/`tone` son enums cerrados en `data/vocab.json` (política: valores, su porqué y los pesos de `actor-heat`). `upsertActor` rechaza un valor fuera del vocab y `validate-data` falla; el matiz va en `<campo>_note`. Un valor nuevo se agrega al vocab con su `heat`, nunca como texto libre (2026-09-28: 6 actores puntuaban con el default de `actor-heat` sin aviso).
- Quién usa una táctica se DERIVA de `actor.tactics` (`getActorsByTactic`, y `backend/` hace lo mismo). `tactics.json` no guarda índice inverso y `validate-data` falla si reaparece `actors_known` (el campo se borró el 2026-09-28: tenía 130 pares desincronizados a mano).
- Desde el 2026-09-29 toda interacción lleva `exposure_n`, `assignment` (`chosen`/`randomized`) y, si es sorteada, `propensity`, copiados del recibo de `finalize`; `appendInteraction` y `validate-data` rechazan repetir el framework anterior del target desde la 3a exposición (`db.interactionProblems`).
- `threads[]` es superset de los `thread_id` de sus interacciones: `appendInteraction`/`upsertActor` lo mantienen y `validate-data` lo exige (estaba desincronizado en 31 de 61 actores y `getActorsForThread` perdía gente).
