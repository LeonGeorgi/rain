import { unzipSync } from 'fflate';
import { setTimeout as delay } from 'node:timers/promises';
import type { Row } from '../src/lib/datasets.ts';
import type { Station } from '../src/lib/stations.ts';
import { splitDailyArchive } from './dataset.ts';

export const knmiBase = 'https://cdn.knmi.nl/knmi/map/page/klimatologie/gegevens/daggegevens/';

export function parseKNMI(text: string, stationId: string): Row[] {
  const lines = text.split(/\r?\n/);
  const header = lines.findIndex(line => /^#\s*STN,/.test(line));
  if (header < 0) throw new Error('KNMI: Missing daily data header.');
  const headers = lines[header].replace(/^#\s*/, '').split(',').map(cell => cell.trim());
  const columns = ['STN', 'YYYYMMDD', 'RH'].map(name => {
    if (headers.filter(header => header === name).length !== 1) throw new Error(`KNMI: Missing or duplicate ${name}.`);
    return headers.indexOf(name);
  });
  let previous = '';
  const rows: Row[] = lines.slice(header + 1).filter(line => line.trim()).map(line => {
    const cells = line.split(',').map(cell => cell.trim());
    const [id, rawDate, rain] = columns.map(index => cells[index]);
    if (cells.length !== headers.length || id !== stationId || !/^\d{8}$/.test(rawDate ?? '') || !/^(?:-1|\d+)?$/.test(rain ?? 'invalid')) {
      throw new Error('KNMI: Invalid station, date or precipitation value.');
    }
    const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
    if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date <= previous) {
      throw new Error('KNMI: Invalid, duplicate or out-of-order date.');
    }
    previous = date;
    return [date, rain === '' ? null : rain === '-1' ? 0 : Number(rain) / 10, rain === '' ? 0 : rain === '-1' ? 2 : 1];
  });
  if (!rows.length) throw new Error('KNMI: Empty daily archive.');
  return rows;
}

export function parseKNMIArchive(bytes: Uint8Array, stationId: string) {
  if (bytes.length > 20_000_000) throw new Error('KNMI: Unexpectedly large archive.');
  const files = unzipSync(bytes, {filter:entry => entry.name === `etmgeg_${stationId}.txt` && entry.originalSize <= 30_000_000});
  const text = files[`etmgeg_${stationId}.txt`];
  if (!text) throw new Error('KNMI: Missing station file in archive.');
  return parseKNMI(new TextDecoder().decode(text), stationId);
}

async function downloadArchive(source: string, stationId: string, request: typeof fetch): Promise<Uint8Array> {
  let failure: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response | undefined;
    try {
      response = await request(source, {
        signal: AbortSignal.timeout(120_000),
        headers: {'User-Agent': 'Rain precipitation comparison (github.com/LeonGeorgi/rain)'},
      });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      failure = error;
    }
    if (response && !response.ok) {
      failure = new Error(`KNMI: HTTP ${response.status} for ${stationId}.`);
      await response.body?.cancel();
      if (response.status !== 429 && response.status < 500) throw failure;
    }
    if (attempt < 3) await delay(attempt * 1_000);
  }
  throw failure;
}

export async function fetchKNMI(
  station: Station,
  bounds: Parameters<typeof splitDailyArchive>[2],
  now: Date,
  request: typeof fetch = fetch,
) {
  if (!/^\d{3}$/.test(station.sourceId)) throw new Error('KNMI: Invalid station ID.');
  const source = `${knmiBase}etmgeg_${station.sourceId}.zip`;
  return splitDailyArchive(station, parseKNMIArchive(await downloadArchive(source, station.id, request), station.sourceId), bounds, now, source);
}
