# Ame — Niederschlag im historischen Vergleich

Eine statische React-Webseite für tägliche Niederschlagsmessungen aus Japan und Deutschland. Sie vergleicht das laufende Jahr mit vollständigen historischen Kalenderjahren derselben Station.

## Entwicklung

Node.js ab 24 und pnpm 11.25.0:

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build
pnpm preview
```

Vite startet lokal auf `http://localhost:5173`; die Vorschau des Produktionsbuilds auf `http://localhost:4173`. Der statische Build liegt in `dist/`. React 19, Vite 8 und TypeScript 6 verwenden eine gemeinsame TypeScript-Konfiguration. Die Vite-Konfiguration enthält die React-/Tailwind-Plugins und den Alias `@/` für `src/`.

## Oberfläche

- Native Stationsauswahl, nach Japan und Deutschland gruppiert.
- Japan: Tokyo, Kyoto, Osaka, Sapporo, Fukuoka und Naha (JMA).
- Deutschland: Berlin-Tempelhof, Hamburg-Fuhlsbüttel, München-Stadt, Frankfurt/Main, Köln/Bonn und Dresden-Klotzsche (DWD).
- Kumulierte Jahressummen oder geglätteter Tagesverlauf mit Gauß-Kernel (σ = 11 Tage).
- Historischer Median, mittlere 50 % und 90 %, Min–Max; Referenz alle vollständigen Jahre oder 1991–2020.
- Optional drei Vergleichsjahre mit den höchsten Summen zum selben Stichtag; standardmäßig aus.
- Messwerte per Maus oder Pfeiltasten ablesen; CSV und PNG mit Datenquellen exportieren.

Das Diagramm steht im Mittelpunkt. Es gibt keine dekorative Titelzeile oder Kartenoberfläche. Die Statistik wird im Browser berechnet; ein Anwendungsserver ist nicht erforderlich.

## Datenimport und Veröffentlichung

GitHub Actions aktualisiert alle Stationen zweimal täglich. Jeder Push auf `main` prüft, baut und veröffentlicht die Website über GitHub Pages. [Betrieb und Workflows](docs/github-pages.md).

```bash
pnpm data:update
pnpm data:validate
# JMA-Historie vollständig neu abrufen:
pnpm data:update --refresh-history
```

JMA-Dateien beginnen im Abruffenster 1876; das ist keine Aussage über den tatsächlichen Messbeginn einer Station. Vorhandene historische Dateien werden wiederverwendet und zum Jahreswechsel ergänzt. Der Importer dekodiert die originalen CSV-Antworten als Shift-JIS.

DWD-Dateien beginnen beim veröffentlichten Stationsbeginn. Der Importer liest die ZIP-Archive mit `fflate`, übernimmt `RSK` in mm und bewahrt die ursprünglichen `QN_4`-Prüfverfahrenscodes. Historische Archive werden bei jedem Lauf neu gelesen, damit auch jährliche Korrekturen übernommen werden. Nur `historical` geht in die Referenz ein; ein noch nicht im Archiv veröffentlichtes Vorjahr bleibt fehlend. `recent` liefert das laufende Jahr und ist ausdrücklich vorläufig. Zeiträume richten sich nach `Asia/Tokyo` beziehungsweise `Europe/Berlin`; die Tagesdatierung der Quelle bleibt unverändert.

Stationskennungen, Zahlen, Qualitätscodes und Datumsfolgen werden geprüft. Fehlende DWD-Tage und der Fehlwert `-999` bleiben `null`; ein fehlendes Qualitätskennzeichen `-999` wird intern als 0 gespeichert. Ein fehlgeschlagener Abruf oder ein Rückgang verwendbarer Tageswerte bricht den gesamten Import vor dem Schreiben ab. Die veröffentlichten Dateien bleiben dann unverändert.

Alle Daten liegen unter `public/data/`, getrennt nach Station und historischem/aktuellem Zeitraum. Japanische IDs bleiben unverändert; DWD-IDs tragen das Präfix `dwd-`. Ein Manifest enthält Zeiträume und SHA-256-Inhaltsrevisionen. Der Browser lädt ausschließlich diese vorbereiteten Dateien und speichert sie nach Revision in IndexedDB. Bei Netzfehlern bleibt der lokale Stand sichtbar. „Aktualisieren“ prüft den veröffentlichten Stand erneut; es startet keinen Import.

