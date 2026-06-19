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
**munición del arsenal** (ver abajo) → la jugada de mayor palanca + razonamiento,
pidiéndole **stress-test** ("no me consientas", Art. 3) → el riesgo a anticipar →
ask explícito (confirmar/refutar el blanco, redactar **como REPLY ETIQUETADA a la
persona en su hilo** —norma del grupo, NUNCA root, ver [[comment-post-and-verify]]—,
en la voz de Bernard, marcar **qué NO decir**) → recordatorio de
scope (solo borrador, el botón es de Bernard).

### Munición del arsenal — cablear `data/frameworks.json` al master prompt

Por cada táctica del target (de su dossier), consultar
`getFrameworksByTactic(tacticId)` (de `scripts/db.mjs`) y meter en el master prompt
**los 1-2 counter-frameworks de mayor palanca**, cada uno con: su `name`, su
`enables` (el ángulo deployable) y —obligatorio— su **`attack_surface`** como
"qué NO hacer". El SSOT es `data/frameworks.json`; la vista navegable +
índice inverso (táctica → frameworks) vive en `analysis/frameworks/README.md`.

**Disciplina dura (innegociable):** el coagent elige **UN solo framework por
reply**, NUNCA lo usa como premisa portante (es marco — ver el aprendizaje Göbekli
en el framework `gobekli-kilometro-cero`), y respeta su `attack_surface`. Más
munición ≠ mejor reply: un draft que apila frameworks contradice el norte de
[[reply-output-style]] (corto, una idea, vuelve al hueso) y desperdicia al lurker.
Los frameworks `deploy_as: auto-disciplina-del-activista` (ej. `lenguaje-carne-hachazo`)
NO son armas contra el oponente — informan CÓMO se redacta, no qué se le lanza.

## Por qué existe

Registrada 2026-06-16, engrasada el mismo día. Relaya la inteligencia al
orquestador para producir el borrador óptimo, manteniendo a Bernard fuera del loop
de copy/paste manual entre Facebook, Claude y ChatGPT, sin que ningún agente toque
el botón de publicar.
