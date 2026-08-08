# Bella Mozzarella — Optimierungs-Review

Vollständige Code-Analyse aller 60+ Quelldateien im `src/`-Verzeichnis.
25 Findings mit Schweregrad, Datei-Referenz, Problembeschreibung und konkretem Fix.

---

### 1. [Hoch] useListData.ts — God Hook mit 638 Zeilen und 15+ State-Variablen

**Datei:** `src/hooks/useListData.ts` (Zeilen 20-638)

**Problem:** Der Hook `useListData` verwaltet den gesamten Applikations-Status: 15 `useState`-Aufrufe, 8 Fetch-Funktionen, 7 Mutations-Funktionen, Realtime-Sync, Offline-Queue-Integration, Undo-Logic, Join/Leave/Rename. Jede Komponente, die auch nur eine einzige Funktion braucht, triggert Re-Renders durch alle State-Änderungen. Der Hook ist 638 Zeilen lang und praktisch unwartbar.

**Fix:** In thematisch getrennte Hooks zerlegen:

```typescript
// src/hooks/useShoppingItems.ts — nur shoppingItems + toggle/delete/undo
export function useShoppingItems(listId: string | null) { ... }

// src/hooks/useBringItems.ts — nur bringItems + toggle/delete
export function useBringItems(listId: string | null) { ... }

// src/hooks/useExpenses.ts — expenses + splits + balance
export function useExpenses(listId: string | null) { ... }

// src/hooks/useNotes.ts — notes + reorder + favorite
export function useNotes(listId: string | null) { ... }

// src/hooks/useAuth.ts — userName + list + participantId + join/leave/rename
export function useAuth() { ... }

// src/hooks/useFetchAll.ts — koordiniert alle fetch-Funktionen
export function useFetchAll(listId: string | null) { ... }
```

App.tsx importiert dann nur die Hooks, die es braucht.

---

### 2. [Mittel] Duplizierte WEATHER_CODE_MAP in zwei Dateien

**Datei:** `src/components/WeatherWidget.tsx` (Zeilen 25-54) und `src/components/WeatherScreen.tsx` (Zeilen 50-79)

**Problem:** Beide Dateien definieren identische 30-Eintrag `WEATHER_CODE_MAP`-Objekte und identische `getWeatherInfo`-, `fmtDay`-Funktionen. ~55 Zeilen Code-Duplikation. Bei einer Änderung müssen beide Dateien manuell synchron gehalten werden.

**Fix:** In ein gemeinsames Modul extrahieren:

```typescript
// src/lib/weatherCodes.ts
export const WEATHER_CODE_MAP: Record<number, { emoji: string; desc: string }> = {
  0: { emoji: '☀️', desc: 'Sonnig' },
  // ... alle 30 Einträge
}

export function getWeatherInfo(code: number) {
  return WEATHER_CODE_MAP[code] ?? { emoji: '🌡️', desc: 'Unbekannt' }
}

// In WeatherWidget.tsx und WeatherScreen.tsx:
import { WEATHER_CODE_MAP, getWeatherInfo } from '../lib/weatherCodes'
```

---

### 3. [Hoch] ExpenseScreen.tsx — 898-Zeilen Monolith

**Datei:** `src/components/ExpenseScreen.tsx` (Zeilen 41-898)

**Problem:** Die Komponente verwaltet Form-State (15 useState), Settlement-Berechnung, Matrix-Berechnung, CSV-Export, Inline-Kategorie-Editor und die gesamte Listen-Darstellung in einer einzigen 898-Zeilen-Datei. Die `handleSave`-Funktion allein ist 100+ Zeilen.

**Fix:** In Sub-Komponenten zerlegen:

```typescript
// src/components/ExpenseForm.tsx — Formular mit allen State-Variablen
// src/components/ExpenseList.tsx — Listen-Darstellung mit Gruppierung
// src/components/ExpenseSettlement.tsx — Abrechnung + Ausgleichszahlungen
// src/components/ExpenseMatrix.tsx — Matrix-Tabelle
// src/components/ExpenseCategoryEditor.tsx — Inline-Kategorie-Editor
// src/lib/settlement.ts — settlement-Berechnung auslagern (pure function)
```

ExpenseScreen.tsx wird zum Orchestrierungs-Wrapper (~50 Zeilen).

---

### 4. [Mittel] Duplizierte BRISTOL_COLORS und BRISTOL_EMOJIS

**Datei:** `src/components/BristolScreen.tsx` (Zeilen 25-45) und `src/components/BristolWidget.tsx` (Zeilen 95-103)

