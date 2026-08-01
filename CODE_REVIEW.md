# 🔍 Bella Mozzarella — Vollständige Code-Review

**Datum:** 01.08.2026  
**Projekt:** `/opt/data/bella-fix/`  
**Stack:** React 19 + TypeScript 6.0 + Vite 8.1 + Supabase + Three.js  
**Deployment:** GitHub Pages  

---

## 🚨 KRITISCHE PROBLEME (sofort fixen)

### 1. 🔴 Passwort-Hashing: SHA-256 ohne Salt
**Datei:** `supabase_password_auth.sql` (Zeilen 48, 60, 93, 102, 112)

```sql
v_password_hash := encode(digest(p_password::bytea, 'sha256'::text), 'hex');
```

SHA-256 ist ein **schneller Hash-Algorithmus** und für Passwort-Hashing völlig ungeeignet. Ohne Salt sind Rainbow-Table-Angriffe trivial. Mit Salt wäre es immer noch zu schnell (Milliarden Hashes/sec auf Consumer-Hardware).

**Fix:** pgcrypto bietet `crypt()` mit bcrypt:
```sql
v_password_hash := crypt(p_password, gen_salt('bf', 10));
-- Prüfung:
IF v_participant.password_hash = crypt(p_password, v_participant.password_hash) THEN ...
```

**Risiko:** Bei einem DB-Leak sind alle Passwörter in Minuten crackbar.

---

### 2. 🔴 Admin-Passwort im Klartext in der DB
**Datei:** `App.tsx` (Zeilen 181-184), `sql/verify_admin_password.sql`

```typescript
// App.tsx — speichert Klartext
await supabase.from('lists').update({ admin_password: password }).eq('id', list.id)
```

```sql
-- verify_admin_password.sql — vergleicht Klartext
return v_admin_password = p_password;
```

Das Admin-Passwort wird **unverschlüsselt** in der `lists`-Tabelle gespeichert. Jeder mit DB-Zugriff (Supabase-Dashboard, Service-Key) kann es lesen.

**Fix:** 
1. `admin_password` als Hash speichern (bcrypt via pgcrypto)
2. `verify_admin_password` RPC auf Hash-Vergleich umstellen
3. `handleSetAdminPassword` in App.tsx muss das Passwort nicht mehr im State halten

**Risiko:** Bei DB-Zugriff sofortige Admin-Übernahme.

---

### 3. 🟠 Hartcodierter Join-Code + Kein Code-Rotation
**Datei:** `src/lib/supabase.ts` (Zeile 13)

```typescript
const LIST_JOIN_CODE = 'BELLA26'
```

Der Join-Code ist:
- Im **Source-Code** hartcodiert (GitHub-öffentlich sichtbar)
- Wird **nie rotiert**
- Ist der einzige Schutz für RLS-Policies

Jeder, der den Code kennt, kann per API alle Daten der Liste lesen/schreiben/löschen.

**Fix:** 
- Join-Code aus Umgebungsvariable laden (`import.meta.env.VITE_JOIN_CODE`)
- Optional: Code-Rotation mit Admin-UI

---

### 4. 🟠 localStorage-Session ohne Ablaufdatum
**Dateien:** `useListData.ts` (Zeilen 237-238), `JoinScreen.tsx` (Zeilen 113-114)

```typescript
localStorage.setItem('user_name', result.participant_name)
localStorage.setItem('participant_id', result.participant_id)
```

- Kein Token, kein Expiry, kein Refresh-Mechanismus
- `participant_id` ist eine UUID — bei Kenntnis dieser ID kann jeder die Session übernehmen
- `restore_participant_session` RPC prüft nur ob die ID existiert, nicht ob die Session gültig ist

**Fix:**
- Session-Token mit Ablaufdatum einführen
- `restore_participant_session` um Token-Validierung erweitern
- HttpOnly-Cookie wäre ideal, aber bei SPA + GitHub Pages schwierig

---

### 5. 🟠 Keine Transaktion bei handleRename
**Datei:** `useListData.ts` (Zeilen 483-533)

```typescript
// 1. Neuen Participant inserten
await supabase.from('participants').insert(...)
// 2-4. References updaten (Promise.allSettled)
// 5. Alten Participant löschen
await supabase.from('participants').delete()...
```

