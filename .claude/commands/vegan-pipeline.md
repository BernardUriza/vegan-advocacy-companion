# /vegan-pipeline - Corre el pipeline de debate vegano de punta a punta

ARGUMENTS: opcional — una URL de post/hilo de Facebook o un `post_id` para ir directo a ese hilo. Sin argumento: arranca desde las notificaciones y elige el hilo de mayor palanca.

## Contexto

Atajo para correr el pipeline de 4 etapas de `vegan-advocacy-companion`. NO
redefine la mecánica: cada etapa vive en su regla con su GOLDEN PATH (selectores,
gotchas, verificación). Este comando solo las encadena. La guerra es educar al
lector silencioso casual — el output debe sonar humano, no a IA.

**Automatización primero (ver SSOT de scripts en `CLAUDE.md`).** Las partes
mecánicas de las etapas 1 y 2 ya están scripteadas (`scripts/notif-scan.mjs`,
`scripts/thread-extract.mjs` sobre `fb-lib.mjs`): **arrancar por el script**, no
por el MCP a mano. El MCP queda como confirmación/fallback. Etapas 3 (coagent) y
4 (postear) son MCP a propósito — sin script.

Antes de tocar Chrome, diagnóstico del `~/CLAUDE.md` (el puerto suele ser **9333**,
no 9222). Reusar la tab de FB / del coagent abierta; nunca abrir a ciegas.

## Instrucciones

### Etapa 1 — Agrupar notificaciones · regla [notification-agrupation]
- Si hay argumento (URL/`post_id`): saltar la agrupación e ir directo a ese hilo.
- Si no: **correr `cd scripts && node notif-scan.mjs`** (triage: agrupa por
  `post_id` real, separa el ruido de seguridad `approve_from_another_device`,
  ordena por deuda, emite la `openUrl` por hilo). Entregar la tabla y elegir el
  hilo top. MCP solo si el script falla o un hilo sale raro.

### Etapa 2 — Perfilar el hilo · regla [thread-actor-dossier]
- **Correr `node thread-extract.mjs "<openUrl>" --json`** (la `openUrl` la dio la
  etapa 1): expande TODO, walk del árbol, dedup de los 2 renders, y devuelve
  `{turns[], debt[]}`. MCP (expand+walk a mano) solo como fallback si el hilo sale
  raro.
- Volcar el JSON al transcript en `analysis/threads/` y a los dossiers por actor
  en `analysis/actors/` (acumular, no sobre-escribir; llave = `user_id`).
- Solo análisis. El script **surfacea** la deuda; **decidir** la jugada de mayor
  palanca (la deuda más fresca + la que más educa al lurker) con los dossiers.

### Etapa 3 — Borrador del coagent · regla [coagent-advise]
- Resolver el coagent por identidad (verificar `location.href` al escribir;
  reusar su tab, no duplicar). Seedearle el master prompt denso: tablero + jugada
  + riesgo a anticipar, pidiéndole stress-test y borrador **como reply etiquetada**
  (norma del grupo, nunca root) en la voz de Bernard.
- Esperar a que termine el streaming; entregar veredicto + borrador a Bernard.

### Etapa 4 — Style-gate, postear y verificar · regla [comment-post-and-verify]
- **Paso 0 (style-gate):** pasar el borrador por [reply-output-style]; si pisa la
  kill-list de IA-tells, se lee como mini-ensayo o no devuelve al hueso del marco,
  **reformular** más corto/afilado/humano ANTES de seguir.
- **Gate irreversible:** mostrar el borrador final + dónde va (reply etiquetada a
  la persona). NO postear sin GO explícito de Bernard sobre ese texto (autorizado
  por jugada).
- Con el GO: golden path (evento paste sintético → Enter → verificación histérica
  por `div[role="article"]` + screenshot). Si quedó mal, BORRAR.

## Reglas

- **No postear sin GO por jugada.** La etapa 4 es el único paso irreversible; el
  botón de enviar es de Bernard.
- **Reply etiquetada a la persona, nunca root** (norma del grupo).
- **Output humano, no robótico** — el style-gate de la etapa 4 es obligatorio.
- **Verificar con recibos** — DOM + screenshot, nunca asumir que posteó.
- **Solo análisis en etapas 2–3** — no se toca nada en FB hasta la etapa 4.
- Diagnóstico de Chrome antes de tocarlo; nunca matar Chrome a ciegas.

## Una línea para arrancar

Sin argumento → "Corriendo el pipeline desde notificaciones." Con argumento →
"Corriendo el pipeline sobre el hilo indicado." Luego ejecutar etapa por etapa,
parando en el gate de la etapa 4.
