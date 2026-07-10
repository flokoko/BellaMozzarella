# 🏖️ Urlaubs-Einkaufslisten-App

Gemeinsame Einkaufsliste für Gruppenurlaube. Realtime-Sync via Supabase, mobil-optimiert.

## Features

- **Join-Code System**: Teilnehmer treten mit einem Code (z.B. `URLAUB26`) bei
- **Einkaufsliste**: Items nach Kategorien gruppiert (Essen, Getraenke, Snacks, Equipment, Sonstiges)
- **Mitbringen-Ansicht**: Wer bringt was mit? Items Personen zuweisen und "mitgebracht" abhaken
- **Realtime-Sync**: Alle Änderungen erscheinen sofort bei allen Teilnehmern (Supabase Realtime)
- **Mobile-First**: Optimiert für Smartphone-Nutzung

## Tech Stack

- React + TypeScript (Vite)
- Supabase (Datenbank + Realtime)
- CSS (plain, keine UI-Lib)
- GitHub Pages (Hosting)

## Setup

```bash
# Dependencies
npm install

# .env erstellen (siehe .env.example)
cp .env.example .env
# Dann Werte eintragen:
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key

# Dev-Server
npm run dev
```

## Build

```bash
npm run build
```

## Deploy auf GitHub Pages

### Automatisch (GitHub Actions)

1. Repo zu GitHub pushen (Branch `main`)
2. In GitHub Repo Settings → Settings → Pages → Source: "GitHub Actions" auswählen
3. Unter Settings → Secrets and variables → Actions diese Secrets setzen:
   - `VITE_SUPABASE_URL` — die Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` — der Supabase Anon Key
4. Bei jedem Push auf `main` baut der Workflow automatisch und deployt

Die App ist dann erreichbar unter: **https://flokoko.github.io/urlaubsliste/**

### Manuell (gh-pages)

```bash
npm run deploy
```

Dies baut die App und pusht `dist/` auf den `gh-pages` Branch.

## Supabase Schema

### Tabelle `lists`
| Spalte | Typ |
|--------|-----|
| id | uuid PK |
| name | text |
| join_code | text unique |
| created_at | timestamptz |

### Tabelle `items`
| Spalte | Typ |
|--------|-----|
| id | uuid PK |
| list_id | uuid FK → lists |
| name | text |
| category | text (Essen, Getraenke, Snacks, Equipment, Sonstiges) |
| quantity | text |
| assigned_to | text nullable |
| is_checked | bool |
| is_brought | bool |
| created_by | text nullable |
| created_at | timestamptz |

## Nutzung

1. App öffnen → Join-Code eingeben (default: `URLAUB26`)
2. Namen eingeben → "Beitreten"
3. Items hinzufügen (Name, Menge, Kategorie, optional zugewiesen an)
4. Häkchen setzen wenn gekauft ("erledigt")
5. Auf "Mitbringen"-Tab wechseln um zu sehen wer was mitbringt
6. "Mitgebracht"-Häkchen setzen wenn item angekommen ist