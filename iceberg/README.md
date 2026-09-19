# El iceberg del especismo

Página D3 (`index.html`) que acomoda, por niveles de profundidad, todo lo que emerge de los
grupos de debate: arriba las frases textuales tal cual se oyen; cada nivel hacia abajo es lo que
esa frase presupone, lo que hace materialmente, cómo se defiende el sistema, cómo se reproduce, y
el fondo. Se oscurece conforme bajas.

Abrir: `open iceberg/index.html` (funciona desde `file://`; D3 v7 desde jsdelivr).

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