**Problem:** BristolScreen definiert `BRISTOL_COLORS`, `BRISTOL_EMOJIS`, `BRISTOL_ADJECTIVES` als Konstanten. BristolWidget definiert `BRISTOL_COLORS` und `BRISTOL_EMOJIS` erneut — identisch, aber separat. Bei Änderung einer Farbe müssen beide Dateien manuell synchron gehalten werden.

**Fix:**

```typescript
// src/lib/bristolConstants.ts
export const BRISTOL_COLORS: Record<number, string> = {
  1: '#8B4513', 2: '#A0522D', 3: '#D2691E', 4: '#009246',
  5: '#9ACD32', 6: '#FFD700', 7: '#FF6347', 13: '#8B4513',
}

export const BRISTOL_EMOJIS: Record<number, string> = {
  1: '🪨', 2: '🌭', 3: '🥨', 4: '🍌',
  5: '🍦', 6: '🥣', 7: '💧', 13: '💩',
}

export const BRISTOL_ADJECTIVES: Record<number, string> = {
  1: 'klumpig', 2: 'wurstartig', 3: 'rissig', 4: 'glatt',
  5: 'weich', 6: 'breiig', 7: 'flüssig', 13: 'Plasma',
}

export const BRISTOL_VALUES = [1, 2, 3, 4, 5, 6, 7, 13]
```

Beide Komponenten importieren aus `../lib/bristolConstants`.

---

### 5. [Hoch] Offline-Queue Retry: Vollständige Code-Duplikation des Supabase-Switch

**Datei:** `src/hooks/useOfflineQueue.ts` (Zeilen 106-162)

**Problem:** Der gesamte `if (op.type === 'rpc') ... else if (op.type === 'insert') ... else if (op.type === 'update') ... else if (op.type === 'delete')`-Block wird zweimal geschrieben: einmal im ersten Versuch (Zeilen 107-125) und erneut im Retry-Loop (Zeilen 134-152). Das sind ~45 Zeilen identischer Code.

**Fix:** In eine Hilfsfunktion extrahieren:

```typescript
async function executeOp(op: QueuedOp): Promise<void> {
  if (op.type === 'rpc') {
    const { error } = await supabase.rpc(op.rpcName!, op.payload)
    if (error) throw error
  } else if (op.type === 'insert') {
    const { error } = await supabase.from(op.table).insert(op.payload)
    if (error) throw error
  } else if (op.type === 'update') {
    const { error } = await supabase.from(op.table).update(op.payload).eq(op.filterColumn!, op.filterValue!)
    if (error) throw error
  } else if (op.type === 'delete') {
    const { error } = await supabase.from(op.table).delete().eq(op.filterColumn!, op.filterValue!)
    if (error) throw error
  }
}

// Verwendung im flush-Loop:
try {
  await executeOp(op)
} catch {
  let retries = 0
  while (retries < 2) {
    retries++
    await new Promise(r => setTimeout(r, 1000 * Math.pow(2, retries - 1)))
    try {
      await executeOp(op)
      break
    } catch (e) {
      lastError = e
    }
  }
  if (lastError) opError = true
}
```

---

### 6. [Hoch] checkConnectivity — AbortController wird erstellt aber nie an fetch übergeben

**Datei:** `src/hooks/useOfflineQueue.ts` (Zeilen 39-49)

**Problem:** Die `checkConnectivity`-Funktion erstellt einen `AbortController` und setzt einen 5-Sekunden-Timeout, aber das `signal` wird nie an die Supabase-Query übergeben. Der `clearTimeout` wird zwar aufgerufen, aber die Query kann unbegrenzt hängen — der AbortController macht nichts.

```typescript
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const { error } = await supabase.from('participants').select('id').limit(1).maybeSingle()
    // ^ Kein signal: controller.signal übergeben!
    clearTimeout(timeout)
    return !error
  } catch {
    return false
  }
}
```

**Fix:** Supabase unterstützt `abortSignal` im Options-Objekt:

```typescript
async function checkConnectivity(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const { error } = await supabase
      .from('participants')
      .select('id')
      .limit(1)
      .maybeSingle({ abortSignal: controller.signal })
    clearTimeout(timeout)
    return !error
  } catch {
    return false
  }
}
```

Alternativ kann der fetch-Wrapper in `supabase.ts` das Signal injizieren.

---

### 7. [Mittel] logger.ts — O(n²) localStorage-Zugriffe bei jedem logError

**Datei:** `src/lib/logger.ts` (Zeilen 34-46)

**Problem:** Jeder Aufruf von `logError` liest das gesamte Log-Array aus localStorage (`getLogs()`), parst JSON, fügt einen Eintrag hinzu und schreibt zurück (`saveLogs()`). Bei Fehlern in schneller Folge (z.B. Realtime-Sync Fehler-Loop) wird bei jedem Fehler das gesamte Array gelesen, geparst und serialisiert — O(n) pro Aufruf, O(n²) insgesamt bei n Fehlern.

