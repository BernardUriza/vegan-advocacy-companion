# Coagent Advise — etapa tres: seedear al coagent un master prompt de la jugada

Tercera etapa ([notification-agrupation] → [thread-actor-dossier] →
**coagent-advise** → [comment-post-and-verify]). Tras perfilar el hilo, se manda
la inteligencia al **coagent orquestador** (GPT custom de Bernard — insult-gpt)
para que stress-testee la jugada de mayor palanca y redacte el borrador. Variante
**outbound** de [[coagent]]: Claude NO reacciona al último turno, lo **siembra**.

## insult-gpt es enforcer de consistencia marco→salida (x/y), NO oráculo vegano

Regla dura (2026-06-21). El coagent (insult-gpt) **NO es fuente de opinión vegana** —
pedírsela devuelve **bienestarismo** (el prior por default de TODO LLM, el suyo y el
de Claude). Su maestría es OTRA: **asociar lo que tú mismo le das y cazar la
incoherencia**. Si le entregas un marco y una salida que no cuadra con ese marco, te
corrige HACIA el marco — y en eso, hasta hoy, "no se le escapa una".

Por eso el master prompt se estructura como **x / y**, nunca como pregunta ética
abierta:

- **x = {explicación del marco abolicionista}** — propiedad/esclavitud, sujeto
  poseído, ¿existe la esclavitud necesaria?; el framework elegido con su `enables` y
  su `attack_surface`. El eje, explícito y dado como premisa.
- **y = {la respuesta candidata}** — el borrador actual, o la respuesta bienestarista
  tentadora, o el argumento del oponente que tienta a contestar en términos de daño.

El **ask** NO es "dame la respuesta vegana" (→ bienestarista). Es: **"mi marco es x,
mi salida es y — ¿es y coherente con x? Si no, regrésame la y que SÍ lo sea."**
insult-gpt entonces "insulta" la incoherencia y devuelve `y = {respuesta
abolicionista}` consistente con el marco que TÚ fijaste. Ese es el valor del handoff
y por qué es crucial: pone su fuerza (asociación/coherencia) al servicio del eje, en
vez de su debilidad (ética → welfarista).

**Nunca** le pidas el juicio ético desde cero; **siempre** dale el marco abolicionista
como x y la candidata como y, y pídele consistencia.

## Backstop NO-salteable: el hook de procedencia (root fix 2026-06-21)

Una regla es salteable por diseño — el 2026-06-21 Claude saltó esta etapa entera y
posteó a mano un draft bienestarista (quantum x5). El texto de una regla no frena el
prior welfarista del modelo. El backstop determinista es un **PreToolUse hook** que
ejecuta el harness, NO Claude: antes de que `comment-prepare.mjs` stagee un reply,
exige el **recibo de consulta** `.coagent/<post_id>.consult.json` que emite
`seed-coagent.mjs` — master con frameworks anotados + guardrail, `seed_gate:pass`, y
`draft_sha` == sha del `--body-file`. Sin recibo fresco, o con sha que no cuadra →
**STAGING BLOQUEADO**. El hook **NO juzga contenido** (eso es trabajo de LLM: el
style-gate de etapa 4 + el check x/y del coagent de arriba); solo prueba que la
etapa 3 **ocurrió** con frameworks. Ver `.claude/hooks/coagent-provenance-gate.mjs`
y `scripts/seed-coagent.mjs`.

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

### Higiene del master para pasar el seed-gate (aprendido a chingadazos 2026-06-21)

El seed-gate caza TU PROPIO master, no solo descuidos del coagent. Aun hiper-consciente
del eje, Claude filtró léxico bienestarista en la jugada Y en el ask y el gate lo paró
DOS veces antes de sembrar. Dos reglas mecánicas, no opcionales:

1. **La cita verbatim del oponente VA en blockquote (líneas `>`).** El seed-gate
   excluye los blockquotes (es la cita del rival, no tu jugada). Si la pegas como texto
   plano, el "avoidable harm / unnecessary harm" del oponente cuenta como TUYO y el gate
   truena con `welfaristInPlay` (falso positivo que es culpa del formato, no del eje).
2. **En el ask, NUNCA escribas los términos bienestaristas literales** —ni para
   decirle al coagent que los RECHACE—. El regex no entiende negación: "rechaza si
   deriva a *daño innecesario*" igual dispara `welfaristInPlay`. Referencia el bloque
   guardrail ("el léxico que el GUARDRAIL-ABOLICIONISTA prohíbe") en su lugar.
3. **Corré el seed-gate esperando que te cache a TI.** Si truena, leé la flag, reescribí
   la jugada/ask, re-corré hasta LIMPIO. Recién entonces `seed-coagent.mjs seed`. No es
   un trámite: es el backstop funcionando sobre el autor más propenso al welfarismo —
   vos.

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

## Corridas en paralelo (2+ agentes, un solo Chrome) — aprendido 2026-06-21

Cuando Bernard corre el pipeline con DOS agentes a la vez sobre el mismo Chrome de
debug y el mismo insult-gpt, hay dos colisiones que la mecánica normal no blinda:

1. **Misma conversación del coagent = mensajes interleaveados = basura.** Cada agente
   abre su PROPIA conversación nueva con insult-gpt (`new_page` al GPT base
   `g-iCKKoRd5A-insult-gpt`), NUNCA reusa la tab del otro (global [[coagent]] §0.5).
   Si en `list_pages` ves una tab "Insult GPT - <tema>" que no abriste, es del otro
   agente: no la toques.
2. **Dos clientes MCP sobre un Chrome racean en `select_page`** (la selección es
   global): si seleccionás tu tab mientras el otro opera, le arrebatás la suya a media
   acción (Art. 5). Esto NO se resuelve solo — se **serializa con Bernard**: hacer
   TODO lo reversible sin Chrome (componer master x/y, seed-gate, recibo parcial de
   `seed-coagent seed`), reportar "staged", y esperar que él libere el carril del
   browser antes de sembrar. El `list_pages` (read-only) sí se puede para ver el
   estado sin tocar nada.

## Por qué existe

Registrada 2026-06-16, engrasada el mismo día. Relaya la inteligencia al
orquestador para producir el borrador óptimo, manteniendo a Bernard fuera del loop
de copy/paste manual entre Facebook, Claude y ChatGPT, sin que ningún agente toque
el botón de publicar.
