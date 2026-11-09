import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertNoRegression, DataRegressionError, describeRegression, fillDays, makeDataset } from '../scripts/dataset.ts';
import { fetchWithoutRegression } from '../scripts/update-retry.ts';
import { dateBounds, updateData } from '../scripts/update-data.ts';
import type { Row } from '../src/lib/datasets.ts';
import { stations, type Provider, type Station } from '../src/lib/stations.ts';

const station = stations.find(station => station.provider === 'ghcn')!;
const fetchedAt = '2026-01-04T12:00:00.000Z';
const dataset = (rows: Row[], from = '2026-01-01', to = rows.at(-1)?.[0] ?? '2025-12-31') =>
  makeDataset(station.id, from, to, rows, fetchedAt, 'https://example.com/archive');
const good = dataset([['2026-01-01', 2, 1, '  W'], ['2026-01-02', 0, 2, 'T W'], ['2026-01-03', 4, 1, '  W']]);
const bad = dataset([['2026-01-01', 2, 0, ' SX'], ['2026-01-02', null, 0, '   ']]);
const previous = { history: good, current: good };
const degraded = { history: bad, current: bad };

test('regression diagnostics include precise periods, usable counts, lost dates, values and original flags', () => {
  const report = describeRegression(good, bad, 'ghcn')!;
  assert.deepEqual(report, {
    stationId: station.id, provider: 'ghcn',
    previous: { from: good.from, to: good.to, usableDays: 3 },
    next: { from: bad.from, to: bad.to, usableDays: 0 },
    lostUsableDays: 3, gainedUsableDays: 0,
    lostDayExamples: good.rows.map((row, index) => ({date: row[0], previous: row, next: bad.rows[index] ?? null})),
  });
  assert.throws(() => assertNoRegression(good, bad, 'ghcn'), (error: unknown) => {
    assert.ok(error instanceof DataRegressionError);
    assert.deepEqual(error.report, report);
    for (const text of [station.id, 'ghcn', good.to, bad.to, '3 -> 0', ' SX', 'T W', 'null']) assert.ok(error.message.includes(text));
    return true;
  });
});

test('guard retains aggregate-count semantics, accepts new stations and rollover, and catches an earlier cutoff alone', () => {
  assert.equal(describeRegression(undefined, bad, 'ghcn'), undefined);
  assert.equal(describeRegression(good, dataset([], '2027-01-01', '2026-12-31'), 'ghcn'), undefined);
  const old = dataset([['2026-01-01', 1, 1], ['2026-01-02', null, 0]]);
  const replacement = dataset([['2026-01-01', null, 0], ['2026-01-02', 2, 1]]);
  assert.doesNotThrow(() => assertNoRegression(old, replacement, 'knmi'));
  const shorter = dataset([['2026-01-01', 1, 1]]);
  const report = describeRegression(old, shorter, 'knmi')!;
  assert.equal(report.previous.usableDays, report.next.usableDays);
  assert.equal(report.lostUsableDays, 0);
  assert.deepEqual(report.lostDayExamples, []);
  const mixed = dataset([['2026-01-01', null, 0], ['2026-01-02', 2, 1], ['2026-01-03', null, 0]]);
  const baseline = dataset([['2026-01-01', 1, 1], ['2026-01-02', null, 0], ['2026-01-03', 1, 1]]);
  assert.equal(describeRegression(baseline, mixed, 'knmi')!.lostUsableDays, 2);
  assert.equal(describeRegression(baseline, mixed, 'knmi')!.gainedUsableDays, 1);
});

test('diagnostics apply each provider quality policy and bound examples without truncating counts', () => {
  const qualities: [Provider, number][] = [['jma', 8], ['dwd', 10], ['ghcn', 2], ['knmi', 2]];
  for (const [provider, quality] of qualities) {
    const old = dataset(fillDays([], '2026-01-01', '2026-01-31').map(([date]): Row => [date, 0, quality]));
    const next = dataset(old.rows.map(([date]): Row => [date, 0, 0]));
    const report = describeRegression(old, next, provider)!;
    assert.equal(report.previous.usableDays, 31);
    assert.equal(report.next.usableDays, 0);
    assert.equal(report.lostUsableDays, 31);
    assert.equal(report.lostDayExamples.length, 10);
    assert.equal(report.lostDayExamples.at(-1)!.date, '2026-01-10');
    assert.ok(!new DataRegressionError(report).message.includes('2026-01-11'));
  }
});