**Fix:** Buffer mit Batch-Write:

```typescript
let logBuffer: LogEntry[] = []
let flushTimer: ReturnType<typeof setTimeout> | null = null

function flushLogs() {
  if (logBuffer.length === 0) return
  try {
    const existing = getLogs()
    const combined = [...existing, ...logBuffer].slice(-MAX_LOGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combined))
    logBuffer = []
  } catch { /* ignore */ }
}

export function logError(message: string, data?: unknown) {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'error',
    message,
    data,
    stack: new Error().stack,
  }
  console.error(`[${entry.timestamp}] ${message}`, data)
  logBuffer.push(entry)
  if (!flushTimer) {
    flushTimer = setTimeout(() => { flushTimer = null; flushLogs() }, 1000)
  }
}
```

---

### 8. [Mittel] Ignorierte Fehler bei mehreren Supabase-Aufrufen

**Datei:** `src/components/ListScreen.tsx` (Zeile 244), `src/components/DashboardScreen.tsx` (Zeilen 125-150), `src/components/ExpenseScreen.tsx` (Zeile 388)

**Problem:** Mehrere Supabase-Aufrufe ignorieren Fehler vollständig:

- `ListScreen.tsx` Zeile 244: `await supabase.rpc('batch_delete_items', ...)` — kein Error-Check, kein Toast
- `DashboardScreen.tsx` Zeile 143: `const { error } = await supabase.from('notes').delete()` — error wird gecheckt, aber kein Rollback der optimistic UI
- `ExpenseScreen.tsx` Zeile 388: `await supabase.from('expense_splits').delete().eq(...)` — Fehler beim Split-Löschen wird ignoriert, das Expense wird trotzdem gelöscht

**Fix:** Konsistente Fehlerbehandlung:

```typescript
// ListScreen.tsx
const handleDeleteChecked = () => {
  if (checkedItems.length === 0) return
  confirm('Alle erledigten Items löschen?', async () => {
    const { error } = await supabase.rpc('batch_delete_items', { item_ids: checkedItems.map(i => i.id) })
    if (error) {
      toast(`Fehler beim Löschen: ${error.message}`, 'error')
      return
    }
    onItemChange?.()
  })
}

// ExpenseScreen.tsx — splits zuerst löschen, nur fortfahren wenn erfolgreich
const handleDelete = (expense: Expense) => {
  confirm(`"${expense.description}" wirklich löschen?`, async () => {
    const { error: splitErr } = await supabase.from('expense_splits').delete().eq('expense_id', expense.id)
    if (splitErr) {
      toast(`Fehler beim Löschen der Aufteilung: ${splitErr.message}`, 'error')
      return
    }
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) {
      toast(`Fehler beim Löschen: ${error.message}`, 'error')
      return
    }
    navigator.vibrate?.(10)
    onExpensesChange()
  })
}
```

---

### 9. [Mittel] App.tsx — 7 einzelne Fetch-Aufrufe statt fetchAll nach Sync

**Datei:** `src/App.tsx` (Zeilen 159-166)

**Problem:** Nach erfolgreicher Offline-Queue-Synchronisierung werden 7 einzelne `fetch*`-Aufrufe gestartet statt `fetchAll`:

```typescript
if (list) {
  fetchItems(list.id, 'shopping')
  fetchItems(list.id, 'bring')
  fetchCategories(list.id)
  fetchMeals(list.id)
  fetchNotes(list.id)
  fetchExpenses(list.id)
  fetchParticipants(list.id)
}
```

Diese 7 Aufrufe werden nicht durch `fetchAll` koordiniert — kein `isFetchingRef`-Guard, kein `isLoading`-Management, kein `Promise.all`.

**Fix:**

```typescript
if (list) {
  fetchAll(list.id, true)  // force=true umgeht den Guard
}
```

---

### 10. [Mittel] fetchItems hängt von userName ab — unnötige Callback-Rekreation

**Datei:** `src/hooks/useListData.ts` (Zeilen 56-99)

**Problem:** `fetchItems` ist ein `useCallback` mit `userName` in der Dependency-Liste, weil die Push-Notification-Logik (Zeilen 81-93) `userName` braucht. Jede Änderung von `userName` (z.B. durch Rename) rekombiniert `fetchItems`, was eine Kaskade auslöst: `batchToggleShoppingItems`, `toggleShoppingItem`, `deleteShoppingItem`, `undoDelete`, `toggleBringItem`, `deleteBringItem`, `reorderItems` und `fetchAll` hängen alle von `fetchItems` ab und werden ebenfalls rekombiniert.

