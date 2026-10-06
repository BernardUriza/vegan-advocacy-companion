# Profundidad de anidación vs señal de lurker, y la prueba de visibilidad (2026-10-05)

Dos puntos de la auditoría de Gemini (`2026-10-05-gemini-auditoria-estrategia.md`) que había que medir antes de
adoptar nada: (3) "una reply en el nivel 4 de anidación tiene audiencia de uno, corta por profundidad" y (5) "los
likes en cero son shadowban". Mecánica: `scripts/depth-reactions.mjs` (48 tx, 384 replies mías vivas) y
`scripts/visibility-probe.mjs`.

## Corrección previa: en grupos de FB no existe el "nivel 4"

El DOM tiene tres profundidades: post → comentario raíz (`depth 0`) → reply al comentario (`depth 1`) → reply a una
reply (`depth 2`), y FB pinta todas las replies de un comentario en UNA lista plana con la @mención. Lo que se puede
medir es la profundidad y la **posición** de mi reply dentro de la lista de su comentario raíz. `thread-extract`
guarda `depth` desde hoy; en los tx anteriores se deriva del aria-label (`'s comment` → 1, `'s reply` → 2).

## Resultado (384 replies mías; likes medidas solo en 119)

| profundidad | mis replies | con ≥1 like (IC95) | con respuesta de terceros |
|---|---|---|---|
| 0 raíz | 6 | 1/5 [2–63%] | 3 (50%) |
| 1 reply al comentario | 131 | 6/26 [10–42%] | 12 (9%) |
| 2 reply a una reply | 247 | 13/88 [9–23%] | 4 (1.6%) |

| posición en la lista del raíz | mis replies | con ≥1 like (IC95) | con terceros |
|---|---|---|---|
| 1–3 | 197 | 8/43 [9–32%] | 14 (7%) |
| 4–8 | 87 | 3/29 [3–25%] | 1 (1%) |
| 9+ | 94 | 8/42 [9–33%] | 1 (1%) |

**Lectura honesta.** Los likes no separan nada: todos los intervalos se traslapan y la mediana es 0 en todos los
niveles (como ya decía el research del 28-sep). La señal está en los **terceros**: 12 de 131 replies de
profundidad 1 recibieron respuesta de alguien que no era el interlocutor, contra 4 de 247 en profundidad 2; y 14 de
197 en las posiciones 1–3 contra 2 de 181 de la posición 4 en adelante. Dos de cada tres replies mías (247/384) van
en profundidad 2, donde casi nadie más entra.

**Confusores que impiden leerlo como causa.** Las replies profundas son, por construcción, las vueltas tardías con
los mismos 4–5 recurrentes (Dean, Les, Philip, Anna): el hilo ya envejeció, FB lo bajó del feed y la posición alta
y la profundidad 2 llegan juntas. No se puede separar "nadie lee el nivel 2" de "nadie lee la vuelta 9 con Les".
`thirdPartyReplies` además solo cuenta terceros que me contestan a mí; un tercero que entra a contestarle al
oponente no se ve.

**Lo que sí autoriza este dato:** medir mejor, no cortar todavía. (a) Registrar `depth` y `position` en cada
interacción (HECHO 2026-10-05: `reply_depth`/`reply_position` en el moat, 116 de 120 interacciones con `draft_sha`
llenadas desde los tx con `lurker-sweep --backfill-placement`; 5 en d0, 23 en d1, 88 en d2; `lurker-sweep` las
escribe en cada corrida); (b) en el readout del voice_trial (30/brazo) cruzar brazo ×
profundidad (HECHO: `framework-stats` "Por VOZ" imprime brazo × d0/d1/d2 con terceros); (c) si a 70/brazo la posición 4+ sigue en ~1% de terceros, proponerle a Bernard una regla de salida
por posición (no una denylist de personas), registrada en `notification-agrupation.md` con esta tabla.

## Visibilidad sin sesión (la prueba barata de Gemini)

`visibility-probe.mjs` lee la privacidad del grupo con la sesión de Bernard y abre el permalink en un contexto
incógnito nuevo del mismo Chrome (sin cookies):

| grupo | privacidad | permalink anónimo |
|---|---|---|
| Vegans V's Meat Eaters (Open Debates) 3 | **Private group** | login wall, 731 chars |
| VEGANnoyance; The Group! | **Private group** | login wall |
| Vegans VS Meat Eaters | **Public group** | pinta SOLO el post (1043 chars), cero comentarios, ni los del oponente |

Veredicto: **no concluyente, y no por shadowban**. En los dos grupos privados no hay vista anónima; en el público FB
no le muestra comentarios a nadie sin sesión (la frase de control del propio Philip Wheeldon tampoco aparece). La
prueba requiere una segunda cuenta logueada que no sea de Bernard, y eso ya no es barato ni es decisión mía. Lo que
sí está medido: 8 de 47 replies con likes y terceros que me contestan (18 casos arriba), consistente con poca
exposición, no con ocultamiento.
