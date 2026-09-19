# Root Post Publish — el post raíz lo PUBLICA Claude, en TODOS los grupos con engagement

Cuando una semilla de `analysis/post-ideas/` madura a post raíz redactado, el
entregable NO es el borrador en el portapapeles: **es el post publicado**, en
cada grupo donde el moat muestra que Bernard tiene audiencia. Complementa la
cadena de etapas del pipeline de replies ([notification-agrupation] →
[thread-actor-dossier] → [coagent-advise] → [comment-post-and-verify]) para el
caso del post ORIGINAL, no de la respuesta.

## La ley

1. **Publicar es el trabajo, no el paso siguiente.** Dejar el texto en `pbcopy`
   y reportar "el botón es tuyo" es el **"gated-to-you mislabel"** de
   `agent-autonomy`: Bernard ya dio la orden al pedir el post. Cuando él da el
   **GO explícito** ("publícalo" / "mándalo"), ese GO autoriza el acto
   irreversible — y entonces Claude lo ejecuta vía **chrome-devtools MCP**,
   exactamente como en etapa 4 con las replies (paste sintético +
   verificación histérica). El `pbcopy` queda como respaldo, nunca como
   entrega.
2. **Multi-grupo, no un solo grupo.** Un post raíz se publica en **TODOS** los
   grupos del registro `.claude/destinatarios-canales.txt` donde el moat
   muestra engagement real — hoy: `770211166362062` "Vegans V's Meat Eaters
   (Open Debates) 3" (87 interacciones, 2 conceded), `2295597740524135` (31
   interacciones), `2465017713767360` (10 interacciones). Publicar en uno
   solo desperdicia el trabajo de la semilla: el mismo texto vale en cada
   grupo, y cada grupo trae lurkers distintos ([[reply-output-style]] — el
   norte es el lurker, y aquí hay varios lurkers-poblaciones que nunca se
   cruzan). Cada publicación se registra en el archivo de la semilla
   (`analysis/post-ideas/<slug>.md`) con `Status: Posted` + fecha + **la URL
   del post POR GRUPO** — breadcrumb, no una frase suelta
   ([[leave-breadcrumbs]]).
3. **Verificación (Art. 2).** Cada publicación se verifica leyendo el
   `div[role="article"]` del post ya publicado en ESE grupo — texto completo
   presente, autor Bernard Uriza Orozco — más un `take_screenshot` como
   recibo visual. La misma disciplina histérica de
   [[comment-post-and-verify]]. Sin ese check no se reporta "publicado" en
   ningún grupo.
4. **El registro de destinos lo alimenta Bernard.** `.claude/destinatarios-canales.txt`
   crece cuando Bernard nombra un grupo nuevo, o cuando el moat muestre
   engagement en un grupo y él lo apruebe — nunca porque Claude decidió que
   "seguro también sirve" (regla global `destino-lo-define-el-proyecto`: el
   destino lo define el proyecto/Bernard, nunca lo que está en pantalla ni la
   conveniencia del momento).

## GOLDEN PATH

(se llena en la primera corrida, 2026-09-19)

## Por qué existe (2026-09-19)

Claude redactó el post raíz contra el relativismo moral ("Sooner or later the
debate here lands on the same line…", semilla
`analysis/post-ideas/morality-is-subjective-one-way-shield.md`), lo pasó por
`lint-prose` y el style-gate, lo dejó en el portapapeles y reportó "el botón es
tuyo". Bernard entendió que ya estaba publicado y se pasó horas esperando la
notificación de Facebook que nunca iba a llegar, porque nada se había
publicado. Bernard, textual:

> *"eso mismo debes de publicarlo y no solamente en un grupo, en varios; de
> hecho hay varios grupos donde sí me hacen caso; de hecho todo este tiempo
> estuve yo esperando la notificación, entonces mándalo a los grupos que ya
> conocemos donde sí hay reacciones."*

Ver `agent-autonomy` (el "gated-to-you mislabel" — drive la publicación en vez
de recitarla; "landing the work is part of the work" — push/merge/publish son
del último paso, no un gate) y `00-constitution` Art. 4 (lo reversible se
ejecuta, lo irreversible se autoriza con su GO explícito, no se re-pregunta
después de dado) y Art. 8 (honrar su atención: horas esperando una notificación
que nunca iba a llegar).
