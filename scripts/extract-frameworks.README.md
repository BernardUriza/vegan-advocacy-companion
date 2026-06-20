# extract-frameworks — patrón de extracción fan-out (Stage F)

SSOT del **ingreso** de frameworks a `data/frameworks.json`. Un transcript o una
fuente (charla de YouTube transcrita por Whisper, PDF OCR'd, archivo de
`doctrine/rag/`) → se leen → se extraen objetos `framework` con el schema → se
**mergean** a la SSOT con dedup por `id` y filtrado de `related_tactics` inválidos.

`data/frameworks.json` es la SSOT (Art. 6). La vista navegable + índice inverso
(táctica → frameworks) en `analysis/frameworks/README.md` se **genera** desde la
JSON con `scripts/gen-frameworks.mjs` — no se edita a mano.

## La frontera juicio ↔ mecánica (igual que el resto del pipeline)

- **El JUICIO no se scriptea:** leer la fuente y construir cada objeto framework
  (definición, `enables`, `attack_surface` honesto, `register`, qué `related_tactics`
  aplican) es trabajo de Claude leyendo el texto. Eso es prosa densa, no determinismo.
- **La MECÁNICA sí:** dedup por id, filtrar tactic ids que no resuelven, validar
  campos requeridos, y el write atómico. Eso vive en `mergeFrameworks()`.

`mergeFrameworks(objs)` aplica 4 reglas duras para que una extracción mala no
envenene la SSOT:

| Regla | Comportamiento |
|---|---|
| dedup por `id` | un objeto con `id` ya existente se **SALTA** (el existente gana — Art. 5, nunca clobber) |
| filtro de tácticas | `related_tactics` que no están en `tactics.json` se **DESCARTAN** (con warning); mantiene `validate-data.mjs` verde |
| campos requeridos | un objeto sin `id/name/author/definition/enables/attack_surface/deploy_as` se **RECHAZA** (reportado, no escrito) |
| write atómico | delegado a `db.mjs upsertFramework` (temp-file + rename, deploy-safe) |

## Schema del objeto framework

```js
{
  id,             // kebab-case, único en todo el array (la llave de dedup)
  name,           // título humano
  author,         // autor de la fuente (ej. "Marshall Rosenberg (NVC)")
  tradition,      // linaje (ej. "registro compasivo / comunicación no violenta")
  definition,     // qué ES el concepto
  enables,        // qué te compra desplegarlo en un hilo
  register,        // "compasivo" | "filo"
  attack_surface,  // riesgo honesto: dónde hace backfire / quién lo ataca
  deploy_as,       // "marco" | "auto-disciplina-del-activista" | …
  source_ref,      // ruta a la fuente en doctrine/rag/
  related_tactics  // SOLO ids reales de tactics.json (inválidos se filtran)
}
```

## Uso

```bash
# smoke / presupuesto de chars de una fuente antes de extraer
node extract-frameworks.mjs --source "doctrine/rag/<file>.md"
```

```js
// extracción real (desde otro extractor o un REPL):
import { mergeFrameworks } from './extract-frameworks.mjs';
const result = mergeFrameworks([ /* objetos framework construidos leyendo la fuente */ ]);
// result = { added[], skippedDup[], rejected[], droppedTactics[] }
```

Tras cualquier merge: `node scripts/validate-data.mjs` DEBE quedar verde, y
`node scripts/gen-frameworks.mjs` para regenerar la vista.

## DIFERIDO (necesita Chrome/red/Whisper en vivo — no en este worktree)

Estas fuentes requieren transcripción en vivo (yt-dlp/Whisper) u OCR con red, que
este path aislado no maneja. Se procesan en una sesión con Chrome+red, leyendo el
transcript resultante y llamando `mergeFrameworks`:

- **#26** Instagram interviews (entrevistas, requiere captura en vivo)
- **#27** Veganismo Político (transcripción de video en vivo)
- **#28** OCR Kachanoski (escaneo a texto con red)
- **#29** re-transcribe Educación (re-Whisper del audio)

## Hecho aquí (sin red)

- **#31** registro COMPASIVO: 6 frameworks deployables extraídos de `doctrine/rag/`
  (NVC, IFS, Entrevista Motivacional, Trauma-Informed, Apego, Neurobiología
  Interpersonal/Rogers), todos `register: compasivo`, `deploy_as` =
  `auto-disciplina-del-activista` o `marco`. Ver sus ids en el commit.
