# International daily precipitation

The application contains 42 stations in eight countries. Japan and Germany retain their direct JMA and DWD sources. The United States, Australia, France, the United Kingdom and Sweden use NOAA NCEI’s GHCN-Daily archive. The Netherlands uses KNMI’s published station ZIP archives. No API keys or browser requests to weather services are required.

## Selection and coverage

Stations were selected for long observed precipitation records, substantial numbers of complete calendar years and observations in 2026. Separate stations are never spliced together. Airports and observatories are labelled explicitly in the station picker. Some sites have changed instruments or location over time; these records are not homogenised climate trends.

The initial import was checked on 12 September 2026. Most new stations have many decades of complete years. Reporting latency varies: the US records reach September, Australian records are about a week behind, and the selected French, British and Swedish GHCN archives reach July. KNMI files reach 10 September. The highlighted curve stops at the first missing or rejected observation, which can be earlier than the latest date in the file. No gaps are interpolated, and the year picker remains available for complete historical years.

Canada’s sampled long airport records were not selected because their GHCN precipitation archives did not reach 2026. Stockholm’s sampled automatic-station series was rejected because it had only two complete historical years under the application’s rules; Sveg provides a much longer reference.

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

The import validates all sources before writing any station file, then publishes the manifest last. Network failures, changed formats or a regression in usable observations stop the run. This also means that an upstream quality correction which removes formerly usable observations may require review before the scheduled update can proceed. Existing published data remain available. `pnpm data:validate` checks all 84 station datasets and their hashes; parser and integration tests cover traces, missing values, flags, leap years, year boundaries and failure preservation.
