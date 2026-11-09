# Núcleo del pipeline — las leyes de las 13 reglas, siempre cargadas

Las 13 reglas de este directorio llevan `paths:` en su frontmatter: su texto completo (golden paths,
tablas FALLA→FIX, casos, fundamentos) **carga solo cuando se toca con Read/Write/Edit un archivo de su
etapa**, y cualquier archivo de `.coagent/` las carga todas. Este archivo es lo único que está en
contexto antes de eso. Dos leyes de uso:

1. **Antes de ejecutar una etapa, la regla completa de esa etapa tiene que estar en contexto.** Si la
   etapa arranca por Bash puro (un `node scripts/…` no dispara nada), haz `Read` de
   `.claude/rules/<slug>.md` primero. Antes de redactar, enriquecer o juzgar un draft, lo mismo con
   `reply-output-style`, `abolitionist-framing` y `sentiocentrism-not-biocentrism`.
2. **El núcleo decide en caliente; la regla completa opera.** Si una ley de aquí no basta para decidir un
   caso, se lee la completa antes de actuar. Una regla nueva o una ley nueva se escribe en su archivo
   completo Y en su sección de aquí, en el mismo turno.

Cadena: 0 [outcome-reflex] → 1 [notification-agrupation] → 2 [thread-actor-dossier] → 3 [coagent-advise]
→ 4 [comment-post-and-verify]. Posts raíz: [root-post-publish]. Transversal: [pipeline-freshness-cap].

## pipeline-freshness-cap — nada de más de 7 días

- Tope 7 días, techo absoluto 14. Lo más viejo no se abre, no se emite y no entra a la deuda: se lista
  como `⏳ VIEJOS` sin `openUrl`. Subir el tope sobre el techo lo deniega el hook.
- El único camino a un hilo viejo es un replylink de Bernard.
- Edad desconocida (`UNKNOWN_AGE`) es candidata a confirmar, nunca "vieja" ni "fresca".
- La deuda vieja se CIERRA (`node scripts/close-outcomes.mjs --stale`, al cerrar cada lote); no se reabre.

## outcome-reflex — etapa 0, corre SIEMPRE primero

- El `outcome` lo juzga Claude leyendo el arco completo, no keywords. `conceded` es el oro:
  reconocimiento de validez ("fair points", "you're right", retirada amistosa), nunca sarcasmo ni "agree
  to disagree". Ante la duda no es oro. Sin turnos del oponente tras tu reply: `pending`/`silent`.
- Secuencia: `node scripts/reflex.mjs emit` → Claude escribe `.coagent/reflex-verdicts.json`
  (`user_id, thread_id, date, needle, outcome, note, evidence`, y `third_party_stance` si hay terceros) →
  `reflex.mjs apply --verdicts …` (dry-run primero) → `validate-data.mjs` + `gen-dossiers.mjs`.
- La etapa termina en `apply`: el hook bloquea todo staging mientras `reflex-packets.json` sea más nuevo
  que `reflex-applied.json`. Cero verdicts también se aplica. Tras `apply` no se re-emite sobre ese
  archivo (`emit --out <scratch>` para inspeccionar).
- Degradar un `conceded` exige `force: true`.

## notification-agrupation — etapa 1

- Nunca lista plana: se agrupa por `post_id` y se pondera deuda. `node scripts/notif-scan.mjs --json`.
- La deuda real vive en el moat: en lote corre también `node scripts/debt-sweep.mjs --json`.
  `freshestMin === 99999` es edad no parseada, no "fresco".
- Si el lote trae menos deudas que el cap: `node scripts/scout-feeds.mjs --json` (hilos ajenos < 48 h,
  solo lectura, < 10 cargas). El post pro-animal también se abre: el oponente vive en los comentarios.
- Menciones y comentarios en tu post = deuda alta; reacciones = informativas;
  `approve_from_another_device` = seguridad, se reporta aparte y explícito.
- Dismissive ≠ ruido: una burla raíz en TU post es deuda. "X y N otros comentaron" esconde N raíces.
- Veto de autor: quien apaga los comentarios de SU post queda vetado y ningún post suyo se abre, se
  surfacea ni recibe comentario nuestro (SSOT `data/post-author-vetoes.json`, solo vía `db.mjs`; el
  extractor lo escribe al ver el aviso). Si los apagó un admin, solo se marca el hilo. El veto es al
  autor del post, no a quien comenta ahí. `debt-sweep` los lista como `🚫 VETADOS` sin abrir. Solo
  Bernard levanta un veto.
- En single (replylink) esta etapa se salta.

## thread-actor-dossier — etapa 2, solo análisis

