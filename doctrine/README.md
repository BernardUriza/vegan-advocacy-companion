# doctrine/ — origen del Bot Vegano Compasivo (importado de Claude.ai)

Todo lo que vivía en el **project de Claude.ai "Bot Vegano Compasivo"**
(`01992cbb-aca1-724a-bb13-7ec8c1916f90`, org `bernarduriza@gmail.com`, creado
2025-09-09) traído a este repo el 2026-06-16. Es la **doctrina fundacional** del
bot, anterior al pipeline actual de Chrome DevTools.

## Qué es cada archivo

| Archivo | Qué es | Origen en Claude.ai |
|---|---|---|
| `bot-vegano-compasivo-manual.md` | **Manual de arquitectura emocional** — filosofía central, detección de heridas, algoritmo de respuesta compasiva, biblioteca de respuestas, métricas. | project **description** (5.6K) |
| `compassion-disruption-2025.md` | **El system prompt operativo** — "Compassion Disruption 2025": marco abolicionista, protocolo de 5 pasos, heridas originarias, técnicas avanzadas, autocuidado del activista. | project **instructions** / `prompt_template` (9.9K) |
| `rag/` | Las 8 fuentes que respaldan la doctrina (bibliografía del bot). | project **knowledge files** |

## rag/ — la bibliografía (texto extraído versionado; PDF original en disco, gitignoreado)

Los `.pdf` originales (~10MB) quedan en disco pero **no se versionan** (binarios
pesados — ver `.gitignore`). Lo versionado es el `*.md` con el **texto extraído**
(PyMuPDF), que es grepeable y alimenta cualquier RAG futuro.

| Fuente | Disciplina | Para qué la usa el manual |
|---|---|---|
| **Nonviolent Communication** (Rosenberg) | CNV | Desactivar agresión sin juicio — estructura del primer contacto |
| **W.Arias** = Carl Rogers y la Terapia Centrada en el Cliente | Psicología humanista | Presencia empática total (estima incondicional, empatía, congruencia) |
| **Trauma-Informed Care** (SAMHSA) | Trauma | Identificar el trauma detrás de las defensas; seguridad emocional |
| **Teoría del Apego** (Bowlby, Ainsworth, Main) | Apego | Diagnosticar la herida raíz en patrones repetitivos |
| **IFS — Sistemas Familiares Internos** (Schwartz) | Psicoterapia | "El niño herido adentro del adulto a la defensiva" |
| **Entrevista Motivacional** (Miller & Rollnick, 2016) | Cambio conductual | Provocar cambio sin confrontar; la "prueba de fuego" |
| **Neurobiología Interpersonal** (Siegel) | Neurociencia | Por qué la conexión empática regula el sistema nervioso |
| **Anarquismo Vegano** | Política/ética | Marco abolicionista (animales no son propiedad) |

### Fuentes de autores antiespecistas — alimentan `data/frameworks.json`, NO el registro compasivo

Estas son el **arsenal PRO-vegano deployable** (registro filo): conceptos/términos acuñados que el pipeline despliega como **marco** (nunca premisa portante — ver `attack_surface` en cada framework). Bajadas vía Chrome DevTools / transcripción.

| Fuente | Autor | Frameworks que alimenta |
|---|---|---|
| **Antropoespecismo / Göbekli Tepe** (conferencia UNAM 2019, Whisper) | Samuel Guerrero Azañedo | `antropoespecismo`, `gobekli-kilometro-cero` |
| **Revolucionar la revolución** (charla "afilar el hacha", Whisper) | Samuel Guerrero Azañedo | `revolucionar-la-revolucion` |
| **Violencia Especista / ENFOC** (entrevista LECA 2016, OCR + bio) | Romina Kachanoski | `violencia-especista`, `especidio` |

## Relación con el pipeline actual

⚠️ Hay **tensión de marco** entre esta doctrina y
[`.claude/rules/reply-output-style.md`](../.claude/rules/reply-output-style.md):

- **Compassion Disruption (acá):** "NUNCA insultes", padre amoroso, validación
  devastadora, hablarle al niño herido. Tono terapéutico puro.
- **reply-output-style (pipeline actual):** más mordaz/filo permitido al servicio
  del marco, inversión de carga, escrito para el lurker, kill-list de IA-tells.

**Reconciliado el 2026-06-16** (decisión de Bernard): no eran rivales sino **dos
registros de un mismo norte** (el lurker + la pregunta del marco), elegidos por el
estado del interlocutor — compasivo ante herida/buena fe, mordaz ante mala
fe/escudo, ninguno ante troll. La calibración explícita quedó escrita en la
sección "Los dos registros" de
[`reply-output-style.md`](../.claude/rules/reply-output-style.md); el mapeo de
heridas y las fuentes de este `rag/` son el respaldo del registro compasivo.
