# Monocultivo de frameworks y métrica del lurker — veredicto de investigación (2026-09-28)

Pregunta de Bernard: cómo resolver (2) `algo-a-alguien-sujeto-derecho` en 159/242 interacciones y
19/79 frameworks desplegados, y (3) la métrica del lurker (31/35 replies con 0 reacciones).
Cinco investigadores en paralelo (/histerical-search). Muchas fuentes se leyeron solo por abstract o
snippet (paywall/403); la certeza va marcada por hallazgo.

## Veredictos

**1. "Rotar tras 2 exposiciones" NO tiene sustento; variar la sustancia desde la 3a sí.** (CONFIRMADO
la dirección, INCIERTO el número). La repetición sigue una U invertida: el acuerdo sube y luego cae por
tedio y contraargumentación, con el pico entre ~3 y ~10 exposiciones en laboratorio (Cacioppo & Petty
1979; meta-análisis Schmidt & Eisend 2015). Para audiencias motivadas —un oponente de debate— lo que
retrasa el desgaste es la variación SUSTANTIVA (argumento nuevo), no la cosmética (Schumann, Petty &
Clemons 1990). El efecto de verdad ilusoria no aplica a afirmaciones leídas como opinión moral (2023,
d = −0.23). Ningún estudio mide debate adversarial en línea.

**2. El 4/159 no prueba nada del framework.** (CONFIRMADO el principio, cálculos propios). Se eligió
para interlocutores receptivos: es sesgo de selección. Beta(5,156) ≈ 3.1% [1%–6.5%] se traslapa con el
resto (0/83). Sin aleatorización registrada no hay evaluación off-policy posible (requisito de
positividad; Dudík, Langford & Li; Li et al. LinUCB, replay solo con tráfico aleatorio). Thompson
sampling tolera recompensa retrasada mejor que UCB (Chapelle & Li 2011, vía resumen).

**3. Moral reframing: no justifica cambiar el eje; sí variar la entrada.** (PROBABLE). Feinberg &
Willer 2015 y un experimento de campo (J. Politics 2022, canvassing con escucha) salen positivos; las
réplicas grandes y preregistradas recientes salen nulas en el caso conservadores/ambiente (Voit et al.
2026, N=743; Kim et al. 2023). Ningún estudio compara marco de derechos vs bienestar. Spang 2024 (J.
Agric. Environ. Ethics, filosofía) argumenta que adaptar el mensaje a salud o ambiente perpetúa el
estatus de propiedad: respalda la doctrina abolicionista, pero es argumento, no dato.

**4. Métrica del lurker: las reacciones no validan nada.** (PROBABLE). El único marcador validado de
persuasión es el reconocimiento explícito del persuadido (delta de r/ChangeMyView, Tan et al. 2016), que
equivale a nuestro `conceded`. Los votos sufren herding: un voto positivo inicial aleatorio subió 32% la
probabilidad de votos siguientes (Muchnik, Aral & Taylor 2013). Meta rankea comentarios por likes,
vistas y repliers únicos, así que cero reacciones puede ser cero exposición. Las deltas de reacciones del
hilo o de la raíz no permiten atribución. La postura de respuestas de terceros, codificada por LLM, es la
mejor opción disponible, pero NO está validada.

**5. Alerta no pedida: el registro filo profano.** (INCIERTO, sin evidencia directa). En temas de
identidad, la incivilidad polariza al observador según su postura previa (Anderson et al. 2014, "nasty
effect"); en corrección de hechos de salud el tono no cambió el efecto (Bode, Vraga & Tully 2020). Una
grosería leve sube intensidad y persuasión sobre todo con audiencia simpatizante (Scherer & Sagarin
2006). Lo que más respaldo tiene para el observador es la fuente/recibo, no el tono (Vraga & Bode).
Nadie ha probado insultos profanos dirigidos a un oponente ante observadores neutrales.

## Propuestas derivadas (decisión de Bernard)

- Framework: el eje fijo (propiedad) sigue; desde la 3a vuelta con el mismo target, entrada nueva
  obligatoria (otro framework del arsenal o respuesta a su movimiento más reciente), y registrar
  `framework_secondary`. Agrupar los 79 en ~8-10 familias. Para aprender de verdad: en ~20-30% de los
  replies de buena fe, sortear entre los 2-3 candidatos elegibles y registrar que fue sorteo; comparar
  familias solo con ~15-20 casos sorteados cada una, y hablar de intervalos, no de "win rate".
- Lurker: dejar de citar reacciones como norte (contador secundario). Primario: `conceded` + postura de
  respuestas de terceros codificada por LLM (verbatim guardado), explícitamente como proxy no validado.
  Registrar tipo de interlocutor, número de exposición al mismo target y si el framework fue sorteado.

## Fuentes principales

Cacioppo & Petty 1979 (scispace.com/papers/effects-of-message-repetition-and-position-on-cognitive-1964089099) ·
Schumann, Petty & Clemons 1990 (fbaum.unc.edu/teaching/articles/Schuman_1990.pdf) ·
Schmidt & Eisend 2015 (tandfonline.com/doi/abs/10.1080/00913367.2015.1018460) ·
Hassan & Barber 2021 (cognitiveresearchjournal.springeropen.com/articles/10.1186/s41235-021-00301-5) ·
verdad ilusoria en opiniones 2023 (pmc.ncbi.nlm.nih.gov/articles/PMC10257371) ·
Rains 2013 reactancia (onlinelibrary.wiley.com/doi/abs/10.1111/j.1468-2958.2012.01443.x) ·
Russo et al. Thompson (arxiv.org/abs/1707.02038) · Chapelle & Li 2011 (microsoft.com/en-us/research/wp-content/uploads/2016/02/thompson.pdf) ·
Li et al. LinUCB (arxiv.org/abs/1003.0146) · Dudík et al. doubly robust (arxiv.org/abs/1103.4601) ·
Tan et al. 2016 (arxiv.org/abs/1602.01103) · Muchnik et al. 2013 (science.org/doi/10.1126/science.1240466) ·
Meta ranking de comentarios (transparency.meta.com/features/explaining-ranking/fb-feed-ranked-comments) ·
Lukin et al. 2017 (ar5iv.labs.arxiv.org/html/1708.09085) · Nielsen 90-9-1 (nngroup.com/articles/participation-inequality) ·
Nonnecke & Preece 2000 (dl.acm.org/doi/10.1145/332040.332409) · Anderson et al. 2014 (academic.oup.com/jcmc/article/19/3/373/4067522) ·
Vraga & Bode 2020 (pmc.ncbi.nlm.nih.gov/articles/PMC7532323) · Bode, Vraga & Tully 2020 (misinforeview.hks.harvard.edu/article/do-the-right-thing-tone-may-not-affect-correction-of-misinformation-on-social-media) ·
Scherer & Sagarin 2006 (tandfonline.com/doi/full/10.1080/15534510600747597) ·
Feinberg & Willer 2015 (journals.sagepub.com/doi/abs/10.1177/0146167215607842) · Voit et al. 2026 (sciencedirect.com/science/article/pii/S0022103126000016) ·
J. Politics 2022 reframing en conversación (journals.uchicago.edu/doi/abs/10.1086/716944) ·
Spang 2024 (link.springer.com/article/10.1007/s10806-024-09941-1) · mensajes en menús 2023 (pmc.ncbi.nlm.nih.gov/articles/PMC10166581)
