import React, { useEffect, useMemo, useState } from 'react';
import { Car, CheckCircle2, ClipboardPenLine, History, Plus, Save, Trash2, UserRound, X } from 'lucide-react';

const DEFAULT_VEHICLES = [
  ['CHEVROLET','Aveo'], ['CHEVROLET','Onix'], ['CHEVROLET','Tracker'], ['CHEVROLET','Captiva'], ['CHEVROLET','Groove'],
  ['CHEVROLET','S10 Max'], ['CHEVROLET','Colorado'], ['CHEVROLET','Silverado'], ['CHEVROLET','Tahoe'], ['CHEVROLET','Suburban'],
  ['GMC','Terrain'], ['GMC','Acadia'], ['GMC','Sierra'], ['GMC','Yukon'],
  ['BUICK','Envista'], ['BUICK','Encore GX'], ['BUICK','Envision'],
  ['CADILLAC','XT4'], ['CADILLAC','XT5'], ['CADILLAC','Escalade'],
].map(([brand, name], index) => ({ id:`base-${index + 1}`, brand, name, active:true, system:true }));

const SOURCE_OPTIONS = ['Piso', 'Fan Page', 'Digital', 'Llamada', 'Referido', 'Evento', 'Base de datos', 'Otro'];
const FLOOR_OPTIONS = ['Fresh Up', 'Cita', 'Be-back', 'Calle'];
const DIGITAL_OPTIONS = ['Facebook', 'Instagram', 'Google', 'Landing page', 'WhatsApp', 'Otro'];
const STREET_ORIGIN_OPTIONS = ['Plaza comercial', 'Evento', 'Cruce / calle', 'Otro'];

const clean = value => String(value ?? '').trim();
const identity = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const nameKey = value => identity(value).replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
const dateTime = () => new Date().toISOString();
const displayDate = value => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat('es-MX', { dateStyle:'medium', timeStyle:'short' }).format(date);
};

function initialForm(branches) {
  const branch = branches[0]?.name || '';
  const branchBrand = branches.find(item => item.name === branch)?.brand || '';
  return { name:'', phone:'', phoneAlt:'', email:'', vehicleIds:[], source:'', floorType:'', sourceDetail:'', streetOrigin:'', streetPlace:'', brand:branchBrand, branch, advisor:'', notes:'' };
}

