import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Dataset } from "../src/lib/datasets.ts";
import type { Station } from "../src/lib/stations.ts";
import { DataRegressionError, describeRegression } from "./dataset.ts";

type StationData = { history: Dataset; current: Dataset };
const maxAttempts = 3;

export async function fetchWithoutRegression({
  station, previous, fetchData, diagnosticsDirectory, waitBeforeRetry = delay,
}: {
  station: Station;
  previous: Partial<StationData>;
  fetchData: () => Promise<StationData>;
  diagnosticsDirectory?: string;
  waitBeforeRetry?: (milliseconds: number) => Promise<unknown>;
}): Promise<StationData> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Transport/parsing failures retain their existing provider-specific policy.
    // Only a successful fetch that fails the regression guard is retried here.
    const next = await fetchData();
    const regressions = (["history", "current"] as const).flatMap(period => {
      const report = describeRegression(previous[period], next[period], station.provider);
      return report ? [{ period, report, previous: previous[period], next: next[period] }] : [];
    });
    if (!regressions.length) return next;

    for (const { period, report } of regressions) {
      console.warn(`[${period}, attempt ${attempt}/${maxAttempts}] ${new DataRegressionError(report).message}`);
    }
    if (diagnosticsDirectory) {
      const path = resolve(diagnosticsDirectory, `${encodeURIComponent(station.id)}-attempt-${attempt}.json`);
      try {
        await mkdir(diagnosticsDirectory, { recursive: true });
        await writeFile(path, `${JSON.stringify({
          schemaVersion: 1, recordedAt: new Date().toISOString(), stationId: station.id,
          provider: station.provider, attempt, maxAttempts, regressions,
        }, null, 2)}\n`);
        console.warn(`Regression diagnostic: ${path}`);
      } catch (error) {
        // Diagnostics must not mask the original regression or prevent recovery.
        console.warn(`Could not save regression diagnostic ${path}:`, error);
      }
    }
    if (attempt === maxAttempts) {
      throw new AggregateError(regressions.map(({ report }) => new DataRegressionError(report)),
        `${station.id}: Data regression persists after ${maxAttempts} attempts (${regressions.map(({ period }) => period).join(", ")}). No data published.`);
    }
    await waitBeforeRetry(attempt * 1_000);
  }
  throw new Error("Unreachable retry state.");
}
