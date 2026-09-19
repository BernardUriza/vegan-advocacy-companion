# El iceberg del especismo

Página D3 (`index.html`) que acomoda, por niveles de profundidad, todo lo que emerge de los
grupos de debate: arriba las frases textuales tal cual se oyen; cada nivel hacia abajo es lo que
esa frase presupone, lo que hace materialmente, cómo se defiende el sistema, cómo se reproduce, y
el fondo. Se oscurece conforme bajas.

Abrir: `open iceberg/index.html` (funciona desde `file://`; D3 v7 desde jsdelivr).
En vivo: **https://aos.bernarduriza.com/iceberg/** (publicar con `scripts/iceberg-publish.sh`).

## Visión — por qué existe (2026-09-19)

El "iceberg chart" es un género entero (lore, conspiraciones, memes) y los mapas de
argumentos también existen. Este no es ninguna de las dos cosas: **es un mapa DERIVADO del
moat** — 173 interacciones reales, 37 tácticas etiquetadas sobre gente concreta, frameworks
con win-rate — donde cada nodo del fondo está amarrado por hilos a la frase literal que
alguien escribió en un grupo un martes. Haces clic en "It's food" y se ilumina el camino
hasta "alguien convertido en suministro". Ese camino iluminado es el reclamo que el
activista le hacía al mundo, ahora con recibos.

Lo que el iceberg demuestra es que las contradicciones del especismo cotidiano **no son
pedantes, son estructurales**: cada estación de arriba existe para que no se tenga que mirar
la de abajo. Por eso da autoridad frente al lurker — ya no se discute una frase, se señala
qué la está sosteniendo.

Tres compromisos que lo mantienen honesto:

1. **Solo entra lo que salió de un hilo real.** Un nodo sin cita ni táctica del moat detrás
   es opinión; el iceberg es evidencia acomodada.
2. **Cada hilo procesado que enseñe algo nuevo deja un nodo** (regla en `CLAUDE.md`). Es el
   mismo contrato que el moat: si no se registra el día que se aprende, se pierde.
3. **Se publica en vivo** en `https://aos.bernarduriza.com/iceberg/` con
   `scripts/iceberg-publish.sh` — el SSOT sigue aquí; la copia en activist-os es derivada y
   está marcada como generada.

Bernard, el día que nació: *"he logrado nombrar de forma más exacta lo que yo al mundo le
reclamaba."* Ese es el criterio de calidad de cada nodo nuevo: ¿nombra más exacto?

## Archivos

| Archivo | Qué es | Se edita |
|---|---|---|
| `data.js` | **SSOT** de niveles y nodos (`window.ICEBERG`) | sí — aquí se engorda el iceberg |
| `moat.js` | nombres/definiciones de tácticas y frameworks usados, **generado** desde `data/tactics.json` + `data/frameworks.json` | no — `node scripts/iceberg-build.mjs` |
| `index.html` | la página (layout, gradientes, hilos, panel) | solo para cambiar la visual |

## Cómo agregar un nodo (cada hilo nuevo deja algo)

1. En `data.js`, un objeto en `nodes`:
   - `id` (kebab), `level` (0–5), `title` (corto, es el texto del cuadro),
   - `quote` + `src` si es una frase verbatim del grupo (nivel 0 casi siempre) — sin nombres de
     personas: grupo + mes,
   - `body` (la prosa del panel, en español, eje abolicionista/sensocéntrico),
   - `tactics[]` (ids de `data/tactics.json`), `frameworks[]` (ids de `data/frameworks.json`),
   - `from[]`: ids de los nodos de los que emerge (mismo nivel o superior; nunca uno más abajo).
2. `node scripts/iceberg-build.mjs` — valida (ids reales, `from` coherente) y regenera `moat.js`.
3. Abrir la página y ver el nodo en su banda con sus hilos.

Los `from` son lo que hace iceberg y no lista: al hacer clic en un nodo se iluminan todos sus
ancestros y descendientes. Un nodo sin `from` en un nivel > 0 es un huérfano — casi siempre
señal de que falta la premisa que lo sostiene.

## Gotcha conocido

En `file://`, Chrome loguea `Unsafe attempt to load URL … 'file:' URLs are treated as unique
security origins` por cada `fill="url(#gradiente)"`. Es benigno (los gradientes renderizan) y
desaparece servido por http. Reproducido con una página mínima de un `<rect fill="url(#g)">`.
