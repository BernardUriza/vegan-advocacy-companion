# Notification Agrupation — etapa uno: agrupar por hilo, no por notificación

Primera etapa del pipeline (→ [thread-actor-dossier] → [coagent-advise] →
[comment-post-and-verify]). Facebook tira **N notificaciones por el mismo post**
(comentó X, te mencionó Y, +15 reaccionaron…) y parece N cosas cuando es **una
sola conversación**. La regla: nunca lista plana — **agrupar por hilo (post) y
ponderar dónde hay deuda real.** Pipeline de alto volumen: corre el GOLDEN PATH
sin re-explorar.

## GOLDEN PATH — la mecánica exacta

**0. TRIAGE RÁPIDO por script (arranque por default).** Antes de tocar el MCP,
correr el scraper headless que reusa la sesión logueada vía CDP:
```bash
cd scripts && node notif-scan.mjs          # tabla humana ordenada por deuda
node notif-scan.mjs --json                 # JSON para pipear
```
Conecta por CDP al Chrome de debug (`CDP_URL`, default `http://127.0.0.1:9333`),
abre una **tab nueva** en el contexto logueado (NO navega las tabs de Bernard),
extrae las notifs y **agrupa por `post_id` real** (lo lee del query param
`?post_id=` del href de la notif — fix 2026-06-16; antes salía null y partía un
post en varios hilos), separa el ruido de seguridad, ordena por deuda, y emite
una **`openUrl` lista por hilo** — todo sin gastar tool-calls del MCP. El
`openUrl` del hilo top **alimenta directo a `thread-extract.mjs` (etapa 2)**: no
hace falta el MCP para resolver el `post_id`. **En prueba:** el path MCP (pasos
1–6) queda como confirmación/fallback si el script falla o un hilo sale raro
(ej. notifs de perfil personal con `pfbid` en vez de `post_id` numérico, que aún
caen al agrupado por `comment_id`). (Requiere `playwright-core` en `scripts/`; el
Chrome de debug vivo en 9333 — diagnóstico del `~/CLAUDE.md` si no responde.)

**0.5. DEBT SWEEP — la deuda real vive en el MOAT, no en las notificaciones.**
`notif-scan` (paso 0) arranca desde el embudo de FB, y ese embudo es **lossy**: FB
**agrega** ("and N others"), **vence** los avisos viejos, y un debate de hace días
deja de notificar — su deuda se vuelve **invisible** aunque siga abierta. La fuente
de verdad de la deuda NO es FB, es `data/actors.json` (interacciones `pending`/
`goalpost`). Por eso, en lote, correr TAMBIÉN:
```bash
node debt-sweep.mjs            # tabla humana, ordenada por deuda dura
node debt-sweep.mjs --json     # JSON para pipear
```
Itera los `thread_id` con deuda abierta del moat (`getOpenDebtThreads`), reconstruye
la `openUrl` de cada uno desde `data/threads.json` (auto-poblado por `thread-extract`
en cada corrida — el registro thread→group que el moat nunca guardó) y re-extrae en
vivo, reportando los `owes:true`/`suspect` **sin depender de que FB siga
notificando**. Caso que lo originó (2026-06-29): el embudo solo mostró 1 hilo
caliente; el sweep sacó 4 con OWES dura, incluida deuda fresca real (Samantha
Mckenna, 16h) que FB jamás surfaceó. **Honestidad (Art. 2):** `freshestMin === 99999`
es centinela de "edad no parseada" (raíz vieja sin fechar), NO "fresco" — esas son
candidatas a confirmar, no deuda viva. El sweep SURFACEA; la jugada se decide con los
dossiers. (En modo SINGLE/replylink se salta — el blanco lo da el link, no el moat.)

**1. Llegar a notificaciones sin abrir tabs de más.** `list_pages` primero — casi
siempre ya hay una tab de FB abierta. Si hay una en `facebook.com/notifications`,
`select_page` esa. Si no, navega una tab de FB existente a
`https://www.facebook.com/notifications`. (No abras Chrome a ciegas — diagnóstico
del `~/CLAUDE.md` si el MCP no responde; el puerto suele ser **9333**, no 9222.)

