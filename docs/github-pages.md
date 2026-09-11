# GitHub Actions und GitHub Pages

Die Website wird aus dem privaten Repository `LeonGeorgi/rain` über GitHub Pages veröffentlicht. Repository-Sichtbarkeit und Website-Sichtbarkeit sind getrennt: Eine gewöhnliche Pages-Website ist öffentlich erreichbar.

## Workflows

| Datei | Auslöser | Aufgabe |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull Requests und Pushes auf andere Branches | Installation, Typprüfung, ESLint, Tests, Datenvalidierung und Produktionsbuild |
| `.github/workflows/pages.yml` | Push auf `main`, manueller Start oder Aufruf durch Datenworkflow | Prüfung, Build mit dem von Pages gelieferten Basispfad und Deployment |
| `.github/workflows/update-data.yml` | 00:23 und 12:23 UTC sowie manueller Start | Messwerte abrufen, validieren, committen und den Pages-Workflow aufrufen |

Der Zeitplan entspricht 09:23 und 21:23 japanischer Zeit. GitHub kann geplante Läufe verzögern. Ein fehlgeschlagener Lauf bleibt in Actions sichtbar und ändert die bestehende Website nicht. Zeitpläne laufen auf dem Standardbranch.

## Einmalige Repository-Einrichtung

- Unter **Settings → Pages → Build and deployment → Source** muss **GitHub Actions** gewählt sein.
- GitHub Actions muss im Repository aktiviert sein. Für Pages in einem privaten Repository muss der GitHub-Tarif diese Funktion unterstützen.
- Das Environment `github-pages` muss Deployments von `main` erlauben. Bei Schutzregeln für `main` muss der Datenworkflow seine Datencommits pushen dürfen.
- Es sind keine eigenen API-Schlüssel, PAT-Secrets oder JMA-Zugangsdaten nötig. Der kurzlebige `GITHUB_TOKEN` erhält die im jeweiligen Workflow angegebenen Berechtigungen.

Der Pages-Workflow übernimmt den Basispfad aus `actions/configure-pages`. Das funktioniert sowohl für `/rain/` als auch für eine eigene Domain. Lokal: `pnpm build --base=/rain/` und `pnpm preview --base=/rain/`.

## Datenformat und Speicherung

```text
public/data/
  stations.json
  47662/             Tokyo
    history.json
    current.json
  47759/             Kyoto
  47772/             Osaka
  47412/             Sapporo
  47807/             Fukuoka
  47936/             Naha
```

Jede Stationsdatei enthält `schemaVersion`, `stationId`, `revision`, `fetchedAt`, `from`, `to`, `source` und Tageszeilen `[Datum, Niederschlag oder null, Qualitätscode]`. Die SHA-256-Revision hängt vom Stationsinhalt und Zeitraum ab. Das Manifest verweist auf die Dateien und ihre Revisionen.

Daten liegen dauerhaft im Standardbranch und seiner Git-Historie. Ein Actions-Cache ist keine Datenquelle. Der Browser lädt neue Daten bei geänderter Revision und behält bei Netzwerkfehlern seinen letzten lokalen Stand. „Aktualisieren“ prüft nur veröffentlichte Dateien.

Historische Daten beginnen 1876. Zum Jahreswechsel lädt der Importer das fehlende Vorjahr vollständig nach. Am 1. Januar darf das aktuelle Jahr noch leer sein. Die Referenzauswahl passt ihre Jahresobergrenze automatisch an.

## Daten manuell aktualisieren

In **Actions → Update JMA data → Run workflow** auf `main` starten. Für eine vollständige historische Neuabfrage `refresh_history` aktivieren. Im Normalbetrieb werden vorhandene historische Dateien wiederverwendet.

Lokal:

```bash
pnpm data:update
pnpm data:validate
pnpm check
pnpm build

# Optional: alle historischen Zeiträume erneut bei JMA laden
pnpm data:update --refresh-history
```

Der Import erfolgt in historischen Blöcken von höchstens 30 Jahren. Alle Stationen müssen erfolgreich geprüft sein, bevor Dateien geschrieben werden. Ein Abbruch, ein falscher Stationsname, fehlende oder doppelte Tage, ein unbekanntes Zahlenformat oder ein Rückgang vollständiger Tageswerte lässt den Lauf scheitern. Fehlende Beobachtungen sind keine Nullen. Die Statistik verwendet weiterhin nur vollständige Jahre mit Qualitätscode 8.

## Veröffentlichung nach Datenupdates

Der Datenjob prüft die Dateien, erzeugt einen Commit und pusht ihn ohne Force-Push. Änderungen auf `main` während eines Imports können deshalb einen Konflikt verursachen; dann den Workflow erneut starten. Daten werden nicht stillschweigend über fremde Änderungen geschrieben.

Commits mit `GITHUB_TOKEN` starten üblicherweise keinen weiteren Push-Workflow. Deshalb ruft der Datenworkflow den wiederverwendbaren Pages-Workflow ausdrücklich mit dem vollständigen neuen Commit-SHA auf. Scheitert der anschließende Build, bleiben die Daten im Repository gesichert und die vorherige Website online. Der Pages-Workflow kann nach der Fehlerbehebung manuell erneut gestartet werden.

Deployments werden nacheinander ausgeführt; ein laufendes Deployment wird nicht abgebrochen. Pull Requests bekommen keine Schreibrechte und veröffentlichen nichts. Die verwendeten Actions sind auf vollständige Commit-SHAs festgelegt.

## Offizielle Dokumentation

- [GitHub Pages mit eigenen Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Pages-Veröffentlichungsquelle einstellen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Workflows durch andere Workflows auslösen](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)
- [Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

[Zurück zur Projektübersicht](../README.md)
