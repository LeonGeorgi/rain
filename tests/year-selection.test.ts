import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyze, availableYears } from '../src/lib/rain.ts';
import type { Row } from '../src/lib/datasets.ts';

function wetYear(year: number, amount: number, quality = 8): Row[] {
  const from = Date.UTC(year, 0, 1);
  const days = (Date.UTC(year + 1, 0, 1) - from) / 86_400_000;
  return Array.from({length:days}, (_, index) => [new Date(from + index * 86_400_000).toISOString().slice(0,10), amount, quality]);
}

const history = [...wetYear(2022, 1), ...wetYear(2023, 2), ...wetYear(2024, 3)];
const current: Row[] = [['2025-01-01', 4, 8], ['2025-01-02', 5, 8]];

test('selecting a historical year updates its curve, leap sum, statistics and reference without comparing it to itself', () => {
  const result = analyze(history, current, 'all', 'cumulative', 'jma', {year:2024});
  assert.equal(result.year, 2024);
  assert.equal(result.lastDate, '2024-12-31');
  assert.equal(result.total, 1098);
  assert.equal(result.points.at(-1)?.current, 1098);
  assert.equal(result.complete, true);
  assert.deepEqual(result.series.map(series=>series.year), [2022,2023]);
  assert.equal(result.points.at(-1)?.median, 547.5);
  assert.equal(result.higher, 0);
  assert.ok(result.ranking.every(entry=>entry.year!==2024));
});

test('returning to the current year restores the observed cutoff and keeps the historical archive unchanged', () => {
  const selected = analyze(history, current, 'all', 'cumulative', 'jma', {year:2025});
  const original = analyze(history, current);
  assert.deepEqual(selected, original);
  assert.equal(selected.lastDate, '2025-01-02');
  assert.equal(selected.total, 9);
  assert.equal(selected.complete, false);
});

test('complete selected years use cyclic smoothing, while incomplete years retain an open tail and stop at gaps', () => {
  const result = analyze(history, current, 'all', 'gaussian', 'jma', {year:2024});
  assert.equal(result.provisionalTail, false);
  assert.ok(result.points.every(point=>Math.abs(point.current!-3)<1e-12));
  const broken: Row[] = wetYear(2024,3);
  broken[2] = ['2024-01-03',null,8];
  const incomplete = analyze([...wetYear(2023,1),...broken],current,'all','gaussian','jma',{year:2024});
  assert.equal(incomplete.lastDate,'2024-01-02');
  assert.equal(incomplete.gap,true);
  assert.equal(incomplete.provisionalTail,true);
  assert.equal(incomplete.total,6);
});

test('selectable years respect source-specific quality, skip empty years and include the current year even before its first measurement', () => {
  const rows:Row[] = [['2000-01-01',null,8],['2001-01-01',1,5],['2002-01-01',2,8],['2003-01-01',0,10]];
  assert.deepEqual(availableYears(rows,[],2025,'jma'),[2025,2002]);
  assert.deepEqual(availableYears(rows,[],2025,'dwd'),[2025,2003,2002,2001]);
  assert.deepEqual(availableYears([],[],2025,'dwd'),[2025]);
  const result=analyze(rows,[],'all','cumulative','dwd',{year:2000});
  assert.equal(result.year,2000);
  assert.equal(result.last,-1);
  assert.equal(result.gap,true);
});

test('year selection is independent of the normal reference window and uses the selected year’s preceding December', () => {
  const archive=[...wetYear(1999,1),...wetYear(2000,2),...wetYear(2023,10),...wetYear(2024,1)];
  const selected=analyze(archive,current,'normal','gaussian','jma',{year:2025});
  assert.deepEqual(selected.series.map(series=>series.year),[1999,2000]);
  const earlier=analyze(archive,current,'normal','cumulative','jma',{year:2000});
  assert.deepEqual(earlier.series.map(series=>series.year),[1999]);
  assert.equal(earlier.total,732);
  const partial:Row[]=[['2024-01-01',4,8],['2024-01-02',null,8]];
  const padded=analyze([...wetYear(2023,10),...partial],current,'normal','gaussian','jma',{year:2024});
  assert.ok(padded.points[0].current!>9);
});