**2. `take_snapshot`.** El a11y tree lista cada notificación como un `link` cuyo
texto es el aviso completo y cuya `url` trae los parámetros llave.

**3. Parsear los parámetros de cada `url` de notificación:**

| Parámetro | Para qué |
|---|---|
| `post_id` (o `/posts/<id>` / `multi_permalinks=<id>`) | **La llave de agrupación.** Mismo `post_id` = mismo hilo |
| `comment_id` / `reply_comment_id` | Ancla para abrir en el comentario exacto (etapa dos) |
| `notif_t` | El TIPO → define el peso (tabla abajo) |
| `notif_id` | id único del aviso |

**4. Clasificar por `notif_t`:**

| `notif_t` | Categoría | Peso |
|---|---|---|
| `approve_from_another_device` | **Seguridad, NO es hilo** | Sácalo aparte |
| `group_comment_mention` | Te mencionaron | **Alto — deuda** |
| `group_comment` | Comentaron tu post | **Alto — deuda** |
| `feedback_reaction_generic` | Reaccionaron / likes | **Bajo — dopamina** |

**5. Ruido de seguridad → reportar aparte.** Varias `approve_from_another_device`
en pocos minutos = ataque activo a la cuenta. Dilo explícito (Art. 3), no lo
entierres como "ruido", y NO lo metas en la lista de hilos.

**6. Entregar tabla, no prosa.** Una fila por hilo (agrupado por `post_id`),
ordenada por prioridad: título del post, qué pasó (condensado), lo último sin leer
con su antigüedad, si requiere acción. Recomendar **por dónde empezar** — decidir,
no ofrecer dilema (Art. 4).

## Ponderación (desempate)

Dentro de los de peso alto, gana el hilo con actividad más reciente y con
réplicas-a-tus-réplicas (`reply_comment_id` presente) — ahí es donde más se pierde
"dónde quedó". Las reacciones (`+15 reacted`) son informativas, nunca deuda.

## Trampa: dismissive ≠ ruido, y el agregado "y N otros" ENTIERRA deuda

Un comentario **raíz dismissive / relativista / burlón en TU propio post** SÍ es
deuda de etapa 1, **NO ruido de baja prioridad**. El reflejo de bucketearlo como
"troll low-effort / dopamina → saltar" es el error: es un `group_comment` (peso
**alto**) sobre TU post, se burla de ti o de tu marco **por nombre frente al
lurker**, y una burla del marco sin responder pierde al lector silencioso (el
norte de [[reply-output-style]]). "Dismissive" describe el tono, no el peso —
nunca lo confundas con "low-priority".

Ejemplos verbatim que DEBEN saltar (2026-06-19, hilo `27363745576581926`):
- **Anna Angelika** (raíz): *"I defend nothing… I won't justify it because there
  is no one to justify it to. Morality is subjective."* — relativismo + negativa a
  justificar.
- **Roderick Huffsmith** (raíz): *"'Moral principle' what a joke… they might not
  align with little Bernie's… an extremely weak manner in which to frame a
  conversation."* — burla + ataque meta al marco.

**Por qué no saltaban:** FB los **agrega**. En etapa 1 solo se ve una línea —
"Rüdiger Preiss **y 4 otros** comentaron tu post" — y Anna/Roderick quedan entre
esos "4 otros", individualmente invisibles; solo aparecen al extraer en etapa 2.
Por eso el `"y N otros"` de un `group_comment`/`group_comment_mention` NO es una
sola fila: es **deuda oculta a expandir** — la etapa 1 debe señalar que ese hilo
esconde ~N comentarios raíz por triagear, no contar solo al autor nombrado. La
frescura/conteo del agregado pesa por los N escondidos, no por el uno visible.

## Por qué existe

Registrada 2026-06-16. Bernard se pierde en debates veganos de grupos grandes
("Vegans V's Meat Eaters") donde un post acumula decenas de comentarios, menciones
y réplicas anidadas que FB notifica desagregadas. Agrupar por `post_id` + ponderar
por deuda + separar el ruido de seguridad es el arranque del pipeline.
