import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { stations } from "../src/lib/stations.ts";
import { validateDataset, type StationManifest } from "../src/lib/datasets.ts";
import { makeDataset } from "./dataset.ts";

const directory = fileURLToPath(new URL("../public/data/", import.meta.url));
const manifest: StationManifest = JSON.parse(await readFile(resolve(directory, "stations.json"), "utf8"));
if (manifest.schemaVersion !== 1 || !Number.isFinite(Date.parse(manifest.updatedAt)) ||
    !Array.isArray(manifest.stations) || manifest.stations.length !== stations.length ||
    new Set(manifest.stations.map(station => station.id)).size !== stations.length) {
  throw new Error("Invalid station manifest.");
}
for (const station of stations) {
  const entry = manifest.stations.find(entry => entry.id === station.id);
  if (!entry || entry.name !== station.name || entry.jp !== station.jp) throw new Error(`Missing station ${station.id}.`);
  for (const period of ["history", "current"] as const) {
    const ref = entry[period];
    if (ref.path !== `${station.id}/${period}.json`) throw new Error("Invalid dataset path.");
    const data = validateDataset(JSON.parse(await readFile(resolve(directory, ref.path), "utf8")), station.id);
    const expected = makeDataset(data.stationId, data.from, data.to, data.rows, data.fetchedAt, data.source);
    if (data.revision !== expected.revision || data.revision !== ref.revision ||
        data.from !== ref.from || data.to !== ref.to || data.fetchedAt !== ref.fetchedAt) {
      throw new Error(`Dataset revision/metadata mismatch: ${ref.path}.`);
    }
    if (period === "history" && (data.from !== station.historyStart || data.to !== `${Number(entry.current.from.slice(0, 4)) - 1}-12-31`)) {
      throw new Error(`Historical coverage mismatch: ${ref.path}.`);
    }
    if (period === "current" && data.from !== `${Number(entry.history.to.slice(0, 4)) + 1}-01-01`) {
      throw new Error(`Current-year coverage mismatch: ${ref.path}.`);
    }
  }
}
console.log(`Validated ${stations.length} stations and ${stations.length * 2} datasets.`);