**Fix:** userName in einem Ref halten, nicht in der Dependency:

```typescript
const userNameRef = useRef(userName)
useEffect(() => { userNameRef.current = userName }, [userName])

const fetchItems = useCallback(async (listId: string, listType: ListType) => {
  // ... in der Push-Notification-Logik:
  const newItems = items.filter(i => !prevIds.has(i.id) && i.created_by !== userNameRef.current)
  // ...
}, [])  // keine userName-Abhängigkeit mehr
```

---

### 11. [Mittel] ExpenseScreen — Kategorie-Operationen umgehen Offline-Queue

**Datei:** `src/components/ExpenseScreen.tsx` (Zeilen 567-618)

**Problem:** Der Inline-Kategorie-Editor in ExpenseScreen macht direkte `supabase.from('categories')`-Aufrufe (update, delete, insert) ohne die `useCategories`-Hook und ohne Offline-Queue. Alle anderen Kategorie-Operationen (ListScreen, BringScreen, SettingsScreen) nutzen korrekt die `useCategories`-Hook. Offline-Benutzer können Ausgaben-Kategorien nicht anlegen/ändern/löschen.

**Fix:**

```typescript
// ExpenseScreen.tsx — useCategories Hook nutzen statt direkter supabase-Calls
const { updateCategory, deleteCategory, addCategory } = useCategories(onCategoriesChange)

// Im Inline-Editor:
// Statt: await supabase.from('categories').update({ name: newName }).eq('id', cat.id)
// Jetzt: updateCategory(cat.id, { name: newName })

// Statt: await supabase.from('categories').delete().eq('id', cat.id)
// Jetzt: deleteCategory(cat.id)

// Statt: await supabase.from('categories').insert({ ... })
// Jetzt: addCategory(listId, 'expense', maxOrder + 1)  // addCategory muss listType 'expense' unterstützen
```

---

### 12. [Mittel] DashboardScreen — Notiz-Operationen umgehen Offline-Queue

**Datei:** `src/components/DashboardScreen.tsx` (Zeilen 122-181)

**Problem:** Alle Notiz-CRUD-Operationen (`handleSave`, `handleDelete`, `handleUpdate`) rufen direkt `supabase.from('notes')` auf. Im Gegensatz zu Einkaufslisten-Items, die über `useListData` laufen und Offline-Queue-Support haben, funktionieren Notizen offline nicht.

**Fix:** Notiz-Operationen in `useListData` (oder einen separaten `useNotes`-Hook) mit Offline-Queue-Support verschieben:

```typescript
// In useListData.ts:
const addNote = useCallback(async (listId: string, title: string | null, content: string) => {
  if (isOnline) {
    const { error } = await supabase.from('notes').insert({ list_id: listId, title, content, created_by: userName })
    if (error) { logError('addNote error:', error); return }
  } else {
    enqueue({ type: 'insert', table: 'notes', payload: { list_id: listId, title, content, created_by: userName } })
  }
  fetchNotes(listId)
}, [isOnline, enqueue, userName, fetchNotes])

// Ähnlich für deleteNote und updateNote
```

DashboardScreen ruft dann `addNote`, `deleteNote`, `updateNote` aus dem Hook auf.

---

### 13. [Mittel] MealPlanScreen — Alle Operationen umgehen Offline-Queue

**Datei:** `src/components/MealPlanScreen.tsx` (Zeilen 98-204)

**Problem:** Alle Meal- und MealIdea-Operationen (`saveMeal`, `deleteMeal`, `addIdea`, `deleteIdea`, `planIdea`) rufen direkt Supabase auf. Offline-Benutzer können den Essensplan nicht bearbeiten.

**Fix:** Meal-Operationen in einen `useMeals`-Hook mit Offline-Queue-Support auslagern, analog zu `useListData`'s Item-Operationen:

```typescript
// src/hooks/useMeals.ts
export function useMeals(listId: string | null) {
  const { isOnline, enqueue } = useOfflineQueue()

  const saveMeal = useCallback(async (meal: Partial<Meal>, editingId?: string) => {
    if (isOnline) {
      if (editingId) {
        const { error } = await supabase.from('meals').update(meal).eq('id', editingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('meals').insert(meal)
        if (error) throw error
      }
    } else {
      if (editingId) {
        enqueue({ type: 'update', table: 'meals', payload: meal, filterColumn: 'id', filterValue: editingId })
      } else {
        enqueue({ type: 'insert', table: 'meals', payload: meal })
      }
    }
  }, [isOnline, enqueue])

  return { saveMeal, deleteMeal, addIdea, deleteIdea }
}
```

