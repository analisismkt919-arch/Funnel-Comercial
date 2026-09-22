'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Clock3, FileText, RotateCcw, Save, Search, UserCheck } from 'lucide-react';

const MONTHS=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const YES_NO_PENDING=['PENDIENTE','SI','NO'];
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const clean=value=>String(value??'').trim();
const monthFromDate=value=>{const month=Number(String(value||'').slice(5,7));return month>=1&&month<=12?MONTHS[month-1]:'';};
const formatDate=value=>{if(!value)return 'Sin fecha';const [year,month,day]=String(value).split('-');return day&&month&&year?`${day}/${month}/${year}`:value;};
const appointmentStatus=row=>{
  if(clean(row.factura)||clean(row.vehiculoCompro))return {key:'compro',label:'Compró'};
  if(normalize(row.solicitud)==='SI')return {key:'solicitud',label:'Con solicitud'};
  if(normalize(row.asistio)==='SI')return {key:'asistio',label:'Asistió'};
  if(normalize(row.confirmacion)==='SI'||normalize(row.confirmacion)==='CONFIRMADA')return {key:'confirmada',label:'Confirmada'};
  if(['NO','NO CONFIRMADA'].includes(normalize(row.confirmacion)))return {key:'no-confirmada',label:'No confirmó'};
  return {key:'pendiente',label:'Pendiente'};
};

const emptyAppointment=()=>({
  id:'',mesLead:'',fechaLead:'',reagendado:'',numeroLead:'',campanaOrigen:'',cliente:'',bdc:'',apv:'',gerente:'',autoInteres:'',
  mesCita:'',fechaCita:'',hora:'',telefono:'',fuente:'',citaPorApv:'PENDIENTE',confirmacion:'PENDIENTE',sucursal:'',
  asistio:'PENDIENTE',visitaDomicilio:'PENDIENTE',citaVirtual:'PENDIENTE',solicitud:'PENDIENTE',factura:'',vehiculoCompro:'',
  comentario:'',comentarioApv:'',llamadaSeguimiento:'',createdAt:'',updatedAt:''
});

function Field({label,required=false,help,wide=false,children}){
  return <label className={`bdc-appointment-field ${wide?'wide':''}`}><span>{label}{required&&<b>*</b>}</span>{children}{help&&<small>{help}</small>}</label>;
}

function YesNoSelect({value,onChange,label}){
  return <select aria-label={label} value={value||'PENDIENTE'} onChange={event=>onChange(event.target.value)}>{YES_NO_PENDING.map(option=><option key={option} value={option}>{option==='PENDIENTE'?'Pendiente':option==='SI'?'Sí':'No'}</option>)}</select>;
}

