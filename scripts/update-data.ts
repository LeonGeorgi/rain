import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stations, type Station } from "../src/lib/stations.ts";
import { validateDataset, type Dataset, type DatasetReference, type StationManifest } from "../src/lib/datasets.ts";
import { endpoint, fetchJMA } from "./jma.ts";
import { assertNoRegression, makeDataset } from "./dataset.ts";
import { fetchDWD, fetchDWDIndex } from "./dwd.ts";

const dataDirectory = fileURLToPath(new URL("../public/data/", import.meta.url));

export function dateBounds(now: Date, timeZone = "Asia/Tokyo") {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const year = Number(today.slice(0, 4));
  return {
    historyEnd: `${year - 1}-12-31`, currentStart: `${year}-01-01`,
    yesterday: new Date(Date.parse(today) - 86_400_000).toISOString().slice(0, 10),
  };
}

async function readDataset(directory: string, stationId: string, period: string) {
  try {
    return validateDataset(JSON.parse(await readFile(resolve(directory, stationId, `${period}.json`), "utf8")), stationId);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function reference(data: Dataset, period: string): DatasetReference {
  return {
    path: `${data.stationId}/${period}.json`, revision: data.revision,
    fetchedAt: data.fetchedAt, from: data.from, to: data.to,
  };
}

export async function updateData({
  directory = dataDirectory, now = new Date(), selectedStations = stations,
  fetchRows = fetchJMA, refreshHistory = false, fetchGermanData = fetchDWD, loadGermanIndex = fetchDWDIndex,
}: {
  directory?: string; now?: Date; selectedStations?: Station[];
  fetchRows?: typeof fetchJMA; refreshHistory?: boolean;
  fetchGermanData?: typeof fetchDWD; loadGermanIndex?: typeof fetchDWDIndex;
} = {}) {
  const { historyEnd } = dateBounds(now);
  const manifest: StationManifest = {
    schemaVersion: 1, updatedAt: now.toISOString(), historyEndYear: Number(historyEnd.slice(0, 4)), stations: [],
  };
  const pending = new Map<string, Dataset>();
  const germanIndex = selectedStations.some(station => station.provider === "dwd") ? await loadGermanIndex() : "";
  for (const station of selectedStations) {
    const bounds = dateBounds(now, station.timeZone);
    const { historyEnd, currentStart, yesterday } = bounds;
    console.log(`Updating ${station.name} (${station.id})`);
    const previousHistory = await readDataset(directory, station.id, "history");
    const previousCurrent = await readDataset(directory, station.id, "current");
    let history: Dataset;
    let current: Dataset;
    if (station.provider === "dwd") {
      ({ history, current } = await fetchGermanData(station, bounds, now, germanIndex));
    } else {
      if (previousHistory && (previousHistory.from !== station.historyStart || previousHistory.to > historyEnd)) {
        throw new Error(`Unexpected historical coverage for ${station.id}.`);
      }
      if (!refreshHistory && previousHistory?.to === historyEnd) {
        history = previousHistory;
      } else {
        const rows = refreshHistory ? [] : [...(previousHistory?.rows ?? [])];
        let from = rows.length
          ? new Date(Date.parse(rows.at(-1)![0]) + 86_400_000).toISOString().slice(0, 10)
          : station.historyStart;
        while (from <= historyEnd) {
          const to = `${Math.min(Number(from.slice(0, 4)) + 29, Number(historyEnd.slice(0, 4)))}-12-31`;
          console.log(`  History ${from} to ${to}`);
          rows.push(...await fetchRows(station, from, to));
          from = `${Number(to.slice(0, 4)) + 1}-01-01`;
        }
        history = makeDataset(station.id, station.historyStart, historyEnd, rows, now.toISOString(), endpoint);
      }
      const currentRows = yesterday < currentStart ? [] : await fetchRows(station, currentStart, yesterday);
      current = makeDataset(station.id, currentStart, yesterday, currentRows, now.toISOString(), endpoint);
    }
    assertNoRegression(previousHistory, history, station.provider);
    assertNoRegression(previousCurrent, current, station.provider);
    pending.set(`${station.id}/history.json`, history);
    pending.set(`${station.id}/current.json`, current);
    manifest.stations.push({
      id: station.id, name: station.name, jp: station.jp,
      history: reference(history, "history"), current: reference(current, "current"),
    });
  }
  // Nothing is written until every station has passed validation. The manifest
  // is published last; the workflow commits only after this command succeeds.
  for (const [name, data] of pending) {
    await mkdir(resolve(directory, data.stationId), { recursive: true });
    const path = resolve(directory, name);
    await writeFile(`${path}.tmp`, `${JSON.stringify(data)}\n`);
    await rename(`${path}.tmp`, path);
  }
  await writeFile(resolve(directory, "stations.json.tmp"), `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(resolve(directory, "stations.json.tmp"), resolve(directory, "stations.json"));
  return manifest;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== "--refresh-history")) throw new Error("Only --refresh-history is supported.");
  await updateData({ refreshHistory: args.includes("--refresh-history") });
}