---

### 14. [Mittel] BristolScreen — Alle Operationen umgehen Offline-Queue

**Datei:** `src/components/BristolScreen.tsx` (Zeilen 89-156)

**Problem:** `handleSubmitEntry`, `handleUpdateEntry` und `handleDeleteEntry` rufen direkt Supabase auf. BristolWidget hat das gleiche Problem (Zeilen 41-89). Offline-Benutzer können keine Bristol-Werte eintragen.

**Fix:** Bristol-Operationen in einen `useBristol`-Hook mit Offline-Queue-Support auslagern:

```typescript
// src/hooks/useBristol.ts
export function useBristol(listId: string, userName: string) {
  const { isOnline, enqueue } = useOfflineQueue()

  const submitEntry = useCallback(async (value: number, entryDate: string) => {
    if (isOnline) {
      const { error } = await supabase.from('bristol_entries').upsert(
        { list_id: listId, participant_name: userName, value, entry_date: entryDate },
        { onConflict: 'list_id,participant_name,entry_date' }
      )
      if (error) throw error
    } else {
      enqueue({ type: 'insert', table: 'bristol_entries',
        payload: { list_id: listId, participant_name: userName, value, entry_date: entryDate } })
    }
  }, [listId, userName, isOnline, enqueue])

  return { submitEntry, updateEntry, deleteEntry }
}
```

---

### 15. [Hoch] SettingsScreen — Doppelte Passwort-Ändern-UI teilt sich State (Bug)

**Datei:** `src/components/SettingsScreen.tsx` (Zeilen 377-413 und 542-578)

**Problem:** Die "Passwort ändern"-Funktionalität wird in zwei Sektionen gerendert — einmal im Account-Bereich (Zeilen 377-413) und einmal im Admin-Bereich (Zeilen 542-578). Beide verwenden dieselben State-Variablen: `showChangePassword`, `oldPassword`, `newPassword`, `adminError`. Wenn ein Admin entsperrt ist, werden beide Formulare gleichzeitig sichtbar und steuern denselben State. Das Öffnen eines Formulars zeigt das Formular an beiden Stellen.

**Fix:** Separate State-Variablen oder nur ein Formular rendern:

```typescript
// Option A: Nur im Account-Bereich rendern, Admin-Bereich referenziert es
// Option B: Separate State-Variablen
const [showChangeOwnPw, setShowChangeOwnPw] = useState(false)
const [ownOldPw, setOwnOldPw] = useState('')
const [ownNewPw, setOwnNewPw] = useState('')

// Account-Bereich nutzt showChangeOwnPw / ownOldPw / ownNewPw
// Admin-Bereich bekommt eine separate "Admin-Passwort ändern"-Funktion falls benötigt
```

---

### 16. [Mittel] WeatherWidget und WeatherScreen duplizieren Geocoding-Logik

**Datei:** `src/components/WeatherWidget.tsx` (Zeilen 147-183) und `src/components/WeatherScreen.tsx` (Zeilen 251-287)

**Problem:** Beide Komponenten implementieren identische `handleGeocode`-Funktionen: fetch von `geocoding-api.open-meteo.com`, Parsing, localStorage-Speicherung von lat/lon/name. ~35 Zeilen Duplikation. Beide haben auch identische `storedLocation`-useMemo-Logik und identische `fetchWeather`-Grundstruktur.

**Fix:** In ein gemeinsames Modul extrahieren:

```typescript
// src/lib/weather.ts
export interface GeoLocation { lat: number; lon: number; name: string }

export function getStoredLocation(): GeoLocation | null {
  const lat = localStorage.getItem('weather_lat')
  const lon = localStorage.getItem('weather_lon')
  const name = localStorage.getItem('weather_name')
  if (lat && lon && name) return { lat: parseFloat(lat), lon: parseFloat(lon), name }
  return null
}

export function setStoredLocation(loc: GeoLocation) {
  localStorage.setItem('weather_lat', String(loc.lat))
  localStorage.setItem('weather_lon', String(loc.lon))
  localStorage.setItem('weather_name', loc.name)
}

export async function geocodeCity(query: string): Promise<GeoLocation | null> {
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`)
  if (!res.ok) throw new Error('Ort nicht gefunden')
  const data = await res.json()
  if (!data.results?.length) return null
  const r = data.results[0]
  const name = r.country ? `${r.name}, ${r.country}` : r.name
  return { lat: r.latitude, lon: r.longitude, name }
}
```

---

### 17. [Mittel] useDragReorder — handlePointerMove wird bei jedem dragState-Wechsel neu erstellt

**Datei:** `src/hooks/useDragReorder.ts` (Zeilen 42-58)

**Problem:** `handlePointerMove` hat `dragState` in der useCallback-Dependency-Liste. Da `dragState` bei jeder Pointer-Bewegung aktualisiert wird (über `setDragState` in Zeile 56), wird `handlePointerMove` bei jeder Bewegung neu erstellt. Das führt zu unnötigen Re-Renders aller Komponenten, die diesen Handler verwenden (ItemRow, ListScreen, BringScreen, CategoryManager, DashboardScreen).

**Fix:** dragState in einem Ref halten:

```typescript
const dragStateRef = useRef<DragState>({ draggingId: null, dragOverId: null })
const [dragState, setDragState] = useState<DragState>({ draggingId: null, dragOverId: null })