test('successful first fetch needs no retry, while a third-attempt recovery saves each full rejected dataset', async t => {
  t.mock.method(console, 'warn', () => {});
  const directory = await mkdtemp(join(tmpdir(), 'rain-recovery-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  let calls = 0;
  const waits: number[] = [];
  const waitBeforeRetry = async (ms: number) => { waits.push(ms); };
  assert.equal(await fetchWithoutRegression({station, previous, fetchData: async () => previous, waitBeforeRetry}), previous);
  assert.deepEqual(waits, []);
  const result = await fetchWithoutRegression({station, previous, diagnosticsDirectory: directory, waitBeforeRetry,
    fetchData: async () => ++calls < 3 ? degraded : previous});
  assert.equal(result, previous);
  assert.equal(calls, 3);
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal((await readdir(directory)).length, 2);
  for (const attempt of [1, 2]) {
    const artifact = JSON.parse(await readFile(join(directory, `${station.id}-attempt-${attempt}.json`), 'utf8'));
    assert.equal(artifact.schemaVersion, 1);
    assert.equal(artifact.stationId, station.id);
    assert.equal(artifact.provider, 'ghcn');
    assert.equal(artifact.attempt, attempt);
    assert.equal(artifact.maxAttempts, 3);
    assert.ok(Number.isFinite(Date.parse(artifact.recordedAt)));
    assert.deepEqual(artifact.regressions.map((entry: {period: string}) => entry.period), ['history', 'current']);
    for (const entry of artifact.regressions) {
      assert.deepEqual(entry.previous, good);
      assert.deepEqual(entry.next, bad);
      assert.deepEqual(entry.report, describeRegression(good, bad, 'ghcn'));
    }
  }
});

test('exhausted diagnostics preserve all normalized rows beyond the ten console examples', async t => {
  t.mock.method(console, 'warn', () => {});
  const directory = await mkdtemp(join(tmpdir(), 'rain-full-diagnostic-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const baseline = dataset(fillDays([], '2026-01-01', '2026-01-31').map(([date]): Row => [date, 1, 1, '  W']));
  const rejected = dataset(baseline.rows.map(([date]): Row => [date, 1, 0, ' SX']));
  await assert.rejects(fetchWithoutRegression({station, previous: {current: baseline},
    diagnosticsDirectory: directory, waitBeforeRetry: async () => {},
    fetchData: async () => ({history: good, current: rejected})}), AggregateError);
  assert.equal((await readdir(directory)).length, 3);
  for (const attempt of [1, 2, 3]) {
    const artifact = JSON.parse(await readFile(join(directory, `${station.id}-attempt-${attempt}.json`), 'utf8'));
    assert.equal(artifact.regressions.length, 1);
    const entry = artifact.regressions[0];
    assert.equal(entry.period, 'current');
    assert.equal(entry.report.lostDayExamples.length, 10);
    assert.equal(entry.report.lostUsableDays, 31);
    assert.deepEqual(entry.previous, baseline);
    assert.deepEqual(entry.next, rejected);
  }
});

test('exhaustion is bounded and includes both final regression reports even if diagnostic writes fail', async t => {
  const warnings = t.mock.method(console, 'warn', () => {});
  const directory = await mkdtemp(join(tmpdir(), 'rain-diagnostic-error-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const file = join(directory, 'not-a-directory');
  await writeFile(file, 'keep');
  for (const recover of [false, true]) {
    let calls = 0;
    const waits: number[] = [];
    const result = fetchWithoutRegression({station, previous, diagnosticsDirectory: file,
      fetchData: async () => ++calls === 3 && recover ? previous : degraded,
      waitBeforeRetry: async ms => { waits.push(ms); }});
    if (recover) assert.equal(await result, previous);
    else await assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof AggregateError);
      assert.match(error.message, /after 3 attempts.*history, current.*No data published/);
      assert.equal(error.errors.length, 2);
      assert.ok(error.errors.every(item => item instanceof DataRegressionError));
      return true;
    });
    assert.equal(calls, 3);
    assert.deepEqual(waits, [1000, 2000]);
  }
  assert.ok(warnings.mock.calls.some(call => String(call.arguments[0]).includes('Could not save regression diagnostic')));
  assert.equal(await readFile(file, 'utf8'), 'keep');
});

test('transport and parsing errors propagate unchanged without additional regression retries', async t => {
  t.mock.method(console, 'warn', () => {});
  for (const successfulRegressions of [0, 1]) {
    let calls = 0;
    const waits: number[] = [];
    const failure = new Error('provider parse/transport failure');
    await assert.rejects(fetchWithoutRegression({station, previous,
      fetchData: async () => { if (++calls <= successfulRegressions) return degraded; throw failure; },
      waitBeforeRetry: async ms => { waits.push(ms); }}), error => error === failure);
    assert.equal(calls, successfulRegressions + 1);
    assert.deepEqual(waits, successfulRegressions ? [1000] : []);
  }
});

for (const failingProvider of ['jma', 'dwd', 'ghcn', 'knmi'] as const) {
  test(`${failingProvider} regression exhaustion leaves every provider's published files and manifest byte-identical`, async t => {
    t.mock.method(console, 'warn', () => {});
    t.mock.method(console, 'log', () => {});
    const directory = await mkdtemp(join(tmpdir(), 'rain-publish-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    // Put the failing provider last so all other providers have staged new data.
    const providers: Provider[] = ['jma', 'dwd', 'ghcn', 'knmi'];
    const selectedStations = providers.filter(provider => provider !== failingProvider).concat(failingProvider)
      .map(provider => ({...stations.find(station => station.provider === provider)!, historyStart: '2025-12-01'}));
    let fail = false;
    let failingCalls = 0;
    const rows = (station: Station, from: string, to: string): Row[] => {
      const rejected = fail && station.provider === failingProvider && from === '2026-01-01';
      if (rejected) failingCalls++;
      return fillDays([], from, to).map(([date]): Row => rejected ?
        (station.provider === 'ghcn' ? [date, null, 0, '   '] : [date, null, 0]) :
        (station.provider === 'ghcn' ? [date, fail ? 2 : 1, 1, '  W'] : [date, fail ? 2 : 1, station.provider === 'jma' ? 8 : 1]));
    };
    const fetchData = async (station: Station, bounds: ReturnType<typeof dateBounds>) => ({
      history: makeDataset(station.id, station.historyStart, bounds.historyEnd, rows(station, station.historyStart, bounds.historyEnd), fetchedAt, 'fixture'),
      current: makeDataset(station.id, bounds.currentStart, bounds.yesterday, rows(station, bounds.currentStart, bounds.yesterday), fetchedAt, 'fixture'),
    });
    const options = {directory, selectedStations, now: new Date(fetchedAt), loadGermanIndex: async () => '',
      fetchRows: async (station: Station, from: string, to: string) => rows(station, from, to),
      fetchGermanData: fetchData, fetchGlobalData: fetchData, fetchDutchData: fetchData, waitBeforeRetry: async () => {}};
    await updateData(options);
    const paths = ['stations.json', ...selectedStations.flatMap(station => ['history', 'current'].map(period => `${station.id}/${period}.json`))];
    const before = await Promise.all(paths.map(path => readFile(join(directory, path), 'utf8')));
    fail = true;
    await assert.rejects(updateData(options), /Data regression persists after 3 attempts/);
    assert.equal(failingCalls, 3);
    assert.deepEqual(await Promise.all(paths.map(path => readFile(join(directory, path), 'utf8'))), before);
  });
}
