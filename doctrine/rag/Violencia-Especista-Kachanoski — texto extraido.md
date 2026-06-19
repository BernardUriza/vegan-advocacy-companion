# Violencia Especista / ENFOC — Romina Kachanoski (texto extraído)

- **Autora:** Romina Kachanoski — psicóloga social vegana antiespecista (Lic. en Psicología, Universidad Autónoma de Barcelona; Máster en Investigación en Psicología Social, UAB; estudios doctorales en Psicología Social UAB y en Humanidades y Ciencias Sociales, UPNA). Fundadora de «Violencia Especista» y «Psicología Vegana». Consulta privada con sede en Italia.
- **Concepto:** acuñó los términos **«violencia especista»** y **«especídio»**, presentados por primera vez en la International Animal Rights Conference (Luxemburgo). Desarrolló la teoría taxonómica **ENFOC (Enfoque de Violencia Especista)**.
- **Fuentes (bajadas vía Chrome DevTools, open access CC):**
  - Bio: https://www.psicologiavegana.com/acerca-de-romina-kachanoski/
  - Entrevista/abstract: «ENFOC: Violencia especista — Entrevista a Romina Kachanoski», *Revista Latinoamericana de Estudios Críticos Animales* (LECA), Vol. 3 Núm. 1 (2016), ISSN 2346-920X. https://revistaleca.org/index.php/leca/article/view/103 — entrevistadora: Lucía Arana (TV Animalista, Programa ENFOC). Licencia CC BY-NC-SA/ND.
  - PDF original (escaneado, 25 págs) guardado en `doctrine/rag/` (gitignored). El cuerpo es imagen → **OCR'd con Tesseract (`-l spa`, 300dpi)**; las citas verbatim de abajo provienen de ese OCR. El abstract + bio se bajaron como texto real vía Chrome.
- **Frameworks que alimenta:** `violencia-especista`, `especidio` (ver `data/frameworks.json`).

---

## Tesis central (abstract LECA 2016, texto real)

> «La violencia especista es un problema social emergente a escala planetaria que, lejos de prevenirse o erradicarse, se presenta como un recurso disponible para actuar en sociedad.»

El objetivo declarado: introducir el término *violencia especista* y dar claves para su reconocimiento y erradicación, desde una perspectiva integral, abordando **tres grandes ejes psicosociales**: orígenes, definición y tipos.

### 1. Orígenes — el Especismo Antropocéntrico
La causa de la violencia especista es el **Especismo Antropocéntrico**, situado en el contexto de **otras luchas sociales afines** (contra el sexismo, racismo, nazismo, homofobia, transfobia, etc.). Movimiento clave: la violencia hacia los animales no es una categoría aparte sino **una violencia social como cualquier otra**.

### 2. Definición — por qué «violencia especista» y no otros términos
Justifica implementar el término *violencia especista* **frente a otras terminologías de uso actual** (maltrato animal, abuso, sadismo, crueldad, trastorno mental, etc.), otorgando rigor conceptual. La violencia especista es la **implementación del especismo**: un vínculo relacional asimétrico y opresivo que los humanos ejercen sobre otros animales. El encuadre quita el eufemismo: nombra como *violencia* lo que el lenguaje dominante llama «uso», «producción» o «sacrificio».

### 3. Tipos — la taxonomía ENFOC (5 dimensiones)
Un «exhaustivo abanico de tipologías» agrupado en **cinco dimensiones o escenarios de acción posible**, según el tipo de relación violenta con los animales no-humanos:

1. **Violencia directa** — física, psicológica, espacial, relativa al linchamiento, a la negligencia, e instrumental.
2. **Violencia indirecta.**
3. **Violencia colateral.**
4. **Violencia estructural** — incluye el **Especídio** (el exterminio sistemático e institucionalizado de animales no-humanos; paralelo conceptual al genocidio).
5. **Violencia discursiva.**

A lo largo de la presentación fomenta el **uso pragmático del discurso** y analiza casos prácticos y cotidianos para aprehender la magnitud de la violencia especista actual.

---

## Definiciones verbatim (OCR de la entrevista LECA 2016)

> **Violencia especista:** «la violencia especista es la violencia que los humanos ejercen hacia los demás animales. Así como existe la violencia sexista, existe la violencia [racista]…» — y, en su formulación técnica: «Violencia Especista es ese vínculo de relación asimétrico y opresivo que ejercen los humanos hacia los demás animales.»

> **Especídio:** «El Especidio es el exterminio o eliminación sistemática, total o parcial, de animales nohumanos por motivos de especie.» Lo nombra como el tipo **más devastador** de la violencia especista estructural (analogía explícita con el genocidio: *«dejamos de mirar individuos para pensar en especies»*).

> **El ejercicio central del enfoque:** «por un momento deja a un lado la justificación que tú le quieres dar como especista y mira esa imagen, mira eso que está pasando: esto es violencia.» — sacar a la luz que un acto es violencia, quitándole el eufemismo.

(Citas de la entrevista de Lucía Arana a R.K., Programa ENFOC / TV Animalista, transcritas vía OCR; pueden tener pequeños artefactos de escaneo.)

---

## Nota de despliegue (attack_surface — cómo usarlo en el pipeline)

- **`violencia-especista`** es un marco ético sólido (es una definición, no un dato refutable). Riesgo en Facebook: la palabra «violencia» puede leerse como acusación personal y cerrar al interlocutor de buena fe → **modular con el registro compasivo**.
- **`especidio`** y la jerga ENFOC (las 5 dimensiones, la analogía con el genocidio) **NO van literales a un comentario**: encienden y se leen como exageración ante el lurker. Reservar para audiencia ya sensibilizada. Usar el *concepto* (nombrar la escala estructural), no el *término*.
- Como todo framework de autor: **marco, no premisa portante** (ver el aprendizaje Göbekli en `[[gobekli-kilometro-cero]]`).
