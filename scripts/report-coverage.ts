import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { stations } from "../src/lib/stations.ts";
import { summarizeCoverage, validateDataset, type StationManifest } from "../src/lib/datasets.ts";

const directory = fileURLToPath(new URL("../public/data/", import.meta.url));
const manifest = JSON.parse(await readFile(resolve(directory, "stations.json"), "utf8")) as StationManifest;
const issues: {name:string; provider:string; continuous:string|null; usable:string|null; missing:number}[] = [];

for (const station of stations) {
  const entry = manifest.stations.find(item => item.id === station.id);
  if (!entry) throw new Error(`Missing station ${station.id}.`);
  const current = validateDataset(JSON.parse(await readFile(resolve(directory, entry.current.path), "utf8")), station.id);
  const coverage = summarizeCoverage(current.rows, station.provider);
  if (coverage.missingOrUnusableDays > 0 || coverage.lastContinuous !== coverage.lastUsable) {
    issues.push({
      name: station.name,
      provider: station.provider.toUpperCase(),
      continuous: coverage.lastContinuous,
      usable: coverage.lastUsable,
      missing: coverage.missingOrUnusableDays,
    });
  }
}

console.log("## Observation coverage");
console.log("");
console.log(`Published: ${manifest.updatedAt}`);
console.log("");
if (!issues.length) {
  console.log("All current station series are continuous through their latest usable observation.");
} else {
  console.log("| Station | Provider | Exact through | Latest usable | Missing/unusable days |");
  console.log("| --- | --- | --- | --- | ---: |");
  for (const issue of issues) {
    console.log(`| ${issue.name} | ${issue.provider} | ${issue.continuous ?? "—"} | ${issue.usable ?? "—"} | ${issue.missing} |`);
  }
}
