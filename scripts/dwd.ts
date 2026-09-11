import { unzipSync } from 'fflate';
import type { Row } from '../src/lib/datasets.ts';
import type { Station } from '../src/lib/stations.ts';
import { fillDays, makeDataset } from './dataset.ts';

export const dwdBase = 'https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/daily/kl/';

export function parseDWD(text: string, stationId: string): Row[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift()!.replace(/^\uFEFF/, '').split(';').map(cell => cell.trim());
  const columns = ['STATIONS_ID', 'MESS_DATUM', 'RSK', 'QN_4'].map(name => {
    if (headers.filter(header => header === name).length !== 1) throw new Error(`DWD: Spalte ${name} fehlt oder ist doppelt.`);
    return headers.indexOf(name);
  });
  let previous = '';
  return lines.map(line => {
    const cells = line.split(';').map(cell => cell.trim());
    const [id, rawDate, rawRain, rawQuality] = columns.map(index => cells[index]);
    if (!/^\d+$/.test(id ?? '') || Number(id) !== Number(stationId)) throw new Error('DWD: Falsche Station.');
    if (!/^\d{8}$/.test(rawDate ?? '')) throw new Error('DWD: Ungültiges Datum.');
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date <= previous) {
      throw new Error('DWD: Ungültiges, doppeltes oder unsortiertes Datum.');
    }
    previous = date;
    if (!/^(?:-999(?:\.0)?|\d+(?:\.\d+)?)$/.test(rawRain ?? '') ||
        !/^(?:-999|1|2|3|5|7|8|9|10)$/.test(rawQuality ?? '')) {
      throw new Error('DWD: Unbekanntes Zahlen- oder Qualitätsformat.');
    }
    return [date, Number(rawRain) === -999 ? null : Number(rawRain), Number(rawQuality) === -999 ? 0 : Number(rawQuality)];
  });
}


export function historicalArchive(index: string, stationId: string) {
  if (!/^\d{5}$/.test(stationId)) throw new Error('DWD: Ungültige Stationskennung.');
  const files = [...new Set(index.match(new RegExp(`tageswerte_KL_${stationId}_\\d{8}_\\d{8}_hist\\.zip`, 'g')))];
  if (files.length !== 1) throw new Error(`DWD ${stationId}: Kein eindeutiges historisches Archiv.`);
  return `${dwdBase}historical/${files[0]}`;
}

async function request(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`DWD: HTTP ${response.status} für ${url}.`);
  return response;
}

export function parseArchive(bytes: Uint8Array, stationId: string): Row[] {
  if (bytes.length > 20_000_000) throw new Error('DWD: Unerwartet großes Archiv.');
  const files = unzipSync(bytes, { filter: entry => /^produkt_klima_tag_.*\.txt$/.test(entry.name) && entry.originalSize <= 50_000_000 });
  const products = Object.values(files);
  if (products.length !== 1) throw new Error('DWD: Keine eindeutige Tagesdatei im Archiv.');
  const rows = parseDWD(new TextDecoder('windows-1252').decode(products[0]), stationId);
  if (!rows.length) throw new Error('DWD: Leere Tagesdatei.');
  return rows;
}

async function fetchArchive(url: string, stationId: string) {
  return parseArchive(new Uint8Array(await (await request(url)).arrayBuffer()), stationId);
}

export async function fetchDWD(
  station: Station,
  bounds: { historyEnd: string; currentStart: string; yesterday: string },
  now: Date,
  index: string,
) {
  const historyUrl = historicalArchive(index, station.sourceId);
  const currentUrl = `${dwdBase}recent/tageswerte_KL_${station.sourceId}_akt.zip`;
  const [historicalRows, recentRows] = await Promise.all([
    fetchArchive(historyUrl, station.sourceId), fetchArchive(currentUrl, station.sourceId),
  ]);
  if (historicalRows.at(-1)![0] < `${Number(bounds.historyEnd.slice(0, 4)) - 1}-12-31`) {
    throw new Error(`DWD ${station.name}: Historisches Archiv ist unvollständig oder veraltet.`);
  }
  // Only the quality-controlled archive enters the historical reference. Until
  // its annual release, the preceding year stays missing rather than provisional.
  const history = makeDataset(station.id, station.historyStart, bounds.historyEnd,
    fillDays(historicalRows, station.historyStart, bounds.historyEnd), now.toISOString(), historyUrl);
  if (bounds.yesterday >= bounds.currentStart &&
      (recentRows[0][0] > bounds.currentStart || recentRows.at(-1)![0] < bounds.currentStart)) {
    throw new Error(`DWD ${station.name}: Aktuelles Jahr fehlt im Tagesarchiv.`);
  }
  const lastDate = recentRows.at(-1)![0] < bounds.yesterday ? recentRows.at(-1)![0] : bounds.yesterday;
  const current = makeDataset(station.id, bounds.currentStart, lastDate,
    fillDays(recentRows, bounds.currentStart, lastDate), now.toISOString(), currentUrl);
  return { history, current };
}

export async function fetchDWDIndex() {
  return (await request(`${dwdBase}historical/`)).text();
}
