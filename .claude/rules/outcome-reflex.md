# Outcome Reflex — etapa 0: cerrar/re-juzgar el moat con LLM, no con keywords

Stage 0 del pipeline ([outcome-reflex] → [notification-agrupation] → … →
[comment-post-and-verify]). Corre **SIEMPRE primero**, en cualquier modo. Es el
reflex de "qué tenemos hasta ahora": antes de trabajo nuevo, re-lee los hilos,
**re-juzga el `outcome` de cada interacción con juicio de LLM** (Claude), marca el
`conceded` que el heurístico de keywords pierde, y enriquece una nota por framework.

## Por qué existe (2026-06-21, Bernard)

El `conceded` —el outcome más valioso— **no se debe clasificar con keywords**. Son
frágiles de dos formas, ambas medidas en datos reales:

1. **Falsos negativos por léxico:** "your right" (typo de you're), "you prove valid
   points", "you have many fair points indeed" no caen en la lista. El oro se pierde.
2. **El anchor entierra la concesión:** el heurístico solo mira lo que el oponente dijo
   DESPUÉS de tu último reply. Cuando la concesión ES el `their_move` (el oponente
   concedió y tú cerraste), queda marcada `silent`. Caso real: Jonathan Bowman
   concedió 3 veces ("many fair points", "you prove valid points", "your right about
   that, thxs for being a good sport") y el moat lo tenía como `engaged`/`silent` →
   **cero conceded en todo el tablero**, cuando el oro estaba ahí.

Bernard: *"me han concedido antes, es como encontrar una mina de oro en un terreno
gigante y desolado alrededor."* El conceded es raro y valiosísimo; el instrumento
tiene que poder verlo. Un LLM leyendo el ARCO COMPLETO lo ve; un regex no.

## La frontera (Art. 4): mecánica al script, juicio al LLM

Igual que el resto del pipeline. El script junta el arco y escribe el SSOT; **el
juicio (qué outcome, qué aprendió el framework) es del LLM = Claude**. Dos fases:

1. **emit** — `node scripts/reflex.mjs emit` arma `.coagent/reflex-packets.json`:
   por cada (actor, hilo) con interacciones que tengan framework, el **arco verbatim**
   (turnos del actor + Bernard, en orden) + sus interacciones (date/framework/their_move/
   our_reply_summary/current_outcome). Requiere transcripts frescos `.coagent/tx-<id>.json`
   (etapa-2 `thread-extract --json`); reusarlos si ya son del run.
2. **Claude juzga** cada arco y escribe `.coagent/reflex-verdicts.json`:
   `[{ user_id, thread_id, date, needle, outcome, note, evidence }]`.
   - `outcome` ∈ conceded | engaged | silent | escalated | goalpost | pending.
   - `needle` = substring del `their_move` (match único; el apply aborta si no).
   - `note` = qué aterrizó / por qué, por framework (el "más detalle por framework").
   - **Cazá el conceded, no lo fuerces.** Una concesión es el oponente reconociendo la
     validez del argumento ("fair points", "you're right", "valid points", "good sport",
     "I hadn't thought of it that way", retirada amistosa tras conceder) — NO un insulto
     sarcástico ni un "agree to disagree" desde la trinchera. Ante la duda, no es oro.
3. **apply** — `node scripts/reflex.mjs apply --verdicts .coagent/reflex-verdicts.json`
   (dry-run primero). Usa `db.updateInteractionOutcome`, que apunta a UNA interacción
   exacta y **puede SOBRESCRIBIR** un outcome viejo mal clasificado (re-juicio).
4. `validate-data.mjs` + (si `analysis/actors/` está despejado) `gen-dossiers.mjs`.

## El guard de frescura sigue valiendo

Una jugada sin respuesta del oponente y con reply-ancla reciente queda `pending`, no
`silent` (ver [[OUTCOME-LOOP]] / `scripts/close-outcomes.mjs`). El LLM lo respeta: sin
turnos del oponente tras tu reply, el outcome es `pending`/`silent` según la edad —
**nunca conceded** (no hay evidencia de concesión).

## El moat es el mapa de la mina

Tras el reflex, `getFrameworkWinRate(<id>)` refleja qué framework gana oro y **en qué
tipo de interlocutor**. Medido al bootstrap (2026-06-21): las 3 vetas de oro
(`algo-a-alguien-sujeto-derecho` ×2, `consideracion-moral-no-cuanto-sufre` ×1,
`sembrar-en-el-receptivo` ×1) vinieron TODAS de Jonathan Bowman, un interlocutor de
**buena fe**. La lección que el moat enseña: el oro vive en los receptivos, no en los
pozos sin fondo ([[reply-output-style]] — el norte es el lurker + el receptivo). Etapa-3
([[coagent-advise]]) usa esto para elegir jugada: desplegar el framework que ya probó
sacar concesión en interlocutores parecidos.

## Relación con close-outcomes (keywords)

`scripts/close-outcomes.mjs` (heurístico de keywords + guard de frescura) queda como
**fallback offline / primer pase grosero**; el reflex LLM es el clasificador primario
y lo SOBRESCRIBE cuando el keyword se equivocó. No se borra close-outcomes: sirve para
cerrar en lote sin LLM cuando el volumen de `silent` obvios es alto.

## Por qué corre cada vez

El moat solo vale si está al día. Un `conceded` sin registrar es una mina sin marcar en
el mapa: la próxima vez vuelves a vagar el terreno desolado. El reflex en etapa-0
garantiza que cada run empiece con el tablero real —incluido el oro— antes de decidir
dónde cavar.
