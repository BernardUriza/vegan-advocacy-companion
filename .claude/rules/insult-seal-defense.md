# Insult-Seal Defense — el "eres ignorante/arrogante" es un sello PARA EL LURKER

Regla dura (2026-06-28, Bernard). Gobierna cómo se responde al insulto-sello —
"you're ignorant and arrogant" y sus primos ("get a dictionary", "my darling",
"Bernie", "cheap thrills") — cuando aparece en lugar de un argumento. Subordinada a
[[reply-output-style]] (afina su fila "Insultos" y el registro filo), hermana de
[[abolitionist-framing]].

## El diagnóstico: el insulto no es para ti, es para el lurker

El sello-insulto NO es sincero, NO busca herirte, NO es ni siquiera un ataque real
a ti. Es una jugada retórica **dirigida al lector silencioso**:

- **Cubre cada falta de argumento.** El insulto va exactamente donde debía ir la
  refutación. Es lo que se pone cuando no se tiene el punto.
- **Le hace la chamba al lurker de no pensar.** Un sello que suena contundente y
  definitivo ("este tipo es ignorante, ya, cerrado") le ofrece al observador un
  atajo cognitivo: archivar el intercambio sin reflexionar lo que se dijo.
- **Su necedad es obvia** — el sello mismo delata que no hay argumento detrás. Esa
  obviedad es la palanca: se nombra, no se sufre.

## Por qué no puedes ni callar ni morder

| Reacción | Por qué pierde al lurker |
|---|---|
| **Silencio total** | El lurker lo lee como que el sello pegó — te ve indefenso. El insulto cumplió su función de cierre. |
| **Insulto de vuelta** ("you're the ignorant one") | Convierte el hilo en patio de escuela; dejas de ser el adulto en la sala. El lurker no aprende de una pelea. |
| **Sonar herido** ("why are you insulting me?", "be respectful") | Se lee como que el golpe pegó. Pides simpatía en vez de quitarle al insulto su función. |

El punto NO es defender tu autoestima. Es **quitarle al insulto su función de
cierre** y devolverle al lurker la tarea que el sello le quiso ahorrar.

## La doctrina (stress-testeada por el coagent insult-gpt)

**No se contesta SIEMPRE.** Contestar todo insulto es predecible y le da demasiado
poder. Se contesta **solo cuando el insulto intenta CERRAR el intercambio para el
lurker**; si es ruido suelto, se ignora.

### Movimiento canónico (voz de Bernard, reusable)

> That's a label, not an argument. If the point is wrong, show where. Otherwise the
> insult is just standing in for the answer.

o, más afilado:

> "Ignorant" is doing a lot of work there. Name the mistake, or admit the label is
> what you put where the argument was supposed to go.

Una sola frase. Nombra que el sello ocupa el lugar del argumento y le devuelve al
otro la carga de mostrar el error — frente al lurker.

### Graduación (qué hacer según el comentario)

| El comentario trae… | Respuesta |
|---|---|
| **Argumento + insulto** | Contesta el argumento; añade UNA sola línea al insulto. |
| **Solo insulto** | Una línea de cierre, o nada. |
| **Insulto DESPUÉS de una pregunta clara ya dejada sin responder** | Ignorarlo suele ser más fuerte: deja visible que el otro abandonó el argumento. La pregunta sin contestar es tu mejor recibo. |

## El principio (por qué gana al lurker)

**No pides simpatía — le devuelves al lurker la tarea básica:** mirar si hubo un
argumento o solo un sello emocional para no pensar. El observador, invitado a hacer
ese chequeo, ve por sí mismo quién trajo razones y quién trajo la etiqueta. Ese es
el norte de [[reply-output-style]] (el lurker, no el oponente) aplicado al insulto.

## Cómo se aplica en el pipeline

- **Etapa 3 (coagent-advise):** cuando el target usa el sello-insulto, el master
  prompt pide el movimiento canónico de arriba, con la graduación correcta — no
  morder, no callar, no quejarse.
- **Etapa 4 (style-gate):** un borrador que suene herido ("why are you insulting
  me"), que devuelva el insulto, o que se quede sin nombrar la función del sello
  cuando el insulto intentó cerrar el intercambio → reformular.

## Por qué existe

Registrada 2026-06-28 tras el hilo de Samantha Mckenna (post 27330), donde ella y
Philip M. Kim se pasaron el hilo sellando con "Bernie / ignorant / arrogant / my
darling / cheap thrills" en vez de contestar la pregunta de propiedad. Bernard:
*"necesitan llamarme ignorante y arrogante, no porque ellos lo crean… lo hacen para
el lurker, para cubrir cada falta de argumentos, para facilitarle la chamba de
reflexionar… necesito defenderme para que el lurker no me vea como indefenso."* La
doctrina la afinó el coagent insult-gpt (su maestría: cazar la incoherencia
marco→salida, ver [[coagent-advise]]).
