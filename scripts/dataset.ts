import { createHash } from "node:crypto";
import { usableRow, validateRows, type Dataset, type Row } from "../src/lib/datasets.ts";
import type { Provider, Station } from "../src/lib/stations.ts";

export function makeDataset(stationId: string, from: string, to: string, rows: Row[], fetchedAt: string, source: string): Dataset {
  validateRows(rows, from, to);
  const revision = createHash("sha256").update(JSON.stringify({ stationId, from, to, rows })).digest("hex");
  return { schemaVersion: 1, stationId, revision, fetchedAt, from, to, source, rows };
}

export function assertNoRegression(previous: Dataset | undefined, next: Dataset, provider: Provider = "jma") {
  if (!previous || previous.from !== next.from) return;
  const complete = (data: Dataset) => data.rows.filter(row => usableRow(row, provider)).length;
  if (next.to < previous.to || complete(next) < complete(previous)) {
    throw new Error(`${next.stationId}: Der neue Stand enthält weniger vollständige Tageswerte.`);
  }
}

export function fillDays(rows: Row[], from: string, to: string): Row[] {
  const byDate = new Map(rows.map(row => [row[0], row]));
  const result: Row[] = [];
  for (let day = Date.parse(from); day <= Date.parse(to); day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    result.push(byDate.get(date) ?? [date, null, 0]);
  }
  validateRows(result, from, to);
  return result;
}

export function splitDailyArchive(station: Station, rows: Row[], bounds: {historyEnd: string; currentStart: string; yesterday: string}, now: Date, source: string) {
  const reported = rows.filter(row => row[1] !== null && row[0] <= bounds.yesterday);
  const last = reported.at(-1)?.[0];
  if (!last || rows[0][0] > station.historyStart || last < bounds.historyEnd) {
    throw new Error(`${station.id}: Archive is empty, truncated or missing the preceding year.`);
  }
  // Keep the displayed cutoff honest when the source is a few days behind.
  // Missing internal days remain null; they are never interpolated.
  const currentEnd = last < bounds.currentStart ? bounds.historyEnd : last;
  return {
    history: makeDataset(station.id, station.historyStart, bounds.historyEnd, fillDays(rows, station.historyStart, bounds.historyEnd), now.toISOString(), source),
    current: makeDataset(station.id, bounds.currentStart, currentEnd, fillDays(rows, bounds.currentStart, currentEnd), now.toISOString(), source),
  };
}
