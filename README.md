# Ame — Niederschlag in Japan

Eine statische React-Webseite, die den aktuellen Niederschlag mit echten historischen Tagesmessungen der Japan Meteorological Agency (JMA) vergleicht. Die zentrale Frage: Wie ungewöhnlich ist die bisherige Regenmenge dieses Jahres?

Derzeit laufen Datenabruf, Berechnung und Cache vollständig im Browser. Es gibt keinen eigenen API-Server und keine aktiven GitHub-Actions-Workflows. Die in [docs/github-pages.md](docs/github-pages.md) beschriebene GitHub-Erweiterung ist ein Ausbauplan.

## Schnellstart

Voraussetzungen: Node.js ab 22.13 und pnpm 11.25.0, entsprechend `package.json`.

```bash
# Falls pnpm noch nicht installiert ist:
npm install --global pnpm@11.25.0

# Im entpackten Projektverzeichnis:
pnpm install --frozen-lockfile
pnpm dev
```

Die lokale Entwicklung läuft auf `http://localhost:5173`. Installation, Entwicklung und Build verwenden direkt pnpm und Vite.

```bash
# Statische Website neu erzeugen:
pnpm build

# Statischen Export lokal ansehen:
pnpm preview

# Typen und Lint-Regeln prüfen:
pnpm typecheck
pnpm lint
```

Anschließend `http://localhost:4173` öffnen. Ohne Node-Installation lässt sich der mitgelieferte Export alternativ mit `python3 -m http.server 8080 --directory dist` ansehen. Die Seite über HTTP öffnen, nicht per Doppelklick als `file://`.

## Funktionsumfang

- Stationsauswahl: Tokyo, Kyoto, Osaka, Sapporo, Fukuoka und Naha.
- Kumulative Niederschläge ohne Glättung oder täglicher Niederschlag mit Gauß-Kernel (σ = 11 Tage).
- Historischer Median, zentrale 50-%- und 90-%-Intervalle sowie Min–Max.
- Referenz: alle geeigneten Jahre im Archivfenster 1876–2025 oder 1991–2020.
- Aktuelles Kalenderjahr als orange Linie bis zum letzten zusammenhängenden gültigen Tageswert.
- Drei historische Vergleichsjahre mit den höchsten kumulativen Summen am gleichen Stichtag.
- Ablesen einzelner Tage mit Maus oder Pfeiltasten; PNG- und CSV-Download.
- Browser-Cache pro Station und Datenblock, zwölf Stunden Cache-Dauer für aktuelle Daten.

## Aufbau

```text
index.html              HTML-Einstieg, Metadaten und Favicon
src/
  main.tsx              Startet React
  App.tsx               Oberfläche, Diagramm und Datenladeablauf
  components/ui/        Select, Tabs und Checkbox
  lib/                  JMA-Abruf, Cache, Statistik und Klassenhilfen
  styles/               Globale Styles und übernommene Styles mit Lizenz
public/data/            Vorbereitete Tokyo-Tagesdaten
docs/                   GitHub-Pages-/Actions-Ausbauplan
dist/                   Fertige statische Website nach pnpm build
```

Die App verwendet React 19, Vite 8, TypeScript 6 und Tailwind CSS 4. React startet im Browser über `createRoot`; es gibt weder Server Components noch einen Anwendungsserver. Die Vite-Konfiguration enthält nur die React-/Tailwind-Plugins und den Alias `@/` für `src/`. TypeScript prüft Anwendung und Vite-Konfiguration mit einer gemeinsamen `tsconfig.json`. ESLint verwendet die React-Hooks-, Fast-Refresh- und TypeScript-Regeln.

`pnpm build` prüft zuerst die Typen und schreibt anschließend die Website nach `dist/`. `pnpm preview` (auch `pnpm start`) zeigt diesen Build lokal an. `pnpm check` führt Typprüfung und Linting aus. Auf einen statischen Host gehört der Inhalt von `dist/`.

Die Paketversionen sind im Lockfile festgelegt. Die vorhandene siebentägige Freigabefrist für neue Pakete bleibt aktiv. TypeScript 6 ist auf die unterstützte Version von `typescript-eslint` abgestimmt.

