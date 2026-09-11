export type Row = [string, number | null, number];

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
  stations: { id: string; name: string; jp: string; history: DatasetReference; current: DatasetReference }[];
};

export function validateRows(rows: unknown, from: string, to: string): asserts rows is Row[] {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !Number.isFinite(start) || !Number.isFinite(end) ||
      new Date(start).toISOString().slice(0, 10) !== from ||
      new Date(end).toISOString().slice(0, 10) !== to) {
    throw new Error("Ungültige Datumsgrenzen.");
  }
  const count = Math.max(0, (end - start) / 86_400_000 + 1);
  if (!Array.isArray(rows) || rows.length !== count) throw new Error("Unvollständiger Datenzeitraum.");
  rows.forEach((row, index) => {
    const date = new Date(start + index * 86_400_000).toISOString().slice(0, 10);
    if (!Array.isArray(row) || row.length !== 3 || row[0] !== date ||
        !(row[1] === null || (typeof row[1] === "number" && Number.isFinite(row[1]) && row[1] >= 0)) ||
        !Number.isInteger(row[2]) || row[2] < 0 || row[2] > 9) {
      throw new Error(`Ungültiger Tageswert oder Datumsfolge: ${date}.`);
    }
  });
}

export function validateDataset(value: unknown, stationId: string): Dataset {
  if (!value || typeof value !== "object") throw new Error("Ungültige Stationsdatei.");
  const data = value as Dataset;
  if (data.schemaVersion !== 1 || data.stationId !== stationId ||
      typeof data.revision !== "string" || !/^[a-f0-9]{64}$/.test(data.revision) ||
      !Number.isFinite(Date.parse(data.fetchedAt)) || typeof data.source !== "string") {
    throw new Error("Stationskennung oder Datenformat stimmt nicht überein.");
  }
  validateRows(data.rows, data.from, data.to);
  return data;
}
