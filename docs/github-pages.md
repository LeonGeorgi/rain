# GitHub Actions und GitHub Pages

Die Website wird aus dem privaten Repository `LeonGeorgi/rain` über GitHub Pages veröffentlicht. Repository-Sichtbarkeit und Website-Sichtbarkeit sind getrennt: Eine gewöhnliche Pages-Website ist öffentlich erreichbar.

## Workflows

| Datei | Auslöser | Aufgabe |
| --- | --- | --- |
| `.github/workflows/ci.yml` | Pull Requests und Pushes auf andere Branches | Installation, Typprüfung, ESLint, Tests, Datenvalidierung und Produktionsbuild |
| `.github/workflows/pages.yml` | Push auf `main`, PR-Ereignisse, manueller Start oder Aufruf durch Datenworkflow | Hauptseite und offene PR-Vorschauen bauen und gemeinsam veröffentlichen |
| `.github/workflows/update-data.yml` | 00:23 und 12:23 UTC sowie manueller Start | Messwerte abrufen, validieren, committen und den Pages-Workflow aufrufen |

Der Zeitplan entspricht 09:23 und 21:23 japanischer Zeit. GitHub kann geplante Läufe verzögern. Ein fehlgeschlagener Datenimport oder Produktionsbuild bleibt in Actions sichtbar und ändert die bestehende Website nicht. Fehlgeschlagene PR-Builds werden separat angezeigt und ihre Vorschauen beim nächsten erfolgreichen Deployment weggelassen. Zeitpläne laufen auf dem Standardbranch.

## Einmalige Repository-Einrichtung

- Unter **Settings → Pages → Build and deployment → Source** muss **GitHub Actions** gewählt sein.
- GitHub Actions muss im Repository aktiviert sein. Für Pages in einem privaten Repository muss der GitHub-Tarif diese Funktion unterstützen.
- Das Environment `github-pages` muss Deployments von `main` erlauben. Bei Schutzregeln für `main` muss der Datenworkflow seine Datencommits pushen dürfen.
- Es sind keine eigenen API-Schlüssel, PAT-Secrets oder Zugangsdaten der Wetterdienste nötig. Der kurzlebige `GITHUB_TOKEN` erhält die im jeweiligen Workflow angegebenen Berechtigungen.

Der Pages-Workflow übernimmt den Basispfad aus `actions/configure-pages`. Das funktioniert sowohl für `/rain/` als auch für eine eigene Domain. Lokal: `pnpm build --base=/rain/` und `pnpm preview --base=/rain/`.

## PR-Vorschauen

Nach dem Merge dieses Workflows nach `main` werden PRs aus Branches desselben Repositories mit Ziel `main` automatisch veröffentlicht. Fork-PRs bekommen weiterhin CI-Prüfungen, aber keine automatische Veröffentlichung. Auslöser sind Öffnen, neue Commits, Wiederöffnen, Bearbeiten und Schließen; ein manueller Start auf `main` gleicht alle offenen PRs ab. Der erste Push nach dem Merge nimmt bereits offene PRs mit auf. Der Infrastruktur-PR selbst kann vor diesem Merge noch keine Vorschau über den neuen Workflow bereitstellen.

| Installation | Hauptseite | Vorschau für PR #1 |
| --- | --- | --- |
| Custom Domain | `https://deine-domain.de/` | `https://deine-domain.de/pr-preview/1/` |
| GitHub-Projektseite | `https://leongeorgi.github.io/rain/` | `https://leongeorgi.github.io/rain/pr-preview/1/` |

Die bestehende Domainkonfiguration in Pages bleibt bestehen; zusätzliche DNS-Einträge sind nicht nötig. Der Produktionsbuild nutzt den von `configure-pages` gelieferten Basispfad, jede Vorschau hängt `pr-preview/<Nummer>/` an. Vite-Assets, Favicon und Datenabrufe folgen diesem Pfad. Jede Vorschau enthält die Daten ihres eigenen Commits. Der lokale Datencache wird ebenfalls nach Basispfad getrennt, damit Hauptseite und Vorschauen mit dieser Codeversion nicht denselben Cacheeintrag überschreiben.

