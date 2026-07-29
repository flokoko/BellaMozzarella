# Bella Mozzarella — Bug & Vulnerability Analysis

## CRITICAL

### 1. Race Condition: Mutation Refetch vs Poll Refetch
- **Datei:** `src/hooks/useListData.ts:144-164` (fetchAll guard) + `:257-374` (mutations)
- **Beschreibung:** `fetchAll` nutzt `isFetchingRef` als Guard gegen überlappende Fetches. Adaptive Polling ruft `fetchAll` alle 3-8s auf. Mutationen (toggle, delete, reorder) rufen nach dem Server-Write ebenfalls `fetchAll` auf. Wenn ein Poll-Fetch gerade läuft, wird der Mutation-Refetch durch den Guard blockiert — die UI zeigt dann veraltete Daten bis zum nächsten Poll-Intervall. Umgekehrt kann ein Poll-Fetch den optimistischen State mit Server-Daten überschreiben, bevor die Mutation bestätigt wurde.
- **Fix:** Mutation-Refetch sollte den Guard umgehen (z.B. durch einen `force`-Parameter) oder die Poll-Logik sollte pausieren, während eine Mutation pending ist. Alternativ: Real-Time Subscriptions statt Polling.

### 2. Datenkorruption in `handleRename` — keine Transaktionssicherheit
- **Datei:** `src/hooks/useListData.ts:443-461`
- **Beschreibung:** `handleRename` führt 5 sequentielle DB-Operationen aus: (1) neuen Participant inserten, (2-4) expenses/items/splits updaten, (5) alten Participant löschen. Wenn Schritt 2, 3 oder 4 fehlschlägt, existieren bereits zwei Participants (alt+neu) und die Referenzen in expenses/items/splits zeigen auf einen gelöschten Namen. Kein Rollback.
- **Fix:** Alle Schritte in eine einzelne Supabase RPC/Transaktion packen, oder vor dem Löschen des alten Participants prüfen, ob alle Updates erfolgreich waren. Im Fehlerfall den neuen Participant wieder löschen.

### 3. Datenkorruption in ExpenseScreen `handleSave` — Update-Pfad
- **Datei:** `src/components/ExpenseScreen.tsx:277-329`
- **Beschreibung:** Beim Update einer Expense werden zuerst die alten Splits gelöscht, dann neue eingefügt. Wenn das Insert fehlschlägt, versucht der Code ein Rollback durch Re-Insert der alten Splits. Wenn aber auch das Rollback fehlschlägt (Netzwerkfehler, DB-Constraint), bleibt die Expense ohne Splits zurück — die Abrechnung ist dann kaputt.
- **Fix:** Statt Delete+Insert: Alte und neue Splits vergleichen, nur Differenzen anwenden. Oder eine RPC nutzen, die atomar arbeitet.

### 4. Admin-Passwort im Client sichtbar
- **Datei:** `src/App.tsx:192-193`, `src/lib/supabase.ts:13`
- **Beschreibung:** Das Admin-Passwort wird aus der DB geladen (`list.admin_password`) und client-seitig mit der Eingabe verglichen (`password === list.admin_password`). Das Passwort ist damit im Klartext im Browser-Memory und in der Netzwerk-Response sichtbar. Jeder Teilnehmer kann die DevTools öffnen und das Admin-Passwort auslesen. Zusätzlich ist der Join-Code `BELLA26` hardcodiert im Client-Bundle.
- **Fix:** Passwort-Validierung serverseitig via RPC durchführen. Niemals das Admin-Passwort an den Client senden. Join-Code aus Environment-Variable lesen (ist bereits via `VITE_SUPABASE_*` gemacht, aber `LIST_JOIN_CODE` ist separat hardcodiert).

## HIGH

### 5. Stille Fetch-Fehler — keine User-Feedback
- **Datei:** `src/hooks/useListData.ts:50-142` (alle fetch-Funktionen)
- **Beschreibung:** Sämtliche fetch-Funktionen (`fetchItems`, `fetchCategories`, `fetchMeals`, etc.) loggen Fehler nur via `console.error`. Der User bekommt keinen Toast, keine Fehlermeldung. Wenn das Backend nicht erreichbar ist, sieht der User leere Listen ohne Erklärung.
- **Fix:** Fehler in einem zentralen Error-State sammeln und als Toast/Banner anzeigen. Mindestens: `toast('Daten konnten nicht geladen werden', 'error')`.

