import XLSX from 'xlsx';

const file = process.argv[2];
const workbook = XLSX.readFile(file, { cellDates: true, dense: false });
for (const name of workbook.SheetNames) {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
  console.log(JSON.stringify({
    sheet: name,
    ref: sheet['!ref'] || null,
    rows: rows.length,
    preview: rows.slice(0, 12),
  }, null, 2));
}
