import { cacheGet, cachePut } from "./cache.ts";
import { validateDataset, type Dataset, type DatasetReference, type StationManifest } from "./datasets.ts";

export async function loadStationData(
  stationId: string,
  signal: AbortSignal,
  onCached: (history?: Dataset, current?: Dataset) => void,
) {
  const key = (period: string) => `${import.meta.env.BASE_URL}:${stationId}:published:${period}`;
  const [cachedHistory, cachedCurrent] = await Promise.all([cacheGet(key("history")), cacheGet(key("current"))]);
  if (signal.aborted) throw signal.reason;
  onCached(cachedHistory, cachedCurrent);
  const base = `${import.meta.env.BASE_URL}data/`;
  const response = await fetch(`${base}stations.json`, { signal, cache: "no-cache" });
  if (!response.ok) throw new Error(`The published data is unavailable (HTTP ${response.status}).`);
  const manifest = await response.json() as StationManifest;
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.stations)) throw new Error("Unrecognised station directory.");
  const station = manifest.stations.find(station => station.id === stationId);
  if (!station) throw new Error("No data has been published for this station yet.");
  async function load(ref: DatasetReference, cached: Dataset | undefined, period: string) {
    if (ref.path !== `${stationId}/${period}.json`) throw new Error("Invalid station path.");
    if (cached?.revision === ref.revision) return cached;
    const result = await fetch(`${base}${ref.path}?v=${encodeURIComponent(ref.revision)}`, { signal, cache: "no-cache" });
    if (!result.ok) throw new Error(`The station file is unavailable (HTTP ${result.status}).`);
    const data = validateDataset(await result.json(), stationId);
    if (data.revision !== ref.revision) throw new Error("The data has just been updated. Please refresh again.");
    return data;
  }
  const [history, current] = await Promise.all([
    load(station.history, cachedHistory, "history"), load(station.current, cachedCurrent, "current"),
  ]);
  if (signal.aborted) throw signal.reason;
  const stored = await Promise.all([cachePut(key("history"), history), cachePut(key("current"), current)]);
  return { history, current, updatedAt: manifest.updatedAt, storageWarning: stored.includes(false) };
}

