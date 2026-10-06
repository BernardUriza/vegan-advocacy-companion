# Auditoría hostil de la estrategia por Gemini Pro (2026-10-05)

Chat: https://gemini.google.com/app/0d2f9501c8b5fae6 (cuenta de Bernard). Dos rondas, protocolo anti-ruido del skill `/gemini`.
Primer envío dio negativa enlatada; el seguimiento dijo "no veo consulta anterior" y se reenvió el mismo prompt en el mismo chat.

## Veredicto de Claude por punto (verificado contra el moat, no tragado)

| Punto de Gemini | Veredicto | Por qué |
|---|---|---|
| La métrica mide al oponente, no al lurker | **Aguanta** | conceded/engaged son del oponente; likes 8/47 y terceros casi sin datos. Ya lo decía `2026-09-28-monocultivo-frameworks-y-metrica-lurker.md`; sigue sin resolverse. |
| Profanidad le cuesta al lurker (Anderson 2014, Mutz 2015) | **Retirado por Gemini en ronda 2** | Anderson mide polarización por creencias previas; Mutz es TV. Gemini concedió que no hay estudio que aísle grosería-al-argumento vs ad hominem. La regla del filo profano tampoco tiene evidencia a favor: es pregunta abierta, experimentable. |
| Cortar por profundidad de anidación (nivel 4+ ≈ audiencia de uno) y denylist de recurrentes | **Plausible, sin medir** | FB colapsa ramas largas. Se puede medir con `turns[]` (profundidad) × `reactions` antes de adoptarlo. |
| Comentarios raíz en posts virales de páginas mainstream | **Idea, no evidencia** | "Órdenes de magnitud" no está medido. Cambia el destino: requiere que Bernard lo apruebe en `destinatarios-canales.txt`. |
| Shadowban explica los likes en cero | **Retirado por Gemini** | Hay likes y terceros; cadencia humana con GO por lote. Prueba barata propuesta: string único en un hilo público, verlo sin sesión. |
| "No hay lurkers indecisos en estos grupos" | **Retirado por Gemini** | Sin dato. |
| Sobreajuste a 68 actores patológicos | **Aguanta** | Coincide con el moat: el oro (conceded) vino de buena fe; el volumen va a 4-5 recurrentes de mala fe. |

## Experimento propuesto (ronda 2), corregido por Claude

Sorteo 50/50 profano vs limpio en targets de mala fe, outcome = reacciones + replies de TERCEROS (excluye al autor), ~70 por brazo.
Correcciones: el brazo limpio debe ser filo limpio (sin groserías), no "condescendiente/pasivo-agresivo" como propuso Gemini;
"retweets" no aplica; el volumen real es menor que 10/día, así que n=140 tarda más de 2 semanas; y los likes arrastran rebaño y orden de FB
(ver research del 28-sep), así que el outcome primario debería ser postura de terceros (`third_party_stance`), likes secundario.
Con n≈70/brazo solo se detectan efectos grandes (Gemini lo dijo: 17%→35%).

## Respuestas crudas

### Ronda 1
1. ¿La métrica está mal?
Sí. Estás cometiendo un error de categoría elemental: tu objetivo declarado es el observador silencioso (lurker), pero tu telemetría (conceded, engaged, escalated, goalpost) mide exclusivamente el comportamiento del oponente. Si los likes son cero y no hay intervención de terceros, tu sistema no tiene validación de su objetivo real; está ciego.
Qué medir: En Facebook, el lurker no interactúa en hilos profundos. Para medir impacto indirecto debes inyectar proxies de conversión: 1) CTR de un link señuelo (ej. un recurso abolicionista) en el perfil de Bernard, midiendo picos correlacionados con la actividad. 2) Ratio de reacciones (Me entristece/Me asombra vs. Me divierte) en tus comentarios de nivel superior, no en la profundidad del hilo.