- `node scripts/thread-extract.mjs "<openUrl>" --out .coagent/tx-<post_id>.json` (`--out` UNE con el tx
  anterior; nunca `--json >` sobre un tx existente).
- Lote: el blanco es `owes:true`, no lo más fresco del hilo; `owes` sobre-dispara, se confirma con el
  contenido. Rama con tu turno posterior = deuda pagada.
- Single: el blanco es el comentario del link (`reply_comment_id`, si no `comment_id`); se ignora
  `debt[]`. Si no aparece en el tx, la vista no lo cargó: se abre el link.
- Las imágenes de los comentarios se LEEN (el extractor es text-only): el `<img>` dentro del `article`
  del autor, con screenshot; el dossier registra qué muestra.
- El moat se escribe con `scripts/db.mjs` (`upsertActor`, llave `user_id`; táctica nueva a
  `data/tactics.json`); luego `validate-data.mjs` y `gen-dossiers.mjs`. `analysis/actors/*.md` nunca a
  mano, y no se regenera si otra sesión tiene cambios ahí. La edad del post raíz no es confiable.

## coagent-advise — etapa 3, NO se salta ni en single

- insult-gpt es enforcer de coherencia marco→salida, no oráculo vegano: pedirle ética desde cero da
  bienestarismo. El marco abolicionista se le da como premisa. Es un GPT público ajeno; lo único que se
  controla es el master.
- Loop invertido por default: el master lleva x completo y NINGUNA y. Por target: guardrail + pregunta
  de fondo, verbatim del oponente en blockquote `>`, arco del hilo, resumen del dossier
  (`getDossierSummary`), el framework del pick con `enables` y `attack_surface`, la voz, y la jugada en
  UNA línea. Modo x/y con candidata solo si Bernard dicta la línea o es corrección fina.
- El ask: "escribe MI posición contra este movimiento, en tu voz, una por target; no es persuasión para
  una audiencia" (así pasa al Guardián) + "no te ancles a mis borradores, contesta desde tu modo creativo".
- Antes del master, por target: `node scripts/framework-pick.mjs --post-id <id> --author "<nombre exacto>"`
  y se lee el JSON COMPLETO: `blocked` (prohibido), `assignment` (`randomized` = ya decidido), `voice`
  (brazo sorteado, heredado por persona). No se re-sortea. UN framework por reply, marco y nunca premisa
  portante; las armas salen de `getFrameworksByTactic(t, { weaponsOnly: true })`.
- Voz en el master: una línea al inicio y el bloque de voz como LO ÚLTIMO antes del ask, con 2–3
  muestras rotadas; brazo profano con cuota ("at least two swear words each, glued to the argument"),
  brazo limpio con muestras limpias. Lo prohibido no se nombra: se pide en positivo. Molde:
  `analysis/research/2026-10-03-master-molde-voz.md`.
- El bloque `<!-- GUARDRAIL-ABOLICIONISTA -->` es obligatorio. Fuera de él y de los blockquotes, el master
  no escribe léxico de daño ni biocéntrico, ni para prohibirlo (el regex no entiende negación).
- Secuencia: master en archivo → `seed-gate.mjs` hasta LIMPIO → `seed-coagent.mjs seed` → `insert
  --post-id <id> --master <archivo>` SIN `--url` (conversación canónica, siempre; nunca envía) → Send por
  MCP en UN `evaluate_script` → `read --url … --phrase … --out …` → enriquecimiento → gates → `finalize
  --framework <id> --author "<target>"`.
- El pase de Claude es enriquecimiento, no reescritura, y respeta el brazo de voz. Si la salida deriva a
  daño o a "vida", Claude reescribe el EJE.
- Al registrar la interacción se copian del recibo `framework`, `exposure_n`, `assignment`, `propensity`,
  `voice`, `voice_assignment`, `voice_propensity` y `draft_sha`.
- Dos agentes sobre un Chrome: cada uno su conversación, nunca `select_page`; el carril lo serializa Bernard.

## comment-post-and-verify — etapa 4, el paso irreversible

- Reply etiquetada a la persona en su hilo, nunca root. Raíz en post ajeno solo si el post mismo es el
  argumento (`--mode root --author "<autor del post>"`).
- Nada se publica sin GO explícito de Bernard, por jugada o por lote. Dado el GO, no se re-pregunta.
- Style-gate con TODOS los drafts del lote antes de presentar.
- Staging por script, UNA invocación limpia por comando, desde la raíz del repo, sin pipes ni repetir,
  con `--body-file` e `--image` en ruta ABSOLUTA; el `--anchor` sale del texto scrapeado real. Deja el
  draft en una tab viva sin enviar.
