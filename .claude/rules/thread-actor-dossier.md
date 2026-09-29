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

**PERO la tabla de deuda es SOLO para el modo lote. En modo SINGLE (un replylink) el
blanco lo manda el LINK, no la heurística** (aprendizaje 2026-06-21, bug real): si la
URL trae `reply_comment_id`/`comment_id`, ESE comentario exacto es el target — un
`reply_comment_id` presente significa que es un **reply**, no un raíz, así que amarrá
el blanco al turno cuyo id == ese, e **IGNORÁ `debt[]`/`owes:true`** (esa tabla por
frescura eligió mal: con el link anclando la réplica de Anna, `owes:true` apuntó a
Indecent Bystander —un raíz— y casi contesto al equivocado). Confirmá el verbatim del
target del link antes de decidir la jugada; si la extracción dejó ramas sin expandir
(`complete:false`, o `completeness.pendingExpandButtons > 0` en alguna pasada), abrí el link para ver el comentario anclado. El replylink es
orden directa: obedecerlo, corto o completo según lo que pida el target.
El JSON alimenta el transcript (paso 4) y los dossiers (paso 5) directo. **En
prueba** — si un hilo sale raro (render nuevo de FB, deuda que no cuadra), caer al
path MCP (pasos 1–3) como confirmación/fallback. (Requiere `playwright-core` en
`scripts/`; Chrome de debug vivo en 9333 — diagnóstico del `~/CLAUDE.md` si no
responde.)

### La URL de notificación ESCONDE raíces — el extractor navega a la URL canónica (2026-09-28)

`thread-extract` recibe la `openUrl` de la notif (`?comment_id=…&reply_comment_id=…`), pero
NO navega a ella: FB pinta el post anclado al comentario y deja raíces sin cargar, sin
ningún botón "View more comments" que las prometa, así que `expandAll` termina y el JSON
sale `complete:true` con un hueco. Caso: la raíz de Frank Teuton (5h, 1 reacción) bajo el
post de sintiencia no apareció en dos extracciones seguidas (7 raíces); la URL limpia del
post pintó las 8. Desde entonces el script navega a `canonicalPostUrl(url)`
(`scripts/thread-identity.mjs`, `/groups/<gid>/posts/<pid>/`) y reporta `navUrl`; el
`comment_id` sigue vivo en `url` para localizar el target en single y para
`comment-prepare`, que sí abre la URL anclada porque necesita el foco en ese comentario.
Si Bernard manda un replylink cuyo comentario no aparece en el `tx`, ese es el síntoma:
no es que no exista, es que la vista anclada no lo cargó.

Corrección del mismo día: la canónica sola también miente. En Open Debates 3 pintó 5 turnos
con 0 expansiones y `complete:true` (la anclada daba 17). FB carga un subconjunto distinto en
cada vista, así que el extractor recorre las DOS (canónica y anclada, si la URL trae
`comment_id`) y une los turnos con el dedup de siempre. Medido: 19 turnos en ese hilo, 8
raíces en el de sintiencia (con Frank).

### Esquema del JSON de `thread-extract --json` (no re-parsear ad-hoc, 2026-06-19)

Para leer la salida directo sin escribir re-parsers (lección: asumí campos
inexistentes `theirAgeMin`/`ourAgeMin` y escribí 3 scripts /tmp de más). Campos reales:

- **`debt[]`** (candidatas a deuda, NO la decisión): `author`, `user_id`,
  `freshestMin` (edad en min del turno más fresco del oponente hacia Bernard),
  `owes` (bool), `suspect` (bool), `kind` (`reply`/…), `oppCount`, `myCount`.
  `owes:true` = el oponente tiene turnos hacia Bernard más frescos que la última
  respuesta de Bernard — pero **sobre-dispara** cuando la rama mezcla turnos de
  terceros; confirmar con el contenido antes de elegir blanco (frescura ≠ deuda).