## Methodik und Grenzen

Für die Referenz werden nur vollständige Kalenderjahre verwendet. JMA-Werte benötigen Qualitätscode 8. Beim DWD werden die dokumentierten QN-Verfahren 1, 2, 3, 5, 7, 8, 9 und 10 akzeptiert, jedoch ausschließlich aus dem abgeschlossenen historischen Archiv. QN ist keine Rangskala. Die aktuellen DWD-Werte haben ihre Qualitätskontrolle noch nicht vollständig durchlaufen.

Kumulative Kurven summieren den 29. Februar mit auf; nur sein Achsenpunkt entfällt. Die Jahressumme bleibt erhalten. Vor der Gauß-Glättung wird der 29. Februar entfernt. Historische Jahre werden zyklisch geglättet. Das aktuelle Jahr verwendet vollständige vorhergehende Dezemberwerte, soweit verfügbar; am offenen Ende wird der Kernel neu normiert. Seine letzten 44 Tage sind gestrichelt. Die aktuelle Kurve endet am ersten fehlenden oder unbrauchbaren Tag.

Quantile werden pro Kalendertag mit linearer Interpolation (Typ 7) berechnet. Die Flächen sind historische Verteilungen, keine Konfidenzintervalle oder Prognosen. Stationsverlegungen, Klimaänderungen und Änderungen von Messverfahren/Tagesgrenzen werden nicht herausgerechnet. Es werden keine verschiedenen Stationen zu einer Stadt-Zeitreihe zusammengefügt. Für Tokyo wurden ursprünglich 1.800 Monatssummen zusätzlich gegen JMA-Monatsdaten geprüft; andere Stationen haben bislang keinen zusätzlichen Monatsabgleich.

## Quellen und Lizenz

- [Japan Meteorological Agency: Datenabruf](https://www.data.jma.go.jp/risk/obsdl/)
- [DWD Climate Data Center: tägliche Stationsbeobachtungen](https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/)
- [DWD-Datensatzbeschreibung und Qualitätsverfahren](https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/BESCHREIBUNG_obsgermany-climate-daily-kl_de.pdf)

Datenbasis der deutschen Auswertungen: Deutscher Wetterdienst, Climate Data Center, tägliche Stationsbeobachtungen, Version v24.3; [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Die Daten werden hier in Jahreskurven, Quantile und Vergleiche umgerechnet. Oberfläche und Exporte enthalten die Quellenangabe; CSV-Dateien enthalten zusätzlich die verwendeten Archiv-URLs. JMA-Daten werden nicht unter die DWD-Lizenz gestellt.

## Struktur und Prüfung

```text
src/App.tsx                Oberfläche, Diagramm und Datenladeablauf
src/components/            Methodik, Tabs und Checkbox
src/lib/                   Stationskatalog, Datenformat, Cache und Statistik
src/styles/                Styles und übernommene Styles mit Lizenz
scripts/jma.ts             JMA-CSV-Adapter
scripts/dwd.ts             DWD-Archiv- und Tageswerte-Adapter
scripts/dataset.ts         Inhaltsrevisionen und Schutz vor Datenverlust
scripts/update-data.ts     Gemeinsamer Import und atomare Veröffentlichung
scripts/validate-data.ts   Prüfung aller veröffentlichten Dateien
public/data/               Messwerte und Manifest der zwölf Stationen
tests/                     Parser, Qualität, Statistik, Jahreswechsel und Fehlerfälle
.github/workflows/         CI, Datenimport und GitHub Pages
```

`pnpm check` führt Typprüfung, ESLint und Tests aus. Tests decken unter anderem native Qualitätscodes, fehlende Tage gegenüber null Millimetern, falsche Stationen, ZIP-Auswahl, Schaltjahressummen, Gauß-Glättung, länderspezifische Jahreswechsel und den Erhalt veröffentlichter Daten bei Abruffehlern ab. `pnpm data:validate` prüft die tatsächlich veröffentlichten Dateien einschließlich ihrer Inhaltsrevisionen.