Jeder Lauf baut den aktuellen `main`-Commit und die exakten Head-Commits aller offenen, geeigneten PRs neu. Produktions- und PR-Builds laufen in getrennten Jobs. Ein vertrauenswürdiger Job setzt nur statische Dateien zu einem einzigen Pages-Artefakt zusammen. Die Hauptseite wird über die konkrete Artefakt-ID ihres Build-Jobs geladen. Geschlossene Vorschauen werden nicht mehr aufgenommen und verschwinden dadurch ohne separaten Lösch-Branch. Es gibt keinen zusätzlichen `gh-pages`-Branch und keine langfristige Abhängigkeit von alten Actions-Artefakten.

Nach erfolgreichem Deployment erhält jeder offene PR einen aktualisierten Bot-Kommentar mit Vorschau-Link und Commit-SHA. Ein fehlgeschlagener oder zu großer Preview-Build erhält stattdessen einen Hinweis. Ein neuer Commit während eines laufenden Builds wird durch den nächsten Lauf übernommen; der Kommentar bezeichnet einen älteren Build nicht als aktuellen Stand. Ein Schließen-Ereignis aktualisiert auch den bisherigen Kommentar zur entfernten Vorschau.

PR-Code wird ausschließlich mit `contents: read` auf frischen Runnern gebaut, ohne gespeicherte Checkout-Zugangsdaten, Deployment-Environment, Secrets oder gemeinsamen Build-Cache. Planung, Zusammenstellung und Kommentare verwenden Helfer aus der vertrauenswürdigen Workflow-Revision. Nur der abschließende Deployment-Job erhält `pages: write` und `id-token: write`; der Kommentarjob erhält `pull-requests: write`. Die Vorschauen sind wie die Hauptseite öffentlich und liegen auf derselben Origin. Es sind Vorschauen für eigene Repository-Branches, keine Isolation für fremde Webanwendungen.

Der vollständige Neuaufbau hält das Deployment einfach und konsistent, benötigt aber pro offenem PR einen zusätzlichen Build und eine Kopie der Messdaten. Vier Vorschauen werden höchstens gleichzeitig gebaut. Das gemeinsame Paket hat ein Budget von 900 MiB; Vorschauen darüber werden ausgelassen, damit die Hauptseite veröffentlicht werden kann. Nicht erfolgreiche Vorschauen behalten keine alte, möglicherweise irreführende Version. Scheitert der Produktionsbuild oder das eigentliche Pages-Deployment, bleibt die vorherige veröffentlichte Website bestehen. Künftige Änderungen am Deployment sollten die Prüfungen in `tests/pages-preview.test.mjs` berücksichtigen.

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
  dwd-00433/         Berlin-Tempelhof
  dwd-01975/         Hamburg-Fuhlsbüttel
  dwd-03379/         München-Stadt
  dwd-01420/         Frankfurt/Main
  dwd-02667/         Köln/Bonn
  dwd-01048/         Dresden-Klotzsche
  ghcn-USW00094728/  New York (weitere 37 GHCN-Stationen)
  knmi-260/          De Bilt (weitere fünf KNMI-Stationen)