Dokumentation: [Vite](https://vite.dev/guide/), [React](https://react.dev/learn), [Tailwind mit Vite](https://tailwindcss.com/docs/installation/using-vite).

## Aktueller Datenfluss und Cache

1. Beim Stationswechsel liest die Anwendung zuerst IndexedDB.
2. Tokyo kann sofort auf die mitgelieferten historischen Daten zurückgreifen.
3. Für andere Stationen lädt sie fünf Zeitblöcke von jeweils 30 Jahren direkt bei JMA. Die Blöcke werden nacheinander gespeichert; nach einer Unterbrechung können fertige Blöcke wiederverwendet werden.
4. Historische Daten bis 2025 bleiben ohne Ablaufdatum gespeichert.
5. Aktuelle Daten werden beim Laden der Station geprüft. Nach zwölf Stunden oder über „Aktualisieren“ wird das laufende Jahr bis gestern in japanischer Zeit erneut abgerufen. Es gibt keinen Hintergrundtimer bei geschlossener Seite.
6. Bei Abruffehlern bleibt ein vorhandener Stand sichtbar. Wenn IndexedDB nicht verfügbar ist, gibt es einen Sitzungsspeicher mit Hinweis.

Jeder Browser hat seinen eigenen Cache. Browser können gespeicherte Daten löschen. Historische Korrekturen von JMA werden derzeit nicht automatisch übernommen. Die historische Obergrenze 2025 ist fest eingestellt und muss für spätere Referenzjahre angepasst werden.

## Weiterentwicklung

Der [Ausbauplan für GitHub Pages und GitHub Actions](docs/github-pages.md) beschreibt statisches Hosting und eine mögliche zentrale Aktualisierung der JMA-Daten.

## Datenquellen und wissenschaftliche Methodik

Offizielle Quellen:

- [JMA-Downloadoberfläche](https://www.data.jma.go.jp/risk/obsdl/)
- [JMA-CSV-Endpunkt](https://www.data.jma.go.jp/risk/obsdl/show/table), verwendet per POST
- [Tokyo-Monatssummen](https://www.data.jma.go.jp/stats/etrn/view/monthly_s3.php?prec_no=44&block_no=47662&year=&month=&day=&view=p5)

Der Browser sendet URL-kodierte POST-Daten ohne Zugangsdaten und dekodiert die CSV als Shift-JIS. Am 11.09.2026 lieferte der HTTP-Test für alle sechs Stationen die richtigen Namen sowie `Access-Control-Allow-Origin: *`. Auch ein kompletter historischer Kyoto-Zeitblock wurde geprüft. Ein vollständiger Browser-End-to-End-Test erfolgte noch nicht. JMA kontrolliert CORS und das Exportformat; Änderungen können Anpassungen erfordern.

Die Tokyo-Ausgangsdaten enthalten 54.787 Tageszeilen für 1876–2025. Davon erfüllen 141 vollständige Jahre die Qualitätsregel. Das beigefügte aktuelle Jahr endet am 09.09.2026 mit 1.567 mm und wird bei veraltetem Cache direkt bei JMA aktualisiert. Das Teiljahr 1875 ist ausgeschlossen. Für andere Stationen ist 1876 die untere Abrufgrenze, keine Behauptung über deren Beobachtungsbeginn.

Für die Referenz werden ausschließlich vollständige Jahre mit JMA-Qualitätscode 8 verwendet. Bei kumulativen Kurven wird der Niederschlag des 29. Februar mit aufsummiert; nur sein Achsenpunkt entfällt. Jahressummen bleiben dadurch erhalten. Bei der Gauß-Glättung wird der 29. Februar vorher entfernt. Historische 365-Tage-Reihen werden zyklisch geglättet (σ = 11 Tage, Radius 44 Tage). Das aktuelle Jahr nutzt vollständige vorhergehende Dezemberwerte, soweit vorhanden. Am offenen Ende wird der Kernel neu normiert; die letzten 44 Tage sind gestrichelt.

Fehlende oder nicht normale aktuelle Tageswerte beenden die Kurve. Quantile werden pro Kalendertag über die fertigen Jahreskurven berechnet, mit linearer Interpolation (Typ 7). Die Flächen sind punktweise historische Verteilungen, keine Konfidenzintervalle und keine Prognosebänder. Die langen Reihen sind nicht separat homogenisiert oder um Klimatrends bereinigt.

Für Tokyo wurden ursprünglich alle 1.800 Monatssummen mit den offiziellen JMA-Monatsdaten abgeglichen. Eine Übereinstimmung aufsummierter verfügbarer Werte beweist nicht, dass fehlende Tage vollständig sind. Bei anderen Stationen gibt es bislang Datums- und Qualitätsprüfungen, aber keinen zusätzlichen Monatsabgleich.

## Bisherige Prüfung

Nach der Vite-Migration sind `pnpm check` (TypeScript und ESLint) sowie `pnpm build` erfolgreich. Entwicklungsmodus und Produktionsvorschau wurden im Browser geprüft: Tokyo-Daten laden, Wechsel zwischen kumulativem und geglättetem Verlauf, Referenzzeitraum und Intervallanzeige funktionieren. CSV-Export (365 Tageszeilen) und PNG-Export wurden heruntergeladen und geprüft. Ein zusätzlicher Build mit `/rain/` als Basispfad enthält korrekt aufgelöste Assets. JMA-Logik und Ausgangsdaten sind gegenüber dem Stand vor der Migration unverändert.

- TypeScript-Prüfung und statischer Produktionsbuild erfolgreich.
- Alle 365 × 8 Spalten der kumulativen Berechnung stimmen innerhalb 0,000001 mm mit der bisherigen Python-Auswertung überein.
- Referenzgrößen, Rangfolge am 9. September (1938, 1941, 2024), Schaltjahressummen, Abbruch bei Datenlücken, Gauß-Normierung und offizieller CSV-Parser geprüft.
- Der vollständige Erstimport aller übrigen Stationen und der optionale, nur lesende WebMCP-Aufruf wurden bei dieser Migration nicht gesondert getestet.

## Inhalt des Downloads

Enthalten sind Quellcode, Lockfile, Tokyo-Ausgangsdaten und der bereits gebaute statische Export. Nicht enthalten sind `node_modules`, Git-Historie, Zugangsdaten und lokale Laufzeit-Caches. Die fertige Website enthält ausschließlich öffentlich bezogene JMA-Daten.

