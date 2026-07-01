# Provenance-Accusation Defense — "tú introdujiste/dijiste X" se VERIFICA contra el arco, no se concede ni se ignora

Regla dura de debate (2026-06-30, Bernard). Gobierna cómo se responde a la
**acusación de procedencia / burden-flip**: cuando el oponente afirma *"tú
introdujiste X / tú dijiste Y / tú moviste el poste a Z / es TU trabajo defenderlo,
no el mío"*. Hermana de [[insult-seal-defense]] y [[abolitionist-framing]],
subordinada a [[reply-output-style]] (afina su manejo de mala fe). Es una aplicación
del **Art. 2** (verificar el estado real, nunca asumir) al contenido del debate.

## El diagnóstico: una atribución es un reclamo de hecho — y se puede medir

La acusación de procedencia hace pasar por "tú ya admitiste / tú empezaste esto" algo
que **o es cierto o no lo es**, y casi siempre se lanza para **invertir la carga** y
**confundir al lurker**: si el oponente logra que el intercambio se lea como "él trajo
una idea indefendible y ahora la esquiva", gana sin argumentar. Dos errores simétricos,
ambos caros:

- **Concederla a ciegas** (asumir que es cierta) → cargas con una posición que nunca
  tomaste; el lurker te ve defendiendo lo indefendible.
- **Asumirla falsa sin verificar** → si resultó cierta (de verdad la introdujiste, o
  respondiste sin ver el arco), niegas un hecho y quedas como el deshonesto.

La salida no es elegir un bando a priori. Es **medir**.

## La regla: VERIFICAR el arco antes de responder (Art. 2)

Ante cualquier "tú introdujiste/dijiste/moviste X":

1. **Correr `node thread-extract.mjs "<url>" --json`** y leer el **arco completo
   oponente↔Bernard en orden cronológico**. Trazar **quién introdujo cada pieza** (el
   caso-límite, la analogía, el término, el "slippery slope"). La verificación es
   mecánica y barata; el costo de equivocarse es alto (el lurker).
2. **El veredicto del arco decide la respuesta**, no el instinto.

## Si la acusación es FALSA → exponer el hecho, sin drama

Exponer la mala atribución **factualmente, mostrando el hecho y dejando que pese** —
NUNCA llamarla "mentira" ni dramatizar. Llamarla mentira le da al oponente una **salida
emocional** ("me estás insultando") y convierte el hecho en una pelea de tono. Lección
del coagent (2026-06-21/30): *"muestra el hecho y deja que pese"*.

- Va **PRIMERO** (mala fe = exponer la trampa antes de cualquier otra cosa, desde la
  fuerza — ver [[reply-output-style]] § "La concesión es CONDICIONada").
- **Frecuentemente lo que dicen que tú trajiste lo trajeron ELLOS** — y suele cortar en
  su contra. Devolvérselo: nombrar quién lo introdujo de verdad y por qué refuta su
  punto, no el tuyo.
- Sin psicología clínica, sin acusación de carácter — solo el registro del hilo.

**Forma canónica (reusable):**
> There is no [X] in this thread for me to defend. The only [edge case / claim] raised
> was [Y], and you brought that in — and it cuts the other way: [por qué].

Luego volver al hueso (la pregunta del marco) y, si aplica, una sola línea al sello
([[insult-seal-defense]]: "ask your AI friend" / "get a dictionary" = etiqueta, no
refutación).

## Si la acusación es VERDADERA → concederla limpia, desde la buena fe

Si el arco muestra que **sí** introdujiste eso, lo mal-atribuiste, o **respondiste sin
leer el arco** (el riesgo real: contestar el turno fresco sin reconstruir lo previo):
concédelo de frente y dueño. La honestidad intelectual ante el lurker vale más que
ganar el punto; negar un hecho verificable es la derrota.

## No ignorarla — el lurker lee el silencio como esquive

Una acusación de procedencia **sin verificar ni responder** le lee al lector silencioso
como que el oponente te atrapó. Por eso se **atiende** (corto, una vuelta, y de vuelta
al hueso), nunca se ignora — aun frente a un pozo sin fondo. El valor sigue siendo 100%
el lurker.

## El gancho

**Verificar el arco es barato; conceder una falsa o ignorar una verdadera es caro.**
Verifica siempre, expón el hecho sin drama, devuelve la pieza mal-atribuida a quien la
trajo, y vuelve al título.

## El caso que la originó (2026-06-30, Anna Angelika, post 27496)

Anna afirmó: *"You were the one who introduced the slippery slope, so it's your job to
support it, not mine. Ask your AI friend to do a better job."* El arco completo
(`thread-extract --json`) lo desmintió: **no había ningún slippery slope en ese hilo**
(el line-drawing fish/octopuses/nematodes era de OTRO hilo, el de Les). El único
caso-límite del hilo de Anna — *humanos permanentemente inconscientes* — **lo introdujo
ELLA** (su turno previo: "we'd have trouble explaining why permanently unconscious
humans still deserve protection"), y Bernard solo se lo había volteado. El reply expuso
el hecho sin llamarlo mentira ("There is no slippery slope in this thread for me to
defend… you brought that in… it cuts the other way"), volteó su analogía del juez, nombró
la negativa-como-respuesta, y cerró con la pregunta del título. Bernard: *"hay que
aprender a detectar mejor esas (falsas o no) acusaciones, para podernos defender."*
