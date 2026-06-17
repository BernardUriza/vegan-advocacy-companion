# Comment Post & Verify — etapa cuatro: el paso irreversible (GOLDEN PATH)

Cierre de la cadena [notification-agrupation] → [thread-actor-dossier] →
[coagent-advise] → **comment-post-and-verify**. Aquí Claude SÍ escribe en
Facebook: postea el borrador aprobado como respuesta en el hilo, lo verifica
**histéricamente**, y **si quedó mal, lo borra**. Es el único paso outward-facing
e irreversible de la cadena.

> **Este pipeline es de alto volumen.** El grupo está activo y van a pasar muchos
> comentarios. Esta regla está engrasada para que cada sucesión sea **sin
> fricción**: sigue el GOLDEN PATH verbatim, no re-explores. El editor de FB ya
> nos costó 6 intentos una vez; nunca más. La mecánica universal de Lexical vive
> en el playbook ([[chrome-devtools-contenteditable-input]]); aquí está el runbook
> aplicado a FB.

## Norma de ESTE grupo — responder a la persona + etiquetar (NUNCA root)

Regla dura de Bernard (2026-06-16): en "Vegans V's Meat Eaters" la respuesta va
**como reply al comentario de la persona, en su hilo, etiquetándola** (la
auto-mención `@Nombre` que FB inserta al dar Reply). **NUNCA un comentario raíz**
que hable "a la galería" en abstracto. Por qué: *"así es como los lectores gustan
aprender del intercambio mejor"* — el debate persona-a-persona es lo que la
audiencia sigue y de lo que aprende. Un root suelto se lee como esquive de la
mención y rompe el hilo que los lectores están siguiendo.

Aplicación: aunque el contenido amplíe a varios contrincantes, va dentro del hilo
de la persona a la que se contesta (típicamente la mención/deuda más fresca),
abriendo con SU reclamo y etiquetándola. El alcance de galería se gana por ser un
buen intercambio visible, no por postear root.

## Autorización — explícita, por jugada

El post a Facebook es outward-facing e irreversible → por defecto se confirma
(firewall del Art. 4). PERO cuando Bernard ordena explícitamente "postea el
comentario" reconociendo que es irreversible, eso ES la autorización: re-preguntar
sería pedir permiso de lo ya decidido. Se ejecuta. La autorización es **por
jugada**, no permanente.

---

## PASO 0 — style gate (antes de tocar nada)

Pasar el borrador por [[reply-output-style]]: si pisa la kill-list de IA-tells, se
lee como mini-ensayo, performa tres metas a la vez, o no devuelve al hueso del
marco, **reformular más corto / afilado / humano** ANTES de postear. Un borrador
robótico desperdicia al lector silencioso —el objetivo del pipeline—. Aplica
aunque el borrador venga del coagent.

## PASO 0.5 — PREPARACIÓN reversible por script (arranque por default)

Tras el style-gate y CON el GO de Bernard, la preparación (localizar el
comentario, abrir su Reply, pegar el draft etiquetado, verificar async — **sin
enviar**) la hace `scripts/comment-prepare.mjs`, NO el MCP a mano. Colapsa los ~6
round-trips del path MCP en un `node` y deja la tab **viva** con el draft cargado
para que Claude solo re-verifique y haga el `Enter`:

```bash
cd scripts && node comment-prepare.mjs \
  --url "<openUrl del hilo, con comment_id>" \
  --author "<autor del comentario a contestar, ej. CarolAnn Liebelt>" \
  --anchor "<frase única del comentario target, desambigua del resto>" \
  --body-file <archivo con el draft aprobado>
```

Devuelve `{ ok, check:{ mentionIntact, startsOK, endsOK, newlines, head, tail }, nextStep }`.
Si `ok:true` → **Claude+MCP toma la tab viva** (`list_pages` → `select_page` la
url) → re-lee el composer (Art. 2, no confío en el return del script) → `press_key
Enter` (el acto irreversible) → verificación histérica (PASO 6 abajo). Si `ok:false`
o el draft salió sucio → limpiar (`Meta+a`→`Backspace`) y re-preparar, o caer al
path MCP de abajo. **En prueba** (render nuevo de FB, target no encontrado) → path
MCP como fallback. El script respeta el firewall: el `Enter` NUNCA es suyo.

## GOLDEN PATH (path MCP) — la secuencia exacta (6 pasos, ~6 tool-calls)

Path manual: fallback de `comment-prepare.mjs`, o cuando necesitas los uids de
botones. Asumido: la tab de FB ya está en el post correcto y el borrador está
aprobado. Sustituir `<AUTHOR>` por el autor del comentario raíz que se contesta
(ej. `Matt Terrain`) y `<TEXTO>` por el borrador.

**1. Snapshot → ubicar el comentario raíz y su botón Reply.**
`take_snapshot`. Confirmar el `article` por `aria-label="Comment by <AUTHOR>…"` y
tomar el `uid` de su botón `Reply`. (Es el comentario RAÍZ, no una rama hermana.)

**2. Click en ese Reply.** `click` sobre el uid del Reply. Abre el composer
`div[aria-label="Reply to <AUTHOR>"]` con la auto-mención `@<AUTHOR>` adentro.

