import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCSV, endpoint } from "../scripts/jma.ts";
import { makeDataset as createDataset, assertNoRegression } from "../scripts/dataset.ts";
function makeDataset(id: string, from: string, to: string, rows: Row[], fetchedAt: string) {
  return createDataset(id, from, to, rows, fetchedAt, endpoint);
}
import { dateBounds, updateData } from "../scripts/update-data.ts";
import { validateRows, type Row } from "../src/lib/datasets.ts";
import { stations } from "../src/lib/stations.ts";

const station = stations[0];
const csv = (rows: string) => `,東京,東京,東京,東京\n年月日,降水量の合計(mm),降水量の合計(mm),降水量の合計(mm),降水量の合計(mm)\n${rows}`;

test("JMA keeps missing rainfall distinct from zero and preserves quality flags", () => {
  const rows = parseCSV(csv("2026/1/1,0.0,0,8,1\n2026/1/2,,0,1,1"), station);
  assert.deepEqual(rows, [["2026-01-01", 0, 8], ["2026-01-02", null, 1]]);
  validateRows(rows, "2026-01-01", "2026-01-02");
});

test("JMA rejects wrong stations, malformed numbers and unknown quality values", () => {
  assert.throws(() => parseCSV(csv("2026/1/1,0,0,8,1"), stations[1]));
  assert.throws(() => parseCSV(csv("2026/1/1,invalid,0,8,1"), station));
  assert.throws(() => parseCSV(csv("2026/1/1,2,0,,1"), station));
  assert.throws(() => parseCSV(csv("2026/1/1,-2,0,8,1"), station));
});

test("validation rejects missing, duplicate, out-of-order and impossible dates", () => {
  assert.throws(() => validateRows([["2026-01-01", 0, 8]], "2026-01-01", "2026-01-02"));
  assert.throws(() => validateRows([["2026-01-01", 0, 8], ["2026-01-01", 1, 8]], "2026-01-01", "2026-01-02"));
  assert.throws(() => validateRows([["2026-01-02", 0, 8], ["2026-01-01", 1, 8]], "2026-01-01", "2026-01-02"));
  assert.throws(() => validateRows([], "2026-02-30", "2026-03-01"));
});

test("revisions detect historical corrections without changing on an identical fetch", () => {
  const rows: Row[] = [["2026-01-01", 2, 8]];
  const a = makeDataset(station.id, "2026-01-01", "2026-01-01", rows, "2026-01-02T00:00:00Z");
  const b = makeDataset(station.id, a.from, a.to, rows, "2026-01-03T00:00:00Z");
  const corrected = makeDataset(station.id, a.from, a.to, [["2026-01-01", 3, 8]], b.fetchedAt);
  assert.equal(a.revision, b.revision);
  assert.notEqual(a.revision, corrected.revision);
  assert.throws(() => assertNoRegression(a, makeDataset(station.id, a.from, a.to, [["2026-01-01", null, 1]], b.fetchedAt)));
});

test("year rollover follows Japan time, including January 1 and leap day", () => {
  assert.deepEqual(dateBounds(new Date("2026-12-31T15:00:00Z")), {
    historyEnd: "2026-12-31", currentStart: "2027-01-01", yesterday: "2026-12-31",
  });
  assert.equal(dateBounds(new Date("2024-03-01T00:00:00Z")).yesterday, "2024-02-29");
});

function rowsBetween(from: string, to: string): Row[] {
  return Array.from({ length: Math.max(0, (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1) }, (_, index) =>
    [new Date(Date.parse(from) + index * 86_400_000).toISOString().slice(0, 10), 1, 8]);
}

test("updates reuse history and a failed station leaves all published files unchanged", async () => {
  const directory = await mkdtemp(join(tmpdir(), "rain-data-test-"));
  try {
    let calls = 0;
    const options = { directory, selectedStations: stations.slice(0, 2), now: new Date("2026-01-03T00:00:00Z") };
    const manifest = await updateData({ ...options, fetchRows: async (_station, from, to) => { calls++; return rowsBetween(from, to); } });
    assert.equal(calls, 12);
    const original = await readFile(join(directory, "stations.json"), "utf8");
    const current = await readFile(join(directory, "47662/current.json"), "utf8");
    calls = 0;
    await assert.rejects(updateData({ ...options, now: new Date("2026-01-04T00:00:00Z"), fetchRows: async (station, from, to) => {
      calls++;
      if (station.id === stations[1].id) throw new Error("JMA unavailable");
      return rowsBetween(from, to);
    } }), /JMA unavailable/);
    assert.equal(calls, 2);
    assert.equal(await readFile(join(directory, "stations.json"), "utf8"), original);
    assert.equal(await readFile(join(directory, "47662/current.json"), "utf8"), current);
    assert.equal(manifest.stations.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
