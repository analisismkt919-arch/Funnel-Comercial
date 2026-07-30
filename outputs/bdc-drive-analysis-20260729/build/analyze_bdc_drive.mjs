import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath = "C:/Users/mkt-tj-ai/Downloads/Copia de CITAS 25  26.xlsx";
const outputDir = "C:/Users/mkt-tj-ai/Documents/FUNNEL/vercel-supabase/outputs/bdc-drive-analysis-20260729";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  include: "id,name,address,rowCount,columnCount",
  maxChars: 12000,
  tableMaxRows: 4,
  tableMaxCols: 12,
});
await fs.writeFile(`${outputDir}/overview.ndjson`, overview.ndjson, "utf8");
console.log(overview.ndjson);

const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 12000 });
await fs.writeFile(`${outputDir}/sheets.ndjson`, sheets.ndjson, "utf8");
console.log(sheets.ndjson);

const sheetNames = [];
for (const line of sheets.ndjson.split(/\r?\n/)) {
  if (!line.trim()) continue;
  try {
    const item = JSON.parse(line);
    if (item.name) sheetNames.push(item.name);
  } catch {}
}

for (const name of sheetNames) {
  const safe = name.replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60);
  const region = await workbook.inspect({
    kind: "region",
    sheetId: name,
    range: "A1:AZ25",
    include: "values,formulas",
    maxChars: 18000,
    tableMaxRows: 25,
    tableMaxCols: 52,
  });
  await fs.writeFile(`${outputDir}/${safe}-top.ndjson`, region.ndjson, "utf8");
  console.log(`SHEET:${name}\n${region.ndjson}`);
}

if (sheetNames.length) {
  const preview = await workbook.render({
    sheetName: sheetNames[0],
    range: "A1:Z20",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(`${outputDir}/preview-first-sheet.png`, new Uint8Array(await preview.arrayBuffer()));
}
