# Testing Guide - Vegan Advocacy Companion

## Quick Start: Load Extension in Chrome

### 1. Load the Extension

1. Open Chrome and navigate to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the folder: `/Users/bernardurizaorozco/Documents/vegan-advocacy-companion`
5. The extension should appear in your extensions list

### 2. Open the Side Panel

**Method 1: From any webpage**
- Click the puzzle icon (🧩) in Chrome toolbar
- Find "Vegan Advocacy Companion"
- Click on it to open the side panel

**Method 2: Right-click the extension icon**
- Right-click the extension icon
- Select "Open side panel"

### 3. Verify Backend is Running

Make sure the backend server is running:
```bash
cd /Users/bernardurizaorozco/Documents/vegan-advocacy-companion/backend
npm run dev
```

Should show: `✓ Ready in [time]ms` on `http://localhost:3001`

---

## Test Cases

### Test Case 1: Positive Detection (Contains Fallacy)

**Input:**
```
Humans have always eaten meat, it's tradition. Our ancestors hunted animals for thousands of years.
```

**Expected Result:**
- ✅ Validation succeeds
- Shows: "¡Identificación correcta! +[XP] XP"
- Confidence: ~90-95%
- Keywords highlighted: "always eaten meat", "tradition", "ancestors"
- XP bar increases
- Current level/progress updates

---

### Test Case 2: Negative Detection (No Fallacy)

**Input:**
```
Animal agriculture contributes 14.5% of global greenhouse gas emissions according to the UN FAO.
```

**Expected Result:**
- ❌ Validation shows not a fallacy
- Shows: "Esto no parece ser Appeal to Tradition"
- Explanation: "This is a factual claim with citation, not an appeal to tradition"
- No XP awarded
- Progress remains unchanged

---

### Test Case 3: Edge Case (Ambiguous)

**Input:**
```
Eating meat is natural, all carnivores do it.
```

**Expected Result:**
- Could go either way (borderline Naturalistic Fallacy, not Appeal to Tradition)
- Should show low confidence (~30-50%)
- Clear explanation of why it's ambiguous

---

## Debugging Tips

### If Extension Doesn't Load:
```bash
# Check for syntax errors in manifest
cat /Users/bernardurizaorozco/Documents/vegan-advocacy-companion/manifest.json | jq .

# Check Chrome version (must be 114+)
# Open: chrome://version/
```

### If Side Panel is Blank:
1. Open Chrome DevTools on the side panel:
   - Right-click in the side panel → "Inspect"
2. Check Console for JavaScript errors
3. Verify all files exist:
   ```bash
   ls -la /Users/bernardurizaorozco/Documents/vegan-advocacy-companion/sidepanel/
   ```

### If API Calls Fail:
1. Check backend is running: `curl http://localhost:3001/api/health`
2. Check Network tab in DevTools for CORS errors
3. Verify API_URL in `script.js` matches backend port (3001)

### If XP Doesn't Save:
1. Open Chrome DevTools → Application → Local Storage
2. Look for key: `vegan_advocacy_progress`
3. Should contain JSON with: `{ level: 1, xp: 0, totalFallaciesFound: 0 }`

---

## Manual Testing Checklist

- [ ] Extension loads without errors in `chrome://extensions/`
- [ ] Side panel opens successfully
- [ ] Progress bar displays correctly (Level 1, 0 XP)
- [ ] Can paste argument text into textarea
- [ ] "Validar Identificación" button is clickable
- [ ] API call completes (check Network tab)
- [ ] Validation result displays (✅ or ❌)
- [ ] XP increases on correct identification
- [ ] Progress persists after closing/reopening side panel
- [ ] All 5 snippet cards display
- [ ] Can copy snippets to clipboard
- [ ] Fallback keyword detection works if API is down

---

## Chrome DevTools Inspection

### Console Logs to Monitor:
```javascript
// Should see on successful validation:
"✅ Validación exitosa:"
{ isValid: true, confidence: 95, ... }
"🎯 ¡Identificación correcta! +[XP] XP"

// Should see on XP award:
"Progreso guardado:", { level: 1, xp: 85, ... }
```

### Network Requests to Monitor:
```
POST http://localhost:3001/api/validate-fallacy
Status: 200 OK
Response: { isValid: true, confidence: 95, ... }
```

---

## Known Limitations (MVP)

- No database sync (progress only in LocalStorage)
- Only validates "Appeal to Tradition" (not other 6 fallacy types)
- No Facebook integration yet (manual copy/paste)
- No leaderboard or badges
- No custom snippet generation (only 5 pre-written)
- XP calculation is fixed (+85 for correct, 0 for incorrect)

---

## Success Criteria

✅ **MVP is successful if:**
1. Extension loads and side panel opens
2. User can paste an argument and validate it
3. GPT-5-mini correctly identifies Appeal to Tradition
4. XP is awarded and persisted
5. Progress bar updates visually
6. Snippets can be copied

🎉 **Ready for beta testing with 2-3 users!**
