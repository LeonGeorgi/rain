# Ausbauidee: GitHub Pages und GitHub Actions

## Variante A: GitHub Pages als statischer Host

Die Anwendung kann zunächst unverändert im Browser rechnen und JMA direkt abrufen. GitHub Pages liefert nur die Dateien aus `dist/` aus. Der lokale IndexedDB-Cache bleibt bestehen.

Vorgehen:

1. Quellcode in ein eigenes GitHub-Repository übernehmen.
2. Für die erste Version eine Adresse an der Domainwurzel wählen, beispielsweise ein Repository `BENUTZERNAME.github.io` oder eine eigene Domain.
3. Lokal `pnpm build` ausführen und den Inhalt von `dist/` in den Veröffentlichungsbranch kopieren.
4. Unter **Settings → Pages** den Branch und das Veröffentlichungsverzeichnis auswählen.

Alternativ kann ein eigener Actions-Workflow Installation, Build und Pages-Veröffentlichung übernehmen. Dann **GitHub Actions** als Pages-Quelle einstellen. Die üblichen Schritte sind Checkout, Node/pnpm einrichten, `pnpm install --frozen-lockfile`, `pnpm build`, `actions/configure-pages`, `actions/upload-pages-artifact` mit `path: dist` und `actions/deploy-pages`. Der Deployment-Job benötigt `pages: write`, `id-token: write` und das Environment `github-pages`.

**Projektadresse:** Für `BENUTZERNAME.github.io/REPOSITORY/` mit `pnpm build --base=/REPOSITORY/` bauen. Vite setzt die Asset-Pfade; die Datenabrufe, der Startseiten-Link und das Favicon verwenden denselben Basispfad. Alternativ `base: '/REPOSITORY/'` in `vite.config.ts` eintragen. Für eine eigene Domain an der Domainwurzel genügt `pnpm build`.

## Variante B: Actions aktualisiert die JMA-Daten zentral

Ziel: Besucher laden fertig bereitgestellte Stationsdateien von derselben Website. Die Anwendung bleibt statisch; JMA wird zentral durch einen geplanten Job abgefragt.

Vorgeschlagene Dateistruktur für den Ausbau:

```text
public/data/
  stations.json
  47662/
    history.json
    current.json
  47759/
    history.json
    current.json
```

`stations.json` sollte Stationsnummer, Namen, verfügbare Jahre und URLs enthalten. Jede Datendatei sollte einen Schema-Stand, `fetchedAt`, den letzten Beobachtungstag und die Qualitätskennzeichen speichern. Die obige Struktur ist vorgeschlagen und noch nicht implementiert; derzeit liegen nur die beiden Tokyo-Dateien unter `public/data/`.

Empfohlener Ablauf:

1. **Einmaliger Import:** Für eine begrenzte Stationsliste die historischen Tageswerte laden, auf Vollständigkeit und Qualität prüfen und dauerhaft als Dateien im Repository ablegen.
2. **Regelmäßiges Update:** Beispielsweise zweimal täglich aktuelle Werte laden. Anfangs kann das ganze laufende Jahr erneut geladen werden; später reicht ein überlappender jüngster Zeitraum plus gelegentliche vollständige Prüfung auf Korrekturen.
3. **Validierung:** Stationskennung, Datumsgrenzen, doppelte Tage, Zahlenformat und Qualitätscodes prüfen. Fehlende Messungen niemals als 0 mm interpretieren. Für weitere Stationen auch Monatsabgleiche ergänzen.
4. **Fehlerfall:** Bei unplausibler oder unvollständiger Antwort den zuletzt gültigen Stand beibehalten und den fehlgeschlagenen Lauf sichtbar machen.
5. **Dauerhafte Speicherung:** Geänderte Datendateien beispielsweise in einen dedizierten Datenbranch schreiben. Ein Actions-Cache oder die temporäre Runner-Festplatte ist keine verlässliche dauerhafte Datenquelle.
6. **Veröffentlichung:** Den validierten Datenstand in den Build übernehmen und die gesamte statische Website über Pages veröffentlichen. Update, Build und Deployment können im selben Workflow laufen.
7. **Frontend anpassen:** Die vorhandenen direkten JMA-Aufrufe durch Abrufe der Stations-JSON-Dateien ersetzen. IndexedDB bleibt ein zusätzlicher lokaler Cache. Ein Versionsfeld oder `fetchedAt` sollte auch Änderungen historischer Dateien erkennbar machen.

Ein möglicher Zeitplan als Ausschnitt eines späteren Workflows:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: '23 0,12 * * *' # UTC; zweimal täglich
```

Das ist nur die Trigger-Konfiguration, kein vollständiger ausführbarer Workflow. Ein JMA-Updateskript und der komplette Build-/Deployment-Workflow müssen noch erstellt werden. Es liegt bewusst keine aktivierte Datei unter `.github/workflows/` im Projekt.

Geplante Läufe sind nicht minutengenau garantiert. GitHub kann sie bei hoher Last verzögern oder ausfallen lassen; bei öffentlichen Repositories können Zeitpläne nach 60 Tagen ohne Repository-Aktivität deaktiviert werden. Deshalb den tatsächlichen Beobachtungs- und Aktualisierungsstand anzeigen und Fehler überwachen.

## Stationsauswahl im Actions-Modell

Der Nutzer wählt aus den vorbereiteten Stationen. Die Auswahl lädt nur deren Dateien; sie startet keinen neuen Actions-Lauf. Neue Stationen werden zur Importliste hinzugefügt und beim nächsten Import vorbereitet.

Für beliebige, noch nicht vorbereitete Stationen wäre weiterhin ein direkter Browserabruf bei JMA oder ein kleiner API-Endpunkt nötig. Ein GitHub-Token zum Starten von Workflows gehört nicht in den öffentlichen Frontend-Code.

Die Statistik kann im Browser bleiben: So funktionieren ein anderer Referenzzeitraum und eine andere Glättung ohne neue Serveranfrage. Erst bei wesentlich mehr Daten wäre zusätzliches Vorberechnen sinnvoll. Für dieses Projekt würde ich zunächst Variante A nutzen und Variante B ergänzen, wenn direkte JMA-Abrufe oder erste Stationsimporte im Alltag stören.

## Offizielle GitHub-Dokumentation

Stand der Dokumentationsprüfung: 11.09.2026.

- [Eigene Workflows für GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Veröffentlichungsquelle für Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Geplante Actions-Läufe](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

[Zurück zur Projektübersicht](../README.md)
