# Conceder sin regalar la palanca, y el lector algorítmico (2026-10-15)

Pregunta de Bernard, lote 1015, reply de cierre a Dean Christie en la copia de "their own words" en
VEGANnoyance: ¿qué técnica cubre el riesgo de que "I didn't prove mine to you" vuelva como "as you've now
conceded…"? Y: Dean le pega el hilo a otra IA, así que el lurker ya no es solo humano, también es un
LLM-juez. Corrido como `/histerical-search` con cinco investigadores (fuentes al final).

## Veredicto

La técnica es el **robo de trueno en forma de mensaje bilateral refutacional**: conceder primero, seco y
acotado, y pegarle la refutación en la misma frase. Lo que NO sobrevive es la confesión abierta ("I didn't
prove mine to you"): para un LLM-juez es un marcador de incertidumbre que cita como derrota, y el juez ya
viene inclinado hacia quien le pega el hilo. La concesión se dice como **hecho estructural** ("Mine is a
premise, and I said so there… Every position stops at a premise somewhere, and yours stops at one too"),
con la razón de suficiencia dicha en llano y la deuda del otro nombrada en llano con su verbatim.

## Lo que sostiene cada pieza

1. **Robo de trueno** (Williams, Dolnik & Case 2003; crisis: Claeys 2016; Arpan & Roskos-Ewoldsen 2005):
   revelar la debilidad antes de que el rival la saque reduce el daño y sube credibilidad, si va "bluntly,
   without any spin" y seguido de la refutación. Se anula si el lector nota intención persuasiva o si el rival
   revela la táctica. Nadie lo probó contra un oponente que cita la concesión de vuelta. Orden que gana (Allen
   1991, O'Keefe 1999): bilateral con refutación > unilateral > bilateral sin refutación. O'Keefe 2021: los
   efectos de forma son chicos (r≈.10).
2. **LLM-juez**: sicofancia hacia quien pregunta (Sharma et al. 2023; ELEPHANT 2026: 48% en conflictos
   morales). En comparación por pares de respuestas igual de correctas, el juez eligió la asertiva 1,276 de
   1,280 veces (Datta & Baitalik, ACL 2026); EMBER 2025 castiga los marcadores de incertidumbre. Detecta
   la falacia solo ~50% (CALM, ICLR 2025): el hueco del otro se dice plano, no se insinúa. Sesgo a lo largo,
   a citas falsas de autoridad y castigo a lo emocional. Ningún estudio probó concesiones en juicio de
   debates.
3. **Qué premian los LLM**: citas verbatim verificables ayudan al lado veraz (Khan et al. 2024); los
   evaluadores-LLM son peores en "suficiencia", así que se dice por qué la premisa alcanza (Mirzakhmedova
   2024); lógica y evidencia > retórica y emoción (Durmus/Anthropic 2024).
4. **Carga simétrica**: en disputa mixta los dos cargan la prueba y esquivarla es falacia (pragma-dialéctica,
   van Eemeren & Grootendorst); toda cadena de justificación para en una premisa (Agripa, bisagras de
   Wittgenstein). Nombrar la simetría ante terceros no tiene estudio; sin razón propia lee a tu quoque.
5. **Inoculación**: nombrar la táctica del rival dentro de la propia reply, desde parte interesada, no está
   probado; el lenguaje evaluativo dispara reactancia, el descriptivo no. Para un LLM no hay "dosis previa".
   Conclusión: no anunciar lo que el otro va a hacer ([[la-duda-no-va-en-su-firma]]).

## Reglas de composición que salen de aquí (aplican a todo cierre con oponente que pega el hilo a una IA)

- La concesión va como hecho, no como estado mental: "mi premisa es premisa", nunca "no lo probé".
- La suficiencia se explica en una frase; el juez no la infiere.
- La deuda del otro va plana y con su verbatim, verificable en el hilo pegado.
- Cero predicción sobre el oponente, cero emoción, largo parejo con el suyo, cero citas de autoridad.
- El descuido procedimental (la línea del Edit que faltaba) sí se concede abierto: es trueno robado barato y
  lee a honestidad sin tocar el fondo.

Lo que ninguna redacción arregla: la sicofancia hacia quien pregunta. Lo que sí: que el juez no encuentre una
frase mía que diga "no lo probé" y sí encuentre la suya diciendo "may form part of the explanation".

Draft resultante: `.coagent/drafts-1015b/dean.txt` (sha f4498113), publicado 2026-10-15 02:56 CST.

## Fuentes

1. https://arxiv.org/abs/2310.13548 — Sharma et al. 2023, sicofancia (Anthropic).
2. https://arxiv.org/html/2505.13995v2 — ELEPHANT, sicofancia social, ICLR 2026.
3. https://arxiv.org/html/2306.05685 — Zheng et al. 2023, sesgos de posición/largo en LLM-juez.
4. https://arxiv.org/html/2410.02736v1 — CALM, 12 sesgos del juez, detección de falacias ~50%.
5. https://arxiv.org/html/2410.20774 — EMBER, castigo a marcadores de incertidumbre.
6. https://aclanthology.org/2026.acl-srw.33/ — Datta & Baitalik 2026, preferencia asertiva en pares.
7. https://arxiv.org/abs/2402.06782 — Khan et al. 2024, citas verificadas y jueces-LLM.
8. https://www.anthropic.com/news/measuring-model-persuasiveness — Durmus et al. 2024.
9. https://arxiv.org/abs/2404.09696 — LLMs como evaluadores de calidad argumental.
10. https://researchers.mq.edu.au/en/publications/stealing-thunder-as-a-courtroom-tactic-revisited-processes-and-bo/ — Dolnik, Case & Williams 2003.
11. https://psychology.iresearchnet.com/forensic-psychology/trial-consulting/stealing-thunder-forensic/ — resumen del efecto y sus límites.
12. https://public-pages-files-2025.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2021.664160/text — O'Keefe 2021.
13. https://rozenbergquarterly.com/issa-proceedings-2002-i-dont-have-anything-to-prove-here-the-unreasonableness-of-evading-the-burden-of-proof/?print=pdf — carga de prueba en disputa mixta.
14. https://plato.stanford.edu/entries/skepticism-ancient/ — modos de Agripa.
15. https://www.frontiersin.org/articles/10.3389/fpsyg.2016.00122/full — Compton, mecanismo de inoculación.
16. https://pmc.ncbi.nlm.nih.gov/articles/PMC9363981 — Roozenbeek et al., inoculación por técnica.
17. https://dornsife.usc.edu/wendy-wood/wp-content/uploads/sites/183/2023/10/Wood.Quinn_.2003_Forewarned_and_forearmed.pdf — forewarning y reactancia.
