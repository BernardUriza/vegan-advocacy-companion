# 🌱 Vegan Advocacy Companion

Compañero de **debate vegano de alto volumen** en grupos de Facebook (ej.
"Vegans V's Meat Eaters"). No es un asistente de juguete: corre un **pipeline de
4 etapas, engrasado y validado en producción**, que va de la notificación de FB a
una respuesta posteada y verificada — escrita para educar al **lector silencioso
casual** (el lurker), no para ganarle al troll.

> **Qué es el producto y qué es maqueta.** El **pipeline de 4 etapas sobre
> `scripts/fb-lib.mjs`** es lo que se usa a diario y lo que **sí ha dado
> resultados** (comentarios posteados, debates ganados ante la galería, memoria
> longitudinal de actores). La extensión Chrome + backend Azure que también vive
> en este repo fue la **maqueta inicial** — sigue acá como referencia, pero no es
> el producto vivo. Ver [Maqueta original](#maqueta-original--roadmap).

---

## El pipeline ganador — 4 etapas

Flujo canónico, cada etapa con su GOLDEN PATH (selectores, gotchas y verificación
ya pagados) en su propia regla bajo [`.claude/rules/`](.claude/rules/). El
detalle vive en [`CLAUDE.md`](CLAUDE.md); esto es el mapa.

| # | Etapa | Qué hace | Arranca por |
|---|---|---|---|
| 1 | **[notification-agrupation](.claude/rules/notification-agrupation.md)** | Agrupa notificaciones por `post_id` real, separa el ruido de seguridad, ordena por deuda, emite la `openUrl` por hilo | `scripts/notif-scan.mjs` |
| 2 | **[thread-actor-dossier](.claude/rules/thread-actor-dossier.md)** | Expande el hilo completo, walk del árbol, tabla de deuda, y perfila a cada actor en un dossier longitudinal | `scripts/thread-extract.mjs` |
| 3 | **[coagent-advise](.claude/rules/coagent-advise.md)** | Seedea al coagent orquestador (ChatGPT) el tablero + la jugada de mayor palanca para que la stress-testee y redacte el borrador | chrome-devtools MCP |
| 4 | **[comment-post-and-verify](.claude/rules/comment-post-and-verify.md)** | Style-gate → preparar el draft → **GO de Bernard** → postear → verificación histérica + screenshot | `scripts/comment-prepare.mjs` + MCP |

**Atajo:** el skill `/vegan-pipeline` encadena las 4 etapas y se detiene en el
gate irreversible de la etapa 4 (el botón de publicar es de Bernard, autorizado
por jugada).

### La frontera del firewall (Art. 4)

Lo **reversible se scriptea** (scrapear, agrupar, expandir, walk del árbol, y
**preparar el draft en el composer SIN enviar**). El **acto irreversible** —el
`Enter` que publica + su verificación— y el **juicio** (qué jugada, prosa del
dossier, style-gate) **nunca se scriptean**: eso es de Claude + MCP + Bernard.

---

## La automatización — `scripts/` (SSOT)

Las partes mecánicas y deterministas se scriptean con `playwright-core` +
`connectOverCDP` al **Chrome de debug (puerto 9333)**, colapsando ~6 round-trips
del MCP en un `node` sin quemar tokens. Nunca tocan las tabs de Bernard: siempre
abren tab nueva en el contexto logueado.

| Script | Etapa | Qué hace |
|---|---|---|
| `fb-lib.mjs` | — | **Lib canónica — todo script la importa** (sesión CDP, tabs efímeras/persistentes, parsing de edad) |
| `notif-scan.mjs` | 1 | Scrapea notificaciones, agrupa por `post_id`, ordena por deuda, emite `openUrl` |
| `thread-extract.mjs` | 2 | Expande todo, walk del árbol, dedup de los 2 renders de FB, árbol + tabla de deuda |
| `comment-prepare.mjs` | 4 (prep) | Localiza el comentario, abre Reply, pega el draft etiquetado **sin enviar**, deja la tab viva para el `Enter` de Claude+MCP |

Etapa 3 (coagent) es MCP a propósito — sin script: la UI de ChatGPT cambia más
seguido que la de FB y la consulta debe ser a conciencia.

> **Antes de tocar Chrome:** diagnóstico del `~/CLAUDE.md` (el puerto suele ser
> **9333**, no 9222). Nunca matar Chrome a ciegas.

---

## La doctrina — [`doctrine/`](doctrine/)

El bot nació como un project de Claude.ai, **"Bot Vegano Compasivo"**, importado
a este repo. Ahí vive la doctrina fundacional (`compassion-disruption-2025.md` +
el manual de arquitectura emocional) y el **RAG** de 8 fuentes (CNV/Rosenberg,
Rogers, SAMHSA trauma-informed, Bowlby, IFS, Entrevista Motivacional, Siegel,
Anarquismo Vegano) como texto extraído grepeable.

El estilo de cada reply lo gobierna
[`reply-output-style`](.claude/rules/reply-output-style.md): humano no robótico,
150–350 palabras, **dos registros de un mismo norte** (compasivo ante buena
fe/herida, mordaz ante mala fe/escudo, ninguno ante troll), kill-list de IA-tells,
norte = inversión de carga / la pregunta del marco, escrito para el lurker.

---

## La memoria longitudinal — [`analysis/`](analysis/)

- `analysis/actors/<slug>.md` — **dossier duro por persona** (bando, postura,
  tácticas, veredicto de debate, log fechado). Se acumula a través de hilos; la
  llave es el `user_id`, no el nombre. Convierte el companion en memoria: quién
  mueve postes, quién es persuadible, quién es pozo sin fondo.
- `analysis/threads/<post_id>-<slug>.md` — transcript íntegro de cada hilo.

---

## Cómo correr el pipeline

```bash
# Chrome de debug vivo en 9333 (diagnóstico en ~/CLAUDE.md si no responde)

# Etapa 1 — triage de notificaciones
cd scripts && node notif-scan.mjs            # tabla por deuda; --json para pipear

# Etapa 2 — perfilar el hilo elegido
node thread-extract.mjs "<openUrl>" --json   # árbol + deuda → transcript + dossiers

# Etapas 3 y 4 — vía Claude + chrome-devtools MCP (coagent + posteo con GO)
```

O simplemente invocar el skill **`/vegan-pipeline`** (con o sin URL/`post_id`).

---

## Maqueta original — roadmap

La primera versión del repo fue una **extensión Chrome educativa** (identificar
falacias con un backend Next.js + Azure OpenAI). **Fue maqueta** — quedó como
referencia, no se mantiene como producto. Sus piezas siguen en el árbol:

- `manifest.json`, `sidepanel/` (→ `backend/public/extension`), `background.js`,
  `content/`, `icons/` — la extensión.
- `backend/` — API Next.js (`/api/validate-fallacy`) + integración Azure Key Vault.
- `I18N-TESTING.md`, `TESTING.md` — pruebas de la maqueta.

**Roadmap (features de la maqueta, aún no en el pipeline ganador):**

- [ ] Más tipos de falacia (Ad Hominem, Whataboutism…) servidos al pipeline.
- [ ] Generación de snippets con IA alimentada por el `doctrine/rag/`.
- [ ] Content script de "Mark as Debate" sobre FB.
- [ ] Gamificación / tracking (XP, badges, streaks) — de la maqueta.
- [ ] Capturar `user_id` automáticamente al perfilar (etapa 2).

---

## License

MIT — proyecto educativo privado.

---

Construido para activistas veganos que pelean la guerra real: **el lector
silencioso que está decidiendo qué pensar.**