const updateDragState = useCallback((updater: (prev: DragState) => DragState) => {
  setDragState(prev => {
    const next = updater(prev)
    dragStateRef.current = next
    return next
  })
}, [])

const handlePointerMove = useCallback((e: React.PointerEvent) => {
  if (!dragStateRef.current.draggingId) return
  const currentY = e.clientY
  let closestId: string | null = null
  let closestDist = Infinity
  for (const [id, top] of itemTops.current) {
    const dist = Math.abs(top - currentY)
    if (dist < closestDist) { closestDist = dist; closestId = id }
  }
  if (closestId && closestId !== dragStateRef.current.draggingId) {
    updateDragState(prev => ({ ...prev, dragOverId: closestId }))
  }
}, [updateDragState])  // keine dragState-Abhängigkeit mehr
```

---

### 18. [Mittel] supabase.ts — Hardcoded Fallback-Join-Code 'BELLA26'

**Datei:** `src/lib/supabase.ts` (Zeile 13)

**Problem:** Der Join-Code hat einen hardcoded Fallback:

```typescript
const LIST_JOIN_CODE = import.meta.env.VITE_JOIN_CODE || 'BELLA26'
```

Wenn die Umgebungsvariable fehlt, fällt die App still auf den Default-Code zurück. In einer Produktions-Deployment ohne `.env`-Konfiguration würde jeder den Join-Code kennen.

**Fix:** Strict-Mode — kein Fallback, Fehler bei fehlender Variable:

```typescript
const LIST_JOIN_CODE = import.meta.env.VITE_JOIN_CODE
if (!LIST_JOIN_CODE) {
  throw new Error('Missing VITE_JOIN_CODE. Copy .env.example to .env and fill in your values.')
}
```

Oder zumindest eine Warning:

```typescript
const LIST_JOIN_CODE = import.meta.env.VITE_JOIN_CODE || 'BELLA26'
if (!import.meta.env.VITE_JOIN_CODE) {
  console.warn('VITE_JOIN_CODE not set — using default BELLA26. Set this in production!')
}
```

---

### 19. [Mittel] reorderItems ruft fetchAll auf statt gezielt fetchItems

**Datei:** `src/hooks/useListData.ts` (Zeilen 437-463)

**Problem:** Nach einem Reorder wird `fetchAll(list.id)` aufgerufen, was alle 8 Tabellen neu lädt. Beim Umordnen von Shopping-Items werden aber nur Shopping-Items geändert — alle anderen Fetches (Bring, Categories, Meals, Notes, Expenses, Participants) sind verschwendete Netzwerk-Requests.

```typescript
// Nach reorder:
if (list) fetchAll(list.id)  // lädt ALLES neu
```

Das gleiche Problem bei `reorderNotes` (Zeile 480).

**Fix:**

```typescript
// reorderItems:
if (list) {
  fetchItems(list.id, listType)  // nur die betroffene Liste
}

// reorderNotes:
if (list) {
  fetchNotes(list.id)  // nur Notes
}
```

---

### 20. [Mittel] ExpenseScreen Inline-Kategorie-Editor dupliziert useCategories-Logik

**Datei:** `src/components/ExpenseScreen.tsx` (Zeilen 554-624)

**Problem:** Der Inline-Kategorie-Editor implementiert `update`, `delete` und `add` für Kategorien direkt mit Supabase-Aufrufen, während die `useCategories`-Hook dieselbe Funktionalität bereits kapselt (inkl. Error-Handling, Toast-Meldungen und Offline-Queue-Support). Der Code in ExpenseScreen ist ~70 Zeilen lang und wiederholt die Logik.

**Fix:** Siehe Finding #11 — `useCategories`-Hook verwenden. Der Inline-Editor wird zu:

```typescript
const { updateCategory, deleteCategory, addCategory } = useCategories(() => {
  onCategoriesChange()
  onExpensesChange()  // falls Kategorien von Expenses referenziert werden
})