Wenn Schritt 2-4 teilweise fehlschlägt, ist der Datenbank-State inkonsistent:
- Neuer Participant existiert, aber expenses/items verweisen noch auf den alten Namen
- Rollback-Logik löscht nur den neuen Participant, nicht die bereits geupdateten Referenzen

**Fix:** Als einzelne Supabase RPC mit `BEGIN...COMMIT` Transaktion implementieren.

---

## 🟡 MITTELSCHWERE PROBLEME (diese Woche fixen)

### 6. any-Typen
| Datei | Zeile | Code |
|-------|-------|------|
| `App.tsx` | 143 | `useState<any>(null)` |
| `DashboardScreen.tsx` | 61 | `installPrompt: any` |
| `ExpenseScreen.tsx` | 308 | `PromiseLike<any>[]` |
| `BristolScreen.tsx` | 337-338 | `formatter={(val: any) => ...}` |
| `useDebouncedCallback.ts` | 10 | `(...args: any[])` |

**Fix:** 
- `installPrompt`: `BeforeInstallPromptEvent` Interface definieren
- `PromiseLike<any>` → `PromiseLike<PostgrestResponse<...>>` oder `PromiseLike<{ error: ... }>`
- Recharts `any` → spezifische Typen aus recharts

---

### 7. Ineffiziente Batch-Delete-Operation
**Datei:** `ListScreen.tsx` (Zeile 238)

```typescript
await Promise.all(checkedItems.map((item) => supabase.from('items').delete().eq('id', item.id)))
```

N parallele DELETE-Requests statt einem Batch. Bei 50 Items sind das 50 HTTP-Requests.

**Fix:** Supabase RPC für Batch-Delete:
```sql
CREATE FUNCTION batch_delete_items(item_ids UUID[]) RETURNS void AS $$
  DELETE FROM items WHERE id = ANY(item_ids);
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### 8. Unused Props in ExpenseCharts
**Datei:** `ExpenseCharts.tsx` (Zeilen 69-70)

```typescript
void expenseSplits
void knownPersons
```

`expenseSplits` und `knownPersons` werden als Props deklariert, aber nie verwendet. Mit `noUnusedParameters: true` im tsconfig müsste das eigentlich einen Build-Fehler werfen — wird aber durch `void` unterdrückt.

**Fix:** Entweder die Props entfernen oder die geplanten Features implementieren (z.B. "Wer schuldet wem"-Chart).

---

### 9. Offline-Queue: Kein Dedup, stoppt bei erstem Fehler
**Datei:** `useOfflineQueue.ts`

- **Kein Dedup:** Mehrere Toggles desselben Items erzeugen separate Queue-Einträge
- **Stoppt bei Fehler:** `flushQueue` bricht bei erstem Fehler ab (Zeile 96: `break`), alle nachfolgenden Ops bleiben in der Queue
- **Kein Retry:** Fehlgeschlagene Ops werden nicht erneut versucht

**Fix:**
- Queue vor dem Flushen deduplizieren (letzter State pro Item zählt)
- Fehlerhafte Ops in separaten "dead letter" Bereich verschieben
- Exponentielles Backoff für Retries

---

### 10. Keine Input-Validierung/Sanitization
**Dateien:** `AddItemForm.tsx`, `JoinScreen.tsx`, `DashboardScreen.tsx`

- Item-Namen, Notiz-Inhalte, Benutzernamen werden ohne Längenbegrenzung oder XSS-Schutz an Supabase gesendet
- React rendert Text als Text (kein `dangerouslySetInnerHTML`), daher kein direktes XSS-Risiko
- Aber: Keine Längenlimits → mögliche DB-Überläufe oder DoS

**Fix:** 
- `maxLength` auf Input-Feldern
- Serverseitige CHECK-Constraints für Textlängen

---

### 11. Bristol-Tab verwendet Wallet-Icon (gleiches wie Ausgaben)
**Datei:** `App.tsx` (Zeile 229)

```typescript
bristol: { icon: Wallet, label: 'Bristol' },
```

Bristol und Ausgaben teilen sich das `Wallet`-Icon von lucide-react. Das ist verwirrend für Benutzer.

**Fix:** Eigenes Icon — z.B. `Stethoscope` oder `Activity` von lucide-react, oder ein Custom-Emoji.

---

### 12. Keine Suchfunktion
Weder Einkaufsliste, Mitbringen-Liste, Ausgaben noch Essensplan haben eine Suchleiste. Bei 50+ Items wird die Navigation mühsam.

**Fix:** 
- Client-seitige Filterung mit `useMemo` + Such-Input
- Optional: Debounced Search

---

### 13. Kein Daten-Export
Keine Möglichkeit, Einkaufslisten, Ausgaben oder Essenspläne zu exportieren (CSV, PDF, Clipboard).

**Fix:**
- "Exportieren"-Button in Settings oder pro Screen
- CSV-Generierung mit Blob-Download

---

### 14. Keine Tests
**0 Test-Dateien im gesamten Projekt.**

**Fix (priorisiert):**
1. Unit-Tests für `aggregate.ts` (Kernlogik)
2. Unit-Tests für `useOfflineQueue.ts`
3. Integration-Tests für Auth-Flow
4. Komponenten-Tests mit Testing Library

---

## 🔵 KLEINERE OPTIMIERUNGEN

### 15. Batch-Reorder RPCs mit Loop statt Set-Operation
**Dateien:** `supabase_batch_reorder.sql`, `supabase_notes_reorder_migration.sql`

```sql
FOR i IN 1..array_length(item_ids, 1) LOOP
  UPDATE items SET sort_order = i - 1 WHERE id = item_ids[i];
