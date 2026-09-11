import type { Provider } from "./stations.ts";

// GHCN rows additionally preserve their original measurement, quality and source flags.
export type Row = [string, number | null, number, string?];

export type Dataset = {
  schemaVersion: 1;
  stationId: string;
  revision: string;
  fetchedAt: string;
  from: string;
  to: string;
  source: string;
  rows: Row[];
  validatedMonths?: number;
};

export type DatasetReference = Omit<Dataset, "rows" | "schemaVersion" | "stationId" | "source"> & {
  path: string;
};

export type StationManifest = {
  schemaVersion: 1;
  updatedAt: string;
  historyEndYear: number;
  stations: { id: string; name: string; jp?: string; history: DatasetReference; current: DatasetReference }[];
};

export function validateRows(rows: unknown, from: string, to: string): asserts rows is Row[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !Number.isFinite(start) || !Number.isFinite(end) ||
      new Date(start).toISOString().slice(0, 10) !== from ||
      new Date(end).toISOString().slice(0, 10) !== to) {
    throw new Error("Invalid date boundaries.");
  }
  const count = Math.max(0, (end - start) / 86_400_000 + 1);
  if (!Array.isArray(rows) || rows.length !== count) throw new Error("Incomplete data period.");
  rows.forEach((row, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    if (!Array.isArray(row) || (row.length !== 3 && row.length !== 4) || row[0] !== date ||
        !(row[1] === null || (typeof row[1] === "number" && Number.isFinite(row[1]) && row[1] >= 0)) ||
        !Number.isInteger(row[2]) || row[2] < 0 || row[2] > 10 ||
        (row.length === 4 && (typeof row[3] !== 'string' || !/^[\x20-\x7e]{3}$/.test(row[3])))) {
      throw new Error(`Invalid daily value or date sequence: ${date}.`);
    }
  });
}

export function validateDataset(value: unknown, stationId: string): Dataset {
  if (!value || typeof value !== "object") throw new Error("Invalid station file.");
  const data = value as Dataset;
  if (data.schemaVersion !== 1 || data.stationId !== stationId ||
      typeof data.revision !== "string" || !/^[a-f0-9]{64}$/.test(data.revision) ||
      !Number.isFinite(Date.parse(data.fetchedAt)) || typeof data.source !== "string") {
    throw new Error("Station ID or data format does not match.");
  }
  validateRows(data.rows, data.from, data.to);
  if (stationId.startsWith('ghcn-') && data.rows.some(row => row[2] !== (row[1] === null ? 0 : ghcnQuality(row[1], row[3] ?? '')))) {
    throw new Error('GHCN quality status does not match the original flags.');
  }
  return data;
}

// Status 1 = usable amount, 2 = trace (stored as zero), 0 = missing/rejected.
// These internal statuses are distinct from JMA and DWD quality codes.
export function ghcnQuality(rain: number, flags: string) {
  if (!/^[ BDPT]$/.test(flags[0] ?? '') || flags.length !== 3 || flags[1] !== ' ' || flags[2] === ' ' || flags[0] === 'P') return 0;
  if (flags[0] === 'T') return rain === 0 ? 2 : 0;
  return 1;
}

// DWD QN describes the checking procedure, not the JMA per-value quality flag.
export function usableRow(row: Row, provider: Provider = "jma") {
  if (row[1] === null) return false;
  if (provider === 'jma') return row[2] === 8;
  if (provider === 'dwd') return [1, 2, 3, 5, 7, 8, 9, 10].includes(row[2]);
  return row[2] === 1 || row[2] === 2;
}
