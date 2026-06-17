# GPT-5 Prompts Documentation

Esta carpeta contiene todos los prompts utilizados para interactuar con Azure OpenAI GPT-5-mini.

## 📁 Estructura

```
prompts/
├── README.md                           # Este archivo
├── fallacy-detection-system.md        # System prompt principal
└── examples/                           # (futuro) Ejemplos de few-shot learning
```

## 🎯 Propósito

Mantener los prompts en archivos markdown separados permite:

- ✅ **Versionamiento**: Track cambios en Git con diff legible
- ✅ **Colaboración**: Fácil revisión de prompts por el equipo
- ✅ **Iteración**: Probar variaciones sin tocar código TypeScript
- ✅ **Documentación**: Explicar el razonamiento detrás de cada instrucción
- ✅ **Portabilidad**: Reutilizar prompts en otros proyectos

## 📝 Archivo Principal

### `fallacy-detection-system.md`

**Propósito**: Detectar falacias lógicas y generar respuestas personalizadas

**Modelo**: Azure OpenAI GPT-5-mini (deployment: `gpt-5-mini`)

**Input**:
```json
{
  "argumentText": "We've always eaten meat - it's tradition"
}
```

**Output**:
```json
{
  "detected": true,
  "fallacyType": "appeal_to_tradition",
  "fallacyName": "Appeal to Tradition",
  "confidence": 85,
  "explanation": "...",
  "keywords": ["always", "tradition"],
  "snippets": [
    {
      "style": "educational",
      "title": "Educational - Historical Context",
      "content": "..."
    },
    // ... 4 more styles
  ]
}
```

**Placeholders**:
- `{{FALLACY_DESCRIPTIONS}}`: Generado dinámicamente desde `/lib/fallacy-types.ts`

**Ubicación en código**: `/app/api/validate-fallacy/route.ts` → `buildSystemPrompt()`

## 🔧 Uso en Código

### Cómo se integra actualmente

```typescript
// backend/app/api/validate-fallacy/route.ts

import fs from 'fs';
import path from 'path';

function buildSystemPrompt(): string {
  // 1. Leer el template markdown
  const promptPath = path.join(process.cwd(), 'prompts', 'fallacy-detection-system.md');
  let promptTemplate = fs.readFileSync(promptPath, 'utf-8');

  // 2. Generar descripciones dinámicas de falacias
  const fallacyDescriptions = FALLACY_TYPES.map(fallacy => `
**${fallacy.name} (ID: ${fallacy.id}):**
${fallacy.definition}

Common keywords: ${fallacy.keywords.slice(0, 6).join(', ')}
Examples: ${fallacy.examples.slice(0, 3).map(ex => `"${ex}"`).join(', ')}
`).join('\n');

  // 3. Reemplazar placeholder
  return promptTemplate.replace('{{FALLACY_DESCRIPTIONS}}', fallacyDescriptions);
}
```

### Refactor propuesto

Para leer desde markdown en lugar de hardcode, necesitas:

1. ✅ **Crear el archivo markdown** (ya hecho)
2. ⏳ **Refactorizar `buildSystemPrompt()`** para leer desde archivo
3. ⏳ **Agregar manejo de errores** si el archivo no existe

## 🧪 Testing de Prompts

### Modo desarrollo

Para probar cambios en prompts sin rebuild:

1. Edita `fallacy-detection-system.md`
2. Guarda el archivo
3. El siguiente request API usará el nuevo prompt (no requiere restart en modo dev)

### Validación

Antes de hacer commit de cambios a prompts:

```bash
# Verificar que el placeholder existe
grep -q "{{FALLACY_DESCRIPTIONS}}" prompts/fallacy-detection-system.md && echo "✅ Placeholder OK"

# Contar palabras del prompt (útil para estimar tokens)
wc -w prompts/fallacy-detection-system.md
```

## 📊 Estimación de Tokens

| Sección | Tokens (aprox) |
|---------|----------------|
| System prompt base | ~500 |
| Fallacy descriptions (5 tipos) | ~300 |
| User argument (promedio) | ~50 |
| GPT response (con snippets) | ~1500 |
| **Total por request** | **~2350** |

**Límite GPT-5-mini**: 16K input + 16K output

## 🔄 Workflow de Actualización

### Para modificar el prompt:

1. **Edita el markdown**:
   ```bash
   code backend/prompts/fallacy-detection-system.md
   ```

2. **Prueba localmente**:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev

   # Terminal 2: Test
   curl -X POST http://localhost:3001/api/validate-fallacy \
     -H "Content-Type: application/json" \
     -d '{"argumentText": "We'\''ve always eaten meat"}'
   ```

3. **Documenta el cambio**:
   - Actualiza "Version History" en el markdown
   - Incrementa número de versión si es cambio mayor

4. **Commit**:
   ```bash
   git add backend/prompts/
   git commit -m "prompt: improve snippet specificity instructions"
   ```

## 🎓 Mejores Prácticas

### DO ✅

- Usa markdown para formatting (listas, headers, code blocks)
- Documenta el "por qué" de cada instrucción en comentarios
- Incluye ejemplos de input/output esperado
- Mantén el prompt modular (usa placeholders para partes dinámicas)
- Versiona cambios significativos

### DON'T ❌

- No uses lenguaje ambiguo ("try to...", "maybe...")
- No hagas el prompt excesivamente largo (>1000 palabras)
- No incluyas instrucciones contradictorias
- No hardcodees listas que cambian frecuentemente
- No omitas edge cases en las guidelines

## 📚 Recursos

- [OpenAI Best Practices for Prompting](https://platform.openai.com/docs/guides/prompt-engineering)
- [Azure OpenAI GPT-5 Model Card](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/models)
- [Prompt Engineering Guide](https://www.promptingguide.ai/)

## 🔮 Futuro

### Posibles mejoras:

- [ ] Agregar few-shot examples en carpeta `/examples/`
- [ ] Crear variantes de prompts para A/B testing
- [ ] Traducir prompts a español para modo bilingüe
- [ ] Agregar prompt para generar "counter-counter-arguments"
- [ ] Sistema de prompt chaining para argumentos complejos
