# Ame — Niederschlag in Japan

Eine statische React-Webseite, die den aktuellen Niederschlag mit echten historischen Tagesmessungen der Japan Meteorological Agency (JMA) vergleicht. Die zentrale Frage: Wie ungewöhnlich ist die bisherige Regenmenge dieses Jahres?

Die Statistik und der Cache laufen im Browser. GitHub Actions lädt und validiert die JMA-Messwerte zentral zweimal täglich. Die Website lädt ausschließlich vorbereitete Stationsdateien von GitHub Pages. Jeder Push auf `main` baut und veröffentlicht die Website automatisch. [Betrieb und Workflows](docs/github-pages.md).

## Schnellstart

Voraussetzungen: Node.js ab 24 und pnpm 11.25.0, entsprechend `package.json`.

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
- Versionsabhängiger Browser-Cache pro Station; zentrale Datenaktualisierung zweimal täglich.

## Aufbau

```text
index.html              HTML-Einstieg, Metadaten und Favicon
src/
  main.tsx              Startet React
  App.tsx               Oberfläche, Diagramm und Datenladeablauf
  components/ui/        Select, Tabs und Checkbox
  lib/                  JMA-Abruf, Cache, Statistik und Klassenhilfen
  styles/               Globale Styles und übernommene Styles mit Lizenz
public/data/            Manifest und Messwerte aller sechs Stationen
scripts/                JMA-Import und Datenvalidierung
tests/                  Tests für Import, Qualität und Jahreswechsel
.github/workflows/      Prüfung, Datenaktualisierung und Pages-Deployment
docs/                   Betrieb und GitHub-Konfiguration
dist/                   Fertige statische Website nach pnpm build
```

Die App verwendet React 19, Vite 8, TypeScript 6 und Tailwind CSS 4. React startet im Browser über `createRoot`; es gibt weder Server Components noch einen Anwendungsserver. Die Vite-Konfiguration enthält nur die React-/Tailwind-Plugins und den Alias `@/` für `src/`. TypeScript prüft Anwendung, Skripte, Tests und Vite-Konfiguration mit einer gemeinsamen `tsconfig.json`. ESLint verwendet die React-Hooks-, Fast-Refresh- und TypeScript-Regeln.

`pnpm build` prüft zuerst die Typen und schreibt anschließend die Website nach `dist/`. `pnpm preview` (auch `pnpm start`) zeigt diesen Build lokal an. `pnpm check` führt Typprüfung, Linting und Tests aus. `pnpm data:update` aktualisiert die Messwerte; `pnpm data:validate` prüft alle veröffentlichten Dateien. Auf einen statischen Host gehört der Inhalt von `dist/`.

Die Paketversionen sind im Lockfile festgelegt. Die vorhandene siebentägige Freigabefrist für neue Pakete bleibt aktiv. TypeScript 6 ist auf die unterstützte Version von `typescript-eslint` abgestimmt.

