# Volleyball Turnier – Vercel Webapp

Statische Webapp ohne Backend oder externe Abhängigkeiten.

## Funktionen

- 10 Teamnamen frei eingeben
- Vorrundenmodus über **Spiele pro Team** ändern (Standard: 3)
- Automatischer Round-Robin-Spielplan ohne Doppelbegegnungen
- Bei 3 Spielen pro Team: 3 Runden × 5 Spiele = 15 Spiele
- Ein Satz pro Spiel
- Ergebniseingabe direkt im Spielplan
- Tabelle nach:
  1. Siege
  2. Punktedifferenz
  3. erzielte Punkte
  4. Teamname
- Top 4 und Bottom 2 automatisch markieren
- Speicherung im Browser via `localStorage`
- Responsive für Handy/Tablet/Desktop

## Vercel Deployment

### Variante A: Git
1. Ordner in ein GitHub-/GitLab-/Bitbucket-Repository hochladen.
2. In Vercel **Add New Project** wählen.
3. Repository importieren.
4. Framework Preset kann auf **Other** bleiben.
5. Deploy starten.

### Variante B: Vercel CLI

```bash
npm i -g vercel
vercel
```

Im Projektordner ausführen und den Dialog bestätigen.

## Wichtiger Hinweis zur Speicherung

Die Daten liegen aktuell nur im Browser des jeweiligen Geräts. Das ist ideal für eine einzelne Turnierleitung auf einem Laptop/Tablet.

Wenn mehrere Geräte gleichzeitig dieselben Ergebnisse sehen und bearbeiten sollen, braucht die App eine gemeinsame Datenbank, z. B. Vercel Postgres/Neon oder Supabase.
