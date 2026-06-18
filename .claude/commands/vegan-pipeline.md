# /vegan-pipeline - Corre el pipeline de debate vegano de punta a punta

ARGUMENTS: opcional — una URL de post/hilo de Facebook o un `post_id` para ir directo a ese hilo. Sin argumento: arranca desde las notificaciones y elige el hilo de mayor palanca.

## Contexto

Atajo para correr el pipeline de 4 etapas de `vegan-advocacy-companion`. NO
redefine la mecánica: cada etapa vive en su regla con su GOLDEN PATH (selectores,
gotchas, verificación). Este comando solo las encadena. La guerra es educar al
lector silencioso casual — el output debe sonar humano, no a IA.

**Automatización primero (ver SSOT de scripts en `CLAUDE.md`).** Las partes
mecánicas de las etapas 1 y 2 ya están scripteadas (`scripts/notif-scan.mjs`,
`scripts/thread-extract.mjs` sobre `fb-lib.mjs`): **arrancar por el script**, no
por el MCP a mano. El MCP queda como confirmación/fallback. Etapas 3 (coagent) y
4 (postear) son MCP a propósito — sin script.

**SSOT de datos: `data/*.json` vía `scripts/db.mjs` (Art. 6).** Los actores y la
librería de tácticas viven en `data/actors.json` + `data/tactics.json` — esa es la
fuente canónica de máquina. Los `analysis/actors/*.md` son **vista generada**
(`scripts/gen-dossiers.mjs`), NO se editan a mano. El pipeline LEE el contexto de
ahí (`getDossierSummary(userId)` da tácticas + `canonical_counter` + qué-no-hacer
ya listos) y ESCRIBE estructurado (`upsertActor`, `appendInteraction`). Tras
cualquier escritura: `node scripts/validate-data.mjs` (falla si hay dangling refs,
drift o user_ids duplicados) y `node scripts/gen-dossiers.mjs` para regenerar los
`.md`. **Si otra sesión está editando `analysis/actors/` (archivos untracked/dirty
ahí), NO regenerar** — clobbearías su trabajo (Art. 5); escribe el JSON y deja la
regen para cuando el folder esté despejado.

Antes de tocar Chrome, diagnóstico del `~/CLAUDE.md` (el puerto suele ser **9333**,
no 9222). Reusar la tab de FB / del coagent abierta; nunca abrir a ciegas.

## Instrucciones

### Etapa 1 — Agrupar notificaciones · regla [notification-agrupation]
- Si hay argumento (URL/`post_id`): saltar la agrupación e ir directo a ese hilo.
- Si no: **correr `cd scripts && node notif-scan.mjs`** (triage: agrupa por
  `post_id` real, separa el ruido de seguridad `approve_from_another_device`,
  ordena por deuda, emite la `openUrl` por hilo). Entregar la tabla y elegir el
  hilo top. MCP solo si el script falla o un hilo sale raro.

### Etapa 2 — Perfilar el hilo · regla [thread-actor-dossier]
- **Correr `node thread-extract.mjs "<openUrl>" --json`** (la `openUrl` la dio la
  etapa 1): expande TODO, walk del árbol, dedup de los 2 renders, y devuelve
  `{turns[], debt[]}`. MCP (expand+walk a mano) solo como fallback si el hilo sale
  raro.
- Volcar el transcript íntegro a `analysis/threads/<post_id>-<slug>.md` (eso sigue
  siendo markdown human-written, NO generado).
- **Perfilar actores = escribir el JSON SSOT, no el markdown.** Por cada actor del
  hilo, `upsertActor({...})` en `data/actors.json` vía `db.mjs` (llave = `user_id`;
  acumular, no sobre-escribir). Etiquetar sus `tactics` con IDs de
  `data/tactics.json` — si una táctica nueva no existe, **agregarla a `tactics.json`**
  con su `canonical_counter` y `what_not_to_do` (la librería crece con cada hilo).
  Luego `node scripts/validate-data.mjs` y, si el folder está despejado,
  `node scripts/gen-dossiers.mjs`.