Dokumentation: [Vite](https://vite.dev/guide/), [React](https://react.dev/learn), [Tailwind mit Vite](https://tailwindcss.com/docs/installation/using-vite).

## Datenfluss und Cache

1. GitHub Actions lädt zweimal täglich das aktuelle Jahr bis gestern in japanischer Zeit für alle sechs Stationen.
2. Historische Daten beginnen 1876 und reichen bis zum Ende des Vorjahres. Fehlende historische Jahre werden automatisch ergänzt; eine vollständige historische Neuabfrage ist manuell möglich.
3. Der Import prüft Stationsnamen, vollständige Datumsfolgen, Zahlen und Qualitätscodes. Fehlende Messwerte bleiben `null`. Ein Datenrückgang oder fehlgeschlagener Stationsabruf bricht die Aktualisierung ab, bevor Daten geschrieben werden.
4. Validierte Daten und ein Manifest werden in `public/data/` committed. Derselbe Workflow ruft anschließend das Pages-Deployment für genau diesen Commit auf. Bei Fehlern bleibt die vorherige Website online.
5. Der Browser liest `data/stations.json` und lädt nur Stationsdateien, deren Inhaltsrevision sich geändert hat. Dadurch werden auch historische Korrekturen im Cache erkannt.
6. „Aktualisieren“ prüft den zuletzt veröffentlichten Stand erneut. Es startet keinen JMA-Abruf und keinen Workflow. Bei Netzwerkfehlern bleiben lokal gespeicherte Werte sichtbar.

Jeder Browser hat seinen eigenen IndexedDB-Cache. Wenn IndexedDB nicht verfügbar ist, gibt es einen Sitzungsspeicher mit Hinweis. Browser können gespeicherte Daten löschen. Details zu Zeitplan, Berechtigungen und manuellem Betrieb stehen in [docs/github-pages.md](docs/github-pages.md).

## Datenquellen und wissenschaftliche Methodik

Offizielle Quellen:

- [JMA-Downloadoberfläche](https://www.data.jma.go.jp/risk/obsdl/)
- [JMA-CSV-Endpunkt](https://www.data.jma.go.jp/risk/obsdl/show/table), verwendet per POST
- [Tokyo-Monatssummen](https://www.data.jma.go.jp/stats/etrn/view/monthly_s3.php?prec_no=44&block_no=47662&year=&month=&day=&view=p5)

Der zentrale Importer sendet URL-kodierte POST-Daten ohne Zugangsdaten an JMA und dekodiert die CSV als Shift-JIS. Browser benötigen keinen direkten Zugriff auf JMA und keine CORS-Freigabe von JMA. Das Exportformat wird durch Parser- und Qualitätsprüfungen abgesichert.

Die historischen Dateien enthalten für jede Station Tageszeilen von 1876 bis zum Ende des Vorjahres, einschließlich JMA-Kennzeichen für fehlende Beobachtungen. 1876 ist die untere Abrufgrenze, keine Behauptung über den tatsächlichen Beobachtungsbeginn einer Station. Die aktuelle Datenabdeckung steht im Manifest und in der Oberfläche.

Für die Referenz werden ausschließlich vollständige Jahre mit JMA-Qualitätscode 8 verwendet. Bei kumulativen Kurven wird der Niederschlag des 29. Februar mit aufsummiert; nur sein Achsenpunkt entfällt. Jahressummen bleiben dadurch erhalten. Bei der Gauß-Glättung wird der 29. Februar vorher entfernt. Historische 365-Tage-Reihen werden zyklisch geglättet (σ = 11 Tage, Radius 44 Tage). Das aktuelle Jahr nutzt vollständige vorhergehende Dezemberwerte, soweit vorhanden. Am offenen Ende wird der Kernel neu normiert; die letzten 44 Tage sind gestrichelt.

Fehlende oder nicht normale aktuelle Tageswerte beenden die Kurve. Quantile werden pro Kalendertag über die fertigen Jahreskurven berechnet, mit linearer Interpolation (Typ 7). Die Flächen sind punktweise historische Verteilungen, keine Konfidenzintervalle und keine Prognosebänder. Die langen Reihen sind nicht separat homogenisiert oder um Klimatrends bereinigt.

Für Tokyo wurden ursprünglich alle 1.800 Monatssummen mit den offiziellen JMA-Monatsdaten abgeglichen. Eine Übereinstimmung aufsummierter verfügbarer Werte beweist nicht, dass fehlende Tage vollständig sind. Bei anderen Stationen gibt es bislang Datums- und Qualitätsprüfungen, aber keinen zusätzlichen Monatsabgleich.

## Bisherige Prüfung

Nach der Vite-Migration sind `pnpm check` (TypeScript und ESLint) sowie `pnpm build` erfolgreich. Entwicklungsmodus und Produktionsvorschau wurden im Browser geprüft: Tokyo-Daten laden, Wechsel zwischen kumulativem und geglättetem Verlauf, Referenzzeitraum und Intervallanzeige funktionieren. CSV-Export (365 Tageszeilen) und PNG-Export wurden heruntergeladen und geprüft. Ein zusätzlicher Build mit `/rain/` als Basispfad enthält korrekt aufgelöste Assets. JMA-Logik und Ausgangsdaten sind gegenüber dem Stand vor der Migration unverändert.

- TypeScript-Prüfung und statischer Produktionsbuild erfolgreich.
- Alle 365 × 8 Spalten der kumulativen Berechnung stimmen innerhalb 0,000001 mm mit der bisherigen Python-Auswertung überein.
- Referenzgrößen, Rangfolge am 9. September (1938, 1941, 2024), Schaltjahressummen, Abbruch bei Datenlücken, Gauß-Normierung und offizieller CSV-Parser geprüft.
- Der zentrale Erstimport und die Dateivalidierung wurden für alle sechs Stationen ausgeführt. Tests prüfen Parser, Datenlücken, Qualitätsverlust, Inhaltsrevisionen, Jahreswechsel und den Erhalt des letzten gültigen Stands bei Abruffehlern.

## Inhalt des Downloads

Enthalten sind Quellcode, Lockfile, Stationsdaten und der bereits gebaute statische Export. Nicht enthalten sind `node_modules`, Git-Historie, Zugangsdaten und lokale Laufzeit-Caches. Die fertige Website enthält ausschließlich öffentlich bezogene JMA-Daten.

