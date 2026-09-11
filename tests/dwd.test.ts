import assert from 'node:assert/strict';
import { test } from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDWD, parseArchive, fillDays, historicalArchive, dwdBase, fetchDWD } from '../scripts/dwd.ts';
import { makeDataset } from '../scripts/dataset.ts';
import { dateBounds, updateData } from '../scripts/update-data.ts';
import { analyze } from '../src/lib/rain.ts';
import { stations } from '../src/lib/stations.ts';
import type { Row } from '../src/lib/datasets.ts';

const csv = (rows: string) => `STATIONS_ID;MESS_DATUM;QN_4;RSK;eor\r\n${rows}`;
const germanStation = stations.find(station => station.id === 'dwd-00433')!;

test('DWD preserves zero, missing values and the original quality procedure', () => {
  const rows = parseDWD(csv('433;20240101;5;0.0;eor\r\n433;20240103;10;-999;eor\r\n433;20240104;-999;2.5;eor'), '00433');
  assert.deepEqual(rows, [['2024-01-01', 0, 5], ['2024-01-03', null, 10], ['2024-01-04', 2.5, 0]]);
  assert.deepEqual(fillDays(rows, '2024-01-01', '2024-01-04')[1], ['2024-01-02', null, 0]);
  assert.deepEqual(fillDays(rows, '2025-01-01', '2024-12-31'), []);
});

test('DWD rejects wrong stations, malformed values, unknown quality and invalid or duplicate dates', () => {
  for (const row of ['434;20240101;10;1;eor', '433;20240101;10;;eor', '433;20240101;4;1;eor',
    '433;20240101;10;-1;eor', '433;20240230;10;1;eor', '433;20240101;10;1;eor\n433;20240101;10;2;eor']) {
    assert.throws(() => parseDWD(csv(row), '00433'));
  }
  assert.throws(() => parseDWD('STATIONS_ID;MESS_DATUM;RSK\n433;20240101;1', '00433'));
});

test('DWD reads exactly one daily product from ZIP and requires an unambiguous station archive', () => {
  const product = strToU8(csv('433;20240101;10;1.5;eor'));
  const bytes = zipSync({'produkt_klima_tag_20240101_20240101_00433.txt': product, 'metadata.txt': strToU8('ignored')});
  assert.deepEqual(parseArchive(bytes, '00433'), [['2024-01-01', 1.5, 10]]);
  assert.throws(() => parseArchive(zipSync({'metadata.txt': product}), '00433'));
  assert.throws(() => parseArchive(zipSync({'produkt_klima_tag_a.txt': product, 'produkt_klima_tag_b.txt': product}), '00433'));
  const name = 'tageswerte_KL_00433_19480101_20251231_hist.zip';
  assert.equal(historicalArchive(`<a href="${name}">${name}</a>`, '00433'), `${dwdBase}historical/${name}`);
  assert.throws(() => historicalArchive(name, '01975'));
  assert.throws(() => historicalArchive(`${name} tageswerte_KL_00433_19480101_20241231_hist.zip`, '00433'));
});

function wetYear(year: number, quality: number): Row[] {
  return fillDays([], `${year}-01-01`, `${year}-12-31`).map(([date]) => [date, 1, quality]);
}

test('German analysis accepts historical QN 5/10 and provisional QN 1, preserves leap totals and stops at gaps', () => {
  const history = [...wetYear(2023, 5), ...wetYear(2024, 10)];
  const current: Row[] = [['2025-01-01', 2, 1], ['2025-01-02', null, 1], ['2025-01-03', 3, 1]];
  const data = analyze(history, current, 'all', 'cumulative', 'dwd');
  assert.deepEqual(data.series.map(series => series.values.at(-1)), [365, 366]);
  assert.equal(data.lastDate, '2025-01-01');
  assert.equal(data.total, 2);
  assert.equal(data.gap, true);
  assert.equal(analyze(history, current).series.length, 0);
  assert.equal(analyze(wetYear(2024, 8), [['2025-01-01', 2, 8]]).series.length, 1);
  const gaussian = analyze(history, current, 'all', 'gaussian', 'dwd');
  assert.ok(gaussian.series[0].values.every(value => Math.abs(value - 1) < 1e-12));
  assert.equal(analyze([...wetYear(2023, 5).slice(1)], [], 'all', 'cumulative', 'dwd').series.length, 0);
});

test('year boundaries follow the station timezone, including German summer time', () => {
  const now = new Date('2026-12-31T15:00:00Z');
  assert.equal(dateBounds(now).currentStart, '2027-01-01');
  assert.equal(dateBounds(now, 'Europe/Berlin').currentStart, '2026-01-01');
  assert.equal(dateBounds(new Date('2026-07-01T22:30:00Z'), 'Europe/Berlin').yesterday, '2026-07-01');
});

test('a DWD failure preserves published Japanese and German data', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'rain-dwd-test-'));
  const options = {
    directory, selectedStations: [stations[0], germanStation], now: new Date('2026-01-03T00:00:00Z'),
    fetchRows: async (_station: typeof germanStation, from: string, to: string) => fillDays([], from, to).map(([date]): Row => [date, 1, 8]),
    loadGermanIndex: async () => '',
    fetchGermanData: async (station: typeof germanStation, bounds: ReturnType<typeof dateBounds>, now: Date) => ({
      history: makeDataset(station.id, station.historyStart, bounds.historyEnd, fillDays([], station.historyStart, bounds.historyEnd), now.toISOString(), dwdBase),
      current: makeDataset(station.id, bounds.currentStart, bounds.yesterday, fillDays([], bounds.currentStart, bounds.yesterday), now.toISOString(), dwdBase),
    }),
  };
  try {
    await updateData(options);
    const manifest = await readFile(join(directory, 'stations.json'), 'utf8');
    const japanese = await readFile(join(directory, '47662/current.json'), 'utf8');
    await assert.rejects(updateData({...options, now: new Date('2026-01-04T00:00:00Z'), fetchGermanData: async () => { throw new Error('DWD unavailable'); }}));
    assert.equal(await readFile(join(directory, 'stations.json'), 'utf8'), manifest);
    assert.equal(await readFile(join(directory, '47662/current.json'), 'utf8'), japanese);
  } finally {
    await rm(directory, {recursive:true, force:true});
  }
});

test('a provisional preceding year never enters the historical reference before the annual archive release', async context => {
  const archive = (rows: Row[]) => zipSync({'produkt_klima_tag_test.txt': strToU8(csv(rows.map(([date, rain, quality]) =>
    `433;${date.replaceAll('-', '')};${quality};${rain};eor`).join('\n')))});
  const historical = archive(wetYear(2024, 10));
  const recent = archive([['2025-12-31', 99, 1], ['2026-01-01', 2, 1]]);
  context.mock.method(globalThis, 'fetch', async (url: string) => new Response(new Uint8Array(url.endsWith('_hist.zip') ? historical : recent).buffer));
  const station = {...germanStation, historyStart:'2024-01-01'};
  const data = await fetchDWD(station, dateBounds(new Date('2026-01-03T00:00:00Z'), station.timeZone),
    new Date('2026-01-03T00:00:00Z'), 'tageswerte_KL_00433_20240101_20241231_hist.zip');
  assert.deepEqual(data.history.rows.at(-1), ['2025-12-31', null, 0]);
  assert.deepEqual(analyze(data.history.rows, data.current.rows, 'all', 'cumulative', 'dwd').series.map(series => series.year), [2024]);
  assert.equal(data.current.to, '2026-01-01');
  assert.deepEqual(data.current.rows, [['2026-01-01', 2, 1]]);
});