// Im Editor:
onChange={(e) => {
  setCatLocalNames(prev => ({ ...prev, [cat.id]: e.target.value }))
  debouncedUpdate(cat.id, { name: e.target.value })
}}
onDelete={() => deleteCategory(cat.id)}
onAdd={() => addCategory(listId, 'expense', maxOrder + 1)}
```

---

### 21. [Niedrig] BristolWidget — Kein Retry bei Fetch-Fehler

**Datei:** `src/components/BristolWidget.tsx` (Zeilen 41-89)

**Problem:** Wenn `fetchStats` fehlschlägt (z.B. Netzwerkfehler), wird `error` gesetzt und ein Warn-Emoji angezeigt. Es gibt keinen Retry-Button und keine automatische Wiederholung. Der Benutzer muss die Seite neu laden.

**Fix:**

```typescript
// Retry-Button im Error-Fall hinzufügen:
{error && (
  <div className="bristol-widget-error-text">
    {error}
    <button className="bristol-widget-retry-btn" onClick={fetchStats}>
      ↻ Erneut versuchen
    </button>
  </div>
)}
```

---

### 22. [Niedrig] WeatherScreen — Radar-Fetch schlägt still fehl ohne User-Feedback

**Datei:** `src/components/WeatherScreen.tsx` (Zeilen 208-222)

**Problem:** Der Radar-Daten-Fetch fängt Fehler mit `.catch(() => {})` ab — komplett still. Wenn RainViewer nicht erreichbar ist, sieht der Benutzer keine Radar-Karte, aber auch keine Fehlermeldung. Er weiß nicht, ob Radar gerade lädt oder nicht verfügbar ist.

**Fix:**

```typescript
const [radarError, setRadarError] = useState(false)

useEffect(() => {
  let cancelled = false
  setRadarError(false)
  fetch('https://api.rainviewer.com/public/weather-maps.json')
    .then(r => r.json())
    .then(data => {
      if (cancelled) return
      setRadarHost(data.host)
      setRadarFrames(data.radar?.past ?? [])
      setRadarIndex((data.radar?.past ?? []).length - 1)
    })
    .catch(() => { if (!cancelled) setRadarError(true) })
  return () => { cancelled = true }
}, [])

// Im Render:
{radarError && (
  <p className="weather-radar-error">📡 Regenradar derzeit nicht verfügbar</p>
)}
```

---

### 23. [Niedrig] clearCacheForList iteriert alle localStorage-Keys

**Datei:** `src/lib/readCache.ts` (Zeilen 47-58)

**Problem:** `clearCacheForList` iteriert alle localStorage-Keys, um die mit dem Prefix `bm_cache_{listId}_` zu finden. Bei Apps mit vielen localStorage-Einträgen (Logs, Offline-Queue, Theme, Weather, Bristol, etc.) ist das O(n) bei jedem Join/Leave.

**Fix:** Liste der Cache-Tables bekannt machen:

```typescript
const CACHE_TABLES = [
  'shopping_items', 'bring_items', 'categories', 'meals',
  'meal_ideas', 'notes', 'expenses', 'expense_splits', 'participants',
]

export function clearCacheForList(listId: string): void {
  try {
    for (const table of CACHE_TABLES) {
      localStorage.removeItem(cacheKey(listId, table))
    }
  } catch { /* localStorage unavailable */ }
}
```

---

### 24. [Hoch] Auto-Restore-Session — isLoading bleibt true wenn List-Fetch null zurückgibt

**Datei:** `src/hooks/useListData.ts` (Zeilen 287-311)

**Problem:** In der Auto-Restore-Logik wird `setIsLoading(true)` (Zeile 296) gesetzt, bevor die Listendaten geholt werden. Wenn die List-Query `null` zurückgibt (z.B. Liste wurde gelöscht), wird `isLoading` nie auf `false` gesetzt — die App bleibt im Loading-Zustand mit Skeleton-Screens:

```typescript
setIsLoading(true)  // Zeile 296
supabase.from('lists').select('*').eq('id', result.list_id).single().then(({ data }) => {
  if (data) {
    setList(data as ShoppingList)
    fetchAll(result.list_id)  // setzt isLoading auf false
  }
  // ❌ Wenn data null ist, bleibt isLoading true forever!
})
```

**Fix:**

```typescript
setIsLoading(true)
supabase
  .from('lists')
  .select('*')
  .eq('id', result.list_id)
  .single()
  .then(({ data }) => {
    if (data) {
      setList(data as ShoppingList)
      fetchAll(result.list_id)
    } else {
      // Liste nicht gefunden — Session zurücksetzen
      setIsLoading(false)
      localStorage.removeItem('user_name')
      localStorage.removeItem('participant_id')
    }
  })
  .catch(() => {
    setIsLoading(false)
    // Optional: Session-Cleanup
  })
