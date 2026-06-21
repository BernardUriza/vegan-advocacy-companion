# Coagent Advise — etapa tres: seedear al coagent un master prompt de la jugada

Tercera etapa ([notification-agrupation] → [thread-actor-dossier] →
**coagent-advise** → [comment-post-and-verify]). Tras perfilar el hilo, se manda
la inteligencia al **coagent orquestador** (GPT custom de Bernard — insult-gpt)
para que stress-testee la jugada de mayor palanca y redacte el borrador. Variante
**outbound** de [[coagent]]: Claude NO reacciona al último turno, lo **siembra**.

## La mecánica del DOM vive en `/coagent` (SSOT) — NO se duplica aquí

Esta etapa ES el outbound seed-&-read del skill **`/coagent`** (su SKILL.md cita
este rule como "the project-level rule this generalizes"). Toda la mecánica volátil
de manejar ChatGPT —resolver el coagent por identidad (`resolve-coagent.py`),
reusar la tab sin duplicar, verificar `location.href` antes de escribir, insertar
el master prompt con `execCommand` (gotcha del `args`), enviar con Enter, **esperar
por estabilidad de contenido** (no por el `stop-button` stale), leer en llamada
aparte, y entregar el veredicto a Bernard sin postear— es **`/coagent` GOLDEN PATH
Steps 0–7**. Invocar `/coagent` o seguir su SKILL.md; cuando los selectores de
ChatGPT cambien, se arregla **ahí una vez**, no en tres copias.

Lo que es de ESTA etapa (no del skill) es solo el **contenido del master prompt**
(abajo) y que el destino del borrador es [comment-post-and-verify]. El botón de
enviar a Facebook es de Bernard.

## El master prompt — denso, en este orden

Línea de identidad obligatoria (`hola soy claude code, escribo desde
exchange-coagent devtools.`) → qué etapa es → post raíz verbatim + reacciones →
tablero completo (cada rama/actor con bando y táctica, resumen de los dossiers) →
**munición del arsenal** (ver abajo) → **el bloque guardrail abolicionista
delimitado** (ver abajo) → la jugada de mayor palanca + razonamiento,
pidiéndole **stress-test** ("no me consientas", Art. 3) → el riesgo a anticipar →
ask explícito (confirmar/refutar el blanco, redactar **como REPLY ETIQUETADA a la
persona en su hilo** —norma del grupo, NUNCA root, ver [[comment-post-and-verify]]—,
en la voz de Bernard, marcar **qué NO decir**) → recordatorio de
scope (solo borrador, el botón es de Bernard).

## PASO 0 — seed-gate ANTES de seedear (mecánica, root fix 2026-06-21)

Tras componer el master prompt en su archivo y **antes** de seedearlo al coagent,
pasarlo por el gate determinista:

```bash
node scripts/seed-gate.mjs .coagent/master-prompt-batch.md
```

- **exit 0 (LIMPIO)** → la jugada no es bienestarista y el guardrail está presente;
  seedear al coagent.
- **exit 1 (FLAGS DURAS)** → **NO mandar al coagent**, reformular la JUGADA primero.
  Las flags duras son:
  - `welfaristInPlay` — la jugada (fuera del guardrail y de las citas verbatim del
    oponente) usa léxico bienestarista como eje (`daño innecesario`, `rol del daño`,
    `subproducto incidental`, `incidental vs propósito`, `menos daño`, `unnecessary/
    least/reduce harm`, `byproduct`, `dos intereses en la balanza`). Reescribir el eje
    a propiedad/esclavitud (ver abajo).
  - `guardrailMissing` — falta el bloque guardrail delimitado.
  - `guardrailHollow` — el bloque existe pero no nombra el eje propiedad/esclavitud
    contra el daño prohibido (un guardrail de relleno no cuenta).

Este es el equivalente etapa-3 del `style-gate` de etapa 4 (ver `scripts/SEED-GATE.md`):
el welfarismo se inyecta en la **jugada**, no en el draft, así que el gate va donde se
decide la jugada — antes del coagent, no después del borrador. El detector es el mismo
SSOT (`scripts/welfarist-axis.mjs`), corrido en español. La regla del Art. 4 aplicada:
lo regexeable se scriptea, el juicio (componer la jugada) se queda en Claude.

### Munición del arsenal — cablear `data/frameworks.json` al master prompt