- Solo análisis. El script **surfacea** la deuda; **decidir** la jugada de mayor
  palanca (la deuda más fresca + la que más educa al lurker) con los dossiers
  (`getDossierSummary(userId)`).

### Etapa 3 — Borrador del coagent · regla [coagent-advise]
- **Cargar el contexto del blanco desde el SSOT:** `getDossierSummary(<user_id>)`
  da postura, tácticas observadas, su `canonical_counter` y `what_not_to_do` por
  táctica — el master prompt se arma con eso, no re-derivando desde cero.
- Resolver el coagent por identidad (verificar `location.href` al escribir;
  reusar su tab, no duplicar). Seedearle el master prompt denso: tablero + jugada
  + riesgo a anticipar + **el `what_not_to_do` del actor**, pidiéndole stress-test
  y borrador **como reply etiquetada** (norma del grupo, nunca root) en la voz de
  Bernard.
- Esperar a que termine el streaming; entregar veredicto + borrador a Bernard.

### Etapa 4 — Style-gate, postear y verificar · regla [comment-post-and-verify]
- **Paso 0 (style-gate):** pasar el borrador por [reply-output-style]; si pisa la
  kill-list de IA-tells, se lee como mini-ensayo o no devuelve al hueso del marco,
  **reformular** más corto/afilado/humano ANTES de seguir.
- **Gate irreversible:** mostrar el borrador final + dónde va (reply etiquetada a
  la persona). NO postear sin GO explícito de Bernard sobre ese texto (autorizado
  por jugada).
- Con el GO: golden path (evento paste sintético → Enter → verificación histérica
  por `div[role="article"]` + screenshot). Si quedó mal, BORRAR.
- **Cerrar el loop en el SSOT (outcome-track / el delta).** Posteado y verificado,
  `appendInteraction(<user_id>, { thread_id, date, their_move, our_reply_summary,
  outcome: "pending" })` en `data/actors.json`. El `outcome` arranca `pending` y se
  actualiza en el siguiente run cuando se vea la reacción del actor
  (`conceded` / `escalated` / `silent` / `goalpost`). Esto es lo que mide si el
  pipeline EDUCA, no solo si postea. Luego `validate-data.mjs` + (si el folder está
  despejado) `gen-dossiers.mjs`.

## Reglas

- **No postear sin GO por jugada.** La etapa 4 es el único paso irreversible; el
  botón de enviar es de Bernard.
- **Reply etiquetada a la persona, nunca root** (norma del grupo).
- **Output humano, no robótico** — el style-gate de la etapa 4 es obligatorio.
- **Verificar con recibos** — DOM + screenshot, nunca asumir que posteó.
- **Solo análisis en etapas 2–3** — no se toca nada en FB hasta la etapa 4.
- **JSON es la SSOT, el markdown es generado.** Escribir vía `db.mjs`
  (`upsertActor`/`appendInteraction`), NUNCA editar `analysis/actors/*.md` a mano.
  Tras escribir: `validate-data.mjs` (debe pasar) + `gen-dossiers.mjs` (si el folder
  está despejado de sesiones paralelas; si no, dejar la regen pendiente).
- **La táctica se reutiliza, no se reinventa.** Antes de redactar, jalar el
  `canonical_counter` de la táctica desde `data/tactics.json`. Táctica nueva → se
  agrega a la librería, no se improvisa suelta.
- Diagnóstico de Chrome antes de tocarlo; nunca matar Chrome a ciegas.

## Una línea para arrancar

Sin argumento → "Corriendo el pipeline desde notificaciones." Con argumento →
"Corriendo el pipeline sobre el hilo indicado." Luego ejecutar etapa por etapa,
parando en el gate de la etapa 4.