```

Jede Stationsdatei enthält `schemaVersion`, `stationId`, `revision`, `fetchedAt`, `from`, `to`, `source` und Tageszeilen `[Datum, Niederschlag oder null, Qualitätscode]`. Bei JMA bleibt der Originalcode erhalten, beim DWD `QN_4` (fehlendes Kennzeichen als 0); die jeweiligen Regeln stehen in der Methodik. DWD-Quellen-URLs verweisen auf die tatsächlich verwendeten Archive. Bei GHCN wird zusätzlich das ursprüngliche dreistellige Mess-/Qualitäts-/Quellenflag als viertes Tupelfeld gespeichert. GHCN/KNMI verwenden interne Statuswerte 0 (fehlend/abgelehnt), 1 (verwendbarer Betrag), 2 (Spur, rechnerisch null). Diese Werte sind keine DWD- oder JMA-Codes. Die SHA-256-Revision hängt vom Stationsinhalt und Zeitraum ab. Das Manifest verweist auf die Dateien und ihre Revisionen.

Daten liegen dauerhaft im Standardbranch und seiner Git-Historie. Ein Actions-Cache ist keine Datenquelle. Der Browser lädt neue Daten bei geänderter Revision und behält bei Netzwerkfehlern seinen letzten lokalen Stand. „Aktualisieren“ prüft nur veröffentlichte Dateien.

JMA-Daten beginnen im Abruffenster 1876 und werden zum Jahreswechsel ergänzt. DWD-Daten beginnen beim Stationsbeginn; die abgeschlossenen Archive werden bei jedem Lauf neu gelesen. Ein noch nicht im DWD-Archiv veröffentlichtes Vorjahr bleibt aus der historischen Referenz ausgeschlossen. Aktuelle DWD-Werte aus `recent` sind vorläufig. Die Jahresgrenzen werden pro Station in japanischer beziehungsweise der jeweiligen Stationszeitzone bestimmt. Am 1. Januar darf das aktuelle Jahr noch leer sein. Die Referenzauswahl passt ihre Jahresobergrenze automatisch an.

## Daten manuell aktualisieren

In **Actions → Update weather data → Run workflow** auf `main` starten. Für eine vollständige historische Neuabfrage `refresh_history` aktivieren. Im Normalbetrieb werden vorhandene JMA-Historien wiederverwendet; DWD-, GHCN- und KNMI-Archive werden immer neu gelesen.

Lokal:

```bash
pnpm data:update
pnpm data:validate
pnpm check
pnpm build

# Optional: alle historischen Zeiträume erneut bei JMA laden
pnpm data:update --refresh-history
```

Der JMA-Import erfolgt in historischen Blöcken von höchstens 30 Jahren; der DWD liefert je Station ein historisches und ein aktuelles ZIP-Archiv. Alle Stationen müssen erfolgreich geprüft sein, bevor Dateien geschrieben werden. Ein Abbruch, ein falscher Stationsname, fehlende oder doppelte Tage, ein unbekanntes Zahlenformat oder ein Rückgang vollständiger Tageswerte lässt den Lauf scheitern. Fehlende Beobachtungen sind keine Nullen. Die Statistik verwendet nur vollständige Jahre nach den Qualitätsregeln des jeweiligen Anbieters. Die internationalen Archive und deren Abrufverzögerungen beschreibt [Internationale Daten](international-data.md).

## Veröffentlichung nach Datenupdates

Der Datenjob prüft die Dateien, erzeugt einen Commit und pusht ihn ohne Force-Push. Änderungen auf `main` während eines Imports können deshalb einen Konflikt verursachen; dann den Workflow erneut starten. Daten werden nicht stillschweigend über fremde Änderungen geschrieben.

Commits mit `GITHUB_TOKEN` starten üblicherweise keinen weiteren Push-Workflow. Deshalb ruft der Datenworkflow den wiederverwendbaren Pages-Workflow ausdrücklich mit dem vollständigen neuen Commit-SHA auf. Der Pages-Workflow liest bei der Planung den aktuellen `main`-Stand; falls inzwischen ein neuerer Commit vorliegt, hat dieser Vorrang, damit ein verzögert gestarteter Datenlauf keine ältere Hauptseite wiederherstellt. Scheitert der anschließende Build, bleiben die Daten im Repository gesichert und die vorherige Website online. Der Pages-Workflow kann nach der Fehlerbehebung manuell erneut gestartet werden.

Deployments werden nacheinander ausgeführt; ein laufendes Deployment wird nicht abgebrochen. PR-Build-Jobs bekommen keine Schreibrechte; die Veröffentlichung ihrer statischen Ergebnisse übernimmt der getrennte Pages-Deployment-Job. Die verwendeten Actions sind auf vollständige Commit-SHAs festgelegt.

## Offizielle Dokumentation

- [GitHub Pages mit eigenen Workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [Pages-Veröffentlichungsquelle einstellen](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Workflows durch andere Workflows auslösen](https://docs.github.com/en/actions/how-tos/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow)
- [Zeitgesteuerte Workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)

[Zurück zur Projektübersicht](../README.md)

