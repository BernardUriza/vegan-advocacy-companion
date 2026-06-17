# vegan-advocacy-companion

## El pipeline de debate (4 etapas, engrasado)

Flujo canónico para procesar la actividad de Facebook en los grupos de debate
vegano — cada etapa con su GOLDEN PATH determinista (selectores, secuencias y
gotchas ya pagados). Alto volumen, fricción cero:

**1 [notification-agrupation]** (agrupar por `post_id`) → **2 [thread-actor-dossier]**
(perfilar actores, solo análisis) → **3 [coagent-advise]** (borrador del coagent)
→ **4 [comment-post-and-verify]** (postear + verificar, irreversible, autorizado
por jugada). La mecánica universal de inserción en editores ricos vive en el
playbook (`chrome-devtools-contenteditable-input`).

El estilo de los replies (humano, no robótico) lo gobierna
[reply-output-style](.claude/rules/reply-output-style.md) — etapa 4 compara el
borrador contra ese spec y reformula si suena a IA.

## Scripts del pipeline (`scripts/`) — SSOT de automatización

Las partes **mecánicas y deterministas** (scrapear, agrupar, expandir, walk del
árbol) están scripteadas con `playwright-core` + `connectOverCDP` al Chrome de
debug (9333): colapsan ~6 round-trips del MCP en un `node`, sin quemar tokens.
El **juicio** (qué jugada, prosa del dossier, master prompt), el **style-gate**, y
el **acto irreversible** (el `Enter` que publica + su verificación histérica)
NUNCA se scriptean — eso es de Claude + MCP + Bernard. La frontera es el firewall
del Art. 4: lo **reversible** se scriptea (scrapear, agrupar, expandir, walk,
**y preparar el draft en el composer SIN enviar**); el `Enter` y todo lo
outward-facing se queda en Claude.

| Script | Etapa | Qué hace | Lo invoca |
|---|---|---|---|
| `fb-lib.mjs` | — | **Lib canónica (Art. 6) — todo script la importa.** NO toca las tabs de Bernard: siempre abre tab nueva en el contexto logueado. Ver el mapeo método→caller abajo. | los demás scripts |
| `notif-scan.mjs` | 1 | Scrapea notificaciones, agrupa por `post_id` real, separa el ruido de seguridad, ordena por deuda, y emite una **`openUrl` lista** por hilo. `--json` para pipear. | paso 0 de [notification-agrupation] |
| `thread-extract.mjs` | 2 | Toma la `openUrl`, expande TODO, walk de `div[role=article]`, dedup de los 2 renders de FB, árbol padre→hijo + **tabla de deuda** determinista. `--json` alimenta dossiers/transcript. | paso 0 de [thread-actor-dossier] |
| `comment-prepare.mjs` | 4 (prep) | **PREPARACIÓN reversible:** abre el hilo, localiza el comentario por `--author`+`--anchor`, abre su Reply, pega el `--body-file` como **reply etiquetada** (respeta la auto-mención; gotcha anidado), verifica async — y **NO envía**. Deja la tab **viva** con el draft y reporta el handoff. | paso 0 de [comment-post-and-verify] |

**`fb-lib.mjs` — método → caller (todo método tiene dueño; Art. 6):**

| Método | Qué entrega | Callers |
|---|---|---|
| `openScratchPage()` | tab **efímera** (`done()` la cierra) — para leer/scrapear | `notif-scan.mjs`, `thread-extract.mjs` |
| `openPersistentPage()` | tab **persistente** (`detach()` suelta el CDP, la tab sigue viva) — para dejar el draft cargado y que Claude+MCP haga el `Enter` | `comment-prepare.mjs` |
| `ageMinutes(text)` | minutos desde "15m"/"3h" **y** "15 minutes ago"/"3 hours ago" (ambos renders de FB) | `thread-extract.mjs` (tabla de deuda) |
| `fmtAge(min)` | minutos → "27m"/"4h" para display | `thread-extract.mjs` |
| `CDP_URL` | endpoint del Chrome de debug (`9333`, override `CDP_URL`) | los tres scripts |

**Handoff:** `notif-scan` → `openUrl` → `thread-extract` → (jugada decidida) →
`comment-prepare` deja el draft en una tab viva → **Claude+MCP**: `list_pages` →
`select_page` esa tab → re-leer el composer (Art. 2) → `press_key Enter`
(irreversible, GO de Bernard) → verificación histérica `div[role=article]` +
screenshot. Todos los scripts **en prueba**: si un hilo sale raro (render nuevo de
FB, deuda que no cuadra, target no encontrado), caer al path MCP de la regla como
confirmación/fallback. **Etapa 3 (coagent) es MCP a propósito** — sin script: la
interfaz de ChatGPT cambia más seguido que la de FB y la consulta debe ser a
conciencia (decisión de Bernard, 2026-06-16).

## Rules (`.claude/rules/`)

- [notification-agrupation](.claude/rules/notification-agrupation.md) — etapa uno (**arranca por `scripts/notif-scan.mjs`**): agrupar notificaciones por hilo (`post_id` real), separar el ruido de seguridad (`approve_from_another_device`), ponderar por deuda real (menciones/comentarios > reacciones), emitir la `openUrl` del hilo.
- [thread-actor-dossier](.claude/rules/thread-actor-dossier.md) — etapa dos (**arranca por `scripts/thread-extract.mjs`**): expandir el hilo completo, extraer árbol + tabla de deuda, y perfilar a cada actor en un dossier duro persistente (`analysis/actors/<slug>.md`). Solo análisis, no se responde.
- [coagent-advise](.claude/rules/coagent-advise.md) — etapa tres: seedear al coagent orquestador un master prompt denso con el tablero + la jugada de mayor palanca, para que la stress-testee y redacte el borrador. Claude no postea; el botón de enviar es de Bernard.
- [comment-post-and-verify](.claude/rules/comment-post-and-verify.md) — etapa cuatro (irreversible, autorizada por jugada): paso 0 style-gate, **preparación reversible por `scripts/comment-prepare.mjs`** (localiza el comentario, abre el Reply, pega el draft etiquetado sin enviar y deja la tab viva), luego Claude+MCP re-verifica y hace el `Enter` irreversible + verificación histérica por `div[role=article]` + screenshot, y borra si quedó mal. El paste sintético existe porque el Lexical de FB rompe execCommand.
- [reply-output-style](.claude/rules/reply-output-style.md) — el spec de 20 Q&A de cómo se redactan los replies: humano no robótico, 150–350 palabras, más mordaz al servicio del marco, kill-list de IA-tells, norte = inversión de carga / default ético. Etapa 4 compara contra esto y reformula.
