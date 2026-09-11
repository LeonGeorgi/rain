import { createHash } from "node:crypto";
import { usableRow, validateRows, type Dataset, type Row } from "../src/lib/datasets.ts";
import type { Provider } from "../src/lib/stations.ts";

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
