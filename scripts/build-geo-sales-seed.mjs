import fs from 'node:fs';
import XLSX from 'xlsx';

const [source, target] = process.argv.slice(2);
const workbook = XLSX.readFile(source, { cellDates: true });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
const clean = value => String(value ?? '').trim();
const periodFromDate = value => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const match = clean(value).match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
};
const sales = rows.map((row, index) => ({
  id: clean(row['No. Factura']) || `venta-${index + 1}`,
  fecha: periodFromDate(row.Fecha), sucursal: clean(row.Sucursal), modelo: clean(row['Desc. Modelo']),
  colonia: clean(row.Colonia), cp: clean(row['Codigo Postal']).replace(/\.0$/, '').padStart(5, '0'),
  municipio: clean(row.Municipio), estado: clean(row.Estado),
})).filter(row => row.fecha && /^\d{5}$/.test(row.cp));
fs.writeFileSync(target, JSON.stringify({ meta: { source: 'VENTAS ENERO-JUNIO 2026.xls', importedAt: new Date().toISOString(), rows: sales.length }, sales }));
console.log(JSON.stringify({ rows: sales.length, bytes: fs.statSync(target).size }));