Por cada táctica del target (de su dossier), consultar
`getFrameworksByTactic(tacticId)` (de `scripts/db.mjs`) y meter en el master prompt
**los 1-2 counter-frameworks de mayor palanca**, cada uno con: su `name`, su
`enables` (el ángulo deployable) y —obligatorio— su **`attack_surface`** como
"qué NO hacer". El SSOT es `data/frameworks.json`; la vista navegable +
índice inverso (táctica → frameworks) vive en `analysis/frameworks/README.md`.

**Eje abolicionista, no bienestarista (innegociable — [[abolitionist-framing]]).**
El master prompt DEBE pedir marco **abolicionista**: el eje es propiedad/esclavitud
(sujeto poseído), NO reducción/cantidad de daño. Prohibir explícito que el borrador
redacte el eje en términos de "harm/unnecessary harm/least harm/incidental vs
intentional" o que conceda "daño innecesario en las cosechas también" — eso aplana
la diferencia categórica (en la cosecha no hay esclavo; en la granja sí) y pierde.
Frente a crop_deaths/least-harm: nombrar la esclavitud y preguntar **¿existe la
esclavitud necesaria?**. El framework de eje es `algo-a-alguien-sujeto-derecho`.

Esta prohibición va en el master prompt como un **bloque guardrail delimitado** —
el `seed-gate` (PASO 0) lo exige y lo excluye al cazar welfarismo (dentro del bloque,
nombrar "harm/daño" es legítimo: se nombra para prohibirlo). Formato canónico:

```
<!-- GUARDRAIL-ABOLICIONISTA -->
EJE INNEGOCIABLE: el argumento gira en PROPIEDAD/ESCLAVITUD (el animal es un sujeto
poseído), NO en la cantidad ni el rol del daño. PROHIBIDO redactar el eje como
"harm / unnecessary harm / least/reduce harm / byproduct / incidental vs purpose /
daño innecesario / menos daño / dos intereses en la balanza", y PROHIBIDO conceder
"daño innecesario también en las cosechas". Frente a crop_deaths: nombrar que la
granja es esclavitud (hay un sujeto poseído) y la cosecha no, y preguntar ¿existe la
esclavitud necesaria? El daño se menciona al pasar, jamás como eje portante.
<!-- /GUARDRAIL-ABOLICIONISTA -->
```

Las JUGADAS (enables/attack_surface/razonamiento/riesgo de cada blanco) viven FUERA
del bloque y deben estar limpias de ese léxico — si una jugada lo usa como eje, el
`seed-gate` truena (`welfaristInPlay`).

**Disciplina dura (innegociable):** el coagent elige **UN solo framework por
reply**, NUNCA lo usa como premisa portante (es marco — ver el aprendizaje Göbekli
en el framework `gobekli-kilometro-cero`), y respeta su `attack_surface`. Más
munición ≠ mejor reply: un draft que apila frameworks contradice el norte de
[[reply-output-style]] (corto, una idea, vuelve al hueso) y desperdicia al lurker.
Los frameworks `deploy_as: auto-disciplina-del-activista` (ej. `lenguaje-carne-hachazo`)
NO son armas contra el oponente — informan CÓMO se redacta, no qué se le lanza.

## El seed grande va por ARCHIVO, no se re-teclea inline (engrasado 2026-06-19)

Cuando el master prompt es grande (lote: ~8.5k chars), **componerlo en un archivo**
(`.coagent/master-prompt-batch.md`) y de ahí insertarlo — NUNCA re-teclear el cuerpo
a mano. La inserción del bulk es mecánica y reversible (misma forma que
`comment-prepare`): hoy se embebe inline en `evaluate_script` (gotcha del `args` del
skill `/coagent` — el texto va como literal en el body de la función, no por `args`),
pero ese inline-a-mano fue la fricción de la corrida en lote. El root fix es
**scriptear la inserción** (`scripts/seed-coagent.mjs`, backlog G.41): lee el archivo,
teclea por CDP en `#prompt-textarea` (ChatGPT acepta `execCommand`, no es Lexical),
deja la tab viva para que Claude verifique `location.href`+contenido y haga el Enter.
El JUICIO (componer el prompt) se queda con Claude; solo el bulk-insert se scriptea.
Hasta que exista el script: componer en archivo y embeber inline es el path, pero es
el smell a eliminar — no es la forma final.

## Por qué existe

Registrada 2026-06-16, engrasada el mismo día. Relaya la inteligencia al
orquestador para producir el borrador óptimo, manteniendo a Bernard fuera del loop
de copy/paste manual entre Facebook, Claude y ChatGPT, sin que ningún agente toque
el botón de publicar.