2. ¿El registro profano con los de mala fe le cuesta al lurker más de lo que gana?
Sí. El registro hostil destruye tu persuasión de terceros.
Evidencia: El "Nasty Effect" (Anderson et al., 2014) demuestra que la incivilidad y el tono profano en comentarios en línea polarizan a los lectores silenciosos, provocando que rechacen el argumento central independientemente de su solidez lógica o evidencia. Asimismo, Mutz (2015) evidenció que la argumentación agresiva reduce drásticamente la confianza y receptividad del espectador neutral. El lurker no asimila tu framework sensocentrista; percibe hostilidad tribal, activa mecanismos de defensa de identidad y descarta el mensaje.

3. ¿Dónde estoy quemando esfuerzo y qué cortaría?
Sí, tu asignación de recursos es algorítmicamente inútil. Quemas cómputo y riesgo de cuenta en 4-5 recurrentes de mala fe dentro de hilos muertos.
Qué cortar: Corta por profundidad de anidación. La UI de Facebook colapsa automáticamente los debates largos ("Ver más comentarios"). Un lurker estadísticamente no lee más allá de 2 o 3 niveles de profundidad. Cualquier respuesta en un nivel 4 de anidación contra un troll tiene una audiencia literal de una persona. Implementa una denylist estricta para esos 5 recurrentes y aborta cualquier hilo después de la segunda réplica sin tracción de terceros.

4. ¿Qué jugada de alcance tiene mejor relación esfuerzo/lurker?
Sí, existe una jugada inmensamente superior. Tu superficie de ataque actual es deficiente: los grupos de "Vegans vs Meat Eaters" son cámaras de eco hiperpolarizadas donde no existen lurkers indecisos, solo activistas atrincherados.
La jugada: Apunta a comentarios raíz (top-level) en posts virales de páginas de noticias mainstream, documentales ambientales o nutrición tradicional, no en grupos de debate. Un solo comentario lógico de primer nivel, en los primeros 30 minutos de vida de un post público con alto tráfico, captura órdenes de magnitud más impresiones y exposición a civiles no radicalizados que 299 interacciones en el barro de un grupo nicho.

5. El riesgo más grande que no estoy viendo
Sí. Tienes un doble punto ciego fatal.
Primero (Operativo): Shadowbanning algorítmico. Tu pipeline (scraping por CDP, alta velocidad de inyección, reincidencia sobre los mismos usuarios y uso de léxico confrontacional vía "insult-gpt") es la huella digital exacta de una operación inauténtica coordinada. Que tus likes estén en cero probablemente indica que los clasificadores de quality score de Facebook ya están ocultando tus comentarios por defecto.
Segundo (Estratégico): Sesgo de selección por sobreajuste (overfitting). Estás calibrando las tácticas de tu IA basándote en la reacción de 68 actores patológicos en un nicho de debate. Estás entrenando al sistema para sobrevivir en un pozo tóxico, optimizando tu retórica alejándola exactamente de lo que resonaría con el lurker civil al que afirmas querer llegar.

### Ronda 2 (rebate de Claude y respuesta)
> Ronda 2. Tres de tus puntos no aguantan contra mis datos; defiéndelos o retíralos.
> A) Shadowban: 8 de 47 replies medidas sí tienen likes y hay terceros que me contestan. Además no hay alta velocidad: cada lote lo aprueba Bernard a mano y se publica a cadencia humana (unas 5-15 replies al día). ¿Qué prueba barata distingue shadowban de simple poca exposición? Dame una, no una teoría.
> B) Anderson et al. 2014 midió que la incivilidad polariza percepciones según las creencias previas del lector (nanotecnología); no que el lector "rechace el argumento central". Mutz 2015 es sobre TV y planos cerrados. ¿Qué estudio mide directamente groserías dirigidas al ARGUMENTO (no a la persona) en comentarios y su efecto en el espectador? Si no existe, dilo.
> C) "En estos grupos no hay lurkers indecisos": afirmación sin dato. ¿De dónde sale?
> Luego: diseña UN experimento de 2 semanas que yo pueda correr con este pipeline (sorteo ya existe) para decidir registro profano vs. limpio con mala fe, con qué outcome medible y qué n necesito. Máximo 400 palabras.

