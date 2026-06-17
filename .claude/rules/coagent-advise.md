# Coagent Advise — etapa tres: seedear al coagent un master prompt de la jugada

Tercera etapa ([notification-agrupation] → [thread-actor-dossier] →
**coagent-advise** → [comment-post-and-verify]). Tras perfilar el hilo, se manda
la inteligencia al **coagent orquestador** (GPT custom de Bernard — insult-gpt)
para que stress-testee la jugada de mayor palanca y redacte el borrador. Variante
**outbound** de [[coagent]]: Claude NO reacciona al último turno, lo **siembra**.

## GOLDEN PATH — la mecánica exacta (gotchas ya pagados)

**1. Resolver el coagent por IDENTIDAD, nunca por la tab abierta** ([[coagent]]
§0): la URL que Bernard da explícito, o `COAGENT_CHATGPT_URL` del `.env` de ESTE
repo. Hay varias conversaciones del mismo GPT (ej. `6a31477a` ≠ `6a2f4733`); usar
la correcta.

**2. REUSAR la tab si ya existe — no duplicar** ([[coagent]] §0.5). `list_pages`
primero: si ya hay una tab en la URL EXACTA, `select_page` esa. **Solo** `new_page`
si no existe. (Lección 2026-06-16: hice `new_page` de una que ya estaba abierta y
la dupliqué; Bernard: "ya estaba abierta". No toques otras tabs de ChatGPT.)

**3. Verificar `location.href` JUSTO antes de escribir** (las tabs se mueven entre
`select_page` y el `insertText`). `evaluate_script` que devuelva `location.href` +
`document.title`; abortar si no contiene el chat id correcto.

**4. Insertar el master prompt — ChatGPT SÍ acepta `execCommand`** (su composer es
contenteditable simple, NO Lexical como FB — ver [[chrome-devtools-contenteditable-input]]):
```js
() => {
  const el = document.querySelector('#prompt-textarea');
  if (!el) return { ok:false, error:'no composer' };
  el.focus();
  document.execCommand('selectAll'); document.execCommand('delete');
  const text = `<MASTER PROMPT inline>`;   // ver gotcha del args abajo
  document.execCommand('insertText', false, text);
  return { ok:true, len: el.innerText.length };
}
```
**GOTCHA del `args` (ya pagado):** esta versión del MCP trata cada item de
`evaluate_script.args` como **uid de elemento**, no como string → pasar el texto
por `args` falla ("Element uid … not found" / "No snapshot found"). **FIX: embeber
el texto DENTRO del cuerpo de la función** como template literal (sin `args`).

**5. Enviar:** `press_key Enter`. Verificar: `totalMsgs` subió + `composerEmpty`.

**6. Esperar sin leer a medias:** pollear `[data-testid="stop-button"]`; mientras
`streaming:true`, no leas. Cuando termine, leer el último mensaje del assistant en
una llamada aparte.

**7. Entregar el veredicto + borrador a BERNARD** (no es orden para Claude; es
inteligencia para él). Claude NO postea — eso es [comment-post-and-verify], y el
botón de enviar es de Bernard.

## El master prompt — denso, en este orden

Línea de identidad obligatoria (`hola soy claude code, escribo desde
exchange-coagent devtools.`) → qué etapa es → post raíz verbatim + reacciones →
tablero completo (cada rama/actor con bando y táctica, resumen de los dossiers) →
la jugada de mayor palanca + razonamiento, pidiéndole **stress-test** ("no me
consientas", Art. 3) → el riesgo a anticipar → ask explícito (confirmar/refutar el
blanco, redactar **como REPLY ETIQUETADA a la persona en su hilo** —norma del
grupo, NUNCA root, ver [[comment-post-and-verify]]—, en la voz de Bernard, marcar
**qué NO decir**) → recordatorio de
scope (solo borrador, el botón es de Bernard).

## Por qué existe

Registrada 2026-06-16, engrasada el mismo día. Relaya la inteligencia al
orquestador para producir el borrador óptimo, manteniendo a Bernard fuera del loop
de copy/paste manual entre Facebook, Claude y ChatGPT, sin que ningún agente toque
el botón de publicar.