### 6. `Suspense fallback={null}` — leere weiße Fläche beim Screen-Wechsel
- **Datei:** `src/App.tsx:313-399`
- **Beschreibung:** Alle lazy-loaded Screens haben `fallback={null}`. Beim ersten Laden eines Screens (z.B. Einkaufsliste) sieht der User für ~200-500ms eine komplett leere Fläche — kein Spinner, kein Skeleton. Das wirkt wie ein Freeze/Absturz.
- **Fix:** `fallback={<SkeletonCard />}` oder einen zentrierten Spinner rendern.

### 7. Initiales Passwort im Placeholder sichtbar
- **Datei:** `src/components/JoinScreen.tsx:163`
- **Beschreibung:** `placeholder="Initial: BELLA26"` zeigt das Standard-Passwort jedem, der die Seite lädt. Jeder kann sich damit als neuer User registrieren (sofern die RLS das erlaubt).
- **Fix:** Placeholder auf `"Passwort"` ändern. Den Hint-Text darunter belassen (der ist bewusst sichtbar).

### 8. Keine Input-Längenvalidierung
- **Dateien:** `JoinScreen.tsx`, `DashboardScreen.tsx`, `MealPlanScreen.tsx`, `ExpenseScreen.tsx`
- **Beschreibung:** Keine der Texteingaben hat ein `maxLength`-Attribut oder client-seitige Längenprüfung. Namen, Notizen, Ausgaben-Beschreibungen können beliebig lang sein — potenziell DB-Constraints verletzen oder die UI sprengen.
- **Fix:** `maxLength` an allen Inputs setzen (Name: 50, Beschreibung: 200, Notiz: 500). Serverseitige Validierung in RLS/RPC ergänzen.

### 9. Memory Leak: Auto-Restore Session ohne Cleanup
- **Datei:** `src/hooks/useListData.ts:226-250`
- **Beschreibung:** Der `useEffect` für Auto-Restore nutzt dynamisches `import()` mit `.then()`-Chain. Wenn die Komponente unmountet bevor die Promises resolven, werden `setUserName`, `setParticipantId`, `setList` auf einer unmounted Komponente aufgerufen — React warnt in dev, im Production-Build potenziell undefiniertes Verhalten.
- **Fix:** Abort-Controller oder `mounted`-Ref im Cleanup setzen.

### 10. `handleRename` fügt neuen Participant OHNE Passwort ein
- **Datei:** `src/hooks/useListData.ts:450`
- **Beschreibung:** `handleRename` inserted einen neuen Participant via `supabase.from('participants').insert({ list_id, name })` — ohne `password`-Feld. Wenn die DB einen NOT NULL constraint auf `password` hat, schlägt das fehl. Wenn nicht, hat der umbenannte User kein Passwort mehr.
- **Fix:** Entweder das alte Passwort mitnehmen (via `select` vor dem Insert) oder die RPC `login_participant` für die Umbenennung nutzen.

## MEDIUM

### 11. Race Condition: Expense Splits Fetch
- **Datei:** `src/hooks/useListData.ts:212-223`
- **Beschreibung:** Expense Splits werden in einem separaten `useEffect` gefetcht, der von `expenses` abhängt. Wenn `fetchAll` neue Expenses lädt, triggert das den Splits-Fetch. Aber wenn kurz darauf eine Mutation die Expenses ändert, kann der Splits-Fetch noch mit alten Expense-IDs laufen und veraltete Splits setzen.
- **Fix:** Splits zusammen mit Expenses in `fetchExpenses` fetchen (JOIN oder zweiter Request im selben Promise).

### 12. `fireConfetti`: setTimeout ohne Cleanup
- **Datei:** `src/App.tsx:36-56`
- **Beschreibung:** Zwei `setTimeout` (200ms, 400ms) werden ohne Cleanup gestartet. Wenn der User innerhalb von 400ms die Seite verlässt oder den Tab wechselt, feuern die Timeouts trotzdem und rufen `confetti()` auf — potenziell Fehler im Console.
- **Fix:** Timeout-IDs speichern und im Cleanup des `useEffect` clearen.

### 13. Fehlende Accessibility-Labels
- **Dateien:** `ListScreen.tsx:164`, `MealPlanScreen.tsx:327-336`, `ExpenseScreen.tsx:608-617`, `BristolScreen.tsx:208-219`
- **Beschreibung:**
  - Checkboxen in ItemRow haben kein sichtbares Label — Screenreader sagen nur "checkbox unchecked".
  - Leere Meal-Cells sind Buttons nur mit Icon — kein Text für Screenreader.
  - Person-Chips in ExpenseScreen haben keinen `aria-pressed` State.
  - Bristol-Value-Picker Buttons haben Emoji+Zahl aber kein `aria-label`.
