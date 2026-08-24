'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Boxes, Car, CheckCircle2, Download, Plus, Save, Search, Trash2, Upload } from 'lucide-react';

const EMPTY_DATA = { records: [] };
const ALL_BRANCHES = 'Todas las sucursales';
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const textKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
const periodLabel = value => {
  const [year, month] = String(value || '').split('-');
  return month ? `${MONTHS[Math.max(0, Number(month) - 1)]} ${year}` : value;
};
const normalizePeriod = (value, XLSX) => {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  if (typeof value === 'number') {
    const parsed = XLSX?.SSF?.parse_date_code?.(value);
    if (parsed?.y && parsed?.m) return `${parsed.y}-${String(parsed.m).padStart(2, '0')}`;
  }
  const clean = String(value || '').trim();
  const iso = clean.match(/^(\d{4})[-/]?(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}`;
  const named = textKey(clean).match(new RegExp(`(${MONTHS.map(textKey).join('|')})\\s*(?:DE\\s*)?(\\d{4})`));
  if (named) return `${named[2]}-${String(MONTHS.map(textKey).indexOf(named[1]) + 1).padStart(2, '0')}`;
  return '';
};
const ageBand = days => {
  const value = Math.max(0, Number(days) || 0);
  if (value <= 30) return { key: 'healthy', label: 'Sano', className: 'healthy' };
  if (value <= 60) return { key: 'watch', label: 'Vigilancia', className: 'watch' };
  if (value <= 90) return { key: 'attention', label: 'Atención', className: 'attention' };
  return { key: 'critical', label: 'Crítico', className: 'critical' };
};
const makeRow = (period, branch) => ({
  id: `inventory-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  period,
  branch: branch || '',
  model: '',
  unitId: '',
  quantity: 1,
  days: 0,
  updatedAt: new Date().toISOString(),
});

