# Abolitionist Framing — el eje es PROPIEDAD/ESCLAVITUD, no "harm"

Regla dura y de fondo (2026-06-21). Gobierna el EJE de cada reply, por encima del
tono y del formato. Es la corrección de la derrota recurrente: los borradores se
redactan en términos **bienestaristas** ("harm/daño/sufrimiento/unnecessary harm/
reduce harm/least harm") como si el problema fuera la **cantidad** o el **rol** del
daño — y eso **concede el terreno y pierde**. El marco es **abolicionista**: el
problema es el **estatus de propiedad** del animal (un sujeto poseído, esclavizado),
no cuánto sufre ni si el daño es "necesario".

Tiene una regla **hermana de eje**, [[sentiocentrism-not-biocentrism]]: ésta fija
que el eje es propiedad/esclavitud (no daño); la hermana fija que el **sujeto** del
eje se nombra por su SINTIENCIA (sentient being), no por estar vivo (living being).
Las dos juntas: *¿qué justifica poseer a un sujeto que siente?* — ni "daño" ni
"vida" como eje.

Subordina a [[reply-output-style]] (el NORTE ya dice "usar seres sintientes como
propiedad/recurso" — esta regla lo hace innegociable y nombra el drift bienestarista
como kill-list) y a [[coagent-advise]] (el master prompt debe pedir marco
abolicionista, no de reducción de daño). El framework canónico del eje es
`algo-a-alguien-sujeto-derecho` (de objeto de propiedad a sujeto de derecho).

## La distinción que define todo: esclavitud, no daño

| Bienestarismo (PIERDE — kill-list) | Abolicionismo (el eje) |
|---|---|
| Mide cantidad/rol del daño: "incidental vs propósito", "least harm" | Mide ESTATUS: ¿es propiedad/esclavo o no lo es? |
| "El daño innecesario importa en todos lados" | El daño no es el eje; la **esclavitud** lo es |
| Concede "unnecessary harm" en cosechas/azúcar | NO concede: ahí no hay nadie esclavizado |
| Pregunta "¿qué justifica el daño innecesario?" | Pregunta "¿existe la esclavitud **necesaria**?" |

**El crop_deaths flip mal hecho es la trampa.** Conceder "sí, en la cosecha de
azúcar también se mata innecesariamente" **aplana la diferencia categórica**: en una
cosecha **no hay nadie esclavizado** — es muerte incidental de alguien que NO es
propiedad. En la granja **sí hay un esclavo** — un sujeto criado, poseído y dispuesto
como propiedad. El crop death y la granja no se distinguen por *cantidad* ni por
*intención del daño* (eso es bienestarismo); se distinguen por **estatus de
propiedad/esclavitud**. Pelear el body-count o el "rol del daño" ya perdió el marco.

## Cómo se aplica (frente a crop_deaths / least-harm / "unnecessary harm")

1. **NO competir en cantidad de daño** ni conceder "unnecessary harm everywhere".
   Esa concesión es la derrota.
2. **Nombrar el estatus:** la granja es **esclavitud** (un sujeto tratado como
   propiedad); la cosecha no lo es (nadie es propiedad ahí). La diferencia no es
   cuánto se daña, es **a quién se posee**.
3. **Invertir la carga sobre el estatus, no sobre el daño:** la pregunta del marco
   no es "¿qué justifica el daño si es evitable?" sino **"¿existe la esclavitud
   necesaria?"** — la carga cae sobre quien defiende poseer a un sujeto.
4. **Conceder lo empírico sin tocar el eje:** que las cosechas matan animales, que
   algunos veganos consumen daño evitable — todo eso se concede *y no mueve nada*,
   porque el eje nunca fue el daño: fue la propiedad.

## KILL-LIST de framing (el style-gate la aplica, etapa 4)

NUNCA redactar el eje del reply en términos de — como si el problema fuera la
cantidad/rol del daño:
- "harm" / "daño" como sustantivo central del argumento
- "unnecessary harm" / "avoidable harm" / "sufrimiento evitable"
- "reduce harm" / "less harm" / "least harm" / "minimize harm"
- "incidental vs intentional harm" / "byproduct vs purpose" como LA distinción
- conceder "there is unnecessary harm everywhere / in crops too"

En su lugar, el eje va en términos de: **propiedad, esclavitud, sujeto poseído,
estatus moral, alguien vs algo, ¿existe la esclavitud necesaria?**. El daño puede
mencionarse al pasar, pero NUNCA es el eje portante del reply.

### El detector (SSOT) cubre TODO el léxico welfarista, no solo "harm" — y se corre sobre CUALQUIER prosa generada

El detector canónico `scripts/welfarist-axis.mjs` caza `pain/cruelty/humane/welfare/
compassion/painless/feels pain/sin dolor/sacrificio humanitario` además de las formas
de `harm/daño` (criterio inequívoco → STRONG; mención bare → QUANTUM soft, como `harm`,
para no falsear el "nombrar-para-rechazar"). Lo consumen el `seed-gate` (masters,
etapa-3), el `style-gate` (drafts, etapa-4) y `scripts/lint-prose.mjs <archivo|stdin>`
— este último corre el MISMO detector sobre **cualquier prosa que Claude genere con
audiencia de lurker** (contraataques anticipados, ejemplos, borradores ad-hoc), NO solo
los drafts del pipeline. Ese era el gap: prosa generada fuera del pipeline escapaba el
filtro y filtró `"who feels pain"` en un contraataque (2026-06-27). Disciplina dura:
antes de presentar/postear prosa generada, `node scripts/lint-prose.mjs <archivo>`; si
FLAG, reescribir el eje a propiedad/esclavitud. Ver [[welfarist-lint-any-prose]].

## La salida a prueba de concesión (Art. — marco, no premisa)

Como todo framework, `algo-a-alguien-sujeto-derecho` se planta como la intuición que
el lurker ya tiene (cualquier perro es *alguien*), traducido a lenguaje llano
("alguien vs algo"), NUNCA como jerga jurídica ni como premisa demostrada (eso es
petición de principio — ver el attack_surface del framework). Si refutan el estatus,
la pregunta sigue en pie: ¿qué justifica poseer a un sujeto que evita el dolor,
busca seguir vivo y tiene experiencias?

## El caso que la originó (2026-06-21, Anna Angelika, hilo crop deaths)

El reply A2 a Anna concedió que "en las cosechas de azúcar se mata innecesariamente"
y peleó la distinción "subproducto incidental vs propósito" — puro bienestarismo.
Bernard: *"sigues hablando en términos de 'harm' y 'daño' y eso es bienestarismo
puro, por eso seguimos perdiendo… en las cosechas de azúcar no hay nadie esclavo,
en la granja sí. Esa es la distinción, es esclavitud innecesaria, y el post debía
preguntar si existía la esclavitud necesaria… no estás siguiendo un framework
abolicionista aún."* El post original mismo se centraba en pérdida directa/sujeto;
el drift a "harm" lo traicionó. No se cambió lo ya posteado; esta regla aplica de
aquí en adelante.