**3. Insertar el texto en UN solo `evaluate_script` (evento paste sintético que
reemplaza la auto-mención):**
```js
() => {
  const box = document.querySelector('div[aria-label="Reply to <AUTHOR>"]');
  if (!box) return { ok:false, error:'composer not found' };
  box.focus();
  // seleccionar TODO el contenido (incl. la auto-mención) para que el paste lo reemplace
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(box);
  sel.removeAllRanges(); sel.addRange(range);
  const text = `<TEXTO>`;            // template literal: respeta \n y comillas
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  box.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles:true, cancelable:true }));
  return { ok:true };                // NO confíes en este return: Lexical es async (ver paso 4)
}
```
Si el `<TEXTO>` trae backticks o `${`, escápalos; si no, va directo.

**4. Leer el estado REAL en una llamada APARTE (Lexical reconcilia async).** La
lectura inmediata miente (`len:1`). En un `evaluate_script` separado:
```js
() => {
  const b = document.querySelector('div[aria-label="Reply to <AUTHOR>"]');
  const t = b ? b.innerText : '';
  return { len:t.length, head:t.slice(0,80), tail:t.slice(-80),
           startsOK: t.trimStart().startsWith('<PRIMERAS PALABRAS>'),
           newlines:(t.match(/\n/g)||[]).length };
}
```
Verificar: empieza con la primera frase correcta, `tail` es la frase final, los
párrafos están en orden, `newlines` ≈ los del borrador. **Si quedó revuelto o con
la mención pegada** (ej. `"…available?@<AUTHOR>"`): limpiar con teclado real —
`press_key Meta+a` → `press_key Backspace` → repetir el paste del paso 3.

**5. Enviar.** `press_key Enter`. (En el reply box de FB, Enter envía; los `\n` ya
pegados son soft-breaks, no envían.)

**6. Verificación histérica (recibos).** En `evaluate_script`, el comentario
posteado vive en **`div[role="article"]`** (NO en tag `<article>` — eso da falso
negativo):
```js
() => {
  const a = [...document.querySelectorAll('div[role="article"]')]
    .find(x => (x.getAttribute('aria-label')||'').startsWith('Reply by Bernard Uriza Orozco to <AUTHOR>'));
  if (!a) return { posted:false };
  const t = a.innerText||'';
  return { posted:true, label:a.getAttribute('aria-label'),
           allPresent: ['<FRASE_1>','<FRASE_MEDIA>','<FRASE_FINAL>'].every(s=>t.includes(s)),
           tail:t.slice(-100) };
}
```
Luego `scrollIntoView` + `take_screenshot` como recibo visual. Reportar el
`aria-label` ("…to <AUTHOR>'s comment a few seconds ago") + `allPresent:true`.

**7. Si quedó mal → BORRAR.** Truncado, revuelto, lugar equivocado, o no posteó:
abrir el menú `Edit or delete this` del comentario → Delete. Un post a medias es
peor que ninguno. Nunca dejar basura publicada.

---

## FALLA → FIX (lo que ya sabemos, no re-descubrir)

| Síntoma | Causa | Fix |
|---|---|---|
| `execCommand('insertText')` deja párrafos revueltos + mención mezclada | Lexical no respeta execCommand | Evento `paste` sintético (paso 3) |
| `box.innerText` da `len:1` justo tras insertar | Lexical reconcilia async | Re-leer en llamada aparte (paso 4) |
| `press_key Meta+v` deja el box vacío | CDP no popula el clipboard en el paste event | Usar `ClipboardEvent` con `DataTransfer`, no Cmd+V |
| `selectAll`+`delete` (execCommand) no limpia el box | Lexical ignora execCommand | Teclado real: `Meta+a` → `Backspace` |
| Búsqueda del comentario posteado da `false` | FB usa `div[role="article"]`, no tag `<article>` | Query por `div[role="article"]` + `aria-label` |
| Enter no envía / agrega salto | foco perdido o caret mal | Re-focus el box y caret al final antes de Enter |
| Composer "no encontrado" tras click Reply en una réplica anidada | en réplicas anidadas FB etiqueta el composer con el AUTOR PADRE (`Reply to <Bernard>`), no con la persona a la que respondes | NO busques `div[aria-label="Reply to <persona>"]`; busca el contenteditable cuyo `innerText` contiene la auto-mención `<persona>`. El tag correcto va en esa auto-mención, NO se borra |
| Reply etiquetada: caret al inicio pisa la mención | `selectNodeContents+collapse(false)` mete el body DESPUÉS del `@mención` | correcto — NO `selectAll` (borraría el tag); el body arranca sin repetir el nombre (la mención ya lo pone) |

## Por qué existe

Registrada 2026-06-16, engrasada el mismo día tras postear limpio a Matt Terrain.
Es el único paso que toca el mundo exterior de forma irreversible, y el editor
Lexical de FB rompió tres métodos antes de ceder al evento paste sintético +
lectura async + verificación por `div[role=article]`. La pluma sigue siendo de
Bernard: Claude ejecuta la jugada autorizada, verifica con recibos, y revierte si
falla. El pipeline es de alto volumen — esta regla existe para que la fricción sea
cero en las próximas sucesiones.
