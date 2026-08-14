# Code Review: HEAD~3..HEAD (3 Commits)

**Commits:**
- aadd85e feat: search in dashboard notes
- 71fa95a feat: csv export for shopping and bring lists
- 32e7eb0 feat: search in meal plan

**Geprüfte Dateien:** MealPlanScreen.tsx/css, DashboardScreen.tsx/css, ListScreen.tsx/css, BringScreen.tsx/css

**TypeScript:** `tsc --noEmit` läuft fehlerfrei. Keine `any`, keine unused vars/imports.

**React Rules of Hooks:** Alle Hooks (useState, useMemo, useEffect, useCallback) stehen vor dem ersten `return` in jeder Komponente. Kein Hook nach bedingtem Return. Die bedingten Returns (z.B. `if (isLoading) return ...` in ListScreen) kommen erst nach allen Hooks. Kein Verstoß.

---

## Mittel

### 1. ListScreen: CSV-Export ignoriert Suchfilter
**Datei:** `src/components/ListScreen.tsx`, Zeile 259
**Problem:** `handleExportCSV` exportiert `items` (alle Items) statt `searchFiltered` (die gefilterte Liste). Der BringScreen exportiert korrekt `filtered`. Ein User der sucht und dann exportiert, bekommt unerwartet alle Items.
**Fix:**
```tsx
// Zeile 259: items → searchFiltered
const rows = searchFiltered.map(i => [
```

### 2. Hardcoded `#009246` statt CSS-Variable — Theme-Bug im Dark-Mode
**Dateien:** `src/components/BringScreen.css` Zeile 63+71, `src/components/ListScreen.css` Zeile 62+67
**Problem:** `.bring-export-btn` und `.list-export-btn` verwenden hardcoded `#009246`. Im Dark-Mode ändert sich `--accent` zu `#00b35e`, aber die hardcoded Werte bleiben `#009246` — die Buttons haben im Dark-Mode das falsche (zu dunkle) Grün.
**Fix:**
```css
/* BringScreen.css */
.bring-export-btn {
  border: 2px solid var(--accent);   /* statt #009246 */
  color: var(--accent);              /* statt #009246 */
}
.bring-export-btn:hover {
  background: var(--accent);         /* statt #009246 */
  border-color: var(--accent);       /* statt #009246 */
}

/* ListScreen.css */
.list-export-btn {
  border-color: var(--accent);      /* statt #009246 */
  color: var(--accent);              /* statt #009246 */
}
.list-export-btn:hover {
  background: var(--accent);        /* statt #009246 */
  border-color: var(--accent);      /* statt #009246 */
}
```

### 3. Hardcoded `rgba(0, 146, 70, 0.12)` in DashboardScreen — Theme-Inkonsistenz
**Datei:** `src/components/DashboardScreen.css`, Zeile 285
**Problem:** `.dash-notes-search:focus` verwendet `rgba(0, 146, 70, 0.12)` hardcoded. Im Dark-Mode ist `--accent-light` = `rgba(0, 179, 94, 0.12)`, aber der hardcoded Wert ändert sich nicht. Die andere Such-Inputs (`.mealplan-search-input:focus`, `.bring-search-input:focus`) verwenden korrekt `var(--accent-light)`.
**Fix:**
```css
.dash-notes-search:focus {
  border-color: var(--italian-green);
  box-shadow: 0 0 0 3px var(--accent-light);   /* statt rgba(0, 146, 70, 0.12) */
}
```

---

## Klein

### 4. `.bring-export-btn` dupliziert Button-Styles statt Modifier-Muster
**Datei:** `src/components/BringScreen.css`, Zeile 60-77
**Problem:** `.bring-export-btn` definiert eigene `width`, `padding`, `border-radius`, `font-family`, `cursor`, `transition` etc. — statt als Modifier für `bring-filter-btn` (wie `.list-export-btn` ein Modifier für `list-top-bar-btn` ist). Das ist CSS-Duplikation und inkonsistent mit dem ListScreen-Muster.
**Fix:** Button als `bring-filter-btn bring-export-btn` klassifizieren und nur `border-color`/`color`/`background` im CSS überschreiben, analog zu `.list-export-btn`.

### 5. `getMeal` wird in Render-Logik umgangen
**Datei:** `src/components/MealPlanScreen.tsx`, Zeile 92 vs. 524+535
**Problem:** Die Render-Logik verwendet jetzt `filteredMeals.find(m => m.day === day && m.meal_type === type)` direkt (Zeilen 524, 535), während `getMeal(day, type)` (Zeile 92) noch in `planIdea` (Zeile 251) verwendet wird. `getMeal` sucht in `meals` (ungefiltert), die Render-Logik sucht in `filteredMeals`. Das ist funktional korrekt (`planIdea` soll ungefiltert prüfen), aber inkonsistent. Kein Bug — nur stilistische Inkonsistenz.
**Fix:** Optional — `getMeal` umbenennen zu `getMealUnfiltered` für Klarheit, oder die gefilterte Suche in eine Hilfsfunktion auslagern.

### 6. CSV-Export: Kein Escaping von Kommata in Header-Zeile
**Dateien:** `src/components/ListScreen.tsx` Zeile 261, `src/components/BringScreen.tsx` Zeile 387
**Problem:** Die Header-Zeile wird mit `headers.join(',')` geschrieben — ohne Anführungszeichen. Die Datenzeilen werden korrekt mit `\"${c.replace(/\"/g, '\"\"')}\"` eingewickelt. Aktuell sind alle Header-Werte komma-frei, also kein akuter Bug. Aber wenn später ein Header mit Komma hinzukommt, bricht das CSV.
**Fix:** Konsistent alle Zeilen behandeln:
```tsx
const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
```

---

## Zusammenfassung

Die Änderungen sind solide: TypeScript kompiliert sauber, keine Hook-Verstöße, keine Regressionen (nur die erlaubten 8 Dateien wurden angefasst). Die Such-Logik ist korrekt implementiert (case-insensitive, leere Tage/Ideen werden ausgeblendet, CSV hat BOM). 

Die drei mittleren Probleme sind: (1) der ListScreen-Export ignoriert den aktiven Suchfilter, (2+3) hardcoded Farbwerte brechen im Dark-Mode. Alle sind kleine, lokalisierte Fixes.