import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "C:/Users/mkt-tj-ai/Documents/FUNNEL/vercel-supabase/outputs/campaign-template-20260729";
const workbook = Workbook.create();
const input = workbook.worksheets.add("Campañas BDC");
const instructions = workbook.worksheets.add("Instrucciones");
const catalogs = workbook.worksheets.add("Catálogos");

workbook.comments.setSelf({ displayName: "User" });

input.showGridLines = false;
instructions.showGridLines = false;
catalogs.showGridLines = false;

input.getRange("A1:I1").merge();
input.getRange("A1").values = [["PLANTILLA DE IMPORTACIÓN MASIVA DE CAMPAÑAS BDC"]];
input.getRange("A1:I1").format = {
  fill: "#143568",
  font: { bold: true, color: "#FFFFFF", size: 16 },
  verticalAlignment: "center",
};
input.getRange("A1:I1").format.rowHeight = 34;

input.getRange("A2:I2").merge();
input.getRange("A2").values = [[
  "Registra una fila por periodo, campaña y sucursal. El mismo archivo puede contener varios meses y años."
]];
input.getRange("A2:I2").format = {
  fill: "#EAF2FF",
  font: { color: "#31598D", italic: true },
  verticalAlignment: "center",
};
input.getRange("A2:I2").format.rowHeight = 27;

input.getRange("A4:I4").values = [[
  "Periodo", "Marca", "Origen", "Campaña", "Sucursal", "Cantidad",
  "Presupuesto inicial", "Presupuesto adicional", "Presupuesto total"
]];
input.getRange("A4:I4").format = {
  fill: "#2563EB",
  font: { bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "outside", style: "thin", color: "#1E40AF" },
};
input.getRange("A4:I4").format.rowHeight = 30;

const blankRows = Array.from({ length: 250 }, () => ["", "", "", "", "", null, null, null, null]);
input.getRange("A5:I254").values = blankRows;
input.getRange("I5").formulas = [["=IF(D5=\"\",\"\",SUM(G5:H5))"]];
input.getRange("I5:I254").fillDown();
input.getRange("A5:H254").format.fill = "#FFFBEA";
input.getRange("I5:I254").format.fill = "#EAF7EF";
input.getRange("F5:F254").format.numberFormat = "#,##0";
input.getRange("G5:I254").format.numberFormat = "\"$\"#,##0";
input.getRange("A5:I254").format.borders = {
  insideHorizontal: { style: "thin", color: "#E4EAF2" },
  bottom: { style: "thin", color: "#CBD5E1" },
};

input.getRange("A5:A254").dataValidation = {
  rule: { type: "list", formula1: "'Catálogos'!$D$2:$D$61" }
};
input.getRange("B5:B254").dataValidation = {
  rule: { type: "list", formula1: "'Catálogos'!$A$2:$A$3" }
};
input.getRange("C5:C254").dataValidation = {
  rule: { type: "list", formula1: "'Catálogos'!$B$2:$B$3" }
};
input.getRange("E5:E254").dataValidation = {
  rule: { type: "list", formula1: "'Catálogos'!$C$2:$C$14" }
};
input.getRange("F5:H254").dataValidation = {
  rule: { type: "whole", operator: "greaterThanOrEqual", formula1: 0 }
};

input.getRange("A4:I254").format.verticalAlignment = "center";
input.getRange("A:A").format.columnWidth = 13;
input.getRange("B:B").format.columnWidth = 12;
input.getRange("C:C").format.columnWidth = 14;
input.getRange("D:D").format.columnWidth = 34;
input.getRange("E:E").format.columnWidth = 22;
input.getRange("F:F").format.columnWidth = 13;
input.getRange("G:I").format.columnWidth = 21;
input.freezePanes.freezeRows(4);
input.freezePanes.freezeColumns(1);
input.tables.add("A4:I254", true, "CampanasBdcImport");

workbook.comments.addThread(
  { cell: input.getRange("A4") },
  "Formato obligatorio AAAA-MM. Ejemplos: 2024-01, 2025-07, 2026-12."
);
workbook.comments.addThread(
  { cell: input.getRange("D4") },
  "Usa exactamente el mismo nombre para una campaña distribuida entre varias sucursales."
);
workbook.comments.addThread(
  { cell: input.getRange("G4") },
  "El presupuesto solo aplica a campañas de origen PROPIOS. Para PLANTA déjalo en cero."
);

