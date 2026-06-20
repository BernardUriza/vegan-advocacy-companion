# Data layer schema — `data/*.json`

SSOT de la capa de datos del pipeline de debate vegano. Tres arrays JSON, leídos y
escritos vía `scripts/db.mjs` (ESM, escritura atómica) y validados por
`scripts/validate-data.mjs` (debe quedar verde — `node scripts/validate-data.mjs`).

Las llaves de cruce: un actor referencia tácticas por `tactics[]`; una táctica
lista de vuelta a sus actores por `actors_known[]` (consistencia bidireccional,
chequeada); un framework contrarresta tácticas por `related_tactics[]`. La llave
dura de un actor es `user_id` (el nombre se repite, el id no).

---

## `actors.json` — dossier por persona (memoria longitudinal)

Array de actores del grupo. Un objeto por persona; acumula apariciones a través de
hilos (se AÑADE, no se sobre-escribe).

| Campo | Tipo | Qué es | Requerido |
|---|---|---|---|
| `user_id` | string | Llave dura — el id numérico del perfil de FB (de `/user/<id>/`). Único en el archivo. | sí (validado: requerido + único) |
| `name` | string | Nombre visible en FB. | sí (validado) |
| `profile_url` | string | URL del perfil dentro del grupo. | recomendado |
| `bando` | string | `pro-vegan` / `anti-vegan` / `aliado` / `ambiguo`. | sí (validado) |
| `postura_nucleo` | string | La tesis del actor en una línea. | recomendado |
| `analisis` | string | Perfilado duro en prosa (sin suavizar, sin inventar). | recomendado |
| `tactics` | string[] | Ids de tácticas (de `tactics.json`) que emplea. Cada id debe existir. | sí (validado: cada id resuelve) |
| `tone` | string | `dismissive` / `civil` / `sarcástico` / `hostile_rhetorical` / `buena fe`, etc. | recomendado |
| `verdict` | string | Veredicto de debate: `persuadible` / `audiencia` / `pozo sin fondo`. | sí (validado) |
| `register` | string | Registro recomendado para responderle: `filo` / `compasivo` / `ninguno`. | sí (validado) |
| `what_not_to_do` | string | Errores a evitar con este actor (no morder anzuelos, etc.). | recomendado |
| `threads` | string[] | `post_id` de los hilos donde apareció. | recomendado |
| `interactions` | object[] | Log fechado de intercambios (ver sub-shape abajo). | recomendado |

**`interactions[]` sub-shape:** `thread_id` (string), `date` (string `YYYY-MM-DD`),
`their_move` (string — qué jugó el actor), `our_reply_summary` (string — resumen de
la respuesta de Bernard), `outcome` (string — ej. `goalpost` / `pending` / cerrado).

---

## `tactics.json` — catálogo de tácticas/falacias del oponente (27)

Array de tácticas reconocidas. Un objeto por táctica; su `id` es la llave que los
actores y frameworks referencian.

| Campo | Tipo | Qué es | Requerido |
|---|---|---|---|
| `id` | string | Slug único — la llave referenciada por `actors[].tactics` y `frameworks[].related_tactics`. | sí |
| `name` | string | Nombre legible de la táctica. | sí |
| `category` | string | `fallacy` / `rhetoric` / etc. | sí |
| `definition` | string | Qué es la táctica y cómo se ve en debates veganos. | sí |
| `canonical_counter` | string | El contra-movimiento de referencia. | sí |
| `register` | string | Registro con el que se contrarresta: `filo` / `compasivo`. | sí |
| `what_not_to_do` | string | El error típico al enfrentarla (el pantano a evitar). | sí |
| `actors_known` | string[] | `user_id` de actores que la usan. Cada uno debe existir Y listar esta táctica de vuelta. | sí (validado: bidireccional) |
| `fallacy_type_id` | string \| null | Id de falacia del backend (`appeal_to_nature`, `ad_hominem`, …) o `null` si no mapea. | sí (validado contra lista conocida si no es null) |

---

## `frameworks.json` — arsenal de marcos antiespecistas (55)

Array de frameworks (marcos, premisas portantes, auto-disciplinas) destilados de la
doctrina. Munición que `getFrameworksByTactic()` surfacea por táctica del target.

| Campo | Tipo | Qué es | Requerido |
|---|---|---|---|
| `id` | string | Slug único del framework. | sí (validado: requerido + único) |
| `name` | string | Nombre legible del marco. | sí (validado) |
| `author` | string | Autor de la doctrina (ej. Samuel Guerrero Azañedo, Romina Kachanoski). | sí (validado) |
| `tradition` | string | Corriente/tradición de la que proviene. | recomendado |
| `definition` | string | Qué afirma el marco (a menudo con cita textual). | sí (validado) |
| `enables` | string | El ángulo deployable — qué te permite hacer en el debate. | sí (validado) |
| `register` | string | `filo` / `compasivo`. | recomendado |
| `attack_surface` | string | El flanco — qué NO hacer, dónde un oponente fino lo ataca. Obligatorio cablearlo al master prompt como "qué no hacer". | sí (validado) |
| `deploy_as` | string | Cómo se despliega. Debe EMPEZAR por uno de `{marco, premisa_portante, auto-disciplina}` (sufijos permitidos, ej. `marco (con cautela)`, `auto-disciplina-del-activista`). | sí (validado: prefijo válido) |
| `source_ref` | string | Ruta (relativa a ROOT) al texto-fuente en `doctrine/rag/`. Debe existir en disco. | sí (validado: existe en disco) |
| `related_tactics` | string[] | Ids de tácticas que el framework contrarresta. Cada id debe existir. Vacío = huérfano (WARN). | sí (validado: cada id resuelve; vacío → WARN) |

---

## Chequeos de `validate-data.mjs`

ERROR (rompe el build, exit 1):
1. Actor referencia una táctica inexistente.
2. Táctica reclama un actor desconocido, o un actor que no la lista de vuelta.
3. Campos requeridos de actor (`name`, `bando`, `verdict`, `register`) + `user_id` único.
4. `fallacy_type_id` desconocido (si no es null).
5. Frameworks: `id` único + campos requeridos; `related_tactics` que resuelvan.
6. **`source_ref` de un framework que no existe en disco.**
7. **`deploy_as` de un framework que no empieza por `{marco, premisa_portante, auto-disciplina}`.**

WARN (señal real, NO rompe el build):
- **Framework con `related_tactics` vacío** — arsenal huérfano, inalcanzable por `getFrameworksByTactic`.
- **Táctica que ningún framework contrarresta** — hueco de cobertura del arsenal.
- Dossier markdown con un `user_id` ausente del JSON SSOT (drift).
