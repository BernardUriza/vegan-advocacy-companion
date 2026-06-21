# style-gate.mjs — pre-filtro determinista del PASO 0 de etapa 4

`scripts/style-gate.mjs` es el **cedazo barato** que corre ANTES del juicio LLM en
el PASO 0 de [comment-post-and-verify](../.claude/rules/comment-post-and-verify.md).
Caza con regex los IA-tells de [reply-output-style](../.claude/rules/reply-output-style.md)
que NO requieren criterio: kill-phrases literales, staccato, abrir-con-nombre,
largo fuera de rango, tricolon repetido, emojis/markdown/grito.

## Qué NO hace (el límite duro)

**No reemplaza el juicio de tono.** Lo que es irreductiblemente LLM se queda en el
LLM:

- ¿el reply **vuelve al hueso** (la pregunta moral, inversión de carga)?
- ¿el **registro** (compasivo vs mordaz) calza con el estado del interlocutor?
- ¿**performa tres metas a la vez** (el smell de "AI drivel")?
- ¿suena a **mini-ensayo / profesor dando clase** aunque no pise ningún regex?
- ¿usa **un solo framework** del arsenal sin apilarlos ni hacerlo premisa portante?

El style-gate solo garantiza que el juicio caro arranque sin los tells obvios —
no que el borrador sea bueno.

## Cómo lo usa etapa 4

```bash
# tras tener el borrador aprobado (del coagent o de Claude), antes del juicio de tono:
node scripts/style-gate.mjs <draft.txt> --name "<autor del comentario target>"
```

- **exit 0 (clean)** → no hay flags duras; pasa al juicio LLM de tono/hueso.
- **exit 1 (flags duras)** → reformular más corto/afilado/humano ANTES de seguir.
  Las flags duras son: `killPhrases`, `staccato` (mayoría de líneas frase-suelta),
  `opensWithName` (vocativo inicial — el tag de FB ya nombra, duplicaría), y
  `emojiOrMarkdown` (emojis, `**bold**`, MAYÚSCULAS-grito, headings markdown).
- **flags blandas** (`wordCount` fuera de 150-350, `tricolon` aislado) **avisan**
  pero NO fallan el exit — son señales para el juicio, no vetos.

`--json` emite el detalle por check (cada flag con su evidencia) para pipear.
`--name` opcional: si se pasa, `opensWithName` solo marca cuando el vocativo inicial
coincide con ese nombre (el destinatario que el tag de FB ya etiqueta).

## Los checks

| Check | Flag | Qué caza | Evidencia |
|---|---|---|---|
| `killPhrases` | dura | "Let's unpack", "It's worth noting", "At the end of the day", "Here's the thing" | frase + offset + contexto |
| `staccato` | dura si ratio≥0.6 y ≥4 líneas | cada frase en su propio renglón (tell del borrador del coagent) | ratio + líneas ofensoras |
| `opensWithName` | dura | el cuerpo abre con "Nombre," (duplica el tag de FB) | el vocativo detectado |
| `wordCount` | blanda | fuera de 150-350 palabras | conteo + too_short/too_long |
| `tricolon` | blanda (dura si se repite) | "X, Y, and Z" como molde | cada ocurrencia |
| `emojiOrMarkdown` | dura | emojis, **bold**, MAYÚSCULAS-grito, headings | los tokens encontrados |
| `welfaristAxis` | **dura** | framing bienestarista como EJE: "unnecessary/avoidable/least/reduce harm", "byproduct", "two interests on the scale", o quantum de daño ("harm/suffering/daño/sufrimiento") en apertura/cierre o ≥2 veces (eje, no al pasar) | términos fuertes + posición + conteo |

`welfaristAxis` es el backstop mecánico de [[abolitionist-framing]]: el eje debe ser
PROPIEDAD/ESCLAVITUD (sujeto poseído), no la cantidad/rol del daño. Un draft
bienestarista NO puede llegar al composer — `comment-prepare` lo rechaza (exit 4)
antes de abrir tab. Una mención del daño "al pasar" (1 vez, en medio del cuerpo) se
tolera; en la apertura, el cierre, o repetida, es el eje → falla. Quita la discreción
del único punto donde el redactor (LLM) deriva al prior bienestarista genérico.

## Por qué existe

El PASO 0 de etapa 4 mezclaba dos cosas: cazar tells mecánicos (regex) y juzgar
tono (LLM). Separarlas hace el pre-filtro **determinista, reproducible y gratis** —
un borrador que pisa la kill-list ni siquiera llega al juicio caro, y el juicio
llega a concentrarse en lo que solo él puede ver (el hueso, el registro, el smell
de mini-ensayo). Es la mecánica del firewall del Art. 4 aplicada al style-gate: lo
regexeable se scriptea, el criterio se queda en Claude.
