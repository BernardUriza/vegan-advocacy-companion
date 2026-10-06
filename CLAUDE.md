# vegan-advocacy-companion

Pipeline para debatir en grupos veganos de Facebook ("Vegans V's Meat Eaters" y hermanos):
de la notificación al reply publicado y verificado, escrito para el lector silencioso. Las
reglas de `.claude/rules/` se cargan solas; este archivo es el mapa y no las repite.

## El pipeline (cada etapa es una regla con su GOLDEN PATH)

0 [outcome-reflex] re-juzga el moat con LLM → 1 [notification-agrupation] notifs, deuda del
moat y scout → 2 [thread-actor-dossier] extraer y perfilar, solo análisis → 3 [coagent-advise]
master en loop invertido a insult-gpt → 4 [comment-post-and-verify] style-gate, GO de lote,
publicar y verificar. El atajo es `/vegan-pipeline`. Posts raíz propios: [root-post-publish].
Eje y voz de todo lo que se escribe: [abolitionist-framing], [sentiocentrism-not-biocentrism],
[reply-output-style]; defensas: [insult-seal-defense], [provenance-accusation-defense],
[retreat-cycle-defense]. Mecánica transversal: [pipeline-freshness-cap].

**El firewall (Art. 4):** lo reversible se scriptea (scrapear, agrupar, expandir, preparar el
draft en el composer SIN enviar). El juicio, el style-gate y el `Enter` que publica son de Claude
con MCP, y solo con el GO explícito de Bernard, por jugada o por lote.

## Scripts (`scripts/`, detalle y flags en `scripts/CLAUDE.md`)

| Etapa | Script | Para qué |
|---|---|---|
| 0 | `reflex.mjs emit` / `apply` | packets por actor → verdicts de Claude → escribe outcomes + marcador |
| 0 | `close-outcomes.mjs --stale` | cierra como `silent` la deuda > 7d; correr al cerrar cada lote |
| 0 | `lurker-sweep.mjs`, `moat-link-drafts.mjs` | respuestas de terceros (proxy) y reacciones (secundario) por reply; backfill de `draft_sha` |
| 1 | `notif-scan.mjs --json` | notifs agrupadas por `post_id` con `openUrl` |
| 1 | `debt-sweep.mjs` · `scout-feeds.mjs --json` | deuda viva del moat · hilos ajenos < 48h |
| 2 | `thread-extract.mjs "<url>" --out .coagent/tx-<post_id>.json` | `root`, `turns[]`, `debt[]`; `--out` UNE con el tx anterior (lo que la vista ya no carga queda `retained`), nunca redirigir `--json >` sobre un tx existente |
| 3 | `framework-pick.mjs` → `seed-gate.mjs` → `seed-coagent.mjs seed/insert/read/finalize` | exposición, framework bloqueado, sorteo por target y brazo de voz (`voice_trial`, 50/50 profano/limpio en filo); gate del master, recibo, transporte a ChatGPT sin enviar, recibo del draft final (`finalize --framework` valida el pick y el brazo de voz) |
| 4 | `style-gate.mjs a.txt b.txt …` · `lint-prose.mjs` | gates de prosa por lote (cierres clonados incluidos) |
| 3–4 | `quote-check.mjs <draft>` | toda cita de 4+ palabras existe verbatim en transcripts/moat/hilos; `finalize` lo corre y bloquea (`--quote-ok` para comillas que no son cita) |
| 4 | `comment-prepare.mjs … [--mode root] [--image]` | deja el reply o el raíz cargado en una tab viva, sin enviar |
| — | `validate-data.mjs` · `gen-dossiers.mjs` | tras toda escritura al moat |
| — | `framework-stats.mjs` | efectividad por familia con intervalo Jeffreys; solo lo sorteado compara |

Todos hablan con el Chrome de debug en **9333** por CDP (diagnóstico en `~/CLAUDE.md`). Tests:
`node --test *.test.mjs` desde `scripts/`.

## Dónde vive cada cosa

- `data/*.json` es el SSOT del moat (actores, tácticas, frameworks, hilos) y solo se escribe con
  `scripts/db.mjs`. `analysis/actors/*.md` es vista generada: nunca a mano, y no se regenera si
  otra sesión tiene cambios sin commitear ahí.
- `.coagent/` es el estado de trabajo de cada lote: `tx-*.json`, masters, recibos
  `<post_id>.consult.json`, drafts, respuestas del coagent, `receipts/` con screenshots.
- `analysis/threads/` transcripts, `analysis/post-ideas/` semillas de posts raíz,
  `analysis/frameworks/README.md` índice táctica → frameworks, `doctrine/` doctrina fundacional.
- `iceberg/`: página D3 del iceberg del especismo; SSOT `iceberg/data.js`, `moat.js` se genera
  con `node scripts/iceberg-build.mjs` (ver `iceberg/README.md`).
- `.claude/destinatarios-canales.txt`: los únicos grupos donde se publica (lo llena Bernard).
- `.claude/hooks/`: `coagent-provenance-gate` (staging sin recibo, reflex sin apply, cierre
  clonado), `mcp-publish-gate` (paste por MCP sin draft consultado para ese post),
  `pipeline-freshness-cap` (tope de edad).
- Prototipo viejo, no es el producto: la extensión de Chrome (`manifest.json`, `background.js`,
  `sidepanel/`, `content/`, `_locales/`) y `backend/` (Next.js). No se toca sin que Bernard lo pida.

## Gotchas que cuestan una vuelta

- Los hooks bloquean cualquier comando Bash que MENCIONE el script de preparación de replies,
  incluso en un mensaje de commit o un heredoc. Para rutas usa `scripts/comment-*.mjs`; en texto,
  "reply staging". Para probar un hook, pásale el payload JSON por stdin desde un archivo.
- Corre los scripts desde la raíz del repo: el hook de envío resuelve el registro de canales
  desde el cwd.
- `.claude/rules/` está gobernado por la constitución: nada de `cd` hacia ahí, globs ni pipes.
  Rutas absolutas, una operación por comando.
- Después de `reflex apply` no vuelvas a emitir sobre `.coagent/reflex-packets.json`: queda más
  nuevo que el marcador y bloquea todo staging. Para inspeccionar, `emit --out <scratch>`.
- La edad del post raíz que da `readThreadRoot` no es confiable; la de los turnos sí.
