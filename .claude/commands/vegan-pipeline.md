# /vegan-pipeline - Corre el pipeline de debate vegano de punta a punta (modo lote)

ARGUMENTS: opcional.
- Sin argumento → **modo lote (default)**: arranca desde notificaciones, toma TODAS
  las deudas `owes:true` (cap 4 por lote) y las procesa en paralelo hasta un único
  gate de revisión.
- Un número `N` → limita el lote a las N deudas de mayor palanca.
- Una URL/`post_id` → **modo single**: un solo hilo, sin lote (para un target duro
  o de alto riesgo que merece atención dedicada).

## Contexto

Atajo para correr el pipeline de 4 etapas de `vegan-advocacy-companion`. NO
redefine la mecánica: cada etapa vive en su regla con su GOLDEN PATH (selectores,
gotchas, verificación). Este comando solo las encadena. La guerra es educar al
lector silencioso casual — el output debe sonar humano, no a IA.

**Por qué modo lote (el cuello de botella era el humano, no la mecánica).** El
pipeline serial ponía a Bernard en el loop N veces: scan→extract→coagent→presentar
→GO→postear→repetir desde cero, esperando N veces. Pero las etapas 1–3 son 100%
reversibles (scan, extract, perfilar, redactar) — **no necesitan el GO de Bernard
entre hilos**. Solo el post de la etapa 4 es irreversible (firewall Art. 4). Así
que se hace TODO el trabajo reversible de los top-N de un jalón y se colapsan los N
round-trips humanos en **un solo gate de revisión de lote**. Bernard sigue viendo
cada texto y autorizando antes de cualquier post — solo aprieta el botón una vez
por N, no N veces.

**El guard de calidad es innegociable (Art. 3).** Batchear NO degrada cada
borrador: la guerra del lurker se gana por calidad, no por volumen — un draft
robótico desperdicia lectores. Por eso: el coagent stress-testea CADA jugada con su
`what_not_to_do`, el style-gate corre **por-draft**, y la revisión de lote presenta
cada borrador con suficiente detalle para vetar individualmente. La velocidad sale
de matar la latencia humana, NO de cortar esquinas. Un target sofisticado (Adam
Gaska, Les en el crux) puede pedirse en **modo single** o con seed dedicado dentro
del lote.

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
- Modo single (hay URL/`post_id`): saltar la agrupación e ir directo a ese hilo.
- Modo lote (sin arg / con `N`): **correr `cd scripts && node notif-scan.mjs --json`**
  (triage: agrupa por `post_id` real, separa el ruido de seguridad, ordena por
  deuda, emite la `openUrl` por hilo). Tomar las `openUrl` de los hilos `🔴` (alta
  deuda); el cap del lote es `N` o 4. MCP solo si el script falla.

### Etapa 2 — Perfilar los hilos del lote · regla [thread-actor-dossier]
- **Correr `node thread-extract.mjs "<openUrl>" --json` por CADA hilo del lote**
  (un loop; los hilos son independientes). Quedarse SOLO con los targets `owes:true`
  reales — descartar la frescura sin deuda (CarolAnn/Adam hablándole a un aliado no
  es deuda tuya). El conjunto de `owes:true` a través de los hilos = los blancos del
  lote.
- Volcar el transcript íntegro de cada hilo a `analysis/threads/<post_id>-<slug>.md`
  (markdown human-written, NO generado).
- **Perfilar actores = escribir el JSON SSOT, no el markdown.** Por cada actor,
  `upsertActor({...})` (llave = `user_id`; acumular). Etiquetar `tactics` con IDs de
  `data/tactics.json` — táctica nueva → **agregarla a `tactics.json`** con su
  `canonical_counter` + `what_not_to_do`. Luego `validate-data.mjs` y, si el folder
  está despejado, `gen-dossiers.mjs` (una vez, tras todo el lote).
- Solo análisis. El script **surfacea** la deuda; **decidir** las jugadas (deuda
  `owes:true` + lo que más educa al lurker) con los dossiers
  (`getDossierSummary(userId)`). Si hay >cap deudas, elegir las de mayor palanca y
  reportar las que quedan para el siguiente lote (no truncar en silencio — Art. 2).

### Etapa 3 — Borradores del coagent EN LOTE · regla [coagent-advise]
- **Cargar el contexto de TODOS los blancos del lote desde el SSOT**
  (`getDossierSummary(<user_id>)` por target): postura, tácticas, `canonical_counter`
  y `what_not_to_do`.
- Resolver el coagent por identidad (verificar `location.href` al escribir; reusar
  su tab). **Seedearle UN master prompt de lote**: el tablero + las N jugadas
  numeradas, cada una con su target verbatim, su jugada, su riesgo y su
  `what_not_to_do`, pidiéndole que **stress-testee CADA una y redacte N borradores
  numerados** como replies etiquetadas (norma del grupo, nunca root) en la voz de
  Bernard — y que marque explícito si alguna jugada le parece débil.
  - **Escape de calidad:** para un target sofisticado/alto-riesgo, darle su propio
    seed dedicado (no meterlo al lote) o pedir más profundidad en esa jugada.