- **Fix:** `aria-label` an allen interaktiven Elementen ergänzen. Checkboxen mit `aria-labelledby` auf den Item-Namen verlinken.

### 14. Kein visuelles Feedback für offline-gequeueute Items
- **Datei:** `src/hooks/useListData.ts`, `src/hooks/useOfflineQueue.ts`
- **Beschreibung:** Wenn der User offline ist, werden Änderungen optimistisch im State gespeichert und in die Queue geschrieben. Es gibt aber keine visuelle Unterscheidung zwischen "gespeichert" und "wartet auf Sync". Der User könnte denken, seine Änderung sei bereits auf dem Server.
- **Fix:** Einen `synced`-Status pro Item tracken und visuell darstellen (z.B. grauer Rand/Opacity für pending Items).

### 15. Schwache Passwort-Mindestlänge (3 Zeichen)
- **Datei:** `src/components/SettingsScreen.tsx:170,187`
- **Beschreibung:** `newPw.length < 3` ist die einzige Passwort-Validierung. 3 Zeichen sind trivial zu brute-forcen.
- **Fix:** Mindestens 6 Zeichen, besser 8. Serverseitig in der RPC ebenfalls prüfen.

### 16. `canvas-confetti` nicht dynamisch importiert
- **Datei:** `src/App.tsx:3`
- **Beschreibung:** `canvas-confetti` (~15KB gzipped) wird statisch importiert, obwohl es nur beim Check-all-Items-Event genutzt wird (selten).
- **Fix:** Dynamischen Import: `const { default: confetti } = await import('canvas-confetti')` nur wenn benötigt.

## LOW

### 17. Unnötige Re-Renders durch flache useListData-Destrukturierung
- **Datei:** `src/App.tsx:63-72`
- **Beschreibung:** App destructured ~30 Werte aus `useListData()`. Jede State-Änderung in useListData (z.B. ein Item-Toggle) verursacht einen Re-Render von App und aller Kind-Komponenten, auch wenn der geänderte Wert im aktuellen Tab nicht sichtbar ist.
- **Fix:** State in kleinere Contexts aufteilen oder `useMemo`/`React.memo` für die Screen-Komponenten nutzen.

### 18. `trendData` Neuberechnung bei jedem Render
- **Datei:** `src/components/BristolScreen.tsx:154-172`
- **Beschreibung:** `trendData` iteriert 14 Tage und filtert alle Einträge pro Tag — bei vielen Einträgen teuer. Wird bei jedem Render neu berechnet, auch wenn sich `entries` nicht geändert hat.
- **Fix:** `useMemo` mit `[entries]` als Dependency (ist bereits so — aber die Berechnung selbst könnte optimiert werden durch Voraggregation).

### 19. WeatherWidget: Kein Retry bei API-Fehlern
- **Datei:** `src/components/WeatherWidget.tsx:84-120`
- **Beschreibung:** Wenn die Open-Meteo API nicht erreichbar ist, wird der Fehler einmalig angezeigt. Es gibt keinen Retry-Button oder automatischen Retry.
- **Fix:** Retry-Button im Error-State anzeigen, oder automatischen Retry mit exponentiellem Backoff.

### 20. `useDragReorder`: Pointer Capture Leak bei Unmount während Drag
- **Datei:** `src/hooks/useDragReorder.ts:39,75`
- **Beschreibung:** `setPointerCapture` wird in `handlePointerDown` aufgerufen. Wenn die Komponente unmountet während ein Drag aktiv ist, wird `releasePointerCapture` nie aufgerufen. Der Browser behält den Pointer-Capture, was zu seltsamen Verhalten auf der Seite führen kann.
- **Fix:** `useEffect` Cleanup, der `releasePointerCapture` aufruft, wenn `dragState.draggingId` gesetzt ist.

---

## Zusammenfassung nach Kategorie

| Kategorie | Critical | High | Medium | Low |
|-----------|----------|------|--------|-----|
| Race Conditions | 2 | — | 1 | — |
| Error Handling | 1 | 1 | — | 1 |
| Memory Leaks | — | 1 | 1 | 1 |
| Sicherheit | 1 | 2 | 1 | — |
| UX | — | 2 | 1 | — |
| Performance | — | — | 1 | 2 |
| Accessibility | — | — | 1 | — |
| Edge Cases | — | 1 | — | — |

**Top 3 Quick Wins (niedriger Aufwand, hohe Wirkung):**
1. `Suspense fallback={null}` → Skeleton/Spinner (Fix #6)
2. `placeholder="Initial: BELLA26"` → "Passwort" (Fix #7)
3. Stille Fetch-Fehler → Toast (Fix #5)