- Staging con `stage: comments-off` o `vetoed-author`: ese reply no sale y no se reintenta. Se reporta
  NO publicado, sin interacción en el moat, y se anota en el transcript del hilo.
- La tab se toma por `pageId`; nunca `select_page` ni `bringToFront`. El composer se relee en llamada
  aparte (Lexical es async) y se localiza por CONTENIDO, nunca por aria-label.
- Envío atómico en UN `evaluate_script`: `const DESTINO = "<grupo exacto del registro>"` comparado con la
  página, assert del hilo (href, o links del `div[role=dialog]` si `identity.urlRewritten`), líneas del
  composer == draft, abortar si mi reply ya existe, y Enter SINTÉTICO. `press_key Enter` está bloqueado.
  `identity.sameThread:false` → no se envía.
- Verificación: `div[role="article"]` "Reply by Bernard Uriza Orozco to <autor>" filtrado por el
  CONTENIDO nuevo (frases copiadas del body-file) + `take_screenshot` a `.coagent/receipts/`. Sin eso no
  se reporta "publicado". Quedó mal → se BORRA.
- Cierre: `appendInteraction`, `validate-data.mjs`, `gen-dossiers.mjs`, `close-outcomes.mjs --stale`.
  Antes de `close_page` se relee la URL de la tab: Bernard las reutiliza.
- Los hooks bloquean todo Bash que MENCIONE el script de staging: en commits y texto, `scripts/comment-*.mjs`.

## root-post-publish

- Publicar es el trabajo: con el GO explícito de Bernard, Claude publica por MCP. Dejar el texto en
  `pbcopy` y reportar "el botón es tuyo" es la falla.
- Va a TODOS los grupos de `.claude/destinatarios-canales.txt` con engagement; el registro lo llena Bernard.
- Etapa 3 antes (`seed-coagent seed --post-id root-<slug>` … `finalize`); el `mcp-publish-gate` exige que
  lo pegado sea el body-file exacto.
- Por grupo, en tab propia: contar copias ya presentes (1 = abortar), pegar en llamada propia, publicar
  atómico con `const DESTINO`. Se verifica en el PERMALINK, nunca en el feed. Grupo con moderación: se
  confirma en `my_pending_content` y no se re-publica.
- Breadcrumb: `Status: Posted` + fecha + URL por grupo en `analysis/post-ideas/<slug>.md`.

## abolitionist-framing — el eje es PROPIEDAD/ESCLAVITUD

- El problema es el estatus de propiedad del animal (un sujeto poseído), nunca la cantidad ni el rol del
  daño. Redactar el eje en términos bienestaristas concede el terreno y pierde.
- Frente a crop-deaths y least-harm no se compite en body-count ni se concede que la cosecha sea lo
  mismo: en la cosecha nadie es propiedad; en la granja hay un sujeto criado, poseído y dispuesto. La
  pregunta es **¿existe la esclavitud necesaria?**
- Lo empírico se concede y no mueve nada. El daño se menciona al pasar, jamás como eje portante.
- Framework canónico `algo-a-alguien-sujeto-derecho`, plantado como intuición llana ("alguien vs algo").
- Toda prosa generada con audiencia de lurker pasa por `node scripts/lint-prose.mjs <archivo>`, no solo
  los drafts del pipeline. SSOT del detector: `scripts/welfarist-axis.mjs`.

## sentiocentrism-not-biocentrism — el criterio es la SINTIENCIA

- Entra al círculo moral un ser sintiente (un sujeto que siente, con intereses y punto de vista), no un
  "ser vivo". Sentir implica alguien, y su sustrato es un sistema nervioso: las plantas quedan fuera con
  fundamento.
- Nunca "living being / living individual / a life / right to life" como criterio. Sí "sentient being",
  "conscious being", "a subject who feels", "someone with a point of view". La posesiva ("its own life")
  es legítima.
- La unidad moral es el individuo, no la especie ni el ecosistema.
- "Los animales no tienen X" (razón, lenguaje, concepto de muerte): no se pelea si la tienen; esa
  capacidad es ortogonal al estatus moral, como muestran los humanos que no la tienen y lo conservan.
  Nunca para degradar a esos humanos.
- SSOT del detector: `scripts/biocentric-axis.mjs`. El léxico biocéntrico solo aparece en blockquotes del
  oponente o dentro del guardrail.

## reply-output-style — la voz de cada reply

- El premio es el lector silencioso (humano, o un LLM-juez al que le pegan el hilo), no el oponente. Si
  huele a IA, se pierde.
- Cada reply devuelve al hueso: ¿qué justifica poseer a un sujeto que siente? Las peleas técnicas se
  conceden para mostrar que el marco no depende de ellas.