function AppointmentForm({value,onChange,onSave,onReset,branches,managers,apvs,vehicles,campaigns,bdcNames,mode='create'}){
  const set=(key,next)=>onChange(current=>({...current,[key]:next}));
  const selectBranch=branch=>{
    const availableManagers=[...new Set(apvs.filter(row=>normalize(row.branch)===normalize(branch)).map(row=>row.manager).filter(Boolean))];
    onChange(current=>({...current,sucursal:branch,gerente:availableManagers.includes(current.gerente)?current.gerente:'',apv:''}));
  };
  const selectManager=manager=>onChange(current=>({...current,gerente:manager,apv:apvs.some(row=>normalize(row.branch)===normalize(current.sucursal)&&normalize(row.manager)===normalize(manager)&&normalize(row.apv)===normalize(current.apv))?current.apv:''}));
  const selectApv=apv=>{
    const match=apvs.find(row=>normalize(row.apv)===normalize(apv)&&(!value.sucursal||normalize(row.branch)===normalize(value.sucursal)));
    onChange(current=>({...current,apv,gerente:match?.manager||current.gerente,sucursal:match?.branch||current.sucursal}));
  };
  return <form className="bdc-appointment-form" onSubmit={event=>{event.preventDefault();onSave();}}>
    <div className="bdc-form-intro"><div><span>{mode==='create'?'ALTA DE CITA':'ACTUALIZACIÓN DE SEGUIMIENTO'}</span><h3>{mode==='create'?'Registra la cita desde su origen':'Completa el resultado sin volver a capturar al cliente'}</h3><p>Los campos se conservan con la misma estructura del archivo de citas efectivas.</p></div><div className="bdc-form-steps"><i>1</i><span>Lead</span><i>2</i><span>Cliente</span><i>3</i><span>Agenda</span><i>4</i><span>Resultado</span></div></div>
    <fieldset><legend><i>1</i><div><b>Origen del lead</b><small>Identifica cuándo y por qué canal entró.</small></div></legend><div className="bdc-appointment-grid">
      <Field label="Mes del lead"><select value={value.mesLead} onChange={event=>set('mesLead',event.target.value)}><option value="">Selecciona</option>{MONTHS.map(month=><option key={month}>{month}</option>)}</select></Field>
      <Field label="Fecha exacta" required><input type="date" value={value.fechaLead} onChange={event=>onChange(current=>({...current,fechaLead:event.target.value,mesLead:current.mesLead||monthFromDate(event.target.value)}))}/></Field>
      <Field label="Reagendado"><input type="date" value={value.reagendado} onChange={event=>set('reagendado',event.target.value)}/></Field>
      <Field label="Número de lead"><input value={value.numeroLead} onChange={event=>set('numeroLead',event.target.value)} placeholder="ID de CRM o referencia"/></Field>
      <Field label="Campaña de origen" wide><input list="bdc-campaign-list" value={value.campanaOrigen} onChange={event=>set('campanaOrigen',event.target.value)} placeholder="Nombre exacto de campaña"/><datalist id="bdc-campaign-list">{campaigns.map(item=><option key={item} value={item}/>)}</datalist></Field>
      <Field label="Fuente" required><select value={value.fuente} onChange={event=>set('fuente',event.target.value)}><option value="">Selecciona</option>{['LEAD IT','FACEBOOK','WHATSAPP','KOMMO','OTRO'].map(item=><option key={item}>{item}</option>)}</select></Field>
    </div></fieldset>
    <fieldset><legend><i>2</i><div><b>Cliente y responsables</b><small>Los catálogos se actualizan con la base activa de vendedores.</small></div></legend><div className="bdc-appointment-grid">
      <Field label="Nombre del cliente" required wide><input value={value.cliente} onChange={event=>set('cliente',event.target.value)} placeholder="Nombre completo"/></Field>
      <Field label="Asesor BDC" required><input list="bdc-advisers-list" value={value.bdc} onChange={event=>set('bdc',event.target.value)} placeholder="Persona que atiende"/><datalist id="bdc-advisers-list">{bdcNames.map(item=><option key={item} value={item}/>)}</datalist></Field>
      <Field label="Sucursal" required><select value={value.sucursal} onChange={event=>selectBranch(event.target.value)}><option value="">Selecciona</option>{branches.map(item=><option key={item}>{item}</option>)}</select></Field>
      <Field label="Gerente" required><select value={value.gerente} onChange={event=>selectManager(event.target.value)}><option value="">Selecciona</option>{managers.map(item=><option key={item}>{item}</option>)}</select></Field>
      <Field label="APV" required help="Solo vendedores activos de la sucursal y gerente seleccionados."><select value={value.apv} onChange={event=>selectApv(event.target.value)}><option value="">Selecciona</option>{apvs.filter(row=>(!value.sucursal||normalize(row.branch)===normalize(value.sucursal))&&(!value.gerente||normalize(row.manager)===normalize(value.gerente))).map(row=><option key={`${row.branch}-${row.manager}-${row.apv}`} value={row.apv}>{row.apv}</option>)}</select></Field>
      <Field label="Auto de interés" required><input list="bdc-vehicle-list" value={value.autoInteres} onChange={event=>set('autoInteres',event.target.value)} placeholder="Modelo de interés"/><datalist id="bdc-vehicle-list">{vehicles.map(item=><option key={item} value={item}/>)}</datalist></Field>
    </div></fieldset>
    <fieldset><legend><i>3</i><div><b>Agenda de la cita</b><small>Fecha, hora y modalidad acordadas con el cliente.</small></div></legend><div className="bdc-appointment-grid">
      <Field label="Mes de la cita"><select value={value.mesCita} onChange={event=>set('mesCita',event.target.value)}><option value="">Selecciona</option>{MONTHS.map(month=><option key={month}>{month}</option>)}</select></Field>
      <Field label="Fecha exacta de la cita" required><input type="date" value={value.fechaCita} onChange={event=>onChange(current=>({...current,fechaCita:event.target.value,mesCita:monthFromDate(event.target.value)||current.mesCita}))}/></Field>
      <Field label="Hora" required><input type="time" value={value.hora} onChange={event=>set('hora',event.target.value)}/></Field>
      <Field label="Teléfono" required><input inputMode="tel" value={value.telefono} onChange={event=>set('telefono',event.target.value.replace(/[^0-9+]/g,''))} placeholder="10 dígitos"/></Field>
      <Field label="Cita por APV"><YesNoSelect label="Cita por APV" value={value.citaPorApv} onChange={next=>set('citaPorApv',next)}/></Field>
      <Field label="Confirmación"><select aria-label="Confirmación" value={value.confirmacion||'PENDIENTE'} onChange={event=>set('confirmacion',event.target.value)}><option value="PENDIENTE">Pendiente</option><option value="CONFIRMADA">Confirmada</option><option value="NO CONFIRMADA">No confirmada</option></select></Field>
      <Field label="Visita a domicilio"><YesNoSelect label="Visita a domicilio" value={value.visitaDomicilio} onChange={next=>set('visitaDomicilio',next)}/></Field>
      <Field label="Cita virtual (cotizaciones)"><YesNoSelect label="Cita virtual" value={value.citaVirtual} onChange={next=>set('citaVirtual',next)}/></Field>
    </div></fieldset>
    <fieldset className="result"><legend><i>4</i><div><b>Resultado y seguimiento</b><small>Puede quedar pendiente al crear la cita y completarse posteriormente.</small></div></legend><div className="bdc-appointment-grid">
      <Field label="Asistió"><YesNoSelect label="Asistió" value={value.asistio} onChange={next=>set('asistio',next)}/></Field>
      <Field label="Solicitud"><YesNoSelect label="Solicitud" value={value.solicitud} onChange={next=>set('solicitud',next)}/></Field>
      <Field label="Factura"><input value={value.factura} onChange={event=>set('factura',event.target.value)} placeholder="Número de factura"/></Field>
      <Field label="Vehículo que compró"><input list="bdc-vehicle-list" value={value.vehiculoCompro} onChange={event=>set('vehiculoCompro',event.target.value)} placeholder="Modelo comprado"/></Field>
      <Field label="Comentario" wide><textarea value={value.comentario} onChange={event=>set('comentario',event.target.value)} placeholder="Resultado o siguiente acción"/></Field>
      <Field label="Comentario APV" wide><textarea value={value.comentarioApv} onChange={event=>set('comentarioApv',event.target.value)} placeholder="Retroalimentación del APV"/></Field>
      <Field label="Llamada de seguimiento" wide><textarea value={value.llamadaSeguimiento} onChange={event=>set('llamadaSeguimiento',event.target.value)} placeholder="Fecha, acuerdo o pendiente de la llamada"/></Field>
    </div></fieldset>
    <div className="bdc-appointment-actions"><button type="button" className="secondary" onClick={onReset}><RotateCcw size={15}/> Limpiar</button><button type="submit"><Save size={16}/> {mode==='create'?'Guardar cita agendada':'Guardar seguimiento'}</button></div>
  </form>;
}

