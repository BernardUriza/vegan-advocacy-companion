# Pipeline Mechanics — notas de implementación de los scripts

Notas técnicas de la mecánica de `scripts/`. Cubre lo **completable sin red**
(item #1, item #2) y deja documentados — **NO implementados a ciegas** — los
cambios que tocan paths con Chrome/FB en vivo (#32, #33). El worktree no puede
verificar contra FB; implementar selectores nuevos sin ver el DOM real es la
trampa del fake-green (Art. 2). Se documenta el approach para que la próxima
sesión (con Chrome de debug vivo en 9333) lo cierre con verificación.

---

## Hecho (sin red)

### `pipeline-status.mjs` — dashboard de solo lectura
Panel de control de `data/*.json` vía `db.mjs`. Cero Chrome, cero escritura.
- **Deuda abierta:** interacciones con `outcome` ∈ {`pending`, `goalpost`} (el
  intercambio sigue vivo). `silent`/`engaged` se consideran cerrados.
- **Frameworks sin probar:** un framework está "probado" si **algún** interaction
  lo desplegó (`interaction.framework === framework.id`). Hoy solo
  `algo-a-alguien-sujeto-derecho` está desplegado → 54/55 en el estante.
- **Reparto del tablero:** actores por `bando` / `verdict` / `register`, más los
  perfilados-sin-contestar (tienen `threads` pero cero `interactions`).
- `--json` para pipear. Corre: `node scripts/pipeline-status.mjs`.

### `fb-lib.mjs :: readThreadRoot(page)` — extraer el POST RAÍZ (no el 1er comentario)
**Añadido (no reescribe nada).** Bug que arregla: `thread-extract.mjs#walkArticles`
camina solo `div[role="article"]`, que en FB son los **comentarios** — el post
raíz NO es un `div[role="article"]`, es la "story" del feed/dialog. El walk nunca
lo capturaba, así que el "root" del transcript terminaba siendo el primer
comentario.

Estrategia de selectores (razonada; **necesita verificación en vivo, diferida**):
1. **Autor/ancla:** heading `"<Autor>'s Post"` (`h2`/`[role=heading]`), o el
   `aria-label` del `[role=dialog]` en vista permalink. Mismo heuristic que
   `walkArticles` ya usa para `postOwner`.
2. **Cuerpo:** `[data-ad-rendering-role="story_message"]` (legacy
   `[data-ad-comet-preview="message"]`) — exclusivo del cuerpo de la story, no
   aparece en comentarios. Fallback: el `[role=article]` de nivel superior cuyo
   `aria-label` NO empieza con `Comment by`/`Reply by`.
3. **Edad/user_id:** primer link de timestamp y primer `a[href*="/user/"]` dentro
   del scope de la story.

Devuelve `{ ok, author, user_id, ageStr, text, via }` — `via` reporta qué selector
pegó, para auditar en vivo cuál sobrevive a un render nuevo de FB. El caller
parsea la edad con `ageMinutes(ageStr)`.

**Pendiente de verificación en vivo (diferido):** abrir un hilo real, correr
`page.evaluate(...)` con esta lógica y confirmar que `text` es el cuerpo del post
(no un comentario) y que `author` coincide con el dueño del post. Una vez verde,
cablearlo en `thread-extract.mjs` como el turno raíz del transcript (hoy el `walk`
no emite uno).

---

## Diferido — tocan Chrome/FB en vivo (NO implementados a ciegas)

### #32 — `notif-scan.mjs`: notifs de perfil personal con `pfbid` en vez de `post_id` numérico

**Síntoma.** El agrupado por hilo se ancla en `post_id` numérico (query param,
`multi_permalinks`, o `/posts/<\d+>`). Las notificaciones que vienen de un **perfil
personal** (no de grupo) traen el id del post como **`pfbid…`** (id ofuscado base-
encoded), no numérico. El regex `/\/posts\/(\d+)/` y `p.get('post_id')` no lo
capturan → `post_id` sale `null` y esas notifs caen al fallback de agrupar por
`comment_id`, partiendo un mismo post en varias filas (el mismo defecto que el fix
2026-06-16 resolvió para grupos).

**Approach propuesto (verificar el DOM real antes de codear).**
1. **Ver primero qué trae la URL real** de una notif de perfil (`/permalink/`,
   `story_fbid=pfbid…`, `/posts/pfbid…`). El parseo debe partir del href observado,
   no de un assumption — por eso es diferido.
2. Ampliar la extracción de id en `extractInPage()` para reconocer la forma
   `pfbid`: además de `post_id`/`multi_permalinks`/`/posts/<\d+>`, leer
   `story_fbid`/`fbid` y `/posts/(pfbid[\w-]+)` / `/permalink/(\d+)/`. La key de
   agrupación pasa a ser `post_id ?? story_fbid ?? pfbid`.
3. **No mezclar espacios de id.** Un `pfbid` y un numérico del mismo post NO son
   trivialmente intercambiables; FB a veces da ambos en distintas notifs del mismo
   hilo. Si se ven los dos para un hilo, normalizar a una sola key (preferir el
   numérico cuando exista) requiere observar el caso real — anotado como sub-riesgo.
4. Construir `openUrl`: para `pfbid`, la forma estable suele ser
   `https://www.facebook.com/<id-o-pfbid>/posts/<pfbid>/` o `/permalink/`. Confirmar
   cuál abre en el comentario correcto antes de fijarla.

**Verde = qué probar en vivo.** Correr `notif-scan` con una notif de perfil
presente y confirmar: (a) `post_id`/key ya NO es null, (b) varias notifs del mismo
post de perfil colapsan en UNA fila, (c) el `openUrl` emitido abre el hilo en el
comentario ancla. Hasta entonces, el path MCP de [notification-agrupation] es el
fallback declarado.

### #33 — `comment-prepare.mjs`: auto-pick del comentario freshest `owes:true`

**Hoy.** `comment-prepare.mjs` exige `--author` (+ `--anchor`) para localizar el
comentario a contestar. El operador decide el target a mano a partir de la tabla de
deuda de `thread-extract.mjs`.

**Lo que se quiere.** Que `comment-prepare` (o un paso intermedio) pueda
**auto-elegir** el comentario objetivo: el **freshest con `owes:true`** de la tabla
de deuda — exactamente el criterio que `thread-extract.mjs#buildDebt` ya calcula
(`debt[]` ordenado: `reply` activa antes que `root`, dentro por frescura, con
`owes`/`suspect`). El aprendizaje 2026-06-18 (Frank Teuton) es la razón: el target
correcto es `owes:true`, **no** el turno más reciente del hilo (que puede ser un
sub-debate entre terceros).

**Approach propuesto (verificar en vivo antes de cablear).**
1. **Reusar la deuda, no recalcular.** Dejar que `thread-extract.mjs --json` emita
   `debt[]` (ya lo hace) y que `comment-prepare` acepte un `--auto` que tome
   `debt.find(d => d.owes && !d.suspect)` (el primero ya es el freshest por el sort
   existente). El `author` sale de `d.author`; el `--anchor` se deriva del `text`
   del turno correspondiente en `turns[]` (una frase única de ese comentario).
   Cero lógica de deuda nueva — solo consumir la que ya existe (Art. 6).
2. **`suspect` NO se auto-postea.** Si el top de deuda es `suspect:true` (rama
   ambigua que `buildDebt` marcó para verificar en vivo), `--auto` debe **negarse**
   y pedir target explícito — auto-elegir un suspect es justo lo que el margen
   anti-conservador existe para evitar (Art. 2). Reportar el suspect y parar.
3. **El anchor sigue siendo crítico.** Sin una frase ancla, `openComposer()` toma
   el primer match del autor y puede abrir el Reply equivocado (el autor aparece en
   varias ramas). Derivar el anchor del `text` del turno (primeras ~6 palabras
   únicas) y verificar que desambigua antes de pegar.
4. **El firewall no cambia.** `--auto` solo automatiza la **elección** del target
   (reversible: prepara, no envía). El `Enter` irreversible sigue siendo de
   Claude+MCP con el GO de Bernard. Auto-pick ≠ auto-post.

**Verde = qué probar en vivo.** Sobre un hilo real: `--auto` elige el mismo target
que un humano elegiría leyendo la tabla de deuda, abre el Reply correcto (anchor
desambigua), deja el draft cargado sin enviar, y se **niega** cuando el top es
`suspect`. Hasta entonces, el target manual (`--author`+`--anchor`) es el path
declarado.

---

## Por qué estos dos quedaron diferidos

Ambos cambian la **extracción/selección sobre el DOM vivo de FB** (#32: un id que
solo se ve en notifs reales de perfil; #33: encadenar la deuda real de un hilo
cargado). Implementar selectores o keys de agrupación sin ver el DOM que producen
es exactamente el anti-patrón que el pipeline evita: el `node --check` pasa, el
import falla solo por `playwright-core` ausente en el worktree, pero **nada prueba
que el selector pegue contra FB**. Se documenta el approach con su criterio de
"verde" para que la próxima sesión con Chrome lo cierre verificando, no adivinando.
