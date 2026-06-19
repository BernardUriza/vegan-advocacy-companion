# Thread Actor Dossier — etapa dos: extraer hilo completo y perfilar actores

Segunda etapa ([notification-agrupation] → **thread-actor-dossier** →
[coagent-advise] → [comment-post-and-verify]). Trabajo **forense, solo análisis**
(NO responder, NO reaccionar, NO tocar nada). Dos entregables: transcript íntegro
del hilo + **dossier duro por persona** que se acumula a través de los hilos.

## GOLDEN PATH — la mecánica exacta

**0. EXTRACCIÓN POR SCRIPT (arranque por default).** Antes de tocar el MCP, correr
el extractor headless que reusa la sesión logueada vía CDP:
```bash
cd scripts && node thread-extract.mjs "<openUrl>"          # tabla humana: árbol + deuda
node thread-extract.mjs "<openUrl>" --json                 # JSON para el dossier
```
La `<openUrl>` la sirve `notif-scan.mjs` (campo `openUrl` / línea "abrir:"). El
script (sobre `fb-lib.mjs`) abre una **tab nueva** en el contexto logueado (NO
navega las tabs de Bernard), **expande TODO**, camina los `div[role="article"]`,
**dedupea los dos renders de FB** (espaciado/pegado + badge "· Follow"), clona y
quita los articles anidados antes de leer (si no el padre hereda el timestamp del
hijo → edad corrompida, Art. 2), arma el árbol padre→hijo y una **tabla de deuda
determinista** (oponente que te habló más reciente de lo que respondiste). Devuelve
`{turns[], debt[]}` — todo el walk en un `node`, sin quemar tool-calls del MCP.
**Es extracción + surfaceo, NO la decisión de la jugada:** la tabla de deuda solo
señala candidatas; la jugada se decide con los dossiers (la pluma es de Bernard).
**La frescura de la notificación es TRAMPA — la deuda real es `owes:true`, no el
turno más reciente del hilo** (aprendizaje 2026-06-18): la notif disparó por la
actividad más fresca (Shane↔Rüdiger, 6m) pero era un sub-debate entre DOS terceros,
no dirigido a Bernard; el único `owes:true` era Frank Teuton (5h) — le respondió a
Bernard más reciente de lo que Bernard le contestó. Elegir el blanco por "lo último
que pasó en el hilo" te manda a una rama ajena; elegirlo por `owes:true` (oponente
que te habló y no has contestado) apunta a la deuda real. Si una rama ya tiene tu
turno DESPUÉS del del oponente, esa deuda está PAGADA aunque la notif insista.
El JSON alimenta el transcript (paso 4) y los dossiers (paso 5) directo. **En
prueba** — si un hilo sale raro (render nuevo de FB, deuda que no cuadra), caer al
path MCP (pasos 1–3) como confirmación/fallback. (Requiere `playwright-core` en
`scripts/`; Chrome de debug vivo en 9333 — diagnóstico del `~/CLAUDE.md` si no
responde.)

### Path MCP (confirmación / fallback / cuando necesitas uids de botones)

**1. Abrir el hilo por la URL de la notificación** (la de etapa uno, con su
`comment_id`/`reply_comment_id`) — así FB deja el scroll en el comentario exacto,
no al inicio. `navigate_page` la tab de FB a esa URL → `take_snapshot`.

**2. EXPANDIR TODO antes de extraer (si no, el dossier es fake-green, Art. 2).**
Botones a clickear: `View all N replies`, `View previous replies`,
`View more comments`. **Cada click renumera los `uid`** → `take_snapshot` después
de CADA click y re-localiza el siguiente botón. Repetir hasta que no quede
ninguno. (Si un `click` da "element did not become interactive" o "no longer
exists", re-snapshot y reintenta con el uid nuevo.)

**3. Extraer — en hilos grandes, por JS, NO por snapshot gigante (grease).**
Un `take_snapshot` de un hilo con decenas de comentarios es enorme y caro. Más
ligero: `evaluate_script` que recorra `div[role="article"]` y devuelva por nodo
`{aria-label, user_id (de href*="/user/<id>/"), text}`. El `aria-label` ya trae
"Comment/Reply by X to Y" (la jerarquía) y el autor. Reservar el snapshot para
cuando necesites uids de botones (ej. expandir o el Reply de etapa 4).

Datos a sacar de cada nodo:

| Dato | De dónde |
|---|---|
| Autor | `link` con el nombre dentro del `article` |
| **`user_id`** (llave dura) | de la URL del perfil: `/user/<ID>/` |
| Timestamp | texto del `link` de la hora (`3h`, `27m`…) |
| Texto del comentario | los `StaticText` del `article` (concatenar) |
| Reacciones | botón `N reactions` |
| Quién→quién | el `aria-label` del article: `Reply by X to Y's reply` |
| ¿Es Bernard? | sus comentarios traen botón `Edit or delete this`; los ajenos `Hide or report this` |

**4. Guardar transcript** en `analysis/threads/<post_id>-<slug>.md` (árbol
completo, raíz → última réplica).

**5. Abrir/actualizar dossier por persona** en `analysis/actors/<slug>.md`. Si ya
existe de un hilo anterior, **AÑADIR** la nueva aparición (no sobre-escribir —
Art. 5). La llave es el `user_id` (el nombre se repite, el id no). Actualizar el
índice `analysis/actors/README.md`.

**6. Surfacear el counter-arsenal (no decidir la jugada — eso es etapa-3).** Por
cada táctica etiquetada del actor, consultar `getFrameworksByTactic(tacticId)` (de
`scripts/db.mjs`) y anotar en el dossier **qué frameworks la contrarrestan** (id +
`attack_surface`). Es surfaceo de munición candidata, no la decisión del blanco. El
índice inverso navegable (táctica → frameworks) vive en
`analysis/frameworks/README.md`. La decisión de QUÉ desplegar (un solo framework,
respetando su `attack_surface`) es de etapa-3 ([[coagent-advise]]).

## El dossier — análisis duro (sin suavizar, sin inventar)

| Campo | Qué registra |
|---|---|
| Identidad | nombre, `user_id`, URL de perfil |
| Bando | pro-vegan / anti-vegan / aliado / ambiguo (ambigüedad real se marca, Art. 2) |
| Postura núcleo | la tesis en una línea |
| Tácticas | naturalismo, "normal/default", is-ought, moving goalposts, relativismo, futility, data-dump, welfare rhetoric, sócrates hostil, low-effort/troll |
| Tono | dismissive / civil / sarcástico / buena fe |
| Veredicto de debate | ¿persuadible, audiencia, o pozo sin fondo? |
| Log de acciones | bullets fechados por hilo |

## Solo análisis — la pluma es de Bernard

Esta etapa NO redacta respuestas ni postea. Produce inteligencia para decidir a
quién contestar. Redactar = [coagent-advise]; postear = [comment-post-and-verify],
ambas con su aprobación.

## Por qué existe

Registrada 2026-06-16. Sin un dossier que persista por persona, Bernard re-evalúa
a cada quién desde cero en cada hilo. Los contenedores-por-actor convierten el
companion en memoria longitudinal: quién mueve postes, quién es persuadible, quién
es pozo sin fondo.
