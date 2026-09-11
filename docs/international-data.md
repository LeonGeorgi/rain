# International daily precipitation

The application contains 56 stations in 13 countries. Japan and Germany retain their direct JMA and DWD sources. The United States, Australia, France, the United Kingdom, Sweden, Spain, Switzerland, Austria, Ireland and Norway use NOAA NCEI’s GHCN-Daily archive. The Netherlands uses KNMI’s published station ZIP archives. No API keys or browser requests to weather services are required.

## Selection and coverage

Stations were selected for long observed precipitation records, substantial numbers of complete calendar years and observations in 2026. Separate stations are never spliced together. Airports and observatories are labelled explicitly in the station picker. Some sites have changed instruments or location over time; these records are not homogenised climate trends.

The initial import was checked on 12 September 2026. Most new stations have many decades of complete years. Reporting latency varies: the US records reach September, Australian records are about a week behind, and the selected French, British and Swedish GHCN archives reach July. KNMI files reach 10 September. The highlighted curve stops at the first missing or rejected observation, which can be earlier than the latest date in the file. No gaps are interpolated, and the year picker remains available for complete historical years.

Canada’s sampled long airport records were not selected because their GHCN precipitation archives did not reach 2026. Stockholm’s sampled automatic-station series was rejected because it had only two complete historical years under the application’s rules; Sveg provides a much longer reference.

### Additional countries

The expansion below was checked on 12 September 2026 using the same parser and complete-calendar-year rules as the application. “Current curve through” is the last uninterrupted, accepted daily observation from 1 January 2026; the archive can contain later observations. All entries participate in the existing twice-daily import.

| Country | Station | GHCN ID | Complete reference years | Current curve through |
| --- | --- | --- | ---: | --- |
| Spain | Madrid Retiro | `SP000003195` | 75 | 2026-07-30 |
| Spain | Barcelona Airport | `SP000008181` | 56 | 2026-01-21 |
| Spain | San Sebastián–Igueldo | `SP000008027` | 71 | 2026-01-22 |
| Switzerland | Zürich Fluntern | `SZ000003700` | 122 | 2026-06-02 |
| Switzerland | Geneva Observatory | `SZ000008390` | 65 | 2026-05-31 |
| Switzerland | Lugano | `SZ000009480` | 120 | 2026-06-02 |
| Austria | Vienna | `AU000005901` | 121 | 2026-07-31 |
| Austria | Salzburg | `AU000006306` | 114 | 2026-07-31 |
| Austria | Innsbruck | `AU000011801` | 120 | 2026-07-31 |
| Ireland | Dublin Phoenix Park | `EI000003969` | 144 | 2026-05-31 |
| Ireland | Malin Head | `EI000003980` | 129 | 2026-05-31 |
| Norway | Tromsø | `NO000001026` | 102 | 2026-07-30 |
| Norway | Stavanger Sola | `NOE00109680` | 71 | 2026-07-30 |
| Norway | Bulken | `NOE00100574` | 124 | 2026-07-30 |

The Swiss and Irish archives arrive later than most other European selections. Barcelona and San Sebastián have early gaps in 2026, so their current cumulative curves stop in January even though the archives contain July observations. Their long historical records remain useful with the year picker. The sampled Icelandic series were not added because all had gaps at the start of the current year; several other Spanish and Irish candidates were also omitted because of weaker coverage. A country's inclusion does not imply nationwide station coverage.

## GHCN-Daily

- [NOAA dataset overview](https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily)
- [Format, units and flags](https://www.ncei.noaa.gov/pub/data/ghcn/daily/readme.txt)
- [Station names and coordinates](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-stations.txt)
- [Station-by-element coverage inventory](https://www.ncei.noaa.gov/pub/data/ghcn/daily/ghcnd-inventory.txt)

`scripts/ghcn.ts` downloads one `.dly` file per station, rereading its history to include upstream corrections. It extracts only `PRCP`, converts tenths of a millimetre to millimetres and preserves the original three-character measurement/quality/source flags as the fourth field of each daily row. Missing months and days are filled with `null`, not zero. `MDPR` multi-day totals are not substituted for daily precipitation.

Only a blank quality flag, a nonblank source flag and supported precipitation measurement flags (blank, B, D or T) produce usable observations. B and D denote totals assembled from subdaily reports; T denotes a trace and contributes zero at the source’s reporting precision. Presumed-zero measurements (P) and failed quality checks remain excluded. Malformed records, unknown flags, impossible dates and duplicate months fail the import. The internal status is 0 for missing/rejected, 1 for an accepted amount, and 2 for a trace. These numbers are not JMA or DWD quality codes. The original flags participate in the dataset revision hash.

GHCN integrates different observing programmes. In particular, Australian source flag `a` identifies Bureau of Meteorology data, and European source flag `E` identifies ECA&D. Observation-day definitions can differ; UTC-derived synoptic reports are not necessarily local-midnight totals. Recent values are subject to revision. The twice-daily application job cannot make an upstream archive more current than its publisher.

Citation: Menne, M. J., et al. (2012), *Global Historical Climatology Network – Daily (GHCN-Daily), Version 3*, NOAA National Climatic Data Center, [doi:10.7289/V5D21VHZ](https://doi.org/10.7289/V5D21VHZ), selected stations, accessed 12 September 2026. Methods: Menne et al. (2012), *An Overview of the Global Historical Climatology Network-Daily Database*, [doi:10.1175/JTECH-D-11-00103.1](https://doi.org/10.1175/JTECH-D-11-00103.1). Per-file retrieval timestamps are stored in `fetchedAt`; source links and attribution are included in the website and exports. NOAA data are not assigned the DWD licence.

## KNMI

- [Official daily station ZIP archives](https://www.knmi.nl/nederland-nu/klimatologie/daggegevens)
- [RH definition and station metadata](https://www.knmi.nl/kennis-en-datacentrum/achtergrond/data-ophalen-vanuit-een-script)
- [Reuse terms](https://www.knmi.nl/copyright)

`scripts/knmi.ts` reads the single matching `etmgeg_<station>.txt` file from each station ZIP. `RH` is in tenths of a millimetre; −1 is a trace below 0.05 mm, retained as status 2 with a numerical contribution of zero. Blank RH is missing (status 0); ordinary values use status 1. The source does not expose per-observation quality flags in these files. KNMI checks the daily archive on working days and may revise it. All histories are fetched again on each import.

The selected archive begins in 1901 or 1906 for most stations and 1951 for Schiphol, but precipitation coverage often starts later than the first weather record. Only complete precipitation years enter the historical reference. KNMI’s website applies CC0 unless otherwise specified. Attribution identifies KNMI and the derived processing; KNMI is not involved and does not necessarily endorse this application.

KNMI has announced retirement of its legacy scripted selection interface at the end of 2026. This importer uses the separately published station ZIP files. If those downloads are subsequently replaced, migrate the source adapter to the new documented distribution; do not silently substitute modelled precipitation or treat stale files as fresh observations.

## Publication safety

The import validates all sources before writing any station file, then publishes the manifest last. GHCN transport errors, HTTP 429 and server errors are retried up to three attempts with a short backoff. Persistent network failures, changed formats or a regression in usable observations stop the run. This also means that an upstream quality correction which removes formerly usable observations may require review before the scheduled update can proceed. Existing published data remain available. `pnpm data:validate` checks all 112 station datasets and their hashes; parser and integration tests cover traces, missing values, flags, leap years, year boundaries and failure preservation.