export default function InventoryModule({
  data = EMPTY_DATA,
  persistData,
  branchCatalog = [],
  selectedMonth,
  canCapture = false,
  showToast,
}) {
  const allowedBranches = useMemo(() => branchCatalog.filter(branch => branch?.active !== false), [branchCatalog]);
  const availablePeriods = useMemo(() => {
    const values = new Set((data?.records || []).map(row => row.period).filter(Boolean));
    if (selectedMonth) values.add(selectedMonth);
    const current = new Date();
    values.add(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
    return [...values].sort().reverse();
  }, [data, selectedMonth]);
  const [period, setPeriod] = useState(selectedMonth || availablePeriods[0] || '');
  const [branch, setBranch] = useState('todas');
  const [status, setStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const importRef = useRef(null);

  const allowedKeys = useMemo(() => new Set([...allowedBranches.map(item => textKey(item.name)), textKey(ALL_BRANCHES)]), [allowedBranches]);
  useEffect(() => {
    if (!period && selectedMonth) setPeriod(selectedMonth);
  }, [period, selectedMonth]);
  useEffect(() => {
    const scoped = (data?.records || []).filter(row => row.period === period && allowedKeys.has(textKey(row.branch)));
    setDraft(scoped.map(row => ({ ...row })));
  }, [data, period, allowedKeys]);

  const visibleRows = useMemo(() => draft.filter(row => {
    if (branch !== 'todas' && ![textKey(branch), textKey(ALL_BRANCHES)].includes(textKey(row.branch))) return false;
    if (status !== 'todos' && ageBand(row.days).key !== status) return false;
    const query = textKey(search);
    return !query || textKey(`${row.model} ${row.unitId} ${row.branch}`).includes(query);
  }), [draft, branch, status, search]);

  const summary = useMemo(() => {
    const result = { units: 0, weightedDays: 0, over60: 0, over90: 0 };
    visibleRows.forEach(row => {
      const quantity = Math.max(1, Number(row.quantity) || 1);
      const days = Math.max(0, Number(row.days) || 0);
      result.units += quantity;
      result.weightedDays += quantity * days;
      if (days > 60) result.over60 += quantity;
      if (days > 90) result.over90 += quantity;
    });
    result.average = result.units ? Math.round(result.weightedDays / result.units) : 0;
    return result;
  }, [visibleRows]);

  const byModel = useMemo(() => {
    const grouped = new Map();
    visibleRows.forEach(row => {
      const model = String(row.model || 'Sin modelo').trim();
      const key = textKey(model);
      const quantity = Math.max(1, Number(row.quantity) || 1);
      const days = Math.max(0, Number(row.days) || 0);
      const current = grouped.get(key) || { model, units: 0, weightedDays: 0, maxDays: 0, over60: 0, branches: new Set() };
      current.units += quantity;
      current.weightedDays += quantity * days;
      current.maxDays = Math.max(current.maxDays, days);
      if (days > 60) current.over60 += quantity;
      if (row.branch) current.branches.add(row.branch);
      grouped.set(key, current);
    });
    return [...grouped.values()].map(item => ({
      ...item,
      average: item.units ? Math.round(item.weightedDays / item.units) : 0,
      branchCount: item.branches.size,
    })).sort((a, b) => b.maxDays - a.maxDays || b.units - a.units);
  }, [visibleRows]);

  const existingModels = useMemo(() => [...new Set((data?.records || []).map(row => String(row.model || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'es')), [data]);
  const updateRow = (id, field, value) => setDraft(rows => rows.map(row => row.id === id ? { ...row, [field]: value, updatedAt: new Date().toISOString() } : row));
  const addRow = () => setDraft(rows => [...rows, makeRow(period, branch === 'todas' ? ALL_BRANCHES : branch)]);
  const deleteRow = id => setDraft(rows => rows.filter(row => row.id !== id));
  const save = async () => {
    const valid = draft.filter(row => row.model?.trim() && row.branch && Number(row.quantity) > 0).map(row => ({
      ...row,
      period,
      model: row.model.trim(),
      quantity: Math.max(1, Number(row.quantity) || 1),
      days: Math.max(0, Number(row.days) || 0),
      updatedAt: new Date().toISOString(),
    }));
    const untouched = (data?.records || []).filter(row => row.period !== period || !allowedKeys.has(textKey(row.branch)));
    setSaving(true);
    try {
      await persistData({ records: [...untouched, ...valid] });
      showToast?.(`${valid.length} registros de inventario guardados`, 'success');
    } catch (error) {
      showToast?.(error?.message || 'No fue posible guardar el inventario', 'error');
    } finally {
      setSaving(false);
    }
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const exampleBranch = allowedBranches[0]?.name || ALL_BRANCHES;
    const rows = [
      { Periodo: period || '2026-08', Sucursal: exampleBranch, Modelo: 'Aveo', Unidad_VIN: 'VIN-OPCIONAL-001', Cantidad: 1, Dias_Inventario: 18 },
      { Periodo: period || '2026-08', Sucursal: ALL_BRANCHES, Modelo: 'Tahoe', Unidad_VIN: '', Cantidad: 2, Dias_Inventario: 47 },
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:14},{wch:24},{wch:24},{wch:24},{wch:12},{wch:18}];
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    const catalog = XLSX.utils.aoa_to_sheet([
      ['Sucursales permitidas'],
      [ALL_BRANCHES],
      ...allowedBranches.map(item => [item.name]),
      [],
      ['Indicaciones'],
      ['Periodo: AAAA-MM o nombre del mes y año.'],
      ['Cada importación reemplaza únicamente las sucursales y periodos incluidos en el archivo.'],
      ['Unidad_VIN es opcional; Cantidad y Dias_Inventario deben ser números.'],
    ]);
    catalog['!cols'] = [{wch:82}];
    XLSX.utils.book_append_sheet(wb, catalog, 'Catálogos');
    XLSX.writeFile(wb, `Plantilla_Inventarios_${period || 'mensual'}.xlsx`);
  };

  const importInventory = async file => {
    setImporting(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      const branchesByKey = new Map(allowedBranches.map(item => [textKey(item.name), item.name]));
      branchesByKey.set(textKey(ALL_BRANCHES), ALL_BRANCHES);
      const incoming = [];
      const rejected = [];
      rows.forEach((row, index) => {
        const rowPeriod = normalizePeriod(row.Periodo ?? row.Mes ?? row.Fecha, XLSX) || period;
        const branchName = branchesByKey.get(textKey(row.Sucursal));
        const model = String(row.Modelo ?? row.Unidad ?? '').trim();
        const unitId = String(row.Unidad_VIN ?? row.VIN ?? row['Unidad / VIN'] ?? '').trim();
        const quantity = Number(row.Cantidad ?? 1);
        const days = Number(row.Dias_Inventario ?? row['Días en inventario'] ?? row.Dias ?? row['Días']);
        if (!rowPeriod || !branchName || !model || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(days) || days < 0) {
          rejected.push(index + 2);
          return;
        }
        const identity = textKey(`${rowPeriod}|${branchName}|${unitId || `${model}|${days}`}`);
        incoming.push({ id: `inventory-${identity.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90)}`, period: rowPeriod, branch: branchName, model, unitId, quantity: Math.max(1, Math.round(quantity)), days: Math.round(days), updatedAt: new Date().toISOString() });
      });
      if (!incoming.length) throw new Error(`No se encontraron filas válidas${rejected.length ? `; revisa las filas ${rejected.slice(0, 8).join(', ')}` : ''}.`);
      const scopes = new Set(incoming.map(row => `${row.period}|${textKey(row.branch)}`));
      const untouched = (data?.records || []).filter(row => !scopes.has(`${row.period}|${textKey(row.branch)}`));
      const unique = new Map();
      incoming.forEach(row => unique.set(row.id, row));
      const imported = [...unique.values()];
      await persistData({ records: [...untouched, ...imported] });
      setPeriod(imported.map(row => row.period).sort().at(-1));
      showToast?.(`${imported.length} registros importados${rejected.length ? ` · ${rejected.length} filas omitidas` : ''}`, 'success');
    } catch (error) {
      console.error(error);
      showToast?.(error?.message || 'No fue posible importar el inventario', 'error');
    } finally {
      setImporting(false);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return <div className="inventory-module">
    <style>{INVENTORY_CSS}</style>
    <section className="inventory-hero">
      <div><span className="inventory-eyebrow"><Boxes size={14}/> INTELIGENCIA DE INVENTARIO</span><h1>Inventario por modelo y antigüedad</h1><p>Controla existencias, días en piso y prioridades de desplazamiento por sucursal.</p></div>
      <div className="inventory-hero-actions"><div className="inventory-period"><span>Periodo</span><select value={period} onChange={event => setPeriod(event.target.value)}>{availablePeriods.map(value => <option key={value} value={value}>{periodLabel(value)}</option>)}</select></div>{canCapture && <><button type="button" className="inventory-hero-button secondary" onClick={downloadTemplate}><Download size={15}/> Plantilla</button><button type="button" className="inventory-hero-button" disabled={importing} onClick={() => importRef.current?.click()}><Upload size={15}/> {importing ? 'Importando…' : 'Importar Excel'}</button><input ref={importRef} type="file" accept=".xlsx,.xls" hidden onChange={event => event.target.files?.[0] && importInventory(event.target.files[0])}/></>}</div>
    </section>

    <section className="inventory-filters">
      <label><span>Sucursal</span><select value={branch} onChange={event => setBranch(event.target.value)}><option value="todas">Todas las sucursales</option>{allowedBranches.map(item => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></label>
      <label><span>Antigüedad</span><select value={status} onChange={event => setStatus(event.target.value)}><option value="todos">Todos los estatus</option><option value="healthy">0–30 días · Sano</option><option value="watch">31–60 · Vigilancia</option><option value="attention">61–90 · Atención</option><option value="critical">Más de 90 · Crítico</option></select></label>
      <label className="inventory-search"><span>Buscar</span><div><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Modelo, unidad o sucursal"/></div></label>
    </section>

    <section className="inventory-kpis">
      <article><Car/><span>Unidades</span><strong>{summary.units.toLocaleString('es-MX')}</strong><small>Inventario del filtro actual</small></article>
      <article><Boxes/><span>Promedio en inventario</span><strong>{summary.average} días</strong><small>Promedio ponderado por unidades</small></article>
      <article className="warning"><AlertTriangle/><span>Más de 60 días</span><strong>{summary.over60}</strong><small>Requieren plan de desplazamiento</small></article>
      <article className="critical"><AlertTriangle/><span>Más de 90 días</span><strong>{summary.over90}</strong><small>Prioridad comercial inmediata</small></article>
    </section>

    <section className="inventory-panel">
      <header><div><span className="inventory-eyebrow">RESUMEN EJECUTIVO</span><h2>Antigüedad por modelo</h2></div><small>{periodLabel(period)} · {branch === 'todas' ? 'Todas las sucursales' : branch}</small></header>
      <div className="inventory-table-wrap"><table><thead><tr><th>Modelo</th><th>Unidades</th><th>Sucursales</th><th>Promedio</th><th>Máximo</th><th>&gt; 60 días</th><th>Estatus</th></tr></thead><tbody>{byModel.length ? byModel.map(item => { const band = ageBand(item.maxDays); return <tr key={textKey(item.model)}><td><strong>{item.model}</strong></td><td>{item.units}</td><td>{item.branchCount}</td><td>{item.average} días</td><td>{item.maxDays} días</td><td>{item.over60}</td><td><span className={`inventory-badge ${band.className}`}>{band.label}</span></td></tr>; }) : <tr><td colSpan="7" className="inventory-empty">No hay inventario registrado para este filtro.</td></tr>}</tbody></table></div>
    </section>

    {canCapture && <section className="inventory-panel inventory-capture">
      <header><div><span className="inventory-eyebrow">CAPTURA OPERATIVA</span><h2>Listado de unidades por modelo</h2><p>Registra una fila por unidad o utiliza cantidad para inventarios homogéneos con la misma antigüedad.</p></div><div className="inventory-actions"><button type="button" className="inventory-secondary" onClick={addRow}><Plus size={15}/> Agregar registro</button><button type="button" className="inventory-primary" disabled={saving} onClick={save}><Save size={15}/> {saving ? 'Guardando…' : 'Guardar inventario'}</button></div></header>
      <datalist id="inventory-model-list">{existingModels.map(model => <option key={model} value={model}/>)}</datalist>
      <div className="inventory-table-wrap"><table className="inventory-entry-table"><thead><tr><th>Sucursal</th><th>Modelo</th><th>Unidad / VIN (opcional)</th><th>Cantidad</th><th>Días en inventario</th><th>Estatus</th><th></th></tr></thead><tbody>{draft.length ? draft.map(row => { const band = ageBand(row.days); return <tr key={row.id}><td><select value={row.branch} onChange={event => updateRow(row.id, 'branch', event.target.value)}><option value={ALL_BRANCHES}>{ALL_BRANCHES}</option>{allowedBranches.map(item => <option key={item.id || item.name} value={item.name}>{item.name}</option>)}</select></td><td><input list="inventory-model-list" value={row.model} onChange={event => updateRow(row.id, 'model', event.target.value)} placeholder="Ej. Aveo"/></td><td><input value={row.unitId || ''} onChange={event => updateRow(row.id, 'unitId', event.target.value)} placeholder="Número económico o VIN"/></td><td><input type="number" min="1" value={row.quantity} onChange={event => updateRow(row.id, 'quantity', event.target.value)}/></td><td><input type="number" min="0" value={row.days} onChange={event => updateRow(row.id, 'days', event.target.value)}/></td><td><span className={`inventory-badge ${band.className}`}>{band.label}</span></td><td><button type="button" className="inventory-delete" onClick={() => deleteRow(row.id)} title="Eliminar registro"><Trash2 size={15}/></button></td></tr>; }) : <tr><td colSpan="7" className="inventory-empty">Agrega el primer registro de {periodLabel(period)}.</td></tr>}</tbody></table></div>
      <footer><CheckCircle2 size={15}/> Al guardar, el periodo seleccionado se sincroniza para todos los usuarios autorizados.</footer>
    </section>}
  </div>;
}

const INVENTORY_CSS = `
.inventory-module{display:grid;gap:16px;color:#0f274d}.inventory-hero{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:25px 28px;border-radius:20px;color:#fff;background:linear-gradient(120deg,#102b57 0%,#19488f 64%,#2868dc 100%);box-shadow:0 18px 38px rgba(16,43,87,.16)}
.inventory-eyebrow{display:flex;align-items:center;gap:7px;color:#86b2ff;font-size:10px;font-weight:900;letter-spacing:.12em}.inventory-hero h1{margin:8px 0 5px;font-size:25px}.inventory-hero p,.inventory-panel header p{margin:0;color:#dbe8ff;font-size:12px}.inventory-hero-actions{display:flex;align-items:flex-end;gap:8px;flex-wrap:wrap}.inventory-period{display:grid;gap:5px;min-width:190px}.inventory-period span,.inventory-filters label>span{font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.inventory-period select,.inventory-filters select,.inventory-filters input,.inventory-entry-table input,.inventory-entry-table select{height:39px;border:1px solid #d6e0ed;border-radius:9px;background:#fff;padding:0 11px;color:#102b57;font-weight:700;outline:none}.inventory-period select{border-color:rgba(255,255,255,.35);background:#fff;color:#102b57}.inventory-hero-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:39px;padding:0 13px;border:1px solid rgba(255,255,255,.28);border-radius:9px;background:#fff;color:#17458c;font-size:11px;font-weight:900;cursor:pointer}.inventory-hero-button.secondary{background:rgba(255,255,255,.12);color:#fff}.inventory-hero-button:disabled{cursor:wait;opacity:.7}
.inventory-filters{display:grid;grid-template-columns:minmax(190px,.8fr) minmax(210px,.9fr) minmax(260px,1.4fr);gap:10px;padding:13px 15px;border:1px solid #d8e2ef;border-radius:14px;background:#fff}.inventory-filters label{display:grid;gap:5px;color:#64748b}.inventory-search div{display:flex;align-items:center;gap:7px;height:39px;padding:0 10px;border:1px solid #d6e0ed;border-radius:9px}.inventory-search input{height:auto!important;width:100%;padding:0!important;border:0!important}
.inventory-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.inventory-kpis article{position:relative;min-height:112px;padding:17px;border:1px solid #dbe4ef;border-top:3px solid #2c67dd;border-radius:14px;background:#fff}.inventory-kpis article>svg{position:absolute;right:15px;top:15px;color:#7ea4e9}.inventory-kpis article>span{display:block;color:#7b8ca5;font-size:9px;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.inventory-kpis article>strong{display:block;margin:9px 0 5px;font-size:24px}.inventory-kpis article>small{color:#7b8ca5;font-size:10px}.inventory-kpis .warning{border-top-color:#f59e0b}.inventory-kpis .critical{border-top-color:#ef4444}
.inventory-panel{overflow:hidden;border:1px solid #d9e3ef;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,39,77,.05)}.inventory-panel>header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;border-bottom:1px solid #dce5f0}.inventory-panel h2{margin:5px 0 0;font-size:17px}.inventory-panel header>small{color:#8998ad}.inventory-panel header p{margin-top:5px;color:#7788a0}.inventory-table-wrap{overflow:auto}.inventory-panel table{width:100%;border-collapse:collapse}.inventory-panel th{padding:11px 14px;background:#f4f7fb;color:#6e7f98;font-size:9px;letter-spacing:.07em;text-align:center;text-transform:uppercase}.inventory-panel th:first-child,.inventory-panel td:first-child{text-align:left}.inventory-panel td{padding:12px 14px;border-top:1px solid #e1e8f1;text-align:center;font-size:12px}.inventory-panel tbody tr:hover{background:#f8fbff}.inventory-empty{padding:34px!important;color:#94a3b8!important;text-align:center!important}
.inventory-badge{display:inline-flex;min-width:76px;justify-content:center;padding:5px 8px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase}.inventory-badge.healthy{color:#087443;background:#d9f8e8}.inventory-badge.watch{color:#966100;background:#fff1c7}.inventory-badge.attention{color:#b45309;background:#ffead2}.inventory-badge.critical{color:#c7202f;background:#fee2e2}.inventory-actions{display:flex;gap:8px}.inventory-primary,.inventory-secondary,.inventory-delete{display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:9px;font-weight:800;cursor:pointer}.inventory-primary{height:39px;padding:0 15px;border:0;background:#2865df;color:#fff}.inventory-secondary{height:39px;padding:0 14px;border:1px solid #cad8e8;background:#fff;color:#244875}.inventory-delete{width:35px;height:35px;border:1px solid #fecaca;background:#fff;color:#ef4444}.inventory-entry-table input,.inventory-entry-table select{width:100%;min-width:110px}.inventory-entry-table td:nth-child(2) input{min-width:170px}.inventory-entry-table td:nth-child(3) input{min-width:190px}.inventory-entry-table td:nth-child(4) input,.inventory-entry-table td:nth-child(5) input{min-width:90px;text-align:center}.inventory-capture footer{display:flex;align-items:center;gap:7px;padding:11px 18px;border-top:1px solid #dce5f0;background:#f7faff;color:#61738d;font-size:10px}
@media(max-width:900px){.inventory-hero{align-items:stretch;flex-direction:column}.inventory-hero-actions{align-items:stretch}.inventory-period{width:100%}.inventory-hero-button{flex:1}.inventory-filters{grid-template-columns:1fr}.inventory-kpis{grid-template-columns:repeat(2,1fr)}.inventory-panel>header{align-items:flex-start;flex-direction:column}.inventory-actions{width:100%;flex-wrap:wrap}}
@media(max-width:520px){.inventory-kpis{grid-template-columns:1fr}.inventory-hero{padding:20px}.inventory-actions button{flex:1}.inventory-module{gap:12px}}
`;
