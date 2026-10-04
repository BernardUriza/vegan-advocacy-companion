# 2026-10-03 — Por qué insult-gpt entrega sin filo y con pivotes de negación

Disparador: en los tres seeds del día (lotes 1003A, 1003B y el single 1003C) el coagent devolvió registro
casi limpio y oraciones del tipo "The question is not whether… It is whether…", con la instrucción de voz
verbatim en el master. Investigado con cuatro sub-preguntas en la web y una medición local.

## Lo medido en el repo (fuente primaria)

Groserías por cada mil palabras y pivotes de negación en las 29 respuestas guardadas del coagent
(`.coagent/respuesta-*.md`, `resp-*.md`, `coagent-resp-*.md`), 2026-09-27 a 2026-10-03:

- Groserías: entre 0 y 7 por mil en 27 de 29 respuestas. Las dos excepciones (11 y 16) son replies sueltas
  de ~120–250 palabras a Homer el 28-sep. Los tres seeds del 3-oct dieron 1, 7 y 0. El día no fue distinto
  del resto: el coagent nunca entregó el registro que pide el bloque de voz.
- Pivotes de negación: 0 en 15 de las 17 respuestas anteriores al 30-sep; 1 a 3 en la mayoría desde
  entonces. Coincide con la entrada de la línea "sin 'no es X, es Y' como pivote" en los masters. Es
  correlación con pocas muestras, no prueba de causa.
- En los masters el bloque de voz va una sola vez, cerca del final, seguido de las reglas de formato y del ask.

## Lo que dicen las fuentes

| Pregunta | Hallazgo | Certeza |
|---|---|---|
| ¿Dónde va la instrucción en un prompt largo? | La guía de OpenAI para GPT-4.1 pide repetirla al inicio y al final del contexto largo, y dice que ante conflicto el modelo tiende a seguir la más cercana al final. Anthropic pide datos arriba e instrucciones después. | Confirmado para colocación; la guía es de 2025 y de otro modelo |
| ¿Muestras o descripción para fijar tono? | Las guías de los dos proveedores ponen los ejemplos entre lo más confiable para tono. El único experimento directo hallado (arXiv 2511.13972) mide verbosidad de código: directiva + ejemplos rinde más que cada una sola. | Probable |
| ¿El brief analítico en español jala el registro? | Un estudio (arXiv 2608.26186) muestra que el idioma del prompt cambia la salida aunque el idioma de respuesta sea fijo; mide longitud, no registro. | Incierto, hipótesis |
| ¿Por qué sobrevive "it's not X, it's Y"? | Antislop (arXiv 2510.15061): el patrón aparece muy por encima del texto humano; pedir que se evite tiene eficacia limitada y puede inducir el efecto "elefante rosa"; la supresión por regex sí lo elimina. Anthropic: decir qué hacer en vez de qué no hacer. | Probable (un solo paper mide este patrón) |
| ¿Cambió el modelo debajo del GPT? | Desde junio 2025 el builder puede fijar un "Recommended Model" (9to5mac, prensa). Hay reportes de personas más secas tras GPT-5 y de instrucciones ignoradas al inicio de chats nuevos en GPT-5.5. Nada fechado cerca de octubre 2026. | Incierto como causa |
| ¿Las groserías están permitidas? | El Model Spec (versión 2026-08-18) trata el no maldecir como guía del nivel más bajo, anulable por petición explícita. | Probable |
| ¿La conversación larga borra la persona? | La ventana de ChatGPT es limitada (cifras de 16K a 400K según plan y modelo, fuentes no oficiales) y hay literatura sobre deriva de persona con la longitud del diálogo. Ninguna fuente oficial de OpenAI lo afirma para custom GPTs. | Probable como mecanismo, sin probar en este GPT |

## Lectura

La causa más barata de explicar los datos es de composición del master, no del GPT: la voz se pide una vez,
en un párrafo descriptivo, enterrada bajo reglas de prosa limpia, dentro de un brief analítico de 12–19k
caracteres; y el pivote se prohíbe nombrándolo. La hipótesis de modelo o de conversación larga no explica
que el registro tibio venga desde el 27-sep.

## Lo aplicado ese día

- `.claude/rules/coagent-advise.md` § "Dónde y cómo va la voz": voz al inicio y como último bloque antes
  del ask, 2–3 muestras rotadas, pedir la forma afirmativa sin nombrar el patrón.
- `scripts/style-gate.mjs` `negateThenAffirm`: tres variantes nuevas con test (pronombre, sin predicado,
  do-support). Los 15 drafts publicados del 2 y 3 de octubre pasan el detector ampliado.

## Abierto (decide Bernard)

1. Abrir Configure de insult-gpt y ver qué modelo tiene; fijar uno si el campo existe.
2. Prueba A/B: el mismo master en una conversación nueva contra la canónica, comparando `profanityCount`.
   Contradice la regla de conversación canónica, por eso no se corrió.
3. Medir el próximo lote con el molde nuevo. Si las groserías siguen bajo 7 por mil, la causa está en el
   GPT y no en el master.

## Fuentes

1. https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide — colocación de instrucciones en contexto largo
2. https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices — decir qué hacer; ejemplos para tono
3. https://aclanthology.org/2024.tacl-1.9/ — Lost in the Middle (2024, recuperación, no tono)
4. https://arxiv.org/html/2511.13972v1 — directiva vs ejemplos en control de estilo (código)
5. https://arxiv.org/html/2608.26186 — efecto del idioma del prompt (leído solo el resumen)
6. https://arxiv.org/html/2510.15061v2 — Antislop: frecuencia del patrón y límites de prohibirlo por prompt
7. https://arxiv.org/html/2503.22395v2 — negación en LLMs
8. https://9to5mac.com/2025/06/20/openai-lets-users-choose-model-of-custom-gpts/ — modelo recomendado por GPT
9. https://community.openai.com/t/loss-of-custom-persona-quality-after-gpt-5-switch-reproducible-a-b-with-gpt-4o-vs-gpt-5-text-logs/1355404 — reporte de usuario
10. https://community.openai.com/t/gpt-5-5-ignores-custom-gpt-and-project-instructions-at-the-start-of-new-chats/1384550 — reporte de usuario
11. https://model-spec.openai.com/2026-08-18.html — groserías como guía anulable
12. https://community.openai.com/t/what-is-the-size-of-the-useable-context-in-a-custom-gpt/638334 — ventana de contexto (2024)
13. https://community.openai.com/t/context-loss-during-long-conversations/1402924 — queja de usuario del 2026-10-02
