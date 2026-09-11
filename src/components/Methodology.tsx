import { ChevronDown } from 'lucide-react';
import type { Station } from '@/lib/stations';

const dwd = 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/';

export function Methodology({ station, excluded, today }: { station: Station; excluded: number[]; today: string }) {
  const isDWD = station.provider === 'dwd';
  return (
    <details className="method">
      <summary>Quellen & Methodik <ChevronDown size={16}/></summary>
      <div>
        <p>
          {isDWD
            ? `Datenbasis: Deutscher Wetterdienst (DWD), Climate Data Center, tägliche Stationsbeobachtungen, Station ${station.sourceId} (${station.name}). Lizenz: CC BY 4.0. Die Messwerte wurden hier zu Jahreskurven, Quantilen und Vergleichen verarbeitet.`
            : `Offizielle tägliche Niederschlagssummen der Japan Meteorological Agency, Station ${station.sourceId}.`}
        </p>
        <p>Die Jahresauswahl bestimmt die hervorgehobene Kurve, Kennzahlen und Exporte. Plus und Minus wechseln zum nächsten verfügbaren Messjahr. Das ausgewählte Jahr bleibt aus der historischen Referenz und den Vergleichsjahren ausgeschlossen. Die Referenz umfasst ansonsten den gewählten Archivzeitraum, auch Jahre nach dem angezeigten Jahr.</p>
        <p>Die Intervalle umfassen die mittleren 50 % (25.–75. Perzentil) und 90 % (5.–95. Perzentil) der historischen Jahre; Min–Max zeigt die beobachtete Spannweite. Das sind punktweise historische Verteilungen, keine Konfidenzintervalle oder Prognosen. Quantile: lineare Interpolation (Typ 7).</p>
        <p>
          {isDWD
            ? 'Die Referenz enthält nur vollständige Kalenderjahre aus den DWD-Archiven mit abgeschlossener Qualitätsprüfung (historical). Verwendet werden RSK in mm und die originalen Prüfverfahrenscodes QN_4 (1, 2, 3, 5, 7, 8, 9, 10). Diese Codes sind keine Rangskala und entsprechen nicht den JMA-Qualitätscodes. Aktuelle Werte aus recent sind vorläufig; ihre Qualitätsprüfung ist noch nicht abgeschlossen. Fehlwerte (-999), fehlende Tage oder ein fehlendes Qualitätskennzeichen werden nicht als null Millimeter gewertet. Ein noch nicht im historischen Archiv veröffentlichtes Vorjahr bleibt aus der Referenz ausgeschlossen.'
            : 'Nur vollständige Kalenderjahre mit JMA-Qualitätscode 8 gehen in die Referenz ein.'}
          {' '}{excluded.length > 0 ? `Ausgeschlossene Jahre: ${excluded.join(', ')}.` : ''}
        </p>
        <p>Kumulative Summen enthalten den Niederschlag des 29. Februar; nur sein Achsenpunkt entfällt. So bleiben Jahressummen erhalten. Im Tagesverlauf wird der 29. Februar vor der Gauß-Glättung entfernt; vollständige Jahre werden zyklisch geglättet (σ = 11 Tage, Radius 44 Tage), auch die ausgewählte Jahreskurve. Unvollständige Jahre nutzen die vorhergehenden Dezemberwerte, soweit vollständig verfügbar. Am offenen Ende wird der Kernel neu normiert; die letzten 44 Tage sind gestrichelt und vorläufig. Fehlende oder unbrauchbare Tageswerte beenden die ausgewählte Kurve.</p>
        <p>Der Vergleich beschreibt das historische Archiv einer einzelnen Station. Klimaänderungen, Stationsverlegungen und Änderungen des Messverfahrens werden nicht herausgerechnet. Es gelten die Tagesgrenzen der jeweiligen Quelle; diese können sich zwischen Ländern und historischen Messperioden unterscheiden. Die Zahl vollständiger Jahre kann sich zwischen Stationen stark unterscheiden. Für Tokyo wurden 1.800 Monatssummen zusätzlich mit den offiziellen JMA-Monatssummen abgeglichen; für andere Stationen gibt es bislang keinen zusätzlichen Monatsabgleich.</p>
        <p>Die Messwerte werden zentral zweimal täglich abgerufen, auf Format und Vollständigkeit geprüft und veröffentlicht. „Aktualisieren“ lädt den zuletzt veröffentlichten Stand. Der Browser speichert Stationsdateien anhand ihrer Datenversion; bei Fehlern bleibt der lokale Stand sichtbar. JMA-Archive werden zum Jahreswechsel ergänzt und können manuell vollständig neu geladen werden. DWD-Archive werden bei jedem Import erneut gelesen, damit jährliche Archivkorrekturen übernommen werden.</p>
        <div className="method-links">
          {isDWD ? <>
            <a href={`${dwd}historical/`} target="_blank" rel="noreferrer">DWD-Archiv ↗</a>
            <a href={`${dwd}recent/tageswerte_KL_${station.sourceId}_akt.zip`}>Aktuelle Stationswerte ↓</a>
            <a href={`${dwd}BESCHREIBUNG_obsgermany-climate-daily-kl_de.pdf`} target="_blank" rel="noreferrer">Datensatzbeschreibung ↗</a>
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0 ↗</a>
          </> : <>
            <a href="https://www.data.jma.go.jp/risk/obsdl/" target="_blank" rel="noreferrer">Offizieller JMA-Download ↗</a>
            <a href={`https://www.data.jma.go.jp/stats/etrn/view/daily_s1.php?prec_no=${station.pref}&block_no=${station.sourceId}&year=${today.slice(0,4)}&month=${today.slice(5,7)}&view=`} target="_blank" rel="noreferrer">Tägliche Stationswerte ↗</a>
            <a href={`https://www.data.jma.go.jp/stats/etrn/view/monthly_s3.php?prec_no=${station.pref}&block_no=${station.sourceId}&year=&month=&day=&view=p5`} target="_blank" rel="noreferrer">Monatssummen ↗</a>
          </>}
        </div>
      </div>
    </details>
  );
}
