# Landesumrisse

`country-outlines.json` enthält ausschließlich Deutschland und Japan aus Natural Earth, Admin 0 – Countries, Maßstab 1:50 Millionen. Die geografischen Umrisse wurden in eine gemeinsame Mercator-Darstellung je Land projiziert und auf eine SVG-Nachkommastelle gerundet. Es werden weder Kartenkacheln noch externe Kartendienste zur Laufzeit geladen.

- Quelle: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson (abgerufen am 12. September 2026)
- Lizenz: Public Domain, https://www.naturalearthdata.com/about/terms-of-use/
- Erzeugung: `node scripts/build-maps.ts /pfad/ne_50m_admin_0_countries.geojson`

Die Stationskoordinaten stehen in `src/lib/stations.ts`. Japan: JMA-Standortverzeichnis https://www.jma.go.jp/bosai/amedas/const/amedastable.json (Breiten-/Längengrade aus Grad und Bogenminuten umgerechnet). Deutschland: DWD-CDC-Stationsverzeichnis https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/historical/KL_Tageswerte_Beschreibung_Stationen.txt. Die Punkte zeigen die aktuellen Stationspositionen; historische Verlegungen werden nicht dargestellt.

Die beschrifteten Auswahlflächen dürfen gegenüber den geografisch korrekten Punkten versetzt sein, damit benachbarte Stationen einzeln auswählbar bleiben. Linien verbinden jede Auswahlfläche mit ihrem Stationspunkt. Die Projektion für Geometrie und Punkte ist gemeinsam in `src/lib/country-map.ts` definiert.
