# 🧀 Bella Mozzarella

Gemeinsame Planungs-App für Gruppenausflüge, Urlaube und Events.  
Einkaufsliste, Mitbringen, Essensplan, Ausgabenabrechnung, Notizen & Bristol-Tracking — alles in einer App mit Realtime-Sync.

**Live:** [flokoko.github.io/BellaMozzarella](https://flokoko.github.io/BellaMozzarella/)

---

## Features

### 🛒 Einkaufsliste
- Items nach Kategorien gruppiert (dynamisch anlegbar)
- Automatische Aggregation: gleiche Items werden zusammengefasst
- Drag & Drop zum Sortieren
- Suchfunktion
- Erledigte ausblenden / Batch-Löschen
- Item-Duplizierung
- Undo beim Löschen (5s Rückgängig)

### 🎒 Mitbringen
- Items Personen zuweisen
- Filter: Alle / Nur meine / Unzugewiesen
- "Mitgebracht"-Haken
- Drag & Drop Sortierung

### 🍕 Essensplan
- Wochenplan (Mo–So, Frühstück/Mittag/Abend)
- Ideen-Sammlung mit Tags
- Idee direkt in den Plan übernehmen
- Heute-Markierung

### 💶 Ausgaben
- Ausgaben erfassen mit Betrag, Datum, Kategorie
- Split: Gleichmäßig oder exakt
- Automatische Abrechnung (wer schuldet wem)
- Schulden-Matrix (wer wem was schuldet)
- Ausgaben-Charts (pro Tag / Person / Kategorie)
- CSV-Export
- Suchfunktion

### 📝 Notizen
- Kurznotizen mit Titel + Inhalt
- Favoriten markieren (⭐)
- Drag & Drop Sortierung
- URLs werden automatisch als Links erkannt

### 💩 Bristol-Tracking
- Tägliche Bristol-Skala (1–7 + Plasma 💩)
- Statistik (Ø, Min, Max, Modus)
- Verteilungs-Chart + 14-Tage-Trend
- History mit Inline-Edit
- Confetti-Effekt bei Wert 13

### 🌤️ Wetter
- Aktuelles Wetter + 3-Tage-Vorhersage
- Ort frei wählbar (Open-Meteo API)
- Einklappbare Vorhersage

### 🎨 UI
- Italienisches Design (Grün-Weiß-Rot)
- Glassmorphismus
- Dark Mode (Auto / Hell / Dunkel)
- 3D MozzaScene im Hintergrund (Three.js)
- Haptisches Feedback (Vibration)
- Animierte Kacheln + Seitenübergänge
- PWA: Installierbar, Update-Banner

---

## Tech Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | React 19 + TypeScript 6.0 |
| Build | Vite 8 |
| Backend | Supabase (PostgreSQL + Realtime) |
| 3D | Three.js / React Three Fiber |
| Charts | Recharts (Bristol) + CSS-only (Ausgaben) |
| Icons | Lucide React |
| Tests | Vitest + Testing Library |
| Linting | oxlint |
| Hosting | GitHub Pages (via GitHub Actions) |
| Pre-commit | husky + lint-staged |

---

## Setup

```bash
# Dependencies
npm install

# .env erstellen (siehe .env.example)
cp .env.example .env
# Dann Werte eintragen:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_JOIN_CODE=BELLA26  (optional, Fallback im Code)

# Dev-Server
npm run dev
```

## Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `npm run dev` | Dev-Server starten |
| `npm run build` | Produktions-Build |
| `npm run test` | Tests ausführen |
| `npm run test:watch` | Tests im Watch-Modus |
| `npm run lint` | Linting (oxlint) |
| `npm run preview` | Build lokal previewen |
| `npm run deploy` | Manuelles Deploy (gh-pages) |

## Tests

```bash
npm run test
```

Aktuell **12 Tests** in 2 Testdateien:
- `src/lib/__tests__/aggregate.test.ts` — Item-Aggregation (8 Tests)
- `src/hooks/__tests__/useOfflineQueue.test.ts` — Offline-Queue (4 Tests)

---

## Supabase Schema

### Tabellen

| Tabelle | Beschreibung |
|---------|-------------|
| `lists` | Gruppen (name, join_code, admin_password) |
| `participants` | Teilnehmer (name, password_hash, is_admin) |
| `items` | Einkaufs-/Mitbring-Items (list_type: shopping/bring) |
| `categories` | Dynamische Kategorien (list_type, name, icon, color) |
| `meals` | Essensplan-Einträge (day, meal_type, name) |
| `meal_ideas` | Ideen-Sammlung (name, tags) |
| `notes` | Kurznotizen (title, content, sort_order, is_favorite) |
| `expenses` | Ausgaben (description, amount, paid_by, split_mode) |
| `expense_splits` | Aufteilung pro Person (person_name, share_amount) |
| `bristol_entries` | Bristol-Tracking (value 1–13, entry_date) |

### Auth

- **Login:** Name + Passwort (Initial: `BELLA26`)
- **Passwort-Hashing:** bcrypt (via pgcrypto)
- **Admin:** Erster Beitritt ist Admin, Passwort-geschützte Teilnehmer-Verwaltung
- **Session:** localStorage (participant_id), Wiederherstellung via RPC
- **RLS:** Join-Code-basiert via `x-join-code` HTTP-Header

### RPC-Funktionen

| Funktion | Beschreibung |
|----------|-------------|
| `login_participant` | Login/Registrierung mit bcrypt |
| `change_participant_password` | Passwort ändern |
| `restore_participant_session` | Session wiederherstellen |
| `verify_admin_password` | Admin-Passwort prüfen (bcrypt) |
| `set_admin_password` | Admin-Passwort setzen (bcrypt) |
| `rename_participant` | Teilnehmer umbenennen (atomare Transaktion) |
| `batch_reorder_items` | Items sortieren (unnest-optimiert) |
| `batch_reorder_notes` | Notizen sortieren (unnest-optimiert) |
| `batch_reorder_categories` | Kategorien sortieren |
| `batch_delete_items` | Batch-Löschen |
| `toggle_note_favorite` | Notiz-Favorit umschalten |

---

## Deployment

### Automatisch (GitHub Actions)

1. Repo auf GitHub pushen (Branch `main`)
2. In GitHub Repo → Settings → Pages → Source: "GitHub Actions"
3. Secrets setzen (Settings → Secrets and variables → Actions):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Jeder Push auf `main` → automatischer Build + Deploy

**Live unter:** [flokoko.github.io/BellaMozzarella](https://flokoko.github.io/BellaMozzarella/)

---

## Mitwirken

Pull Requests willkommen! Bitte vorher `npm run test` und `npm run build` ausführen.

---

## Lizenz

MIT — gemacht mit 🧀 und 🇮🇹