- **`turns[]`**: `author`, `user_id`, `target` (a quién responde; `(root)` si es
  comentario al post), `isMine` (bool, es Bernard), `label` (el aria-label
  "Comment/Reply by X to Y N ago"), `ageStr` (`"10 hours"`), `text`, **`reactions`**
  (entero, 0 si ninguna — la huella del LURKER en ese comentario; sale del botón aria
  `"N reactions; see who reacted to this"` y, de respaldo, del dígito pegado DESPUÉS de
  `LikeReply[Share]`; un número del cuerpo nunca cuenta. Parser puro: `lurker.mjs`).
- **`postReactions`** (raíz, opcional): suma de los labels `"Haha: 3 people"` del
  contenedor del post, anclado a un comentario cuyo link lleva el `post_id`; `null` si no
  hay reacciones visibles o no se pudo anclar (nunca se toma de otro post del feed).
- **`me`, `postOwner`, `postIsMine`, `expand`, `counts`** a nivel raíz.
- **`root`** (desde 2026-09-28, cierra G.35): `{ author, user_id, text, via }` del post raíz,
  leído con `fb-lib.readThreadRoot` en la vista canónica; `null` si no se pudo leer. Sin edad a
  propósito: el lector toma el primer timestamp del scope y con comentarios nuevos marcaba la
  hora de un comentario (Krizel: "7:44 PM" en un post de las 5:52 AM). `turns[]` sigue siendo
  solo comentarios. Filtrar turnos dirigidos a Bernard:
  `t.isMine || (t.target||'').includes('Bernard')`.

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
| **Imagen adjunta** | `<img>` dentro del `article` con `src` de `fbcdn`/`scontent` y `naturalWidth>200`; el `alt` ("May be art of apple", "May be an image of text…") describe el contenido |
| Quién→quién | el `aria-label` del article: `Reply by X to Y's reply` |
| ¿Es Bernard? | sus comentarios traen botón `Edit or delete this`; los ajenos `Hide or report this` |

### 3.5 — LEER las imágenes de los comentarios, no solo el texto (regla dura, 2026-06-21)

**Un comentario puede tener su argumento ENTERO en una imagen adjunta, no en el
texto.** Saltarla es un fake-green de extracción (Art. 2): perfilas al actor sin su
jugada real. `thread-extract.mjs` hoy es **text-only** (no captura imágenes —
backlog), así que en hilos con imágenes la extracción NO está completa hasta que se
miran a ojo. Por cada `article` con `<img>` de `fbcdn`/`scontent`:

1. **Lista las imágenes adjuntas** (filtra avatares: los placeholders son `svg`
   150px; las fotos reales son `fbcdn`/`scontent` con `naturalWidth>200`).
2. **Mira la que importa con visión** (`scrollIntoView` el `<img>` correcto →
   `take_screenshot`). El `alt` orienta pero NO basta — léela.
3. Si el comentario depende de la imagen, **el dossier/transcript registra qué
   muestra** (no solo "adjuntó una imagen").

**Gotcha pagado (2026-06-21):** Anna posteó un bodegón de fruta podrida COMO su
argumento ("las plantas también se ven feas en pintura"). La extracción text-only
lo perdió; al ir a verla, un `scrollIntoView` ciego agarró una imagen del FEED
(un post de lobsters) en vez del cuadro — **targetea el `<img>` por el `article`
del autor + dims/alt, nunca el primer `fbcdn` que aparezca**. La imagen correcta
(`alt:"May be art of apple"`, 480×445, dentro del article de Anna) era la que
volteaba su propio argumento (ver [[reply-output-style]] — "Voltear la evidencia
del oponente"). Sin verla, el draft habría sido genérico.

**4. Guardar transcript** en `analysis/threads/<post_id>-<slug>.md` (árbol
completo, raíz → última réplica).

**5. Abrir/actualizar dossier por persona** en `analysis/actors/<slug>.md`. Si ya
existe de un hilo anterior, **AÑADIR** la nueva aparición (no sobre-escribir —
Art. 5). La llave es el `user_id` (el nombre se repite, el id no). Actualizar el
índice `analysis/actors/README.md`.

**6. Surfacear el counter-arsenal (no decidir la jugada — eso es etapa-3).** Por
cada táctica etiquetada del actor, consultar
`getFrameworksByTactic(tacticId, { weaponsOnly: true })` (de
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
