import { ghcnQuality, type Row } from '../src/lib/datasets.ts';
import type { Station } from '../src/lib/stations.ts';
import { splitDailyArchive } from './dataset.ts';
import { setTimeout as delay } from 'node:timers/promises';

export const ghcnBase = 'https://www.ncei.noaa.gov/pub/data/ghcn/daily/';

export function parseGHCN(text: string, stationId: string): Row[] {
  const rows: Row[] = [];
  let previous = '';
  for (const line of text.split(/\r?\n/).filter(line => line.length)) {
    if (line.length !== 269 || line.slice(0, 11) !== stationId || !/^\d{6}$/.test(line.slice(11, 17))) {
      throw new Error('GHCN: Invalid record length, station or date.');
    }
    const year = Number(line.slice(11, 15)), month = Number(line.slice(15, 17));
    if (year < 1800 || month < 1 || month > 12) throw new Error('GHCN: Invalid year or month.');
    if (line.slice(17, 21) !== 'PRCP') continue;
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    if (prefix <= previous) throw new Error('GHCN: Duplicate or out-of-order precipitation month.');
    previous = prefix;
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= 31; day++) {
      const cell = line.slice(21 + (day - 1) * 8, 21 + day * 8);
      const raw = cell.slice(0, 5).trim(), flags = cell.slice(5);
      if (!/^(?:-9999|\d+)$/.test(raw) || !/^[ BDHKLOPTW][ DGIKLMNORSTWXZ][ 01267AaBbCDdEFfGHIKMmNQRrSsTUuWXZz]$/.test(flags)) {
        throw new Error('GHCN: Unknown precipitation value or flags.');
      }
      const rain = raw === '-9999' ? null : Number(raw) / 10;
      if (day > days) {
        if (rain !== null) throw new Error('GHCN: Value on an impossible calendar day.');
        continue;
      }
      if (flags[0] === 'T' && rain !== null && rain !== 0) throw new Error('GHCN: Non-zero trace amount.');
      rows.push([`${prefix}-${String(day).padStart(2, '0')}`, rain, rain === null ? 0 : ghcnQuality(rain, flags), flags]);
    }
  }
  if (!rows.length) throw new Error('GHCN: No precipitation records.');
  return rows;
}

async function downloadArchive(source: string, request: typeof fetch): Promise<string> {
  let failure: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    let response: Response | undefined;
    try {
      response = await request(source, {signal:AbortSignal.timeout(120_000)});
      if (response.ok) return await response.text();
    } catch (error) {
      failure = error;
    }
    if (response && !response.ok) {
      failure = new Error(`GHCN: HTTP ${response.status} for ${source}.`);
      await response.body?.cancel();
      if (response.status !== 429 && response.status < 500) throw failure;
    }
    if (attempt < 3) await delay(attempt * 1_000);
  }
  throw failure;
}

export async function fetchGHCN(station: Station, bounds: Parameters<typeof splitDailyArchive>[2], now: Date, request: typeof fetch = fetch) {
  if (!/^[A-Z0-9]{11}$/.test(station.sourceId)) throw new Error('GHCN: Invalid station ID.');
  const source = `${ghcnBase}all/${station.sourceId}.dly`;
  const text = await downloadArchive(source, request);
  if (text.length > 30_000_000) throw new Error('GHCN: Unexpectedly large station file.');
  return splitDailyArchive(station, parseGHCN(text, station.sourceId), bounds, now, source);
}
