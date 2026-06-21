# seed-gate.mjs — gate determinista del PASO 0 de etapa 3

`scripts/seed-gate.mjs` es el **cedazo del master prompt** que corre ANTES de
seedearlo al coagent en el PASO 0 de [coagent-advise](../.claude/rules/coagent-advise.md).
Es el equivalente etapa-3 del [style-gate](./STYLE-GATE.md) de etapa 4 — pero apunta
al **cargador, no al cañón**: el welfarismo se decide en la JUGADA (la instrucción que
Claude le da al coagent), no en el draft final.

## El root fix que lo originó (2026-06-21)

Anna Angelika humilló a Bernard en un hilo de crop_deaths. La autopsia (`/insult`)
encontró la raíz: el master prompt de las 13:01 le ordenó al coagent una jugada
**bienestarista palabra por palabra** ("el daño innecesario importa en todos lados",
"rol del daño: subproducto incidental vs propósito", "argumento para MENOS daño") y
**sin** el guardrail abolicionista que la regla manda. El coagent hizo exactamente lo
que se le pidió. El `style-gate` de etapa 4 no lo atrapó porque corre sobre el draft,
no sobre la jugada — el veneno ya estaba inyectado aguas arriba.

## Qué caza (dos flags duras → exit 1, NO seedear)

| Flag | Qué caza |
|---|---|
| `welfaristInPlay` | léxico bienestarista como EJE en la jugada (fuera del guardrail y de las citas verbatim): `daño innecesario`, `rol del daño`, `subproducto incidental`, `incidental vs propósito`, `menos daño`, `unnecessary/avoidable/least/reduce harm`, `byproduct`, `dos intereses`, `en la balanza` |
| `guardrailMissing` | falta el bloque `<!-- GUARDRAIL-ABOLICIONISTA --> ... <!-- /GUARDRAIL-ABOLICIONISTA -->` |
| `guardrailHollow` | el bloque existe pero no nombra el eje propiedad/esclavitud contra el daño prohibido (relleno) |

Nota blanda (`quantumCountInPlay >= 3`): muchas menciones de daño en la jugada — avisa
que el daño debería ir solo "al pasar", no falla el exit.

## Qué EXCLUYE antes de detectar (mata los falsos positivos)

1. **El bloque guardrail delimitado** — ahí "harm/daño" es legítimo (se nombra para
   prohibirlo). El gate lo extrae y lo verifica aparte.
2. **Las citas verbatim del oponente** (líneas blockquote `>`) — el comentario del
   rival cita "harm" muchas veces y es contexto necesario, no la jugada de Claude.

Sobre el resto (las jugadas: enables/attack_surface/razonamiento/riesgo) corre el
detector SSOT en español.

## Cómo lo usa etapa 3

```bash
node scripts/seed-gate.mjs .coagent/master-prompt-batch.md          # tabla humana
node scripts/seed-gate.mjs .coagent/master-prompt-batch.md --json   # detalle pipeable
```

- **exit 0 (LIMPIO)** → seedear al coagent.
- **exit 1 (FLAGS DURAS)** → reformular la JUGADA (reescribir el eje a propiedad/
  esclavitud, añadir el guardrail) y volver a correr antes de mandar nada.

## Detector compartido (Art. 6)

El detector vive en `scripts/welfarist-axis.mjs` (SSOT), importado por AMBOS gates:
- `style-gate.mjs` (etapa 4): inglés, posicional (eje en apertura/cierre), quantum≥2.
- `seed-gate.mjs` (etapa 3): español, no-posicional, quantum blando — sobre la jugada.

Cuando la kill-list welfarista crezca, se edita el módulo una vez y ambos gates heredan.

## Por qué existe

El welfarismo no entra en el draft — entra en la jugada. Un gate que solo mira el
draft (etapa 4) llega tarde: el coagent ya redactó sobre munición envenenada. Este
gate mueve el backstop mecánico al punto de inyección (etapa 3, antes del coagent),
y fuerza el guardrail abolicionista que la regla manda pero que el 21-jun no se
cumplió. Es la mecánica del firewall del Art. 4 aplicada a la jugada: lo regexeable
se scriptea, el juicio (componer la jugada) se queda en Claude.