- Esperar a que termine el streaming (estabilidad de contenido, no el stop-button
  stale). Recoger los N borradores.

### Etapa 4 — Style-gate, REVISIÓN DE LOTE, postear y verificar · regla [comment-post-and-verify]
- **Paso 0 (style-gate POR-DRAFT):** pasar CADA borrador por [reply-output-style];
  si pisa la kill-list (incl. **abrir con el nombre** — el tag de FB ya lo pone, ver
  la regla), se lee como mini-ensayo, o no devuelve al hueso, **reformular** ese
  draft ANTES de presentarlo. El style-gate corre por-draft aunque vengan en lote.
- **GATE de lote (el único paso irreversible):** presentar los N borradores
  style-gated en **UN solo mensaje** — por cada uno: target, hilo, la jugada en una
  línea, y el texto final. NO postear nada sin GO de Bernard. Él autoriza el **lote**
  (todas), un **subconjunto** ("postea 1, 3 y 4"), o edita/veta individuales. El
  firewall se mantiene: cada texto pasó por su ojo; el botón es suyo.
- Con el GO del lote: postear los aprobados **back-to-back** por el golden path
  (`comment-prepare.mjs` → re-leer composer → Enter → verificación histérica por
  `div[role="article"]` + screenshot). Si alguno quedó mal, BORRAR ese; los demás
  siguen.
- **Cerrar el loop en el SSOT por cada post** (`appendInteraction(<user_id>,
  { thread_id, date, their_move, our_reply_summary, framework: <id del framework
  desplegado en etapa-3>, outcome: "pending" })`). **El campo `framework` es
  OBLIGATORIO** — es lo único que alimenta el moat de efectividad
  (`framework-stats` / `getFrameworkWinRate`); sin él, por más corridas que hagas,
  el moat queda vacío y nunca sabrás qué jugada funciona. Registrá el id del
  framework que el draft realmente usó (el que etapa-3 eligió de
  `getFrameworksByTactic`), no el candidato surfaceado. El `outcome` arranca
  `pending` y se cierra en el siguiente run con `close-outcomes.mjs`
  (`conceded`/`escalated`/`silent`/`goalpost`/`engaged`). Luego
  `validate-data.mjs` + (si el folder está despejado) `gen-dossiers.mjs`, una vez al
  cerrar el lote.

## Reglas

- **No postear sin GO de lote.** La etapa 4 es el único paso irreversible; el botón
  es de Bernard. El GO ahora es por LOTE (ve cada texto, autoriza todas / un
  subconjunto / veta individuales) — pero nada se postea sin su autorización.
- **Batch solo lo reversible.** Etapas 1–3 (scan, extract, perfilar, redactar,
  style-gate) corren para todo el lote SIN Bernard en el loop. Etapa 4 (postear) es
  lo único que cruza al mundo y necesita su GO.
- **Calidad por-draft innegociable.** Cada borrador con su stress-test y su
  style-gate; batchear no degrada. Target duro → modo single o seed dedicado.
- **Reply etiquetada a la persona, nunca root** (norma del grupo). El cuerpo
  **NUNCA abre con el nombre** (el tag de FB ya pone la auto-mención; ver
  [reply-output-style]).
- **Output humano, no robótico** — el style-gate por-draft es obligatorio.
- **Verificar con recibos** — DOM + screenshot por cada post, nunca asumir.
- **Frescura ≠ deuda.** Solo `owes:true` entra al lote; un oponente hablándole a un
  aliado no es deuda tuya.
- **Solo análisis en etapas 2–3** — no se toca nada en FB hasta el gate de lote.
- **JSON es la SSOT, el markdown es generado.** Escribir vía `db.mjs`; NUNCA editar
  `analysis/actors/*.md` a mano. Tras escribir: `validate-data.mjs` + `gen-dossiers.mjs`
  (si el folder está despejado; si no, dejar la regen pendiente).
- **La táctica se reutiliza, no se reinventa.** Jalar el `canonical_counter` de
  `data/tactics.json`. Táctica nueva → se agrega a la librería.
- Diagnóstico de Chrome antes de tocarlo; nunca matar Chrome a ciegas.

## Una línea para arrancar

Modo lote → "Corriendo el pipeline en lote sobre las N deudas de mayor palanca."
Modo single (con URL/`post_id`) → "Corriendo el pipeline sobre el hilo indicado."
Luego ejecutar las etapas 1–3 para todo el lote y **parar en el gate de revisión de
lote** (etapa 4).
