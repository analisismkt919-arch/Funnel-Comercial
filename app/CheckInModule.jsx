import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardPenLine, History, Save, UserRound, X } from 'lucide-react';
import { CHECKIN_DEFAULT_SOURCE_DETAILS, CHECKIN_DEFAULT_VEHICLES, CHECKIN_SOURCE_OPTIONS, mergeCheckInCatalog } from './checkInCatalog';

const clean = value => String(value ?? '').trim();
const identity = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const dateTime = () => new Date().toISOString();
const displayDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-MX', { dateStyle:'medium', timeStyle:'short' }).format(date);
};

function initialForm(branches) {
  const branch = branches[0]?.name || '';
  const branchBrand = branches.find(item => item.name === branch)?.brand || '';
  return { name:'', phone:'', phoneAlt:'', email:'', colony:'', vehicleIds:[], source:'', sourceDetail:'', sourcePlace:'', brand:branchBrand, branch, advisor:'', notes:'' };
}

export default function CheckInModule({ data = {}, persistData, branchCatalog = [], teams = [], canCapture = false, showToast }) {
  const [section, setSection] = useState('capture');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialForm(branchCatalog));
  const [search, setSearch] = useState('');
  const [recordBranch, setRecordBranch] = useState('ALL');

  const branches = useMemo(() => (branchCatalog || []).filter(item => item?.active !== false && item?.name), [branchCatalog]);
  const vehicles = useMemo(() => mergeCheckInCatalog(CHECKIN_DEFAULT_VEHICLES, data?.vehicles, ['brand','name']).sort((a,b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es')), [data?.vehicles]);
  const activeVehicles = useMemo(() => vehicles.filter(vehicle => vehicle.active !== false), [vehicles]);
  const sourceDetails = useMemo(() => mergeCheckInCatalog(CHECKIN_DEFAULT_SOURCE_DETAILS, data?.sourceDetails, ['source','name']), [data?.sourceDetails]);
  const activeSourceDetails = useMemo(() => sourceDetails.filter(item => item.active !== false && item.source === form.source).sort((a,b) => a.name.localeCompare(b.name, 'es')), [sourceDetails, form.source]);
  const records = useMemo(() => Array.isArray(data?.records) ? data.records : [], [data?.records]);
  const activeAdvisors = useMemo(() => {
    const branchId = identity(form.branch);
    const all = [];
    (teams || []).forEach(team => {
      if (team?.inactiveManager || identity(team?.sucursal) !== branchId) return;
      const inactive = new Set((team?.inactiveVendors || []).map(identity));
      (team?.vendors || []).forEach(vendor => {
        if (clean(vendor) && !inactive.has(identity(vendor))) all.push({ name:clean(vendor), manager:clean(team.manager) });
      });
    });
    return [...new Map(all.map(item => [identity(item.name), item])).values()].sort((a,b) => a.name.localeCompare(b.name, 'es'));
  }, [teams, form.branch]);

  useEffect(() => {
    if (!branches.length || form.branch) return;
    setForm(initialForm(branches));
  }, [branches, form.branch]);
  useEffect(() => {
    const branch = branches.find(item => item.name === form.branch);
    if (!branch) return;
    setForm(current => current.brand === branch.brand ? current : { ...current, brand:branch.brand || current.brand, advisor:'' });
  }, [form.branch, branches]);
  useEffect(() => {
    if (form.advisor && !activeAdvisors.some(item => item.name === form.advisor)) setForm(current => ({ ...current, advisor:'' }));
  }, [activeAdvisors, form.advisor]);

  const update = (key, value) => setForm(current => ({ ...current, [key]:value }));
  const reset = () => setForm(initialForm(branches));
  const notify = (message, type = 'ok') => showToast?.(message, type);

  const saveCheckIn = async event => {
    event?.preventDefault();
    if (!canCapture) return;
    const name = clean(form.name), phone = clean(form.phone), branch = clean(form.branch), advisor = clean(form.advisor);
    if (!name || !phone || !branch || !advisor || !form.source || !form.vehicleIds.length) {
      notify('Completa nombre, teléfono, unidad de interés, medio de contacto, sucursal y APV asignado.', 'error');
      return;
    }
    if (!form.sourceDetail) { notify('Selecciona el detalle del medio de contacto.', 'error'); return; }
    if (form.source === 'Calle' && !clean(form.sourcePlace)) { notify('Indica el nombre de la plaza, evento o punto de origen.', 'error'); return; }
    const vehicleSnapshot = vehicles.filter(vehicle => form.vehicleIds.includes(vehicle.id)).map(vehicle => ({ id:vehicle.id, brand:vehicle.brand, name:vehicle.name }));
    const advisorMeta = activeAdvisors.find(item => item.name === advisor);
    const now = dateTime();
    const record = {
      id:`checkin-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      createdAt:now, updatedAt:now,
      name, phone, phoneAlt:clean(form.phoneAlt), email:clean(form.email), colony:clean(form.colony),
      vehicles:vehicleSnapshot, source:form.source, sourceDetail:clean(form.sourceDetail), sourcePlace:form.source === 'Calle' ? clean(form.sourcePlace) : '',
      brand:clean(form.brand), branch, advisor, manager:advisorMeta?.manager || '', notes:clean(form.notes), status:'Nuevo check in',
    };
    try {
      setSaving(true);
      await persistData({ ...data, records:[record, ...records], vehicles:data?.vehicles || [], sourceDetails:data?.sourceDetails || [] });
      notify(`Check In de ${name} registrado y asignado a ${advisor}.`);
      reset();
    } catch (error) {
      console.error(error);
      notify('No fue posible guardar el Check In. Intenta nuevamente.', 'error');
    } finally { setSaving(false); }
  };


  const visibleRecords = records.filter(record => {
    const matchesBranch = recordBranch === 'ALL' || identity(record.branch) === identity(recordBranch);
    const needle = identity(search);
    return matchesBranch && (!needle || [record.name, record.phone, record.email, record.advisor, record.branch, ...(record.vehicles || []).map(vehicle => vehicle.name)].some(value => identity(value).includes(needle)));
  });
  const today = new Date().toISOString().slice(0,10);
  const todayCount = records.filter(record => String(record.createdAt || '').slice(0,10) === today).length;

  return <div className="checkin-module">
    <style>{CHECKIN_CSS}</style>
    <section className="checkin-hero">
      <div><span className="checkin-eyebrow"><ClipboardPenLine size={14}/> Operación comercial · inicio de prospecto</span><h1>Check In</h1><p>Registra el primer contacto y deja al prospecto listo para su seguimiento comercial.</p></div>
      <div className="checkin-hero-stats"><div><strong>{records.length}</strong><span>registros</span></div><div><strong>{todayCount}</strong><span>hoy</span></div><div><strong>{activeVehicles.length}</strong><span>unidades activas</span></div></div>
    </section>

    <nav className="checkin-tabs" aria-label="Secciones de Check In">
      <button className={section === 'capture' ? 'active' : ''} onClick={() => setSection('capture')}><ClipboardPenLine size={15}/> Nuevo Check In</button>
      <button className={section === 'records' ? 'active' : ''} onClick={() => setSection('records')}><History size={15}/> Registros</button>
    </nav>

    {section === 'capture' && <section className="checkin-flow" aria-label="Flujo de captura y trazabilidad"><header><span>FLUJO DE INFORMACIÓN</span><h2>El Check In inicia el CRM interno</h2><p>La captura conserva el origen para que el recorrido posterior sea identificable en Trazabilidad.</p></header><div className="checkin-flow-steps"><article className="origin"><b>1</b><strong>Check In</strong><small>Contacto, colonia, origen, unidad y APV</small></article><i>→</i><article><b>2</b><strong>Funnel comercial</strong><small>Sucursal + medio homologado</small></article><i>→</i><article><b>3</b><strong>BDC y Citas APV</strong><small>Cita, asistencia y seguimiento</small></article><i>→</i><article><b>4</b><strong>Proceso comercial</strong><small>Demo, solicitud, avalúo, toma y seguro</small></article><i>→</i><article className="closure"><b>5</b><strong>Venta y entrega</strong><small>Conversión y ciclo completo</small></article></div><footer><b>Reglas de cruce:</b> teléfono o correo coincidente enlazan al cliente; el nombre se usa solo como señal de revisión; el VIN enlaza la unidad cuando ya existe.</footer></section>}

    {section === 'capture' && <form className="checkin-card" onSubmit={saveCheckIn}>
      <header className="checkin-card-head"><div><span className="checkin-step">01 · Alta inicial</span><h2>Datos del prospecto y asignación</h2><p>Los campos con <b>*</b> son necesarios para enviar el registro al seguimiento comercial.</p></div><span className="checkin-status"><CheckCircle2 size={15}/> Nuevo registro</span></header>
      {!canCapture && <div className="checkin-readonly">Tu perfil tiene acceso de consulta. Solicita permiso de captura para registrar Check In.</div>}
      <div className="checkin-form-grid">
        <label className="checkin-span-2">Nombre completo <b>*</b><input disabled={!canCapture} value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ej. María Fernanda López" autoComplete="name" /></label>
        <label>Celular / teléfono principal <b>*</b><input disabled={!canCapture} value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="10 dígitos" inputMode="tel" autoComplete="tel" /></label>
        <label>Teléfono alterno<input disabled={!canCapture} value={form.phoneAlt} onChange={event => update('phoneAlt', event.target.value)} placeholder="Opcional" inputMode="tel" /></label>
        <label className="checkin-span-2">Correo electrónico<input disabled={!canCapture} value={form.email} onChange={event => update('email', event.target.value)} placeholder="cliente@correo.com" inputMode="email" autoComplete="email" /></label>
        <label className="checkin-span-2">Colonia<input disabled={!canCapture} value={form.colony} onChange={event => update('colony', event.target.value)} placeholder="Ej. Residencial San Francisco" autoComplete="address-level3" /></label>
      </div>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>02</span><div><h3>Vehículo de interés <b>*</b></h3><p>Selecciona la unidad desde el catálogo activo.</p></div></div><div className="checkin-form-grid"><label className="checkin-span-2">Unidad de interés <b>*</b><select disabled={!canCapture} value={form.vehicleIds?.[0] || ''} onChange={event => update('vehicleIds', event.target.value ? [event.target.value] : [])}><option value="">Selecciona una unidad</option>{[...new Set(activeVehicles.map(vehicle => vehicle.brand))].map(brand => <optgroup key={brand} label={brand}>{activeVehicles.filter(vehicle => vehicle.brand === brand).map(vehicle => <option key={vehicle.id} value={vehicle.id}>{vehicle.name}</option>)}</optgroup>)}</select></label></div>{!activeVehicles.length && <p className="checkin-empty">No hay unidades activas. El administrador puede agregarlas desde Catálogos.</p>}</section>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>03</span><div><h3>Medio de contacto <b>*</b></h3><p>Los detalles se administran desde Catálogos para mantener un origen homologado.</p></div></div><div className="checkin-form-grid checkin-source-grid"><label>Medio de contacto <b>*</b><select disabled={!canCapture} value={form.source} onChange={event => setForm(current => ({ ...current, source:event.target.value, sourceDetail:'', sourcePlace:'' }))}><option value="">Selecciona</option>{CHECKIN_SOURCE_OPTIONS.map(source => <option key={source}>{source}</option>)}</select></label>{form.source && <label>Detalle del medio <b>*</b><select disabled={!canCapture} value={form.sourceDetail} onChange={event => update('sourceDetail', event.target.value)}><option value="">Selecciona</option>{activeSourceDetails.map(detail => <option key={detail.id} value={detail.name}>{detail.name}</option>)}</select></label>}{form.source === 'Calle' && <label className="checkin-span-2">Nombre de plaza, evento o punto de origen <b>*</b><input disabled={!canCapture} value={form.sourcePlace} onChange={event => update('sourcePlace', event.target.value)} placeholder="Ej. Plaza Galerías · Expo Auto · Av. Universidad" /></label>}</div></section>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>04</span><div><h3>Asignación comercial <b>*</b></h3><p>Solo se muestran sucursales y APV activos del catálogo.</p></div></div><div className="checkin-form-grid"><label>Marca <b>*</b><select disabled={!canCapture} value={form.brand} onChange={event => update('brand', event.target.value)}><option value="">Selecciona</option>{[...new Set(branches.map(branch => clean(branch.brand)).filter(Boolean))].sort().map(brand => <option key={brand}>{brand}</option>)}</select></label><label>Sucursal <b>*</b><select disabled={!canCapture} value={form.branch} onChange={event => update('branch', event.target.value)}><option value="">Selecciona</option>{branches.filter(branch => !form.brand || branch.brand === form.brand).map(branch => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></label><label className="checkin-span-2">APV asignado <b>*</b><select disabled={!canCapture} value={form.advisor} onChange={event => update('advisor', event.target.value)}><option value="">Selecciona un APV activo</option>{activeAdvisors.map(advisor => <option key={advisor.name} value={advisor.name}>{advisor.name}{advisor.manager ? ` · ${advisor.manager}` : ''}</option>)}</select></label><label className="checkin-span-2">Notas iniciales<textarea disabled={!canCapture} value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Necesidad, horario de contacto, comentario de piso o información relevante." rows={3} /></label></div></section>
      <footer className="checkin-actions"><button type="button" className="checkin-secondary" disabled={!canCapture} onClick={reset}><X size={15}/> Limpiar</button><button className="checkin-save" disabled={!canCapture || saving} type="submit"><Save size={16}/>{saving ? 'Guardando…' : 'Guardar Check In'}</button></footer>
    </form>}

    {section === 'records' && <section className="checkin-card"><header className="checkin-card-head"><div><span className="checkin-step">Histórico de altas</span><h2>Registros de Check In</h2><p>Consulta quién se registró, su origen, unidad de interés y asignación inicial.</p></div><span className="checkin-status"><UserRound size={15}/>{visibleRecords.length} visibles</span></header><div className="checkin-record-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, teléfono, correo o unidad" /><select value={recordBranch} onChange={event => setRecordBranch(event.target.value)}><option value="ALL">Todas las sucursales</option>{branches.map(branch => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></div><div className="checkin-table-wrap"><table className="checkin-table"><thead><tr><th>Fecha</th><th>Prospecto</th><th>Contacto / colonia</th><th>Interés</th><th>Origen</th><th>Sucursal / APV</th></tr></thead><tbody>{visibleRecords.map(record => <tr key={record.id}><td>{displayDate(record.createdAt)}</td><td><strong>{record.name}</strong>{record.notes && <small>{record.notes}</small>}</td><td><span>{record.phone}</span>{record.phoneAlt && <small>{record.phoneAlt}</small>}{record.email && <small>{record.email}</small>}{record.colony && <small>Col. {record.colony}</small>}</td><td>{(record.vehicles || []).map(vehicle => <span className="checkin-vehicle-tag" key={`${record.id}-${vehicle.id || vehicle.name}`}>{vehicle.brand} · {vehicle.name}</span>)}</td><td><b>{record.source}</b>{record.sourceDetail && <small>{record.sourceDetail}{record.sourcePlace ? ` · ${record.sourcePlace}` : ''}</small>}</td><td><strong>{record.branch}</strong><small>{record.advisor}{record.manager ? ` · ${record.manager}` : ''}</small></td></tr>)}{!visibleRecords.length && <tr><td colSpan={6} className="checkin-empty">No hay Check In que coincidan con los filtros.</td></tr>}</tbody></table></div></section>}

  </div>;
}

const CHECKIN_CSS = `
.checkin-flow{overflow:hidden;margin-bottom:16px;border:1px solid #bed8fb;border-radius:16px;background:linear-gradient(135deg,#eff6ff,#fff)}.checkin-flow header{padding:16px 19px 12px}.checkin-flow header span{color:#2765cc;font-size:9px;font-weight:900;letter-spacing:.11em}.checkin-flow h2{margin:4px 0;color:#143b76;font-size:16px}.checkin-flow p,.checkin-flow footer{margin:0;color:#647995;font-size:10px}.checkin-flow-steps{display:flex;align-items:stretch;gap:7px;padding:0 18px 15px;overflow:auto}.checkin-flow-steps article{display:grid;min-width:145px;gap:4px;padding:11px;border:1px solid #d2e1f3;border-radius:11px;background:#fff}.checkin-flow-steps article.origin{border-color:#77a7f1;background:#eaf3ff}.checkin-flow-steps article.closure{border-color:#8cddb0;background:#effcf4}.checkin-flow-steps b{display:grid;place-items:center;width:22px;height:22px;border-radius:7px;background:#dceaff;color:#1e5fca;font:900 10px var(--font-mono,monospace)}.checkin-flow-steps strong{color:#123565;font-size:11px}.checkin-flow-steps small{color:#6b809d;font-size:9px;line-height:1.35}.checkin-flow-steps>i{align-self:center;color:#4e85d8;font-size:20px;font-style:normal}.checkin-flow footer{padding:10px 18px;border-top:1px solid #dce9f9;background:#f8fbff}.checkin-flow footer b{color:#174a94}
.checkin-module{max-width:1540px;margin:0 auto;color:#102a56}.checkin-module *{box-sizing:border-box}.checkin-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 28px;border-radius:20px;background:linear-gradient(118deg,#102a56 0%,#173b76 52%,#2866df 100%);box-shadow:0 15px 35px rgba(20,54,110,.17);color:#fff}.checkin-eyebrow,.checkin-step{display:flex;align-items:center;gap:7px;text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:850;color:#93b8ff}.checkin-hero h1{margin:7px 0 4px;font-size:30px;letter-spacing:-.04em}.checkin-hero p{margin:0;color:#d9e6ff;font-size:13px}.checkin-hero-stats{display:grid;grid-template-columns:repeat(3,minmax(90px,1fr));gap:8px}.checkin-hero-stats div{padding:11px 13px;border:1px solid rgba(255,255,255,.2);border-radius:13px;background:rgba(255,255,255,.1);text-align:center}.checkin-hero-stats strong{display:block;font-size:21px;font-family:var(--font-mono,monospace)}.checkin-hero-stats span{display:block;margin-top:3px;font-size:9px;text-transform:uppercase;font-weight:800;color:#d4e5ff}.checkin-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:16px 0;padding:7px;border:1px solid #dce6f4;border-radius:14px;background:#edf3fb}.checkin-tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-radius:9px;background:transparent;color:#526b90;font:800 12px inherit;cursor:pointer}.checkin-tabs button.active{background:#fff;color:#1450bd;box-shadow:0 3px 10px rgba(31,68,127,.11)}.checkin-card{overflow:hidden;border:1px solid #dbe6f4;border-radius:18px;background:#fff;box-shadow:0 10px 27px rgba(22,48,89,.055)}.checkin-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:21px 24px;border-bottom:1px solid #e2eaf5;background:linear-gradient(90deg,#fbfdff,#f3f8ff)}.checkin-card-head h2{margin:5px 0 4px;color:#102a56;font-size:19px}.checkin-card-head p{margin:0;color:#607899;font-size:11px}.checkin-card-head p b,.checkin-form-grid b,.checkin-section-title b{color:#d94758}.checkin-status{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 10px;border:1px solid #b9d4ff;border-radius:999px;background:#eaf3ff;color:#1760ca;font-size:10px;font-weight:800}.checkin-readonly{margin:20px 24px 0;padding:10px 12px;border-radius:9px;background:#fff8e7;color:#9a6500;font-size:11px;font-weight:700}.checkin-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:21px 24px}.checkin-form-grid label,.checkin-catalog-form label{display:flex;flex-direction:column;gap:6px;color:#526b90;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.035em}.checkin-form-grid input,.checkin-form-grid select,.checkin-form-grid textarea,.checkin-record-filters input,.checkin-record-filters select,.checkin-catalog-form input{width:100%;min-height:40px;border:1px solid #cad9ec;border-radius:9px;padding:9px 10px;background:#fff;color:#112f5d;font:650 12px inherit;outline:none;text-transform:none;letter-spacing:normal}.checkin-form-grid textarea{resize:vertical;min-height:78px}.checkin-form-grid input:focus,.checkin-form-grid select:focus,.checkin-form-grid textarea:focus,.checkin-record-filters input:focus,.checkin-record-filters select:focus,.checkin-catalog-form input:focus{border-color:#3174e4;box-shadow:0 0 0 3px rgba(49,116,228,.12)}.checkin-form-grid input:disabled,.checkin-form-grid select:disabled,.checkin-form-grid textarea:disabled{background:#f4f7fb;color:#8192aa}.checkin-span-2{grid-column:span 2}.checkin-subsection{border-top:1px solid #e0e9f4;background:#fcfdff}.checkin-section-title{display:flex;align-items:flex-start;gap:10px;padding:18px 24px 0}.checkin-section-title>span{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border-radius:8px;background:#dbeaff;color:#1458bf;font:850 11px var(--font-mono,monospace)}.checkin-section-title h3{margin:1px 0 3px;font-size:14px}.checkin-section-title p{margin:0;color:#7084a2;font-size:10px}.vehicle-picker{display:flex;flex-wrap:wrap;gap:8px;padding:16px 24px 23px}.vehicle-option{display:flex;align-items:center;gap:7px;min-width:175px;padding:9px 11px;border:1px solid #d6e2f2;border-radius:10px;background:#fff;color:#577092;cursor:pointer;transition:.15s}.vehicle-option:hover{border-color:#82aceb}.vehicle-option.selected{border-color:#2d73dd;background:#edf5ff;box-shadow:inset 0 0 0 1px #2d73dd}.vehicle-option input{width:14px;height:14px;accent-color:#2369d7}.vehicle-option span{font-size:8px;font-weight:850;letter-spacing:.05em}.vehicle-option strong{color:#153665;font-size:11px}.checkin-source-grid{padding-bottom:20px}.checkin-actions{display:flex;justify-content:flex-end;gap:9px;padding:16px 24px;border-top:1px solid #dfe8f4;background:#f8fbff}.checkin-save,.checkin-secondary,.checkin-deactivate,.checkin-activate{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;border-radius:9px;padding:0 13px;font:800 11px inherit;cursor:pointer}.checkin-save{border:1px solid #1f63d0;background:#2868d9;color:#fff;box-shadow:0 5px 10px rgba(28,91,204,.18)}.checkin-save:disabled,.checkin-secondary:disabled{opacity:.55;cursor:not-allowed}.checkin-secondary{border:1px solid #cbd9eb;background:#fff;color:#3f5f87}.checkin-record-filters{display:grid;grid-template-columns:minmax(260px,1fr) 230px;gap:10px;padding:16px 24px;border-bottom:1px solid #e1e9f4}.checkin-table-wrap{overflow:auto}.checkin-table{width:100%;min-width:890px;border-collapse:collapse}.checkin-table th{padding:10px 14px;border-bottom:1px solid #d9e4f2;background:#f4f8fd;color:#627996;font-size:9px;text-transform:uppercase;letter-spacing:.05em;text-align:left}.checkin-table td{padding:12px 14px;border-bottom:1px solid #e6edf7;color:#314e77;font-size:11px;vertical-align:top}.checkin-table td strong{display:block;color:#123566;font-size:11px}.checkin-table td b{color:#1c4d9d;font-size:10px}.checkin-table td small{display:block;margin-top:3px;color:#7387a3;font-size:9px;line-height:1.35}.checkin-vehicle-tag{display:block;width:max-content;max-width:220px;margin-bottom:4px;padding:4px 6px;border-radius:6px;background:#ebf3ff;color:#205bb6;font-size:9px;font-weight:750}.checkin-empty{padding:20px 24px;color:#7387a3;font-size:11px;text-align:center}.checkin-catalog-form{display:grid;grid-template-columns:220px minmax(250px,1fr) auto;align-items:end;gap:11px;padding:18px 24px;border-bottom:1px solid #e1eaf5;background:#f8fbff}.checkin-state{display:inline-block;padding:4px 7px;border-radius:999px;background:#e5f8ec;color:#168047;font-size:9px;font-weight:850}.checkin-state.inactive{background:#f1f4f8;color:#718096}.checkin-deactivate{border:1px solid #fed3d8;background:#fff5f5;color:#c22f42}.checkin-activate{border:1px solid #bde8cc;background:#f0fff5;color:#168047}@media(max-width:900px){.checkin-hero{align-items:flex-start;flex-direction:column}.checkin-hero-stats{width:100%}.checkin-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.checkin-catalog-form{grid-template-columns:1fr}.checkin-record-filters{grid-template-columns:1fr}.checkin-card-head{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.checkin-hero{padding:20px}.checkin-hero-stats{grid-template-columns:repeat(3,1fr)}.checkin-form-grid{grid-template-columns:1fr;padding:18px}.checkin-span-2{grid-column:auto}.checkin-section-title,.vehicle-picker,.checkin-actions,.checkin-record-filters,.checkin-catalog-form{padding-left:18px;padding-right:18px}.vehicle-option{min-width:100%}}
`;