instructions.getRange("A1:F1").merge();
instructions.getRange("A1").values = [["GUÍA DE USO"]];
instructions.getRange("A1:F1").format = {
  fill: "#143568",
  font: { bold: true, color: "#FFFFFF", size: 16 },
};
instructions.getRange("A3:B13").values = [
  ["Paso", "Instrucción"],
  ["1", "En la hoja Campañas BDC registra una fila por cada combinación de periodo, campaña y sucursal."],
  ["2", "Puedes incluir campañas de diferentes meses y años dentro del mismo archivo."],
  ["3", "Periodo debe escribirse como AAAA-MM; por ejemplo, 2025-07."],
  ["4", "Marca solo admite TORO o CHS. Origen solo admite PLANTA o PROPIOS."],
  ["5", "Para campañas multisucursal repite el nombre de la campaña y cambia Sucursal y Cantidad."],
  ["6", "Fuera del PMA se usa cuando el registro cuenta en el total, pero no pertenece a una sucursal."],
  ["7", "Presupuesto inicial y adicional solo aplican a PROPIOS; el total se calcula automáticamente."],
  ["8", "No cambies el nombre de la hoja Campañas BDC ni los encabezados."],
  ["9", "En la plataforma entra a BDC y usa Importar BDC.xlsx."],
  ["10", "Si una asignación ya existe para el mismo periodo, marca, origen, campaña y sucursal, se reemplazará; los demás datos BDC se conservan."],
];
instructions.getRange("A3:B3").format = {
  fill: "#2563EB", font: { bold: true, color: "#FFFFFF" }
};
instructions.getRange("A4:A13").format = {
  fill: "#EAF2FF", font: { bold: true, color: "#1D4ED8" }, horizontalAlignment: "center"
};
instructions.getRange("A3:B13").format.borders = {
  insideHorizontal: { style: "thin", color: "#D9E2EF" },
  outside: { style: "thin", color: "#B8C7DA" },
};
instructions.getRange("A:A").format.columnWidth = 10;
instructions.getRange("B:B").format.columnWidth = 105;
instructions.getRange("B4:B13").format.wrapText = true;
instructions.getRange("A4:B13").format.rowHeight = 30;

const periods = [];
for (let year = 2020; year <= 2030; year += 1) {
  for (let month = 1; month <= 12; month += 1) {
    periods.push([`${year}-${String(month).padStart(2, "0")}`]);
  }
}
catalogs.getRange("A1:D1").values = [["Marcas", "Orígenes", "Sucursales", "Periodos"]];
catalogs.getRange("A1:D1").format = {
  fill: "#143568", font: { bold: true, color: "#FFFFFF" }
};
catalogs.getRange("A2:A3").values = [["TORO"], ["CHS"]];
catalogs.getRange("B2:B3").values = [["PLANTA"], ["PROPIOS"]];
catalogs.getRange("C2:C14").values = [
  ["Juventud"], ["Universidad"], ["Estadio Sur"], ["Delicias"], ["Cuauhtémoc"],
  ["Parral"], ["Camargo"], ["Manitoba"], ["Jimenez"], ["Ojinaga"],
  ["CHS Juventud"], ["CHS Delicias"], ["Fuera del PMA"],
];
catalogs.getRange(`D2:D${periods.length + 1}`).values = periods;
catalogs.getRange("A:D").format.columnWidth = 22;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({
  sheetName: "Campañas BDC",
  range: "A1:I18",
  scale: 1.5,
  format: "png",
});
await fs.writeFile(`${outputDir}/preview.png`, new Uint8Array(await preview.arrayBuffer()));

const inspect = await workbook.inspect({
  kind: "table",
  range: "Campañas BDC!A1:I12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 9,
});
console.log(inspect.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan",
});
console.log(errors.ndjson);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${outputDir}/Plantilla_Importacion_Masiva_Campanas_BDC.xlsx`);
