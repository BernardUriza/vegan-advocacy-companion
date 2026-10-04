# 2026-10-03 — Afirmar-luego-negar: ¿tell de IA o el argumento? Y cómo se llama el salto

Disparador: el style-gate no caza "That list proves who can do more. It does not prove who gets the title."
y quedó anotado como pendiente. Bernard preguntó si eso que combatimos es la "afirmación del consecuente:
evidencia compatible con B no prueba B", que fue la respuesta de ChatGPT (10 palabras) a su pregunta sobre el
salto de "una tecnología da evidencia fuerte de dónde está una cosa" a "por tanto B hizo el robo".

## Veredicto

1. La forma afirmar-luego-negar es la jugada central del proyecto y no se bloquea. Lo que se bloquea es
   repetir el mismo molde en un lote.
2. "Afirmación del consecuente" es una etiqueta floja para el ejemplo del robo y equivocada para los saltos
   de hecho a derecho de los hilos. El nombre de estos últimos es brecha ser/deber.
3. Ningún nombre de falacia se dice en público.

## Lo medido en el repo

23 de 132 drafts guardados desde junio usan la forma (regex sobre `.coagent/drafts-*/` y `.coagent/draft-*.txt`).
Ejemplos publicados: "Convenience explains why somebody would want a thing. It doesn't explain why they're
entitled to it." · "Having the reins explains who is in charge. It doesn't explain why the one holding them is
entitled to." · "Saying 'the law says so' tells me how the system currently works. It doesn't tell me why…".
`reply-output-style` ya lista "separar can de should" entre las marcas de voz a conservar. El 3-oct salió con
el mismo par de verbos (tell > say) en una reply a Chris Clark (lote 1003B) y otra a Tiana (lote 1003F).

## Lo que dicen las fuentes

| Pregunta | Hallazgo | Certeza |
|---|---|---|
| ¿Cuál es el tell documentado? | El catálogo de Wikipedia "Signs of AI writing" lista como paralelismo negativo "Not just X, but also Y", "Not X, but Y" y "Y rather than X". El par de oraciones "X prueba A. No prueba B" no aparece en ninguna fuente leída. | Probable (no se pudo leer la lista completa del paper Antislop) |
| ¿Qué figura clásica es cada forma? | Negar-luego-afirmar: antítesis / correctio (epanorthosis). Conceder-y-negar: concessio (paromologia), conceder un punto para probar otro más importante. | Probable (Silva Rhetoricae; la página de distinctio dio 404) |
| ¿Cómo se distingue el tic del uso sustantivo? | Ninguna fuente lo enuncia. Inferencia: el tic niega algo que nadie afirmó para sonar deliberado; el uso sustantivo niega una inferencia que el otro sí hizo. | Inferencia propia |
| ¿"Afirmación del consecuente" nombra el salto del robo? | Solo si el argumento fue "si B lo robó, estaría en X; está en X; luego B". Sin condicional enunciado, el nombre seguro es non sequitur; "evidencia compatible con B no prueba B" describe subdeterminación (Mill). No es falacia del fiscal ni generalización apresurada. | Definiciones confirmadas (IEP, SEP); el mapeo al ejemplo es análisis |
| ¿Y el salto de hecho a derecho de los hilos? | Brecha ser/deber (Ley de Hume): de premisas solo descriptivas no sale un deber sin una premisa evaluativa. Instancias: apelación a la ley, la fuerza hace el derecho, argumento desde la capacidad. "Afirmación del consecuente" es error de categoría aquí. "Falacia naturalista" tiene dos sentidos (Moore vs. uso popular) y conviene evitarla. | Confirmado para el paraguas; probable para las etiquetas de cada instancia |
| ¿Nombrar la falacia o mostrar el hueco? | No hay estudio que compare jerga contra lenguaje llano ante un público lego. La inoculación (Cook, Lewandowsky y Ecker 2017) funciona explicando la técnica, con etiqueta y explicación juntas. Acusar una falacia carga con probarla (Walton) y abre la "falacia de la falacia". | Incierto en el cara a cara; probable que explicar la técnica sirve |

Contradicción anotada: la guía de Wikipedia sí lista una forma en orden afirmar-negar ("Y rather than X"),
pero es una subordinada pegada a una afirmación, distinta del par de oraciones concesión-y-negación.

## Lo aplicado

- `scripts/scope-denial.mjs` (SSOT): detecta la concesión-y-negación y su molde (verbo que afirma > verbo que
  niega). `style-gate` en modo lote bloquea el mismo molde en dos drafts (`scopeDenialRepeat`) y avisa cuando
  dos drafts usan la jugada con verbos distintos. Un draft solo nunca se bloquea por esto. Test en
  `gates.test.mjs`; suite en 167.
- `.claude/rules/reply-output-style.md` § "Conceder el hecho y negar la conclusión ES la jugada".
- Corrección al pendiente anotado ese día: no era un hueco del gate, era una lectura equivocada de Claude.

## Abierto

- El molde se compara solo dentro del lote. Dos replies con el mismo molde en lotes distintos del mismo día
  (como pasó) no se cruzan; el gate de procedencia podría compararlo contra los drafts de las últimas 24 h
  igual que hace con los cierres.
- Leer la lista completa de patrones del paper Antislop y el estudio de corpus de Silvennoinen sobre negación
  contrastiva en humanos.

## Fuentes

1. https://iep.utm.edu/fallacy/ — definiciones de afirmación del consecuente, non sequitur, falacia naturalista
2. https://plato.stanford.edu/entries/abduction/ — inferencia a la mejor explicación y sus límites
3. https://plato.stanford.edu/entries/scientific-underdetermination/ — subdeterminación contrastiva, cita de Mill
4. https://en.wikipedia.org/wiki/Affirming_the_consequent — forma P→Q, Q ∴ P (secundaria)
5. https://en.wikipedia.org/wiki/Prosecutor%27s_fallacy — condicional transpuesto (secundaria)
6. https://plato.stanford.edu/entries/hume-moral/ — Ley de Hume y su controversia interpretativa
7. https://plato.stanford.edu/entries/moral-non-naturalism/ — Moore, pregunta abierta, lo engañoso del nombre
8. https://plato.stanford.edu/entries/fallacies/ — falacias formales (Copi)
9. https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing — variantes del paralelismo negativo
10. https://en.wikipedia.org/wiki/Negative_parallelism — definición y frecuencia en LLMs
11. https://refine.so/blog/negative-parallelism-ai-pattern — por qué el patrón es muleta
12. https://gc.ai/blog/ai-writing-pattern-to-know-contrastive-negation — sustancia primero
13. https://rhetoric.byu.edu/Figures/E/epanorthosis.htm · https://rhetoric.byu.edu/Figures/A/antithesis.htm · https://rhetoric.byu.edu/Figures/C/concessio.htm — figuras clásicas
14. https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0175799 — inoculación por explicación de la técnica
15. https://misinforeview.hks.harvard.edu/article/prebunking-misinformation-techniques-in-social-media-feeds-results-from-an-instagram-field-study/ — prebunking en redes
16. https://pmc.ncbi.nlm.nih.gov/articles/PMC10057814/ — enseñar falacias por nombre en aula
17. https://en.wikipedia.org/wiki/Argument_from_fallacy — falacia de la falacia
No abiertas (403 o solo snippet): Roozenbeek et al. 2022 en Science Advances, Walton "A Pragmatic Theory of
Fallacy", el texto completo de Antislop (arXiv 2510.15061).
