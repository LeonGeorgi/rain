import { ChevronDown } from 'lucide-react';
import type { Station } from '@/lib/stations';

const dwd = 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/';

export function Methodology({ station, excluded, today }: { station: Station; excluded: number[]; today: string }) {
  const isDWD = station.provider === 'dwd';
  const isGHCN = station.provider === 'ghcn';
  const isKNMI = station.provider === 'knmi';
  return (
    <details className="method">
      <summary>Sources & methodology <ChevronDown size={16}/></summary>
      <div>
        <p>
          {isDWD
            ? `Source: Deutscher Wetterdienst (DWD), Climate Data Center, daily station observations, station ${station.sourceId} (${station.name}). Licence: CC BY 4.0. These observations have been processed into annual curves, quantiles and comparisons.`
            : isGHCN
            ? `Source: NOAA NCEI, GHCN-Daily v3, station ${station.sourceId} (${station.name}). The archive integrates observations from national meteorological services and observing networks. Citation: Menne et al. (2012), doi:10.7289/V5D21VHZ. The observations are processed here into annual curves and comparisons; this is not an official NOAA product.`
            : isKNMI
            ? `Source: Royal Netherlands Meteorological Institute (KNMI), daily observations, station ${station.sourceId} (${station.name}). CC0. The observations are processed here; KNMI is not involved in this work and does not necessarily endorse it.`
            : `Official daily precipitation totals from the Japan Meteorological Agency, station ${station.sourceId}.`}
        </p>
        <p>The year selector determines the highlighted curve, statistics and exports. Plus and minus move to the next or previous available year. The selected year is excluded from the historical reference and comparison years. Otherwise, the reference covers the chosen archive period, including years after the displayed year.</p>
        <p>The bands cover the central 50% (25th–75th percentiles) and 90% (5th–95th percentiles) of historical years; Min–Max shows the observed range. These are historical distributions at each calendar day, not confidence intervals or forecasts. Quantiles use linear interpolation (type 7).</p>
        <p>
          {isDWD
            ? 'The reference includes only complete calendar years from the DWD archives with completed quality checks (historical). It uses RSK in mm and the original QN_4 checking-procedure codes (1, 2, 3, 5, 7, 8, 9, 10). These codes are not a ranking and do not correspond to JMA quality codes. Current values from recent are provisional; their quality checks are not yet complete. Missing values (-999), missing days or missing quality flags are not treated as zero millimetres. A preceding year that has not yet been published in the historical archive remains excluded from the reference.'
            : isGHCN
            ? 'GHCN precipitation is converted from tenths of a millimetre. Only observations without a failed quality check and with a supported measurement flag enter the analysis. Missing values and presumed-zero reports are excluded. Trace amounts are retained as traces and contribute zero at the reported precision. Original measurement, quality and source flags are retained in the published station files. Multi-day accumulations are not used as daily amounts. Complete years enter the reference; recent observations can be revised and reporting delays vary by country.'
            : isKNMI
            ? 'KNMI daily RH values are converted from tenths of a millimetre. A value of −1 denotes a trace below 0.05 mm; it is retained as a trace and contributes zero at the reported precision. Blank values remain missing. The archive does not provide per-observation quality flags; KNMI checks these data on working days and may revise them. Only complete calendar years enter the reference.'
            : 'Only complete calendar years with JMA quality code 8 are included in the reference.'}
          {' '}{excluded.length > 0 ? `Excluded years: ${excluded.join(', ')}.` : ''}
        </p>
        <p>Cumulative totals include precipitation on 29 February; only its axis point is omitted, preserving annual totals. In the daily trend, 29 February is removed before Gaussian smoothing. Complete years use cyclic smoothing (σ = 11 days, radius 44 days), including the selected year. Incomplete years use the preceding December observations where fully available. At the open end, the kernel is renormalised; the final 44 days are dashed and provisional. Missing or unusable daily observations end the selected curve.</p>
        <p>The comparison describes the historical archive of a single station. It does not adjust for climate change, station relocations or changes in measurement methods. Each source’s daily observation boundaries apply; these may differ between countries and historical measurement periods. The number of complete years can vary considerably between stations. For Tokyo, 1,800 monthly totals were additionally checked against official JMA monthly totals; other stations have not yet had this additional monthly check.</p>
        <p>Observations are fetched centrally twice a day, checked for format and completeness, then published. “Refresh” loads the latest published data. The browser caches station files by data version; if a request fails, the locally saved data remains visible. JMA archives are extended at the start of each year and can be reloaded in full manually. DWD, GHCN-Daily and KNMI archives are read again on every import to pick up revisions to historical data.</p>
        <div className="method-links">
          {isDWD ? <>
            <a href={`${dwd}historical/`} target="_blank" rel="noreferrer">DWD archive ↗</a>
            <a href={`${dwd}recent/tageswerte_KL_${station.sourceId}_akt.zip`}>Current station observations ↓</a>
            <a href={`${dwd}BESCHREIBUNG_obsgermany-climate-daily-kl_de.pdf`} target="_blank" rel="noreferrer">Dataset documentation (German) ↗</a>
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0 ↗</a>
          </> : isGHCN ? <>
            <a href={`https://www.ncei.noaa.gov/pub/data/ghcn/daily/all/${station.sourceId}.dly`} target="_blank" rel="noreferrer">Daily station archive ↗</a>
            <a href="https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt" target="_blank" rel="noreferrer">Format & quality flags ↗</a>
            <a href="https://doi.org/10.7289/V5D21VHZ" target="_blank" rel="noreferrer">GHCN-Daily dataset citation ↗</a>
            <a href="https://doi.org/10.1175/JTECH-D-11-00103.1" target="_blank" rel="noreferrer">GHCN-Daily methodology ↗</a>
          </> : isKNMI ? <>
            <a href={`https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/daggegevens/etmgeg_${station.sourceId}.zip`}>Daily station archive ↓</a>
            <a href="https://www.knmi.nl/nederland-nu/klimatologie/daggegevens" target="_blank" rel="noreferrer">KNMI daily observations ↗</a>
            <a href="https://www.knmi.nl/copyright" target="_blank" rel="noreferrer">KNMI reuse terms ↗</a>
          </> : <>
            <a href="https://www.data.jma.go.jp/risk/obsdl/" target="_blank" rel="noreferrer">Official JMA download ↗</a>
            <a href={`https://www.data.jma.go.jp/stats/etrn/view/daily_s1.php?prec_no=${station.pref}&block_no=${station.sourceId}&year=${today.slice(0,4)}&month=${today.slice(5,7)}&view=`} target="_blank" rel="noreferrer">Daily station observations ↗</a>
            <a href={`https://www.data.jma.go.jp/stats/etrn/view/monthly_s3.php?prec_no=${station.pref}&block_no=${station.sourceId}&year=&month=&day=&view=p5`} target="_blank" rel="noreferrer">Monthly totals ↗</a>
          </>}
        </div>
      </div>
    </details>
  );
}
