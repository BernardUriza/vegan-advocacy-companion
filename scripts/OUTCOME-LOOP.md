# Outcome-loop — cerrar la memoria write-only

Las interacciones en `data/actors.json` nacen con `outcome: "pending"` y, hasta
ahora, **nunca se cerraban**: cada reply que Bernard postea queda registrada pero
su efecto (¿el oponente concedió? ¿escaló? ¿movió el poste? ¿se calló?) jamás se
escribe de vuelta. La memoria es **write-only**. Este loop la cierra.

Pieza de código (Chrome/red en vivo DIFERIDO, ver el final):

- `scripts/close-outcomes.mjs` — recibe un transcript de hilo (formato
  `thread-extract`) y clasifica el outcome de cada interacción `pending` de ese
  hilo con heurísticas deterministas, escribiéndolo vía `db.mjs`.
- `db.mjs` → `getPendingInteractions()` — lista toda interacción `outcome:"pending"`
  (actor + thread_id + framework) que falta cerrar.
- `db.mjs` → `closeOutcome(userId, threadId, outcome, evidence)` — escribe el outcome
  (append-only sobre el campo: solo muta `outcome`/`outcome_evidence` de una
  interacción que HOY está `pending`; nunca reescribe `their_move`,
  `our_reply_summary` ni `framework`, y nunca re-cierra una ya cerrada).

## Uso

```bash
node close-outcomes.mjs <transcript.json>            # clasifica + escribe vía db.mjs
node close-outcomes.mjs <transcript.json> --dry-run  # clasifica, NO escribe
cat transcript.json | node close-outcomes.mjs --stdin
```

El `<transcript.json>` es la salida `--json` de `thread-extract.mjs` (etapa 2):
`{ url, me, postOwner, turns:[{author,user_id,target,isMine,ageStr,text}], debt }`.
El script también tolera el shape abreviado del handoff (`mine`/`age` en vez de
`isMine`/`ageStr`).

El `thread_id` del hilo se resuelve del doc (`thread_id`/`post_id`) o se infiere de
la `url` (`post_id=` / `multi_permalinks=` / `/posts/<id>`). Solo se cierran las
interacciones `pending` cuyo `thread_id` esté en ESE hilo.

## Las heurísticas (deterministas, por precedencia)

Para cada interacción `pending`, se mira lo que el **oponente** (el actor) dijo
**DESPUÉS de la PRIMERA reply de Bernard dirigida a él** en el transcript — eso es
su respuesta a la jugada, y es la señal del cierre. (Ancla = mi primer turno con
`target === actor.name`; fallback = mi última reply del hilo. Anclar en MI reply a
ESE oponente, no en la última global, evita que un back-and-forth con otro actor
entierre su turno y todo salga `silent`.)

| Outcome | Disparador | Por qué |
|---|---|---|
| **silent** | el oponente NO volvió a hablar tras tu reply | la jugada quedó sin contestar — silencio (frecuente: el reply cerró la rama) |
| **escalated** | keywords de insulto / culto / manipulación / troll (`cult`, `brainwash`, `sheep`, `idiot`, `shut up`, `snowflake`, `triggered`, `pathetic`, `troll`, `manipulat`…) | el intercambio se envenenó; el lurker ve quién perdió la compostura |
| **conceded** | keywords de concesión (`fair enough`, `you're right`, `good point`, `i see`, `point taken`, `i concede`, `i stand corrected`…) | el reply pegó; la señal más fuerte de que la jugada funcionó |
| **goalpost** | keywords de desvío (`but what about`, `that's not the point`, `anyway`, `besides`, `plants feel`, `predators`, `natural`, `circle of life`…) | el oponente movió el poste en vez de responder al hueso |
| **engaged** | el oponente siguió argumentando civil, sin ninguno de los markers anteriores | back-and-forth de buena fe, ni concesión ni evasión ni insulto |

**Precedencia (cuando un turno dispara varias):** `escalated` > `conceded` >
`goalpost` > `engaged`. Un insulto envenena aunque venga con un "good point"
sarcástico; la concesión gana al goalpost porque es la señal más limpia de impacto.

Las heurísticas son **groseras a propósito** (keyword-matching sobre el texto
concatenado de los turnos post-reply del oponente). No pretenden NLP: surfacean un
outcome defendible y dejan `outcome_evidence` con las keywords que dispararon, para
que un humano pueda auditar/corregir. Un `engaged` o `goalpost` dudoso se revisa a
mano; el punto es que la memoria deje de ser write-only.

## Integración con Chrome en vivo — DIFERIDA

La detección de "el oponente respondió después" se alimenta del **transcript de
`thread-extract.mjs`** (etapa 2), que ES quien re-extrae el hilo del Facebook en
vivo vía CDP. El bucle completo sería: re-correr `thread-extract.mjs --json` sobre
los hilos con interacciones `pending` → pipear ese JSON a `close-outcomes.mjs` →
cerrar los outcomes. Esa orquestación contra el Chrome de debug (cuándo re-visitar
cada hilo, batch sobre `getPendingInteractions()`) queda **diferida** — este loop
implementa solo la lógica de clasificación + escritura sobre un transcript ya dado.
Hoy se invoca a mano pasándole el `--json` de `thread-extract`; no toca red.
