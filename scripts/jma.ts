import { validateRows, type Row } from "../src/lib/datasets.ts";
import type { Station } from "../src/lib/stations.ts";

export const endpoint = "https://www.data.jma.go.jp/risk/obsdl/show/table";

export function parseCSV(text: string, station: Station): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const cells = lines.map(line => line.split(",").map(cell => cell.replace(/^"|"$/g, "")));
  if (!cells.some(row => row[0] === "" && row[1] === station.jp) ||
      !cells.some(row => row[0] === "年月日" && row[1] === "降水量の合計(mm)")) {
    throw new Error(`JMA lieferte nicht die erwartete Station ${station.name} oder Messgröße.`);
  }
  return cells.filter(row => /^\d{4}\/\d{1,2}\/\d{1,2}$/.test(row[0])).map(row => {
    const [year, month, day] = row[0].split("/");
    const raw = row[1]?.trim();
    if (raw === undefined || (raw !== "" && !/^\d+(\.\d+)?$/.test(raw)) || !/^\d$/.test(row[3] ?? "")) {
      throw new Error("Unbekanntes JMA-Zahlen- oder Qualitätsformat.");
    }
    return [`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`, raw === "" ? null : Number(raw), Number(row[3])];
  });
}

export async function fetchJMA(station: Station, from: string, to: string): Promise<Row[]> {
  const a = from.split("-"), b = to.split("-");
  const body = new URLSearchParams({
    stationNumList: JSON.stringify([`s${station.id}`]), elementNumList: '[["101",""]]',
    ymdList: JSON.stringify([a[0], b[0], a[1], b[1], a[2], b[2]]),
    aggrgPeriod: "1", interAnnualType: "1", optionNumList: "[]", downloadFlag: "true",
    rmkFlag: "1", disconnectFlag: "1", youbiFlag: "0", fukenFlag: "0", kijiFlag: "0",
    csvFlag: "1", jikantaiFlag: "0", jikantaiList: "[]", ymdLiteral: "1",
  });
  const response = await fetch(endpoint, { method: "POST", body, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`JMA ${station.name}: HTTP ${response.status}.`);
  const rows = parseCSV(new TextDecoder("shift_jis").decode(await response.arrayBuffer()), station);
  validateRows(rows, from, to);
  return rows;
}