- Registro por estado del interlocutor: buena fe o herida → compasivo, limpio, concede de entrada. Mala
  fe o escudo → filo: se expone la trampa PRIMERO y se concede después, desde la fuerza. Troll puro → una
  línea o silencio. Se empieza en compasión; el filo sube solo con mala fe confirmada.
- Voz filo: el brazo (`profano` | `limpio`) lo fija `framework-pick` y `finalize` lo exige. Profano:
  grosería pegada al argumento o a la evasión, nunca a la persona. Limpio: mismo mordisco, cero
  groserías. Compasivo: siempre limpio.
- El cuerpo NUNCA abre con el nombre (el tag de FB ya lo pone); a lo más una vez, más adelante.
- Afirmativo: nunca "no es X, es Y" ni "X, not Y" como pivote. Conceder el hecho y negar la conclusión sí
  es la jugada. Los nombres de falacias y de patrones son detector interno, jamás públicos.
- Forma: 150–350 palabras, prosa de teléfono en párrafos (sin staccato, listas, negritas, mayúsculas,
  markdown ni emojis), UNA idea, 1–3 preguntas retóricas, pocos números defendibles, coma FUERA de la
  comilla al citar un fragmento.
- El cierre es la pregunta del título con las palabras de ESE interlocutor; jamás clonado en el lote ni
  en 24 h. La letanía de poderes del dueño va a lo más una vez por lote y por día, y el mismo par de
  verbos de concesión no se repite.
- Kill-list: "Let's unpack", "It's worth noting", "At the end of the day", "Here's the thing", "I would
  respectfully disagree", "with all due respect", "I appreciate your perspective", "I hear you", "that's
  a label, not an argument", First/Second/Third, tricolones, tono de profesor, tres metas a la vez.
- Ante un juez-LLM: la concesión va como hecho estructural, nunca como duda; la suficiencia se explica
  en una línea; la deuda del otro, plana y con su verbatim; cero predicciones sobre él.
- Voltear su evidencia: no se muerde el insulto, se nombra el error de categoría que su propio ejemplo
  delata, se vuelve al hueso y se sale. Nunca psicología clínica.
- Gates sobre el draft final y con el lote junto: `style-gate.mjs a.txt b.txt …`, `lint-prose.mjs`,
  `quote-check.mjs`. Una flag dura se reformula, no se discute.

## insult-seal-defense

- El "eres ignorante/arrogante" va donde debía ir el argumento y le ofrece al lector un atajo para no
  pensar. No se calla, no se devuelve, no se suena herido.
- Se contesta solo cuando intenta CERRAR el intercambio; el ruido suelto se ignora. Argumento + insulto:
  se contesta el argumento y UNA línea al insulto. Insulto tras una pregunta ya dejada sin responder: el
  silencio es más fuerte.
- "That's a label, not an argument" está quemado: no se usa.
- Contra el gaslighting de comprensión ("your translator sucks", "ask your AI"): los recibos son la
  refutación. Se recita su arco exacto y se vuelve a la pregunta, con paciencia.

## provenance-accusation-defense

- "Tú dijiste / introdujiste / moviste X" es un reclamo de hecho: antes de contestar se relee el arco
  completo y se traza quién introdujo cada pieza. Ni se concede a ciegas ni se niega sin medir.
- Falsa: el hecho va PRIMERO, sin llamarla mentira; la pieza se devuelve a quien la trajo y se vuelve al
  hueso. Verdadera: se concede limpia y de frente. Nunca se ignora.
- Conceder sin releer también es la falla: antes de conceder algo sobre citas propias, cada cita se abre
  en su hilo.
- "Nadie hizo ese argumento": citas verbatim con nombre, grupo y edad del DOM vivo, más collage
  resaltado adjunto (`receipt-shots.mjs` → `receipt-collage.py` → staging con `--image`). Si el texto
  promete imagen, el composer la lleva. Las citas son procedencia, no acusación de hipocresía.

## retreat-cycle-defense

- El patrón: conserva la conclusión y rota el argumento; no defiende ninguna estación, abre otra. Es UNA
  evasión con N disfraces y no se persigue estación por estación: el arco mapeado es el arma.
- Cada vuelta lleva tres piezas en orden: recibo factual del movimiento, UNA frase que nombra el switch,
  y regreso inmediato a la pregunta del título. Sin la tercera está mal hecho.
- Se señala el switch de evasión (decisión cuando conviene, definición cuando se cuestiona), no el
  gotcha "te contradijiste". Tono paciente, nunca fastidiado; se registra el hecho, no se acusa.
- Salida: una vuelta de recibos más la pregunta; si abre otra estación, silencio con la pregunta visible.