export default function CheckInModule({ data = {}, persistData, branchCatalog = [], teams = [], inventoryData = {}, canCapture = false, isAdmin = false, showToast }) {
  const [section, setSection] = useState('capture');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialForm(branchCatalog));
  const [search, setSearch] = useState('');
  const [recordBranch, setRecordBranch] = useState('ALL');
  const [vehicleDraft, setVehicleDraft] = useState({ brand:'CHEVROLET', name:'' });

  const branches = useMemo(() => (branchCatalog || []).filter(item => item?.active !== false && item?.name), [branchCatalog]);
  const inventoryVehicles = useMemo(() => {
    const found = new Map();
    (inventoryData?.records || []).forEach(row => {
      const name = clean(row.model || row.modelo || row.unit || row.unidad);
      if (!name) return;
      const brand = clean(row.brand || row.marca || 'OTRA').toUpperCase();
      const key = `${identity(brand)}|${identity(name)}`;
      if (!found.has(key)) found.set(key, { id:`inventory-${nameKey(key)}`, brand, name, active:true, imported:true });
    });
    return [...found.values()];
  }, [inventoryData]);
  const vehicles = useMemo(() => {
    const saved = Array.isArray(data?.vehicles) ? data.vehicles : [];
    const map = new Map();
    [...DEFAULT_VEHICLES, ...inventoryVehicles, ...saved].forEach(vehicle => {
      const name = clean(vehicle?.name);
      if (!name) return;
      const brand = clean(vehicle?.brand || 'OTRA').toUpperCase();
      const key = `${identity(brand)}|${identity(name)}`;
      const previous = map.get(key);
      map.set(key, { ...previous, ...vehicle, id:vehicle?.id || previous?.id || `vehicle-${nameKey(key)}`, brand, name, active:vehicle?.active !== false });
    });
    return [...map.values()].sort((a,b) => a.brand.localeCompare(b.brand, 'es') || a.name.localeCompare(b.name, 'es'));
  }, [data?.vehicles, inventoryVehicles]);
  const activeVehicles = useMemo(() => vehicles.filter(vehicle => vehicle.active !== false), [vehicles]);
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
  const selectedVehicles = useMemo(() => new Set(form.vehicleIds || []), [form.vehicleIds]);
  const sourceNeedsFloor = form.source === 'Piso';
  const sourceNeedsDigital = form.source === 'Digital';
  const isStreet = form.floorType === 'Calle';

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
  const toggleVehicle = id => setForm(current => ({ ...current, vehicleIds:current.vehicleIds.includes(id) ? current.vehicleIds.filter(value => value !== id) : [...current.vehicleIds, id] }));
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
    if (sourceNeedsFloor && !form.floorType) { notify('Selecciona el tipo de registro de piso.', 'error'); return; }
    if (isStreet && !form.streetOrigin) { notify('Indica si el registro de calle proviene de plaza, evento u otro origen.', 'error'); return; }
    const vehicleSnapshot = vehicles.filter(vehicle => form.vehicleIds.includes(vehicle.id)).map(vehicle => ({ id:vehicle.id, brand:vehicle.brand, name:vehicle.name }));
    const advisorMeta = activeAdvisors.find(item => item.name === advisor);
    const now = dateTime();
    const record = {
      id:`checkin-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      createdAt:now, updatedAt:now,
      name, phone, phoneAlt:clean(form.phoneAlt), email:clean(form.email),
      vehicles:vehicleSnapshot, source:form.source, floorType:sourceNeedsFloor ? form.floorType : '',
      sourceDetail:clean(form.sourceDetail), streetOrigin:isStreet ? form.streetOrigin : '', streetPlace:isStreet ? clean(form.streetPlace) : '',
      brand:clean(form.brand), branch, advisor, manager:advisorMeta?.manager || '', notes:clean(form.notes), status:'Nuevo check in',
    };
    try {
      setSaving(true);
      await persistData({ ...data, records:[record, ...records], vehicles:data?.vehicles || [] });
      notify(`Check In de ${name} registrado y asignado a ${advisor}.`);
      reset();
    } catch (error) {
      console.error(error);
      notify('No fue posible guardar el Check In. Intenta nuevamente.', 'error');
    } finally { setSaving(false); }
  };

  const saveVehicle = async event => {
    event.preventDefault();
    const name = clean(vehicleDraft.name), brand = clean(vehicleDraft.brand).toUpperCase();
    if (!name || !brand) { notify('Escribe la marca y el nombre de la unidad.', 'error'); return; }
    const exists = vehicles.some(vehicle => identity(vehicle.brand) === identity(brand) && identity(vehicle.name) === identity(name));
    if (exists) { notify('Esta unidad ya existe en el catálogo.', 'error'); return; }
    const next = [...(Array.isArray(data?.vehicles) ? data.vehicles : []), { id:`vehicle-${Date.now()}`, brand, name, active:true, createdAt:dateTime() }];
    try { await persistData({ ...data, records, vehicles:next }); setVehicleDraft({ brand, name:'' }); notify(`${name} se agregó al catálogo de unidades.`); }
    catch (error) { console.error(error); notify('No fue posible guardar la unidad.', 'error'); }
  };
  const setVehicleActive = async (vehicle, active) => {
    const saved = Array.isArray(data?.vehicles) ? data.vehicles : [];
    const existing = saved.find(item => identity(item.brand) === identity(vehicle.brand) && identity(item.name) === identity(vehicle.name));
    const next = existing
      ? saved.map(item => item.id === existing.id ? { ...item, active, updatedAt:dateTime() } : item)
      : [...saved, { ...vehicle, id:vehicle.id || `vehicle-${Date.now()}`, active, updatedAt:dateTime() }];
    try { await persistData({ ...data, records, vehicles:next }); notify(active ? `${vehicle.name} se reactivó.` : `${vehicle.name} ya no aparecerá en nuevas capturas.`); }
    catch (error) { console.error(error); notify('No fue posible actualizar la unidad.', 'error'); }
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
      {isAdmin && <button className={section === 'vehicles' ? 'active' : ''} onClick={() => setSection('vehicles')}><Car size={15}/> Catálogo de unidades</button>}
    </nav>

    {section === 'capture' && <form className="checkin-card" onSubmit={saveCheckIn}>
      <header className="checkin-card-head"><div><span className="checkin-step">01 · Alta inicial</span><h2>Datos del prospecto y asignación</h2><p>Los campos con <b>*</b> son necesarios para enviar el registro al seguimiento comercial.</p></div><span className="checkin-status"><CheckCircle2 size={15}/> Nuevo registro</span></header>
      {!canCapture && <div className="checkin-readonly">Tu perfil tiene acceso de consulta. Solicita permiso de captura para registrar Check In.</div>}
      <div className="checkin-form-grid">
        <label className="checkin-span-2">Nombre completo <b>*</b><input disabled={!canCapture} value={form.name} onChange={event => update('name', event.target.value)} placeholder="Ej. María Fernanda López" autoComplete="name" /></label>
        <label>Celular / teléfono principal <b>*</b><input disabled={!canCapture} value={form.phone} onChange={event => update('phone', event.target.value)} placeholder="10 dígitos" inputMode="tel" autoComplete="tel" /></label>
        <label>Teléfono alterno<input disabled={!canCapture} value={form.phoneAlt} onChange={event => update('phoneAlt', event.target.value)} placeholder="Opcional" inputMode="tel" /></label>
        <label className="checkin-span-2">Correo electrónico<input disabled={!canCapture} value={form.email} onChange={event => update('email', event.target.value)} placeholder="cliente@correo.com" inputMode="email" autoComplete="email" /></label>
      </div>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>02</span><div><h3>Vehículo de interés <b>*</b></h3><p>Puedes seleccionar una o más unidades.</p></div></div><div className="vehicle-picker">{activeVehicles.map(vehicle => <label key={vehicle.id} className={`vehicle-option ${selectedVehicles.has(vehicle.id) ? 'selected' : ''}`}><input type="checkbox" disabled={!canCapture} checked={selectedVehicles.has(vehicle.id)} onChange={() => toggleVehicle(vehicle.id)} /><span>{vehicle.brand}</span><strong>{vehicle.name}</strong></label>)}</div>{!activeVehicles.length && <p className="checkin-empty">No hay unidades activas. Un administrador puede agregarlas desde el catálogo de este módulo.</p>}</section>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>03</span><div><h3>Medio de contacto <b>*</b></h3><p>El detalle cambia según el origen para conservar la trazabilidad.</p></div></div><div className="checkin-form-grid checkin-source-grid"><label>Medio de contacto <b>*</b><select disabled={!canCapture} value={form.source} onChange={event => setForm(current => ({ ...current, source:event.target.value, floorType:'', sourceDetail:'', streetOrigin:'', streetPlace:'' }))}><option value="">Selecciona</option>{SOURCE_OPTIONS.map(source => <option key={source}>{source}</option>)}</select></label>{sourceNeedsFloor && <label>Registro de piso <b>*</b><select disabled={!canCapture} value={form.floorType} onChange={event => setForm(current => ({ ...current, floorType:event.target.value, streetOrigin:'', streetPlace:'' }))}><option value="">Selecciona</option>{FLOOR_OPTIONS.map(source => <option key={source}>{source}</option>)}</select></label>}{sourceNeedsDigital && <label>Canal digital<select disabled={!canCapture} value={form.sourceDetail} onChange={event => update('sourceDetail', event.target.value)}><option value="">Selecciona</option>{DIGITAL_OPTIONS.map(source => <option key={source}>{source}</option>)}</select></label>}{isStreet && <label>Origen de calle <b>*</b><select disabled={!canCapture} value={form.streetOrigin} onChange={event => update('streetOrigin', event.target.value)}><option value="">Selecciona</option>{STREET_ORIGIN_OPTIONS.map(source => <option key={source}>{source}</option>)}</select></label>}{isStreet && <label>¿De dónde? <b>*</b><input disabled={!canCapture} value={form.streetPlace} onChange={event => update('streetPlace', event.target.value)} placeholder={form.streetOrigin === 'Plaza comercial' ? 'Nombre de la plaza' : form.streetOrigin === 'Evento' ? 'Nombre del evento' : 'Describe el punto de origen'} /></label>}{!sourceNeedsDigital && !isStreet && form.source && <label className="checkin-span-2">Detalle del medio<input disabled={!canCapture} value={form.sourceDetail} onChange={event => update('sourceDetail', event.target.value)} placeholder="Ej. nombre de evento, campaña, referido o detalle útil" /></label>}</div></section>
      <section className="checkin-subsection"><div className="checkin-section-title"><span>04</span><div><h3>Asignación comercial <b>*</b></h3><p>Solo se muestran sucursales y APV activos del catálogo.</p></div></div><div className="checkin-form-grid"><label>Marca <b>*</b><select disabled={!canCapture} value={form.brand} onChange={event => update('brand', event.target.value)}><option value="">Selecciona</option>{[...new Set(branches.map(branch => clean(branch.brand)).filter(Boolean))].sort().map(brand => <option key={brand}>{brand}</option>)}</select></label><label>Sucursal <b>*</b><select disabled={!canCapture} value={form.branch} onChange={event => update('branch', event.target.value)}><option value="">Selecciona</option>{branches.filter(branch => !form.brand || branch.brand === form.brand).map(branch => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></label><label className="checkin-span-2">APV asignado <b>*</b><select disabled={!canCapture} value={form.advisor} onChange={event => update('advisor', event.target.value)}><option value="">Selecciona un APV activo</option>{activeAdvisors.map(advisor => <option key={advisor.name} value={advisor.name}>{advisor.name}{advisor.manager ? ` · ${advisor.manager}` : ''}</option>)}</select></label><label className="checkin-span-2">Notas iniciales<textarea disabled={!canCapture} value={form.notes} onChange={event => update('notes', event.target.value)} placeholder="Necesidad, horario de contacto, comentario de piso o información relevante." rows={3} /></label></div></section>
      <footer className="checkin-actions"><button type="button" className="checkin-secondary" disabled={!canCapture} onClick={reset}><X size={15}/> Limpiar</button><button className="checkin-save" disabled={!canCapture || saving} type="submit"><Save size={16}/>{saving ? 'Guardando…' : 'Guardar Check In'}</button></footer>
    </form>}

    {section === 'records' && <section className="checkin-card"><header className="checkin-card-head"><div><span className="checkin-step">Histórico de altas</span><h2>Registros de Check In</h2><p>Consulta quién se registró, su origen, unidad de interés y asignación inicial.</p></div><span className="checkin-status"><UserRound size={15}/>{visibleRecords.length} visibles</span></header><div className="checkin-record-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, teléfono, correo o unidad" /><select value={recordBranch} onChange={event => setRecordBranch(event.target.value)}><option value="ALL">Todas las sucursales</option>{branches.map(branch => <option key={branch.id || branch.name} value={branch.name}>{branch.name}</option>)}</select></div><div className="checkin-table-wrap"><table className="checkin-table"><thead><tr><th>Fecha</th><th>Prospecto</th><th>Contacto</th><th>Interés</th><th>Origen</th><th>Sucursal / APV</th></tr></thead><tbody>{visibleRecords.map(record => <tr key={record.id}><td>{displayDate(record.createdAt)}</td><td><strong>{record.name}</strong>{record.notes && <small>{record.notes}</small>}</td><td><span>{record.phone}</span>{record.phoneAlt && <small>{record.phoneAlt}</small>}{record.email && <small>{record.email}</small>}</td><td>{(record.vehicles || []).map(vehicle => <span className="checkin-vehicle-tag" key={`${record.id}-${vehicle.id || vehicle.name}`}>{vehicle.brand} · {vehicle.name}</span>)}</td><td><b>{record.source}</b>{record.floorType && <small>{record.floorType}{record.streetOrigin ? ` · ${record.streetOrigin}` : ''}{record.streetPlace ? `: ${record.streetPlace}` : ''}</small>}{!record.floorType && record.sourceDetail && <small>{record.sourceDetail}</small>}</td><td><strong>{record.branch}</strong><small>{record.advisor}{record.manager ? ` · ${record.manager}` : ''}</small></td></tr>)}{!visibleRecords.length && <tr><td colSpan={6} className="checkin-empty">No hay Check In que coincidan con los filtros.</td></tr>}</tbody></table></div></section>}

    {section === 'vehicles' && isAdmin && <section className="checkin-card"><header className="checkin-card-head"><div><span className="checkin-step">Administración</span><h2>Catálogo de unidades</h2><p>Las bajas solo ocultan una unidad de capturas nuevas; los registros anteriores permanecen intactos.</p></div><span className="checkin-status"><Car size={15}/>{activeVehicles.length} activas</span></header><form className="checkin-catalog-form" onSubmit={saveVehicle}><label>Marca<input value={vehicleDraft.brand} onChange={event => setVehicleDraft(current => ({ ...current, brand:event.target.value.toUpperCase() }))} placeholder="CHEVROLET" /></label><label>Unidad / modelo<input value={vehicleDraft.name} onChange={event => setVehicleDraft(current => ({ ...current, name:event.target.value }))} placeholder="Ej. Equinox EV" /></label><button className="checkin-save" type="submit"><Plus size={16}/> Agregar unidad</button></form><div className="checkin-table-wrap"><table className="checkin-table"><thead><tr><th>Marca</th><th>Unidad</th><th>Origen</th><th>Estado</th><th></th></tr></thead><tbody>{vehicles.map(vehicle => <tr key={vehicle.id}><td><strong>{vehicle.brand}</strong></td><td>{vehicle.name}</td><td>{vehicle.imported ? 'Inventario' : vehicle.system ? 'Base inicial' : 'Catálogo administrador'}</td><td><span className={`checkin-state ${vehicle.active === false ? 'inactive' : ''}`}>{vehicle.active === false ? 'Inactiva' : 'Activa'}</span></td><td><button type="button" className={vehicle.active === false ? 'checkin-activate' : 'checkin-deactivate'} onClick={() => setVehicleActive(vehicle, vehicle.active === false)}>{vehicle.active === false ? <><CheckCircle2 size={14}/> Reactivar</> : <><Trash2 size={14}/> Quitar de captura</>}</button></td></tr>)}</tbody></table></div></section>}
  </div>;
}

const CHECKIN_CSS = `
.checkin-module{max-width:1540px;margin:0 auto;color:#102a56}.checkin-module *{box-sizing:border-box}.checkin-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:26px 28px;border-radius:20px;background:linear-gradient(118deg,#102a56 0%,#173b76 52%,#2866df 100%);box-shadow:0 15px 35px rgba(20,54,110,.17);color:#fff}.checkin-eyebrow,.checkin-step{display:flex;align-items:center;gap:7px;text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:850;color:#93b8ff}.checkin-hero h1{margin:7px 0 4px;font-size:30px;letter-spacing:-.04em}.checkin-hero p{margin:0;color:#d9e6ff;font-size:13px}.checkin-hero-stats{display:grid;grid-template-columns:repeat(3,minmax(90px,1fr));gap:8px}.checkin-hero-stats div{padding:11px 13px;border:1px solid rgba(255,255,255,.2);border-radius:13px;background:rgba(255,255,255,.1);text-align:center}.checkin-hero-stats strong{display:block;font-size:21px;font-family:var(--font-mono,monospace)}.checkin-hero-stats span{display:block;margin-top:3px;font-size:9px;text-transform:uppercase;font-weight:800;color:#d4e5ff}.checkin-tabs{display:flex;gap:5px;flex-wrap:wrap;margin:16px 0;padding:7px;border:1px solid #dce6f4;border-radius:14px;background:#edf3fb}.checkin-tabs button{display:inline-flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-radius:9px;background:transparent;color:#526b90;font:800 12px inherit;cursor:pointer}.checkin-tabs button.active{background:#fff;color:#1450bd;box-shadow:0 3px 10px rgba(31,68,127,.11)}.checkin-card{overflow:hidden;border:1px solid #dbe6f4;border-radius:18px;background:#fff;box-shadow:0 10px 27px rgba(22,48,89,.055)}.checkin-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:21px 24px;border-bottom:1px solid #e2eaf5;background:linear-gradient(90deg,#fbfdff,#f3f8ff)}.checkin-card-head h2{margin:5px 0 4px;color:#102a56;font-size:19px}.checkin-card-head p{margin:0;color:#607899;font-size:11px}.checkin-card-head p b,.checkin-form-grid b,.checkin-section-title b{color:#d94758}.checkin-status{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;padding:7px 10px;border:1px solid #b9d4ff;border-radius:999px;background:#eaf3ff;color:#1760ca;font-size:10px;font-weight:800}.checkin-readonly{margin:20px 24px 0;padding:10px 12px;border-radius:9px;background:#fff8e7;color:#9a6500;font-size:11px;font-weight:700}.checkin-form-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;padding:21px 24px}.checkin-form-grid label,.checkin-catalog-form label{display:flex;flex-direction:column;gap:6px;color:#526b90;font-size:10px;font-weight:850;text-transform:uppercase;letter-spacing:.035em}.checkin-form-grid input,.checkin-form-grid select,.checkin-form-grid textarea,.checkin-record-filters input,.checkin-record-filters select,.checkin-catalog-form input{width:100%;min-height:40px;border:1px solid #cad9ec;border-radius:9px;padding:9px 10px;background:#fff;color:#112f5d;font:650 12px inherit;outline:none;text-transform:none;letter-spacing:normal}.checkin-form-grid textarea{resize:vertical;min-height:78px}.checkin-form-grid input:focus,.checkin-form-grid select:focus,.checkin-form-grid textarea:focus,.checkin-record-filters input:focus,.checkin-record-filters select:focus,.checkin-catalog-form input:focus{border-color:#3174e4;box-shadow:0 0 0 3px rgba(49,116,228,.12)}.checkin-form-grid input:disabled,.checkin-form-grid select:disabled,.checkin-form-grid textarea:disabled{background:#f4f7fb;color:#8192aa}.checkin-span-2{grid-column:span 2}.checkin-subsection{border-top:1px solid #e0e9f4;background:#fcfdff}.checkin-section-title{display:flex;align-items:flex-start;gap:10px;padding:18px 24px 0}.checkin-section-title>span{display:grid;place-items:center;flex:0 0 27px;width:27px;height:27px;border-radius:8px;background:#dbeaff;color:#1458bf;font:850 11px var(--font-mono,monospace)}.checkin-section-title h3{margin:1px 0 3px;font-size:14px}.checkin-section-title p{margin:0;color:#7084a2;font-size:10px}.vehicle-picker{display:flex;flex-wrap:wrap;gap:8px;padding:16px 24px 23px}.vehicle-option{display:flex;align-items:center;gap:7px;min-width:175px;padding:9px 11px;border:1px solid #d6e2f2;border-radius:10px;background:#fff;color:#577092;cursor:pointer;transition:.15s}.vehicle-option:hover{border-color:#82aceb}.vehicle-option.selected{border-color:#2d73dd;background:#edf5ff;box-shadow:inset 0 0 0 1px #2d73dd}.vehicle-option input{width:14px;height:14px;accent-color:#2369d7}.vehicle-option span{font-size:8px;font-weight:850;letter-spacing:.05em}.vehicle-option strong{color:#153665;font-size:11px}.checkin-source-grid{padding-bottom:20px}.checkin-actions{display:flex;justify-content:flex-end;gap:9px;padding:16px 24px;border-top:1px solid #dfe8f4;background:#f8fbff}.checkin-save,.checkin-secondary,.checkin-deactivate,.checkin-activate{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;border-radius:9px;padding:0 13px;font:800 11px inherit;cursor:pointer}.checkin-save{border:1px solid #1f63d0;background:#2868d9;color:#fff;box-shadow:0 5px 10px rgba(28,91,204,.18)}.checkin-save:disabled,.checkin-secondary:disabled{opacity:.55;cursor:not-allowed}.checkin-secondary{border:1px solid #cbd9eb;background:#fff;color:#3f5f87}.checkin-record-filters{display:grid;grid-template-columns:minmax(260px,1fr) 230px;gap:10px;padding:16px 24px;border-bottom:1px solid #e1e9f4}.checkin-table-wrap{overflow:auto}.checkin-table{width:100%;min-width:890px;border-collapse:collapse}.checkin-table th{padding:10px 14px;border-bottom:1px solid #d9e4f2;background:#f4f8fd;color:#627996;font-size:9px;text-transform:uppercase;letter-spacing:.05em;text-align:left}.checkin-table td{padding:12px 14px;border-bottom:1px solid #e6edf7;color:#314e77;font-size:11px;vertical-align:top}.checkin-table td strong{display:block;color:#123566;font-size:11px}.checkin-table td b{color:#1c4d9d;font-size:10px}.checkin-table td small{display:block;margin-top:3px;color:#7387a3;font-size:9px;line-height:1.35}.checkin-vehicle-tag{display:block;width:max-content;max-width:220px;margin-bottom:4px;padding:4px 6px;border-radius:6px;background:#ebf3ff;color:#205bb6;font-size:9px;font-weight:750}.checkin-empty{padding:20px 24px;color:#7387a3;font-size:11px;text-align:center}.checkin-catalog-form{display:grid;grid-template-columns:220px minmax(250px,1fr) auto;align-items:end;gap:11px;padding:18px 24px;border-bottom:1px solid #e1eaf5;background:#f8fbff}.checkin-state{display:inline-block;padding:4px 7px;border-radius:999px;background:#e5f8ec;color:#168047;font-size:9px;font-weight:850}.checkin-state.inactive{background:#f1f4f8;color:#718096}.checkin-deactivate{border:1px solid #fed3d8;background:#fff5f5;color:#c22f42}.checkin-activate{border:1px solid #bde8cc;background:#f0fff5;color:#168047}@media(max-width:900px){.checkin-hero{align-items:flex-start;flex-direction:column}.checkin-hero-stats{width:100%}.checkin-form-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.checkin-catalog-form{grid-template-columns:1fr}.checkin-record-filters{grid-template-columns:1fr}.checkin-card-head{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.checkin-hero{padding:20px}.checkin-hero-stats{grid-template-columns:repeat(3,1fr)}.checkin-form-grid{grid-template-columns:1fr;padding:18px}.checkin-span-2{grid-column:auto}.checkin-section-title,.vehicle-picker,.checkin-actions,.checkin-record-filters,.checkin-catalog-form{padding-left:18px;padding-right:18px}.vehicle-option{min-width:100%}}
`;
