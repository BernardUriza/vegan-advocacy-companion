# Backlog — vegan-advocacy-companion

Roadmap de quick wins. Gobernado por la regla universal `backlog-handling`
(playbook). Cada item: una línea (qué + ruta canónica). Status: `Proposed` por
default; al greenlightear pasa a `In progress` y se promueve a archivo propio
`<slug>.md`; al shippear → `Done` con puntero a dónde aterrizó.

Origen: destilados 2026-06-19 de la sesión que construyó el arsenal de 55
frameworks + lo cableó al pipeline. Los 5 grandes de la auditoría: #1 cableado
(✅ Done), #2 outcome-loop, #3 efectividad-por-framework, #4 style-gate
determinista, #5 bajar dependencia del coagent.

---

## A. Style-gate determinista (audit #4 — partido en átomos)
1. `scripts/style-gate.mjs` — detector literal de la kill-list ("Let's unpack", "It's worth noting", "At the end of the day"…) → flag. — Proposed
2. Detector de **staccato**: ratio de líneas de una sola oración > umbral → flag (el tell del coagent). — Proposed
3. Detector de **abrir-con-nombre**: el cuerpo arranca con el nombre del target → flag (bug del nombre duplicado). — Proposed
4. Guard de **word-count**: flag si <150 o >350 palabras. — Proposed
5. Detector de tricolon repetitivo ("X, Y, and Z" en molde). — Proposed
6. Detector de emojis / MAYÚSCULAS-grito / markdown (debe parecer escrito en el teléfono). — Proposed
7. Wire `style-gate.mjs` en etapa-4 paso-0 como pre-filtro ANTES del juicio LLM. — Proposed

## B. Outcome-loop (audit #2 — memoria hoy es write-only)
8. `thread-extract.mjs`: por cada interacción previa tuya, detectar si el oponente respondió DESPUÉS → clasificar. — Proposed
9. `scripts/close-outcomes.mjs`: barre hilos, actualiza `pending` → conceded/escalated/silent/goalpost. — Proposed
10. Heurísticas de auto-detección de outcome (silencio N días = silent; keywords de concesión; insulto = escalated). — Proposed
11. `notif-scan`: surfacear "pending outcomes" para revisitar hilos donde esperas reacción. — Proposed

## C. Efectividad por framework (audit #3 — el moat)
12. `scripts/framework-stats.mjs`: agrega interacciones por campo `framework` → win/loss/silent por jugada. — Proposed
13. Columna de efectividad en el índice generado (`gen-frameworks.mjs`). — Proposed
14. `db.mjs`: `getFrameworkWinRate(id)`. — Proposed
15. Flag de frameworks con 0 deploys ("arsenal sin probar"). — Proposed
16. Flag de frameworks con mal track-record (alto escalated/silent) para revisión. — Proposed

## D. Hardening de la capa de datos
17. `validate-data`: warn en frameworks con `related_tactics` vacío (arsenal huérfano, inalcanzable por getFrameworksByTactic). — Proposed
18. `validate-data`: warn en tácticas SIN framework que las contrarreste (hueco de cobertura). — Proposed
19. `validate-data`: verificar que cada `source_ref` exista en disco (hoy es manual). — Proposed
20. `validate-data`: enforce `deploy_as` ∈ {marco, premisa_portante, auto-disciplina-del-activista}. — Proposed
21. `data/SCHEMA.md`: documentar campos de actors/tactics/frameworks. — Proposed

## E. Cobertura del arsenal
22. Reporte de cobertura: cuáles de las 27 tácticas tienen ≥1 framework vs 0. — Proposed
23. Auditoría de near-dups (ej. el pollo de André Ford salió 2×) → merge/dedup. — Proposed
24. Tag `lurker_risk` (low/med/high) derivado de keywords del `attack_surface` para triage rápido. — Proposed
25. Frameworks faltantes para tácticas top sin cobertura (crop_deaths_flip, predator_comparison, ai_accusation…). — Proposed

## F. Extracción de contenido (la cola + tooling)
26. ~~Transcribir las 2 entrevistas de Instagram (ANIMAL HUMANO) + extraer frameworks.~~ — **Done** (+10 frameworks → 71).
27. ~~Veganismo Político (134 min): transcribir + extraer.~~ — **Done** (18.4k palabras transcritas + 5 frameworks extraídos → arsenal en 76).
28. OCR del cuerpo completo del PDF de Kachanoski con modelo `small` (hoy solo saqué estructura). — Proposed
29. Re-transcribir Educación Especista con `ca`/autodetección para los tramos catalán garbleados. — Proposed
30. `scripts/extract-frameworks.mjs`: empaquetar el patrón fan-out de extracción en script/comando reusable. — **Done** (scaffold + merge_fw helper).
31. ~~Extraer frameworks de la propia doctrina compasiva (`doctrine/rag/` — Rosenberg, IFS, NVC).~~ — **Done** (6 frameworks compasivos → en el arsenal).

## G. Mecánica del pipeline
32. `notif-scan`: manejar notifs de perfil personal con `pfbid` (el fallback que la regla menciona). — Proposed
33. `comment-prepare`: auto-elegir el comentario correcto cuando hay varios del mismo autor (freshest owes:true). — Proposed
34. `scripts/pipeline-status.mjs`: dashboard de deudas abiertas + pending outcomes + frameworks sin probar en una vista. — Proposed
35. `fb-lib`: helper `readThreadRoot()` (el extractor agarró el 1er comentario como root — bug real visto hoy). — Proposed

## H. Dossier / observabilidad
36. `gen-dossiers`: anexar por-actor los counter-frameworks (etapa-2 paso 6 horneado en la vista .md). — Proposed
37. Score de "heat" por actor: frescura × palanca × persuadibilidad para priorizar el lote. — Proposed
38. `getDossierSummary` que también devuelva los frameworks surfaceados (una sola llamada para etapa-3). — Proposed

## I. Testing / CI
39. Test mínimo de los accessors de `db.mjs` (getFrameworksByTactic, validate caza data mala). — Proposed
40. Pre-commit hook que corre `validate-data.mjs` (bloquea commits con dangling refs/drift). — Proposed

---

**Mi recomendación de arranque (mayor palanca / menor esfuerzo):** #7+#1-3 (style-gate, cierra calidad), #8-9 (outcome-loop, enciende el aprendizaje), #40 (pre-commit guard, barato). El bloque F es el que más engorda el arsenal pero pesa más (transcripción).