export default function BdcAppointmentCapture({mode='create',appointments=[],catalogTeams=[],branchCatalog=[],dealerRecords=[],campaignCatalog=[],onSave,showToast}){
  const [draft,setDraft]=useState(emptyAppointment);
  const [selectedId,setSelectedId]=useState('');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('ALL');
  const branches=useMemo(()=>branchCatalog.filter(row=>row.active!==false).sort((a,b)=>(a.order??999)-(b.order??999)).map(row=>row.name),[branchCatalog]);
  const apvCatalog=useMemo(()=>catalogTeams.filter(team=>!team.inactiveManager).flatMap(team=>{
    const inactive=new Set((team.inactiveVendors||[]).map(normalize));
    return [...new Set((team.vendors||[]).map(clean).filter(Boolean))].filter(vendor=>!inactive.has(normalize(vendor))).map(apv=>({branch:clean(team.sucursal),manager:clean(team.manager),apv}));
  }),[catalogTeams]);
  const managers=useMemo(()=>[...new Set(apvCatalog.filter(row=>!draft.sucursal||normalize(row.branch)===normalize(draft.sucursal)).map(row=>row.manager).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[apvCatalog,draft.sucursal]);
  const vehicles=useMemo(()=>[...new Set([...dealerRecords.flatMap(row=>[row.model,row.modelo,row.auto,row.vehiculo,row.modeloVehiculo,row.unidad]),...appointments.flatMap(row=>[row.autoInteres,row.vehiculoCompro])].map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[dealerRecords,appointments]);
  const campaigns=useMemo(()=>[...new Set([...campaignCatalog.map(row=>row.campaign),...appointments.map(row=>row.campanaOrigen)].map(clean).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[campaignCatalog,appointments]);
  const bdcNames=useMemo(()=>[...new Set(appointments.map(row=>clean(row.bdc)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')),[appointments]);
  const filtered=useMemo(()=>appointments.filter(row=>{
    const status=appointmentStatus(row).key;
    const text=normalize([row.cliente,row.numeroLead,row.telefono,row.apv,row.sucursal,row.factura].join(' '));
    return (!search||text.includes(normalize(search)))&&(statusFilter==='ALL'||status===statusFilter);
  }).sort((a,b)=>String(a.fechaCita||'').localeCompare(String(b.fechaCita||''))||String(a.hora||'').localeCompare(String(b.hora||''))),[appointments,search,statusFilter]);

  useEffect(()=>{
    if(mode==='create'&&!draft.fechaLead){const today=new Date().toISOString().slice(0,10);setDraft(current=>({...current,fechaLead:today,mesLead:monthFromDate(today)}));}
  },[mode]);

  const reset=()=>{const next=emptyAppointment();if(mode==='create'){const today=new Date().toISOString().slice(0,10);next.fechaLead=today;next.mesLead=monthFromDate(today);}setSelectedId('');setDraft(next);};
  const save=async()=>{
    const required=[['fechaLead','fecha del lead'],['cliente','nombre del cliente'],['bdc','asesor BDC'],['sucursal','sucursal'],['gerente','gerente'],['apv','APV'],['autoInteres','auto de interés'],['fechaCita','fecha de la cita'],['hora','hora'],['telefono','teléfono'],['fuente','fuente']];
    const missing=required.find(([key])=>!clean(draft[key]));
    if(missing)return showToast(`Falta capturar ${missing[1]}.`,'error');
    const now=new Date().toISOString();
    const payload={...draft,id:draft.id||`bdc-cita-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,mesLead:draft.mesLead||monthFromDate(draft.fechaLead),mesCita:draft.mesCita||monthFromDate(draft.fechaCita),createdAt:draft.createdAt||now,updatedAt:now};
    try{
      await onSave(payload);
      showToast(draft.id?'Seguimiento BDC actualizado.':'Cita BDC registrada correctamente.');
      reset();
    }catch(error){
      console.error(error);
      showToast('No fue posible guardar la cita BDC. Intenta nuevamente.','error');
    }
  };
  const edit=row=>{setSelectedId(row.id);setDraft({...emptyAppointment(),...row});window.scrollTo({top:0,behavior:'smooth'});};

  return <div className="bdc-appointment-module">
    <style>{`
      .bdc-appointment-module{display:grid;gap:14px}.bdc-appointment-form,.bdc-followup-board{overflow:hidden;border:1px solid #d8e3f0;border-radius:18px;background:#fff;box-shadow:0 12px 30px rgba(15,42,76,.06)}.bdc-form-intro{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:19px 22px;background:linear-gradient(120deg,#0f2f64,#245bc4);color:#fff}.bdc-form-intro span{font-size:8px;font-weight:900;letter-spacing:.12em;color:#bfdbfe}.bdc-form-intro h3{margin:4px 0;font-size:19px}.bdc-form-intro p{margin:0;color:#dbeafe;font-size:10px}.bdc-form-steps{display:grid;grid-template-columns:24px auto 24px auto 24px auto 24px auto;align-items:center;gap:6px}.bdc-form-steps i,.bdc-appointment-form legend i{display:grid;place-items:center;width:24px;height:24px;border-radius:8px;background:#fff;color:#1d4ed8;font-style:normal;font-weight:900}.bdc-form-steps span{color:#dbeafe;font-size:9px;letter-spacing:0}.bdc-appointment-form fieldset{margin:0;padding:17px 20px 20px;border:0;border-bottom:1px solid #e2e8f0}.bdc-appointment-form fieldset.result{background:#f8fbff}.bdc-appointment-form legend{display:flex;align-items:center;gap:9px;padding:0}.bdc-appointment-form legend i{background:#eaf2ff}.bdc-appointment-form legend b,.bdc-appointment-form legend small{display:block}.bdc-appointment-form legend b{font-size:13px;color:#102b57}.bdc-appointment-form legend small{margin-top:2px;color:#7890ac;font-size:9px}.bdc-appointment-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}.bdc-appointment-field{display:grid;align-content:start;gap:5px}.bdc-appointment-field.wide{grid-column:span 2}.bdc-appointment-field>span{color:#61748f;font-size:8px;font-weight:900;text-transform:uppercase}.bdc-appointment-field>span b{margin-left:3px;color:#dc2626}.bdc-appointment-field input,.bdc-appointment-field select,.bdc-appointment-field textarea{width:100%;box-sizing:border-box;border:1px solid #cfdbe9;border-radius:9px;background:#fff;color:#102b57;font:inherit;font-size:10px;outline:none}.bdc-appointment-field input,.bdc-appointment-field select{height:38px;padding:0 10px}.bdc-appointment-field textarea{min-height:64px;padding:9px;resize:vertical}.bdc-appointment-field input:focus,.bdc-appointment-field select:focus,.bdc-appointment-field textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px #dbeafe}.bdc-appointment-field small{color:#8a99ad;font-size:8px}.bdc-appointment-actions{display:flex;justify-content:flex-end;gap:8px;padding:15px 20px;background:#f8fafc}.bdc-appointment-actions button,.bdc-followup-action{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 15px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:900;cursor:pointer}.bdc-appointment-actions button.secondary{border:1px solid #cbd5e1;background:#fff;color:#475569}.bdc-followup-toolbar{display:grid;grid-template-columns:minmax(230px,1fr) 190px auto;align-items:center;gap:10px;padding:15px 18px;border-bottom:1px solid #e2e8f0}.bdc-followup-search{display:flex;align-items:center;gap:7px;height:38px;padding:0 10px;border:1px solid #cfdbe9;border-radius:9px}.bdc-followup-search input{width:100%;border:0;outline:0}.bdc-followup-toolbar select{height:38px;border:1px solid #cfdbe9;border-radius:9px;background:#fff;padding:0 9px}.bdc-followup-toolbar>span{color:#64748b;font-size:9px;text-align:right}.bdc-followup-list{display:grid;gap:9px;padding:14px}.bdc-followup-card{display:grid;grid-template-columns:130px minmax(230px,1.2fr) minmax(200px,1fr) minmax(260px,1.2fr) auto;align-items:center;gap:12px;padding:13px 14px;border:1px solid #dce5f0;border-radius:12px;background:#fff}.bdc-followup-card:hover{border-color:#a9c6f8;background:#fbfdff}.bdc-followup-date strong,.bdc-followup-client strong,.bdc-followup-client small,.bdc-followup-team b,.bdc-followup-team small{display:block}.bdc-followup-date span{display:block;color:#64748b;font-size:8px}.bdc-followup-date strong{margin:3px 0;color:#173f7a;font-size:12px}.bdc-followup-client strong{font-size:12px}.bdc-followup-client small,.bdc-followup-team small{margin-top:3px;color:#7b8da6;font-size:8px}.bdc-followup-team b{font-size:10px}.bdc-followup-stages{display:flex;flex-wrap:wrap;gap:5px}.bdc-followup-stages span,.bdc-status-pill{padding:5px 7px;border-radius:999px;background:#f1f5f9;color:#64748b;font-size:8px;font-weight:900}.bdc-followup-stages span.done,.bdc-status-pill.compro,.bdc-status-pill.solicitud,.bdc-status-pill.asistio,.bdc-status-pill.confirmada{background:#dcfce7;color:#15803d}.bdc-status-pill.pendiente{background:#fef3c7;color:#a16207}.bdc-status-pill.no-confirmada{background:#fee2e2;color:#dc2626}.bdc-followup-empty{padding:38px;text-align:center;color:#64748b}.bdc-followup-heading{display:flex;align-items:center;gap:10px;padding:17px 19px;border-bottom:1px solid #e2e8f0}.bdc-followup-heading svg{color:#2563eb}.bdc-followup-heading h3{margin:0;font-size:16px}.bdc-followup-heading p{margin:4px 0 0;color:#71839c;font-size:9px}@media(max-width:1050px){.bdc-appointment-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.bdc-followup-card{grid-template-columns:120px 1fr 1fr}.bdc-followup-stages{grid-column:2/4}.bdc-followup-action{grid-column:3;justify-self:end}}@media(max-width:650px){.bdc-form-intro{align-items:flex-start;flex-direction:column}.bdc-form-steps{display:none}.bdc-appointment-grid,.bdc-followup-toolbar,.bdc-followup-card{grid-template-columns:1fr}.bdc-appointment-field.wide{grid-column:auto}.bdc-followup-stages,.bdc-followup-action{grid-column:auto}.bdc-followup-action{justify-self:stretch}}
    `}</style>
    {mode==='create'&&<AppointmentForm value={draft} onChange={setDraft} onSave={save} onReset={reset} branches={branches} managers={managers} apvs={apvCatalog} vehicles={vehicles} campaigns={campaigns} bdcNames={bdcNames} mode="create"/>}
    {mode==='followup'&&<>
      {selectedId&&<AppointmentForm value={draft} onChange={setDraft} onSave={save} onReset={reset} branches={branches} managers={managers} apvs={apvCatalog} vehicles={vehicles} campaigns={campaigns} bdcNames={bdcNames} mode="followup"/>}
      <section className="bdc-followup-board"><div className="bdc-followup-heading"><UserCheck size={19}/><div><h3>Seguimiento de citas BDC</h3><p>Confirma asistencia, solicitud, compra y acuerdos posteriores desde una sola bandeja.</p></div></div><div className="bdc-followup-toolbar"><label className="bdc-followup-search"><Search size={14}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cliente, lead, teléfono, APV o factura"/></label><select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}><option value="ALL">Todos los estados</option><option value="pendiente">Pendientes</option><option value="confirmada">Confirmadas</option><option value="asistio">Asistieron</option><option value="solicitud">Con solicitud</option><option value="compro">Compraron</option><option value="no-confirmada">No confirmaron</option></select><span>{filtered.length} cita{filtered.length===1?'':'s'}</span></div><div className="bdc-followup-list">{filtered.map(row=>{const status=appointmentStatus(row);return <article className="bdc-followup-card" key={row.id}><div className="bdc-followup-date"><span>Cita</span><strong>{formatDate(row.fechaCita)}</strong><small><Clock3 size={10}/> {row.hora||'Sin hora'}</small></div><div className="bdc-followup-client"><strong>{row.cliente||'Cliente sin nombre'}</strong><small>{row.telefono||'Sin teléfono'} · {row.autoInteres||'Sin modelo'}</small><span className={`bdc-status-pill ${status.key}`}>{status.label}</span></div><div className="bdc-followup-team"><b>{row.apv||'Sin APV'}</b><small>{row.gerente||'Sin gerente'} · {row.sucursal||'Sin sucursal'}</small></div><div className="bdc-followup-stages"><span className={normalize(row.confirmacion)==='SI'||normalize(row.confirmacion)==='CONFIRMADA'?'done':''}><Check size={10}/> Confirmó</span><span className={normalize(row.asistio)==='SI'?'done':''}><Check size={10}/> Asistió</span><span className={normalize(row.solicitud)==='SI'?'done':''}><Check size={10}/> Solicitud</span><span className={clean(row.factura)||clean(row.vehiculoCompro)?'done':''}><Check size={10}/> Compró</span></div><button className="bdc-followup-action" onClick={()=>edit(row)}><FileText size={14}/> Seguimiento</button></article>})}{!filtered.length&&<div className="bdc-followup-empty"><CalendarClock size={28}/><p>No hay citas que coincidan con los filtros.</p></div>}</div></section>
    </>}
  </div>;
}