```

---

### 25. [Niedrig] App.tsx — Bristol-Modus localStorage-Sync ist redundant

**Datei:** `src/App.tsx` (Zeilen 117-130)

**Problem:** App.tsx schreibt `bristol_modus_enabled` in localStorage (Zeile 122) und hört auf `bristol-modus-change`-Events (Zeilen 126-130). SettingsScreen schreibt ebenfalls in localStorage (Zeile 79) und dispatched das Event (Zeile 80). Wenn App.tsx den Wert ändert, schreibt es in localStorage — aber SettingsScreen liest nicht aus localStorage beim Toggle, sondern dispatched nur das Event. Es gibt zwei Schreib-Pfade für denselben localStorage-Key, was zu Race-Conditions führen kann.

```typescript
// App.tsx schreibt:
useEffect(() => {
  localStorage.setItem('bristol_modus_enabled', bristolEnabled ? 'true' : 'false')
}, [bristolEnabled])

// SettingsScreen schreibt auch:
useEffect(() => {
  localStorage.setItem('bristol_modus_enabled', bristolEnabled ? 'true' : 'false')
  window.dispatchEvent(new CustomEvent('bristol-modus-change'))
}, [bristolEnabled])
```

**Fix:** Single Source of Truth — App.tsx soll nur lesen, SettingsScreen soll nur schreiben:

```typescript
// App.tsx — nur lesen, nie schreiben:
const [bristolEnabled, setBristolEnabled] = useState(
  () => localStorage.getItem('bristol_modus_enabled') === 'true'
)

useEffect(() => {
  const handler = () => setBristolEnabled(localStorage.getItem('bristol_modus_enabled') === 'true')
  window.addEventListener('bristol-modus-change', handler)
  return () => window.removeEventListener('bristol-modus-change', handler)
}, [])

// Den useEffect mit localStorage.setItem aus App.tsx entfernen.
// SettingsScreen behält das Schreiben + Event-Dispatch.
```

---

## Priorisierte TODO-Liste

### Sofort (Sicherheit / Bugs)

- [ ] **#24** — Auto-Restore isLoading-Bug fixen (App bleibt im Loading-Zustand)
- [ ] **#6** — checkConnectivity AbortController an Supabase-Query übergeben
- [ ] **#15** — Doppelte Passwort-Ändern-UI in SettingsScreen mit separatem State fixen
- [ ] **#8** — Ignorierte Fehler bei Supabase-Aufrufen beheben (batch_delete, expense_splits delete)
- [ ] **#18** — Hardcoded Fallback-Join-Code entfernen oder warnen

### Bald (Architektur / Performance)

- [ ] **#1** — useListData in thematische Hooks zerlegen
- [ ] **#3** — ExpenseScreen in Sub-Komponenten zerlegen
- [ ] **#5** — Offline-Queue Retry-Code-Duplikation beheben
- [ ] **#9** — fetchAll statt 7 einzelner Fetches nach Sync verwenden
- [ ] **#10** — fetchItems userName-Dependency via Ref auflösen
- [ ] **#19** — reorderItems: fetchItems statt fetchAll aufrufen
- [ ] **#17** — useDragReorder: dragState via Ref, nicht Callback-Dependency
- [ ] **#7** — logger.ts: Buffer mit Batch-Write implementieren

### Nice-to-have (Code-Qualität / Konsistenz)

- [ ] **#2** — WEATHER_CODE_MAP in gemeinsames Modul extrahieren
- [ ] **#4** — BRISTOL_COLORS/EMOJIS/ADJECTIVES in gemeinsames Modul extrahieren
- [ ] **#16** — Geocoding-Logik in gemeinsames Modul extrahieren
- [ ] **#11** — ExpenseScreen Kategorie-Operationen über useCategories-Hook leiten
- [ ] **#20** — ExpenseScreen Inline-Kategorie-Editor mit useCategories konsolidieren
- [ ] **#12** — DashboardScreen Notiz-Operationen mit Offline-Queue-Support versehen
- [ ] **#13** — MealPlanScreen mit Offline-Queue-Support versehen
- [ ] **#14** — BristolScreen/Widget mit Offline-Queue-Support versehen
- [ ] **#21** — BristolWidget Retry-Button bei Fetch-Fehler hinzufügen
- [ ] **#22** — WeatherScreen Radar-Fehler-Feedback anzeigen
- [ ] **#23** — clearCacheForList mit bekannter Table-Liste optimieren
- [ ] **#25** — Bristol-Modus localStorage-Sync: Single Source of Truth etablieren