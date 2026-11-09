import { createHash } from "node:crypto";
import { usableRow, validateRows, type Dataset, type Row } from "../src/lib/datasets.ts";
import type { Provider, Station } from "../src/lib/stations.ts";

export function makeDataset(stationId: string, from: string, to: string, rows: Row[], fetchedAt: string, source: string): Dataset {
  validateRows(rows, from, to);
  const revision = createHash("sha256").update(JSON.stringify({ stationId, from, to, rows })).digest("hex");
  return { schemaVersion: 1, stationId, revision, fetchedAt, from, to, source, rows };
}

export type RegressionReport = {
  stationId: string;
  provider: Provider;
  previous: { from: string; to: string; usableDays: number };
  next: { from: string; to: string; usableDays: number };
  lostUsableDays: number;
  gainedUsableDays: number;
  // Keep console output bounded. The diagnostic file includes both full datasets.
  lostDayExamples: { date: string; previous: Row; next: Row | null }[];
};

export function describeRegression(previous: Dataset | undefined, next: Dataset, provider: Provider = "jma"): RegressionReport | undefined {
  if (!previous || previous.from !== next.from) return;
  const summarize = (data: Dataset) => ({ from: data.from, to: data.to, usableDays: data.rows.filter(row => usableRow(row, provider)).length });
  const oldSummary = summarize(previous), newSummary = summarize(next);
  if (next.to >= previous.to && newSummary.usableDays >= oldSummary.usableDays) return;
  const oldRows = new Map(previous.rows.map(row => [row[0], row]));
  const newRows = new Map(next.rows.map(row => [row[0], row]));
  const lost = previous.rows.filter(row => usableRow(row, provider) && (!newRows.has(row[0]) || !usableRow(newRows.get(row[0])!, provider)));
  const gained = next.rows.filter(row => usableRow(row, provider) && (!oldRows.has(row[0]) || !usableRow(oldRows.get(row[0])!, provider)));
  return {
    stationId: next.stationId, provider, previous: oldSummary, next: newSummary,
    lostUsableDays: lost.length, gainedUsableDays: gained.length,
    lostDayExamples: lost.slice(0, 10).map(row => ({ date: row[0], previous: row, next: newRows.get(row[0]) ?? null })),
  };
}

export class DataRegressionError extends Error {
  report: RegressionReport;

  constructor(report: RegressionReport) {
    const examples = report.lostDayExamples.map(day => `${day.date}: ${JSON.stringify(day.previous)} -> ${JSON.stringify(day.next)}`).join("; ");
    super(`${report.stationId} (${report.provider}): Der neue Stand enthält weniger vollständige Tageswerte oder einen früheren Endtag. ` +
      `Endtag ${report.previous.to} -> ${report.next.to}; verwendbare Tage ${report.previous.usableDays} -> ${report.next.usableDays}; ` +
      `verloren ${report.lostUsableDays}, hinzugekommen ${report.gainedUsableDays}.` + (examples ? ` Beispiele: ${examples}` : ""));
    this.name = "DataRegressionError";
    this.report = report;
  }
}

export function assertNoRegression(previous: Dataset | undefined, next: Dataset, provider: Provider = "jma") {
  const report = describeRegression(previous, next, provider);
  if (report) throw new DataRegressionError(report);
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