A) Retirado. Con una cadencia manual de 5-15 al día y 17% de interacciones reales, es falta de alcance, no shadowban.
Prueba barata: Responde a un hilo público de alto tráfico usando un string de texto completamente único y sin sentido (ej. krxz-99-alfa). Abre un navegador en modo incógnito (o usa una VPN), sin iniciar sesión, y busca ese string en la plataforma o entra directamente por URL a los comentarios del post. Si lo ves, tu cuenta está indexada y visible.

B) Concedido. Tienes toda la razón en tu lectura de Anderson (efecto de polarización de creencias previas) y Mutz (formatos televisivos). Te doy la respuesta directa: no existe un estudio empírico riguroso que aísle perfectamente la "grosería dirigida al argumento" (ej. "esa premisa es una estupidez") de la "grosería ad hominem", para medir su efecto neto de persuasión en espectadores asíncronos. La literatura agrupa ambas bajo el paraguas de "flaming" o incivilidad general. Retiro la objeción.

C) Retirado. Fue una sobregeneralización sin sustento estadístico. Por la regla 90-9-1 de las comunidades online, la inmensa mayoría de la audiencia en cualquier nicho siempre es silenciosa.

Experimento A/B: Profanidad vs. Mala Fe (14 Días)

Dado tu volumen (promedio 10 posts/día), tendrás ~140 tiros.

Variable Independiente: Al entrar el prompt al pipeline, el sorteador asigna 50/50:

Brazo A (Profano al argumento): Lógica sólida pero lenguaje agresivo/vulgar contra la idea.

Brazo B (Limpio pero Mala Fe): Lógica sólida, sin malas palabras, pero condescendiente, irónico o socrático-pasivo-agresivo.

Outcome Medible: Tasa de conversión de espectadores. Mide únicamente la suma de likes + retweets/replies de terceros. Se excluye explícitamente cualquier respuesta o reacción del autor original (tu objetivo es la audiencia, no él).

Tamaño de muestra (n): 140 posts (70 por brazo).

Poder estadístico: Con n=70 por grupo y tu base actual de ~17% de engagement, este tamaño solo detectará efectos grandes (ej. si el Brazo B salta a un 35% de engagement). Si la diferencia real entre ambos estilos es sutil (ej. 17% vs 22%), 14 días no alcanzarán la significancia estadística (p<0.05) y requerirás un mes de recolección.

Regla de decisión: Si el Brazo B supera al A por más del 15% en interacciones de terceros, la profanidad es un lastre de atención. Si hay empate estadístico, el registro no importa y puedes priorizar el que cueste menos tokens.

## Pre-registro del experimento de voz (escrito antes del primer dato, 2026-10-05)

Decisión de Bernard: sorteo **50/50** en todo target de registro `filo`, desde el 2026-10-06. Mecánica en
`data/vocab.json` → `rotation.voice_trial`; el pick asigna el brazo, `finalize` lo exige (profano ≥ 2 groserías,
limpio = 0), la interacción lo registra, `framework-stats` "Por VOZ" lo lee.

- **Brazos:** `profano` (molde actual) vs `limpio` (filo sin groserías; mismo mordisco). El compasivo no entra.
- **Outcome primario:** `third_party_stance` de los terceros que contestan a la reply, `apoyo / (apoyo + hostil)`,
  con intervalo Jeffreys 95%. Es un proxy no validado (research 28-sep); con 3 de 80 interacciones con terceros
  hoy, se espera escaso. **Secundarios:** `escalated / juzgadas`, `conceded`, `lurker_reactions`.
- **n y corte:** lectura interina a 30 por brazo; corte a 70 por brazo o el 2026-11-05, lo primero. Con 70 por brazo
  solo se detecta un efecto grande.
- **Regla de decisión:** si al corte los intervalos de `apoyo` se traslapan, el registro no mueve a terceros y el
  default se decide por otro criterio (costo, gusto de Bernard), no por "funciona mejor". Si se separan, gana el
  brazo con más apoyo y menos `escalated`; si se contradicen entre sí, se reporta la contradicción, no un ganador.
- **Lo que invalida la lectura:** `lurker-sweep` sin correr al cerrar cada lote (sin terceros no hay outcome);
  drafts enriquecidos fuera del brazo (`finalize` lo bloquea); targets `filo` reclasificados a mitad del trial.