END LOOP;
```

N einzelne UPDATEs in einer Loop. Kann mit `unnest` optimiert werden:

```sql
UPDATE items SET sort_order = new.sort_order
FROM (SELECT unnest(item_ids) AS id, generate_subscripts(item_ids, 1) - 1 AS sort_order) AS new
WHERE items.id = new.id;
```

---

### 16. Adaptive Polling: 3s/8s Intervall
**Datei:** `useListData.ts` (Zeilen 177-179)

```typescript
return Date.now() - lastActivityRef.current < 30000 ? 3000 : 8000
```

3-Sekunden-Polling bei Aktivität ist aggressiv. Supabase Realtime (WebSockets) wäre effizienter und würde Polling komplett ersetzen.

**Fix:** Supabase Realtime Subscriptions statt Polling:
```typescript
supabase.channel('items').on('postgres_changes', { event: '*', schema: 'public', table: 'items' }, () => fetchItems(...)).subscribe()
```

---

### 17. MozzaScene: dpr und Shadow-Map-Größe
**Datei:** `MozzaScene.tsx`

- `dpr={[1, 2]}` — gut für Performance
- `shadow-mapSize-width={512}` — könnte auf 256 reduziert werden für Mobile
- `SphereGeometry(radius, 64, 64)` — 64 Segmente sind okay, 32 würden auf Mobile reichen

---

### 18. oxlint: Minimale Regeln
**Datei:** `.oxlintrc.json`

```json
{
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

Nur 2 Regeln aktiv. oxlint unterstützt hunderte Regeln für TypeScript, React, Import-Sorting etc.

**Fix:** 
- `typescript/no-explicit-any`: warn
- `typescript/no-unused-vars`: error
- `import/order`: warn
- `unicorn/filename-case`: warn

---

### 19. Keine Pre-commit Hooks
Kein `husky`, `lint-staged` oder `.pre-commit-config.yaml`.

**Fix:**
```bash
npm install -D husky lint-staged
npx husky init
```
```json
// package.json
"lint-staged": {
  "*.{ts,tsx}": ["oxlint", "tsc --noEmit"]
}
```

---

### 20. Kein Bundle Analysis
Keine Visualisierung der Bundle-Größe. `recharts` und `three` sind große Dependencies.

**Fix:** `rollup-plugin-visualizer` zu `vite.config.ts` hinzufügen.

---

### 21. sql_migration.sql: Hartcodierte list_id
**Datei:** `sql_migration.sql` (Zeilen 72-86)

```sql
INSERT INTO categories (list_id, ...) VALUES
  ('407cc996-abbe-4d79-b2ca-33277b24097c', 'shopping', 'Essen', ...)
```

Diese UUID ist spezifisch für eine bestimmte Liste. Bei neuen Deployments schlägt der Seed fehl oder seeded in die falsche Liste.

**Fix:** Dynamisches Seeding mit `SELECT id FROM lists` (wie in `supabase_expense_categories.sql` bereits gemacht).

---

### 22. Kein Error Tracking / Monitoring
Kein Sentry, kein Logging-Service. Fehler werden nur per `console.error` geloggt.

**Fix:** Sentry oder vergleichbaren Service integrieren.

---

## 📋 FEHLENDE FEATURES

| Feature | Priorität | Aufwand |
|---------|-----------|---------|
| Suchfunktion (alle Listen) | Hoch | 2-4h |
| Daten-Export (CSV/PDF) | Mittel | 3-6h |
| Supabase Realtime statt Polling | Mittel | 4-8h |
| Batch-Delete RPC | Mittel | 1h |
| Tests (Unit + Integration) | Hoch | 8-16h |
| Pre-commit Hooks (husky + lint-staged) | Mittel | 1h |
| Bundle Analysis | Niedrig | 0.5h |
| Error Tracking (Sentry) | Niedrig | 2h |
| Dark Mode für Charts | Niedrig | 2h |
| PWA "Update available"-Banner | Niedrig | 2h |
| Undo-Funktion für Delete | Niedrig | 3h |
| Item-Duplizierung | Niedrig | 1h |

---

## 📊 ZUSAMMENFASSUNG

### Stärken
- ✅ Gut strukturierte Komponenten-Architektur mit Code-Splitting
- ✅ Konsistente RLS-Policies über alle Tabellen
- ✅ Offline-Queue mit automatischem Sync
- ✅ Adaptive Polling mit Activity-Tracking
- ✅ WebGL Error Boundary für Three.js
- ✅ CSS-only Charts (ExpenseCharts) — keine Library-Abhängigkeit
- ✅ TypeScript strict mode aktiv
- ✅ PWA-ready mit Service Worker, Manifest, Icons

### Schwächen
- ❌ SHA-256 ohne Salt für Passwörter
- ❌ Admin-Passwort im Klartext
- ❌ Hartcodierter Join-Code im Source
- ❌ Keine Transaktionen bei Multi-Step-Operationen
- ❌ Keine Tests
- ❌ any-Typen an mehreren Stellen
- ❌ Keine Suchfunktion / kein Export

---

## ✅ PRIORISIERTE TODO-LISTE

### 🔴 Sofort (diese Woche)
1. [ ] **Passwort-Hashing auf bcrypt umstellen** (`supabase_password_auth.sql`)
2. [ ] **Admin-Passwort hashen** (`App.tsx` + `verify_admin_password.sql`)
3. [ ] **Join-Code aus Umgebungsvariable laden** (`supabase.ts`)
4. [ ] **handleRename als Transaktions-RPC** (`useListData.ts`)

### 🟡 Bald (nächste 2 Wochen)
5. [ ] **any-Typen eliminieren** (installPrompt, Recharts, PromiseLike)
6. [ ] **Batch-Delete RPC** für `ListScreen.tsx` Zeile 238
7. [ ] **Unused Props** in `ExpenseCharts.tsx` entfernen oder implementieren
8. [ ] **Offline-Queue verbessern** (Dedup, Retry, Dead-Letter)
9. [ ] **Bristol-Tab Icon fixen** (Wallet → Stethoscope/Activity)
10. [ ] **Suchfunktion** in ListScreen, BringScreen, ExpenseScreen
11. [ ] **Daten-Export** (CSV) für Einkaufsliste und Ausgaben
12. [ ] **Tests schreiben** (mindestens `aggregate.ts` + `useOfflineQueue.ts`)

### 🔵 Nice-to-have
13. [ ] Supabase Realtime statt Polling
14. [ ] Pre-commit Hooks (husky + lint-staged)
15. [ ] oxlint Regeln erweitern
16. [ ] Bundle Analysis
17. [ ] Batch-Reorder RPCs mit `unnest` optimieren
18. [ ] Sentry Error Tracking
19. [ ] PWA Update-Banner
20. [ ] Undo-Funktion für Delete-Operationen
