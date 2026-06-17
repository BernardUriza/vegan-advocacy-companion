# 🌍 Testing i18n (Internationalization)

La extensión ahora soporta **inglés** y **español** usando la API nativa de Chrome `chrome.i18n`.

## ✅ Cómo probar la extensión con i18n

### 1. Recargar la extensión en Chrome

1. Abre `chrome://extensions/`
2. Encuentra "Vegan Advocacy Companion"
3. Click en el botón **🔄 Reload**

### 2. Verificar que carga en INGLÉS (default)

La extensión debería mostrarse en inglés por defecto:

- **Header**: "🌱 Vegan Advocacy"
- **Button**: "✓ Validate My Identification"
- **Snippets**: "Educational - Historical Context", etc.
- **Progress**: "Fallacies Identified:", "Total XP:"

### 3. Cambiar Chrome a ESPAÑOL

**Opción A - Cambiar idioma de Chrome (recomendado):**

1. Ve a `chrome://settings/languages`
2. Click en "Add languages"
3. Busca y agrega "Español"
4. Click en los 3 puntos junto a "Español" → **"Move to the top"**
5. Reinicia Chrome completamente (Quit + Reopen)
6. Recarga la extensión (`chrome://extensions/` → Reload)

**Opción B - Usar perfil temporal en español:**

```bash
# Crear perfil de Chrome forzado a español
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --user-data-dir=/tmp/chrome-es \
  --lang=es \
  --load-extension=/Users/bernardurizaorozco/Documents/vegan-advocacy-companion
```

### 4. Verificar que carga en ESPAÑOL

La extensión ahora debería mostrarse en español:

- **Header**: "🌱 Activismo Vegano"
- **Button**: "✓ Validar Mi Identificación"
- **Snippets**: "Educativo - Contexto Histórico", etc.
- **Progress**: "Falacias Identificadas:", "XP Total:"

---

## 📁 Archivos de traducción

| Idioma | Archivo | Ubicación |
|--------|---------|-----------|
| 🇺🇸 Inglés | `_locales/en/messages.json` | Default |
| 🇪🇸 Español | `_locales/es/messages.json` | Cuando Chrome está en español |

---

## 🔧 Cómo agregar más idiomas

1. Crear carpeta: `_locales/fr/` (por ejemplo, francés)
2. Copiar `_locales/en/messages.json` a `_locales/fr/messages.json`
3. Traducir todos los valores de `"message"` al nuevo idioma
4. Chrome automáticamente usará el idioma correcto según la configuración del navegador

---

## ⚠️ Nota sobre la webapp (localhost:3001)

**La webapp NO tiene traducciones funcionales** porque:
- `chrome.i18n` solo existe en Chrome Extensions
- La webapp muestra las **keys** (ej: `"section_identify_title"`) en lugar del texto traducido
- Esto es esperado y está OK para desarrollo

**Para habilitar i18n en la webapp necesitarías:**
- Cargar los JSON manualmente con `fetch()`
- O usar una biblioteca como `i18next`
- Pero para el MVP, **solo la extensión necesita i18n**

---

## 🎯 Test checklist

- [ ] Extensión carga sin errores en `chrome://extensions/`
- [ ] Aparece en inglés por defecto
- [ ] Botón de validar muestra texto traducido
- [ ] Los 5 snippets muestran títulos traducidos
- [ ] Sección de progreso muestra labels traducidos
- [ ] Cambiar Chrome a español funciona
- [ ] Extensión se recarga en español automáticamente
- [ ] Todas las traducciones son correctas y naturales
- [ ] No hay keys sin traducir (ej: `"button_copy"` debe mostrar "📋 Copiar")

---

## 🐛 Troubleshooting

**Problema**: La extensión sigue en inglés después de cambiar Chrome a español

**Solución**:
1. Verifica que español sea el **primer idioma** en `chrome://settings/languages`
2. Reinicia Chrome completamente (Quit → Reopen)
3. Recarga la extensión en `chrome://extensions/`

**Problema**: Aparecen keys en lugar de texto (ej: `"header_title"`)

**Solución**:
- Esto es normal en la webapp (localhost:3001)
- En la extensión, verifica que existe `_locales/en/messages.json` y `_locales/es/messages.json`
- Verifica que `manifest.json` tiene `"default_locale": "en"`

---

## 📚 Referencias

- [Chrome i18n API Documentation](https://developer.chrome.com/docs/extensions/reference/i18n/)
- [Supported Locales](https://developer.chrome.com/docs/webstore/i18n/#choosing-locales-to-support)
