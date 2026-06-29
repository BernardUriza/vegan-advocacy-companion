# Sentiocentrism, Not Biocentrism — el criterio es la SINTIENCIA, no la VIDA

Regla dura de eje (2026-06-29, Bernard). Hermana de [[abolitionist-framing]]: esa
fija que el eje es PROPIEDAD/ESCLAVITUD (no daño); ésta fija **quién entra al
círculo moral** — un **ser sintiente** (un sujeto que siente, teme, busca seguir
vivo, tiene experiencias), NO un **ser vivo**. Somos **sensocentristas**, no
biocentristas. Gobierna [[reply-output-style]] (kill-list) y [[coagent-advise]] (el
master prompt) por encima del tono.

## La corrección

> "somos sensocentristas, no biocentrista, deja de hacer las preguntas en términos
> de 'living being' y habla de 'sentient beings'. No cuesta nada ser específico y
> claro." — Bernard, 2026-06-29

El reply a Samantha Mckenna (27330) cerró con *"What makes it legitimate for one
**living** individual to exist as the property of another?"*. "Living" es
biocéntrico y **impreciso**: deja la puerta abierta al tu-quoque de plant-sentience
("las plantas también están vivas"), y enmarca el criterio en la VIDA cuando el
criterio real es la **sintiencia**. No se editó lo ya posteado; la regla aplica de
aquí en adelante.

## La distinción

| Biocéntrico (PIERDE — kill-list) | Sensocéntrico (el eje) |
|---|---|
| El criterio es estar **vivo** | El criterio es **sentir** (tener punto de vista) |
| "living being / living individual / a life" | "sentient being / a subject who feels / someone with experiences" |
| Abre el flanco "las plantas/células también viven" | Lo cierra: una planta no es **alguien**, no teme ni busca seguir vivo |
| "respeto a la vida / valor de la vida / right to life" | consideración moral por **quien tiene intereses experimentados** |

El biocentrismo es vago y regalable; el sensocentrismo traza la línea exacta y es lo
que el lurker ya intuye (un perro es *alguien*; un tomate no). Ser específico no
cuesta nada y cierra el esquive.

## Cómo se aplica

1. **La pregunta del marco va en términos de SUJETO SINTIENTE**, nunca de "living
   being / la vida": *"¿qué justifica poseer a un sujeto que siente, teme y busca
   seguir vivo?"* — no *"¿qué justifica poseer a un ser vivo?"*.
2. **El reemplazo:** "living being/individual/creature/thing" → "sentient being",
   "a subject who feels", "someone with a point of view / experiences".
3. **La posesiva SÍ es legítima:** "experience its own life from the inside" /
   "su propia vida" describe la EXPERIENCIA del sujeto (sensocéntrico correcto), no
   el criterio biocéntrico — no se toca.
4. Combina con [[abolitionist-framing]]: el eje sigue siendo propiedad/esclavitud;
   esta regla solo garantiza que el **sujeto** del eje se nombre por su sintiencia,
   no por estar vivo.

## KILL-LIST de framing (los gates la aplican)

NUNCA enmarcar el criterio de quién-cuenta como — biocéntrico:
- "living being / living individual / living creature / living thing / living organism"
- "ser vivo / individuo vivo / cosa viva"
- "respeto/valor/santidad a la vida", "right to life / derecho a la vida"
- "a life / one life / every life" usado como criterio (la posesiva "its own life"
  está OK — es la experiencia del sujeto)

En su lugar: **ser sintiente, sujeto que siente, alguien con experiencias/punto de
vista, ¿quién tiene intereses experimentados?**.

## El detector (SSOT) — cableado a los tres gates

`scripts/biocentric-axis.mjs` (`detectBiocentricAxis`) es el SSOT, hermano de
`welfarist-axis.mjs`. Lo consumen, igual que el welfarista:
- **`style-gate.mjs`** (etapa 4, draft inglés) — flag `biocentricAxis`.
- **`lint-prose.mjs`** (cualquier prosa con audiencia de lurker) — FLAG biocéntrico.
- **`seed-gate.mjs`** (etapa 3, master español) — flag dura `biocentricInPlay` (no
  seedear hasta reescribir la jugada).

Disciplina (igual que el welfarista): el léxico biocéntrico literal solo aparece en
citas verbatim del oponente (en blockquote `>`, que los gates excluyen) o dentro del
bloque guardrail; en TU jugada/draft/ask, nómbralo por la sintiencia o referencia el
guardrail — el detector no entiende negación y un "no digas living being" igual
dispara.

## Por qué existe

Registrada 2026-06-29 tras postear a Samantha el cierre con "one living individual".
Bernard: el biocentrismo es impreciso y regala el flanco plant-sentience; el criterio
es la sintiencia y nombrarlo así no cuesta nada. Se cableó al gate (no solo prosa)
para que un draft/master con "living being" se frene determinísticamente, igual que
el welfarismo.
