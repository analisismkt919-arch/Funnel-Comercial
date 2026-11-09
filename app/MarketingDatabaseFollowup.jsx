'use client';

import React,{useEffect,useMemo,useRef,useState} from 'react';
import {BarChart3,CalendarCheck,Download,FileSpreadsheet,KeyRound,Phone,Save,Upload,Users} from 'lucide-react';
import {branchSelectionMatches} from './BranchMultiSelect';

const normalize=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toUpperCase();
const clean=value=>String(value??'').trim();
const bool=value=>['SI','SÍ','YES','TRUE','1','X'].includes(normalize(value));
const aliases=(row,names)=>{const wanted=new Set(names.map(normalize));return Object.entries(row||{}).find(([name])=>wanted.has(normalize(name)))?.[1]??'';};
const pct=(value,total)=>total?`${((value/total)*100).toFixed(1)}%`:'0.0%';
const stamp=()=>new Date().toISOString();
const dateOnly=value=>{
  if(value instanceof Date&&!Number.isNaN(value.valueOf()))return value.toISOString().slice(0,10);
  if(typeof value==='number'&&value>20000){const date=new Date(Math.round((value-25569)*86400*1000));return Number.isNaN(date.valueOf())?'':date.toISOString().slice(0,10);}
  const text=clean(value),match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(match)return `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
  return /^\d{4}-\d{2}-\d{2}/.test(text)?text.slice(0,10):'';
};
const hashPin=async(pin,salt)=>{
  const bytes=new TextEncoder().encode(`${salt}:${pin}`);
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');
};
const newSalt=()=>{const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);return[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');};

export default function MarketingDatabaseFollowup({data={},persistData,branches=[],teams=[],period='',selectedPeriods=[],branch='Todas las sucursales',managerFilter='TODOS',apvFilter='TODOS',canCapture=false,canFull=false,accessSession=null,showToast}){
  const [section,setSection]=useState('bases');
  const [baseId,setBaseId]=useState('');
  const [baseName,setBaseName]=useState('');
  const [eventDate,setEventDate]=useState(()=>`${period||new Date().toISOString().slice(0,7)}-01`);
  const [localLeads,setLocalLeads]=useState(()=>Array.isArray(data.databaseLeads)?data.databaseLeads:[]);
  const [importing,setImporting]=useState(false);
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('TODOS');
  const [callId,setCallId]=useState('');
  const [callDraft,setCallDraft]=useState({result:'No contestó',comment:'',nextDate:''});
  const [groupBy,setGroupBy]=useState('branch');
  const [pinManager,setPinManager]=useState('');
  const [pinEntry,setPinEntry]=useState('');
  const [newPin,setNewPin]=useState('');
  const [unlocked,setUnlocked]=useState(()=>new Set());
  const fileRef=useRef(null);
  const campaigns=Array.isArray(data.databaseCampaigns)?data.databaseCampaigns:[];
  const pins=Array.isArray(data.databasePins)?data.databasePins:[];
  useEffect(()=>setLocalLeads(Array.isArray(data.databaseLeads)?data.databaseLeads:[]),[data.databaseLeads]);
  useEffect(()=>{if(!baseId&&campaigns.length)setBaseId([...campaigns].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0].id);},[campaigns,baseId]);
  useEffect(()=>{if(period)setEventDate(current=>current?.slice(0,7)===period?current:`${period}-01`);},[period]);

  const activeTeams=useMemo(()=>(teams||[]).filter(team=>!team?.inactiveManager),[teams]);
  const managerOptions=useMemo(()=>[...new Map(activeTeams.map(team=>[normalize(team.manager),team.manager]).filter(([id])=>id)).values()].sort((a,b)=>a.localeCompare(b,'es')),[activeTeams]);
  const activeAdvisors=team=>{const inactive=new Set((team?.inactiveVendors||[]).map(normalize));return(team?.vendors||[]).filter(name=>!inactive.has(normalize(name)));};
  const advisorsFor=(branchName,manager)=>[...new Map(activeTeams.filter(team=>(!branchName||normalize(team.sucursal)===normalize(branchName))&&(!manager||normalize(team.manager)===normalize(manager))).flatMap(activeAdvisors).map(name=>[normalize(name),name])).values()];
  const canonicalBranch=value=>branches.find(item=>normalize(item.name)===normalize(value))?.name||clean(value);
  const canonicalManager=(value,branchName)=>activeTeams.find(team=>normalize(team.manager)===normalize(value)&&(!branchName||normalize(team.sucursal)===normalize(branchName)))?.manager||clean(value);
  const canonicalAdvisor=(value,branchName,manager)=>advisorsFor(branchName,manager).find(name=>normalize(name)===normalize(value))||clean(value);
  const roleManager=accessSession?.role==='gerente_vtas'?clean(accessSession.manager):'';

  const saveAll=async(nextLeads,extra={})=>{
    setLocalLeads(nextLeads);
    await persistData({...data,databaseLeads:nextLeads,...extra});
  };
  const patchLead=async(id,patch)=>{
    const next=localLeads.map(row=>row.id===id?{...row,...patch,updatedAt:stamp(),updatedBy:accessSession?.name||accessSession?.username||''}:row);
    try{await saveAll(next);}catch(error){showToast?.(error?.message||'No fue posible actualizar el seguimiento.','error');}
  };

  const downloadTemplate=async()=>{
    const XLSX=await import('xlsx');
    const rows=[{'Nombre del cliente':'Ej. Ana Pérez','Teléfono':'6141234567','Correo electrónico':'ana@correo.com','Sucursal':'Juventud','Gerente':'Nombre activo','Asesor / APV':'Nombre activo','Colonia':'Centro','Código postal':'31000','Ciudad':'Chihuahua','Comentarios iniciales':'Interesada en SUV'}];
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),'Clientes');XLSX.writeFile(book,'Plantilla_seguimiento_bases_marketing.xlsx');
  };
  const importBase=async file=>{
    if(!file||!baseName.trim()||!eventDate){showToast?.('Escribe el nombre de la base, la fecha del evento y selecciona el archivo.','error');return;}
    setImporting(true);
    try{
      const XLSX=await import('xlsx');
      const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const rows=XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{defval:'',raw:true});
      const id=`base-${Date.now()}`,createdAt=stamp(),invalid=[];
      const imported=rows.map((row,index)=>{
        const client=clean(aliases(row,['Nombre del cliente','Cliente','Nombre','Nombre completo']));
        const phone=clean(aliases(row,['Teléfono','Telefono','Celular','Tel. celular','Contacto'])).replace(/\.0$/,'');
        const email=clean(aliases(row,['Correo electrónico','Correo electronico','Email','Correo']));
        if(!client||(!phone&&!email)){invalid.push(index+2);return null;}
        let rowBranch=canonicalBranch(aliases(row,['Sucursal','Agencia','Distribuidor']));
        if(!rowBranch&&branches.length===1)rowBranch=branches[0].name;
        if(rowBranch&&!branches.some(item=>normalize(item.name)===normalize(rowBranch)))rowBranch='';
        let manager=roleManager||canonicalManager(aliases(row,['Gerente','Gerencia','Equipo']),rowBranch);
        if(manager&&!activeTeams.some(team=>normalize(team.manager)===normalize(manager)&&(!rowBranch||normalize(team.sucursal)===normalize(rowBranch))))manager='';
        const advisor=canonicalAdvisor(aliases(row,['Asesor / APV','Asesor','APV','Vendedor']),rowBranch,manager);
        return {id:`${id}-${index}-${Date.now()}`,databaseId:id,rowNumber:index+2,client,phone,email,branch:rowBranch,manager,advisor:advisorsFor(rowBranch,manager).some(name=>normalize(name)===normalize(advisor))?advisor:'',colony:clean(aliases(row,['Colonia'])),postalCode:clean(aliases(row,['Código postal','Codigo postal','CP'])).replace(/\.0$/,''),city:clean(aliases(row,['Ciudad','Municipio'])),contacted:bool(aliases(row,['Contactado'])),appointmentScheduled:bool(aliases(row,['Cita agendada'])),appointmentDate:dateOnly(aliases(row,['Fecha de cita','Fecha cita'])),rescheduledDate:dateOnly(aliases(row,['Fecha reagendada','Reagendada'])),attended:bool(aliases(row,['Cita asistida','Efectiva'])),demo:bool(aliases(row,['Demo','Prueba de manejo'])),deposit:bool(aliases(row,['Apartado'])),application:bool(aliases(row,['Solicitud'])),appraisal:bool(aliases(row,['Avalúo','Avaluo'])),tradeIn:bool(aliases(row,['Toma'])),sale:bool(aliases(row,['Venta'])),comments:clean(aliases(row,['Comentarios iniciales','Comentarios','Observaciones'])),attempts:[],createdAt,updatedAt:createdAt,createdBy:accessSession?.name||accessSession?.username||''};
      }).filter(Boolean);
      if(!imported.length)throw new Error('No se encontraron filas válidas. Cada cliente requiere nombre y al menos teléfono o correo.');
      const campaign={id,name:baseName.trim(),eventDate,period:eventDate.slice(0,7),sourceFile:file.name,totalRows:rows.length,validRows:imported.length,rejectedRows:invalid.length,createdAt,createdBy:accessSession?.name||accessSession?.username||''};
      await saveAll([...localLeads,...imported],{databaseCampaigns:[...campaigns,campaign]});
      setBaseId(id);setBaseName('');setSection('seguimiento');
      showToast?.(`${imported.length.toLocaleString('es-MX')} clientes importados${invalid.length?` · ${invalid.length} filas omitidas por falta de datos`:''}.`,'success');
    }catch(error){showToast?.(error?.message||'No fue posible importar la base.','error');}finally{setImporting(false);if(fileRef.current)fileRef.current.value='';}
  };

  const campaignIdsInPeriod=useMemo(()=>new Set(campaigns.filter(item=>!selectedPeriods.length||selectedPeriods.includes(item.period||String(item.eventDate||'').slice(0,7))).map(item=>item.id)),[campaigns,selectedPeriods]);
  const scopeLeads=useMemo(()=>localLeads.filter(row=>campaignIdsInPeriod.has(row.databaseId)&&(baseId?row.databaseId===baseId:true)&&branchSelectionMatches(branch,row.branch,'Todas las sucursales')&&(managerFilter==='TODOS'||normalize(row.manager)===normalize(managerFilter))&&(apvFilter==='TODOS'||normalize(row.advisor)===normalize(apvFilter))&&(!roleManager||normalize(row.manager)===normalize(roleManager))&&(!search||normalize(`${row.client} ${row.phone} ${row.email} ${row.comments}`).includes(normalize(search)))&&(statusFilter==='TODOS'||(statusFilter==='PENDIENTES'&&!row.contacted)||(statusFilter==='CONTACTADOS'&&row.contacted)||(statusFilter==='CITAS'&&row.appointmentScheduled)||(statusFilter==='EFECTIVOS'&&row.attended)||(statusFilter==='VENTAS'&&row.sale))),[localLeads,campaignIdsInPeriod,baseId,branch,managerFilter,apvFilter,roleManager,search,statusFilter]);

  const registerCall=async lead=>{
    const result=callDraft.result,attempt={id:`call-${Date.now()}`,at:stamp(),result,comment:callDraft.comment.trim(),nextDate:callDraft.nextDate,by:accessSession?.name||accessSession?.username||''};
    const patch={attempts:[...(lead.attempts||[]),attempt],lastCallAt:attempt.at,lastCallResult:result};
    if(['Contactado','Cita agendada'].includes(result))patch.contacted=true;
    if(result==='Cita agendada'){patch.appointmentScheduled=true;if(callDraft.nextDate)patch.appointmentDate=callDraft.nextDate;}
    await patchLead(lead.id,patch);setCallId('');setCallDraft({result:'No contestó',comment:'',nextDate:''});showToast?.('Intento de llamada registrado.','success');
  };

  const setManagerPin=async()=>{
    const manager=roleManager||pinManager;
    if(!manager||!/^\d{4,8}$/.test(newPin)){showToast?.('Selecciona un gerente y captura un PIN de 4 a 8 dígitos.','error');return;}
    try{const salt=newSalt(),hash=await hashPin(newPin,salt),next=[...pins.filter(item=>normalize(item.manager)!==normalize(manager)),{manager,salt,hash,updatedAt:stamp(),updatedBy:accessSession?.name||accessSession?.username||''}];await persistData({...data,databaseLeads:localLeads,databasePins:next});setNewPin('');showToast?.(`PIN individual de ${manager} guardado de forma cifrada.`,'success');}catch(error){showToast?.('No fue posible guardar el PIN.','error');}
  };
  const unlockExport=async()=>{
    const manager=roleManager||pinManager,record=pins.find(item=>normalize(item.manager)===normalize(manager));
    if(!record){showToast?.('Este gerente todavía no tiene un PIN configurado.','error');return;}
    const hash=await hashPin(pinEntry,record.salt);
    if(hash!==record.hash){showToast?.('PIN incorrecto.','error');return;}
    setUnlocked(current=>new Set([...current,normalize(manager)]));setPinEntry('');showToast?.('Exportación desbloqueada para esta sesión.','success');
  };
  const exportManager=roleManager||pinManager;
  const exportUnlocked=accessSession?.role==='admin'||(exportManager&&unlocked.has(normalize(exportManager)));
  const exportExcel=async()=>{
    if(!exportUnlocked){showToast?.('Valida el PIN individual del gerente antes de descargar la base.','error');return;}
    const XLSX=await import('xlsx'),rows=scopeLeads.filter(row=>accessSession?.role==='admin'||!exportManager||normalize(row.manager)===normalize(exportManager)).map(row=>({'Base':campaigns.find(item=>item.id===row.databaseId)?.name||'',Cliente:row.client,Teléfono:row.phone,Correo:row.email,Sucursal:row.branch,Gerente:row.manager,'Asesor / APV':row.advisor,'Intentos de llamada':(row.attempts||[]).length,'Último resultado':row.lastCallResult||'',Contactado:row.contacted?'Sí':'No','Cita agendada':row.appointmentScheduled?'Sí':'No','Fecha de cita':row.appointmentDate||'','Fecha reagendada':row.rescheduledDate||'','Cita asistida / efectiva':row.attended?'Sí':'No',Demo:row.demo?'Sí':'No',Apartado:row.deposit?'Sí':'No',Solicitud:row.application?'Sí':'No',Avalúo:row.appraisal?'Sí':'No',Toma:row.tradeIn?'Sí':'No',Venta:row.sale?'Sí':'No',Comentarios:row.comments||''}));
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),'Seguimiento');XLSX.writeFile(book,`Seguimiento_${campaigns.find(item=>item.id===baseId)?.name||'bases'}.xlsx`);
  };

  const totals=useMemo(()=>{const out={total:scopeLeads.length,contacted:0,appointments:0,attended:0,demo:0,deposit:0,application:0,appraisal:0,tradeIn:0,sale:0,attempts:0};scopeLeads.forEach(row=>{out.contacted+=Number(Boolean(row.contacted));out.appointments+=Number(Boolean(row.appointmentScheduled));out.attended+=Number(Boolean(row.attended));out.demo+=Number(Boolean(row.demo));out.deposit+=Number(Boolean(row.deposit));out.application+=Number(Boolean(row.application));out.appraisal+=Number(Boolean(row.appraisal));out.tradeIn+=Number(Boolean(row.tradeIn));out.sale+=Number(Boolean(row.sale));out.attempts+=(row.attempts||[]).length;});return out;},[scopeLeads]);
  const grouped=useMemo(()=>{const map=new Map();scopeLeads.forEach(row=>{const label=groupBy==='manager'?row.manager||'Sin gerente':groupBy==='advisor'?row.advisor||'Sin asesor':row.branch||'Sin sucursal';const item=map.get(normalize(label))||{label,total:0,contacted:0,appointments:0,attended:0,demo:0,application:0,sale:0,attempts:0};item.total++;item.contacted+=Number(Boolean(row.contacted));item.appointments+=Number(Boolean(row.appointmentScheduled));item.attended+=Number(Boolean(row.attended));item.demo+=Number(Boolean(row.demo));item.application+=Number(Boolean(row.application));item.sale+=Number(Boolean(row.sale));item.attempts+=(row.attempts||[]).length;map.set(normalize(label),item);});return[...map.values()].sort((a,b)=>b.total-a.total);},[scopeLeads,groupBy]);
  const currentCampaign=campaigns.find(item=>item.id===baseId);
  const check=(lead,field,label)=><label className="db-check"><input type="checkbox" checked={Boolean(lead[field])} disabled={!canCapture} onChange={event=>patchLead(lead.id,{[field]:event.target.checked})}/>{label}</label>;

  return <section className="database-followup">
    <header className="db-hero"><div><span><FileSpreadsheet size={14}/> ACTIVACIÓN Y SEGUIMIENTO</span><h2>Bases de datos por evento</h2><p>Asigna responsables, documenta cada llamada y mide la conversión completa hasta venta.</p></div><div className="db-hero-kpis"><b>{campaigns.length}<small>bases</small></b><b>{localLeads.length.toLocaleString('es-MX')}<small>clientes acumulados</small></b></div></header>
    <nav className="db-tabs"><button className={section==='bases'?'active':''} onClick={()=>setSection('bases')}><Upload size={15}/>Bases e importación</button><button className={section==='seguimiento'?'active':''} onClick={()=>setSection('seguimiento')}><Phone size={15}/>Seguimiento</button><button className={section==='analisis'?'active':''} onClick={()=>setSection('analisis')}><BarChart3 size={15}/>Análisis</button></nav>

    {section==='bases'&&<div className="db-grid two">
      <article className="db-card"><div className="db-title"><div><span>NUEVA BASE</span><h3>Importar clientes por evento</h3></div><button className="secondary" onClick={downloadTemplate}><Download size={14}/>Plantilla Excel</button></div><div className="db-form"><label>Nombre de la base / evento<input value={baseName} disabled={!canCapture} onChange={event=>setBaseName(event.target.value)} placeholder="Ej. Buen Fin 2026"/></label><label>Fecha del evento<input type="date" value={eventDate} disabled={!canCapture} onChange={event=>setEventDate(event.target.value)}/></label><label className="wide">Archivo Excel o CSV<input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" disabled={!canCapture||importing} onChange={event=>importBase(event.target.files?.[0])}/></label></div><p className="db-note">Se conservan todos los registros válidos. El nombre y al menos un teléfono o correo son obligatorios; sucursal, gerente y APV se homologan contra los catálogos activos.</p></article>
      <article className="db-card"><div className="db-title"><div><span>SEGURIDAD DE DESCARGA</span><h3>PIN individual por gerente</h3></div><KeyRound size={22}/></div><div className="db-form">{!roleManager&&<label>Gerente<select value={pinManager} onChange={event=>setPinManager(event.target.value)}><option value="">Selecciona</option>{managerOptions.map(name=><option key={name}>{name}</option>)}</select></label>}<label>Nuevo PIN (4 a 8 dígitos)<input type="password" inputMode="numeric" value={newPin} disabled={!canFull} onChange={event=>setNewPin(event.target.value.replace(/\D/g,'').slice(0,8))}/></label><button className="primary wide" disabled={!canFull} onClick={setManagerPin}><Save size={14}/>Guardar o restablecer PIN</button></div><p className="db-note">El PIN se almacena como huella cifrada. Complementa los permisos del usuario; nunca sustituye el inicio de sesión ni amplía el acceso a otras sucursales.</p></article>
      <article className="db-card wide"><div className="db-title"><div><span>HISTÓRICO</span><h3>Bases importadas</h3></div></div><div className="db-base-list">{campaigns.length?campaigns.slice().sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(item=><button key={item.id} onClick={()=>{setBaseId(item.id);setSection('seguimiento');}}><b>{item.name}</b><span>{item.eventDate} · {item.validRows||0} clientes</span><small>{item.sourceFile}</small></button>):<p>Aún no hay bases importadas.</p>}</div></article>
    </div>}

    {section==='seguimiento'&&<>
      <div className="db-toolbar"><label>Base<select value={baseId} onChange={event=>setBaseId(event.target.value)}><option value="">Todas las bases del periodo</option>{campaigns.map(item=><option key={item.id} value={item.id}>{item.name} · {item.eventDate}</option>)}</select></label><label>Estado<select value={statusFilter} onChange={event=>setStatusFilter(event.target.value)}>{['TODOS','PENDIENTES','CONTACTADOS','CITAS','EFECTIVOS','VENTAS'].map(value=><option key={value}>{value}</option>)}</select></label><label className="grow">Buscar<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Cliente, teléfono, correo o comentario"/></label><button className="secondary" onClick={exportExcel}><Download size={14}/>Exportar Excel</button></div>
      {!exportUnlocked&&accessSession?.role!=='admin'&&<div className="db-pinbar"><KeyRound size={17}/><b>Desbloquear descarga</b>{!roleManager&&<select value={pinManager} onChange={event=>setPinManager(event.target.value)}><option value="">Selecciona gerente</option>{managerOptions.map(name=><option key={name}>{name}</option>)}</select>}<input type="password" inputMode="numeric" value={pinEntry} onChange={event=>setPinEntry(event.target.value.replace(/\D/g,'').slice(0,8))} placeholder="PIN individual"/><button onClick={unlockExport}>Validar PIN</button></div>}
      <div className="db-summary"><b>{scopeLeads.length}<small>clientes visibles</small></b><b>{totals.attempts}<small>intentos de llamada</small></b><b>{totals.contacted}<small>contactados · {pct(totals.contacted,totals.total)}</small></b><b>{totals.appointments}<small>citas · {pct(totals.appointments,totals.total)}</small></b><b>{totals.sale}<small>ventas · {pct(totals.sale,totals.total)}</small></b></div>
      <div className="db-table-wrap"><table className="db-table"><thead><tr><th>Cliente / contacto</th><th>Responsables</th><th>Llamadas</th><th>Cita</th><th>Avance comercial</th><th>Comentarios</th></tr></thead><tbody>{scopeLeads.map(lead=><React.Fragment key={lead.id}><tr><td><b>{lead.client}</b><span>{lead.phone||'Sin teléfono'} · {lead.email||'Sin correo'}</span><small>{lead.colony}{lead.postalCode?` · CP ${lead.postalCode}`:''}{lead.city?` · ${lead.city}`:''}</small></td><td><select value={lead.branch||''} disabled={!canCapture} onChange={event=>patchLead(lead.id,{branch:event.target.value,manager:'',advisor:''})}><option value="">Sin sucursal</option>{branches.map(item=><option key={item.name}>{item.name}</option>)}</select><select value={lead.manager||''} disabled={!canCapture||Boolean(roleManager)} onChange={event=>patchLead(lead.id,{manager:event.target.value,advisor:''})}><option value="">Sin gerente</option>{activeTeams.filter(team=>!lead.branch||normalize(team.sucursal)===normalize(lead.branch)).map(team=><option key={`${team.sucursal}-${team.manager}`}>{team.manager}</option>)}</select><select value={lead.advisor||''} disabled={!canCapture} onChange={event=>patchLead(lead.id,{advisor:event.target.value})}><option value="">Sin APV</option>{advisorsFor(lead.branch,lead.manager).map(name=><option key={name}>{name}</option>)}</select></td><td><b>{(lead.attempts||[]).length} intentos</b><small>{lead.lastCallResult||'Sin llamadas'}</small><button className="mini" disabled={!canCapture} onClick={()=>setCallId(callId===lead.id?'':lead.id)}><Phone size={12}/>Registrar llamada</button></td><td>{check(lead,'contacted','Contactado')}{check(lead,'appointmentScheduled','Agendada')}{check(lead,'attended','Asistida / efectiva')}<input type="datetime-local" value={lead.appointmentDate||''} disabled={!canCapture} onChange={event=>patchLead(lead.id,{appointmentDate:event.target.value,appointmentScheduled:Boolean(event.target.value)})}/><input type="datetime-local" value={lead.rescheduledDate||''} disabled={!canCapture} onChange={event=>patchLead(lead.id,{rescheduledDate:event.target.value})}/></td><td><div className="db-flags">{check(lead,'demo','Demo')}{check(lead,'deposit','Apartado')}{check(lead,'application','Solicitud')}{check(lead,'appraisal','Avalúo')}{check(lead,'tradeIn','Toma')}{check(lead,'sale','Venta')}</div></td><td><textarea value={lead.comments||''} disabled={!canCapture} onBlur={event=>patchLead(lead.id,{comments:event.target.value})} onChange={event=>setLocalLeads(rows=>rows.map(row=>row.id===lead.id?{...row,comments:event.target.value}:row))} placeholder="Acuerdos y próximos pasos"/></td></tr>{callId===lead.id&&<tr className="db-call-row"><td colSpan="6"><div><b>Nuevo intento de llamada</b><select value={callDraft.result} onChange={event=>setCallDraft(current=>({...current,result:event.target.value}))}>{['No contestó','Contactado','Número inválido','Reagendar','Cita agendada','No interesado'].map(value=><option key={value}>{value}</option>)}</select><input type="datetime-local" value={callDraft.nextDate} onChange={event=>setCallDraft(current=>({...current,nextDate:event.target.value}))}/><input value={callDraft.comment} onChange={event=>setCallDraft(current=>({...current,comment:event.target.value}))} placeholder="Comentario de la llamada"/><button className="primary" onClick={()=>registerCall(lead)}><Save size={13}/>Guardar intento</button></div></td></tr>}</React.Fragment>)}</tbody></table>{!scopeLeads.length&&<div className="db-empty">No hay clientes que coincidan con los filtros seleccionados.</div>}</div>
    </>}

    {section==='analisis'&&<>
      <div className="db-analysis-head"><div><span>LECTURA EJECUTIVA</span><h3>{currentCampaign?.name||'Bases del periodo'}</h3><p>{totals.total?`${pct(totals.contacted,totals.total)} de la base ya fue contactada y ${pct(totals.sale,totals.total)} llegó a venta.`:'No hay registros para los filtros actuales.'}</p></div><label>Agrupar por<select value={groupBy} onChange={event=>setGroupBy(event.target.value)}><option value="branch">Sucursal</option><option value="manager">Gerencia</option><option value="advisor">Asesor de ventas</option></select></label></div>
      <div className="db-funnel">{[['Base',totals.total],['Contactados',totals.contacted],['Citas',totals.appointments],['Efectivos',totals.attended],['Demos',totals.demo],['Solicitudes',totals.application],['Apartados',totals.deposit],['Ventas',totals.sale]].map(([label,value],index)=><div key={label}><span>{label}</span><b>{value}</b><i style={{width:`${totals.total?Math.max(4,(value/totals.total)*100):0}%`}}/><small>{index?`${pct(value,totals.total)} de la base`:`${totals.attempts} llamadas acumuladas`}</small></div>)}</div>
      <div className="db-card"><div className="db-title"><div><span>DESEMPEÑO COMPARATIVO</span><h3>Resultados por {groupBy==='branch'?'sucursal':groupBy==='manager'?'gerencia':'asesor'}</h3></div></div><div className="db-table-wrap"><table className="db-table analysis"><thead><tr><th>Responsable</th><th>Base</th><th>Llamadas</th><th>Contactados</th><th>Citas</th><th>Efectivos</th><th>Demos</th><th>Solicitudes</th><th>Ventas</th><th>Conversión</th></tr></thead><tbody>{grouped.map(row=><tr key={row.label}><td><b>{row.label}</b></td><td>{row.total}</td><td>{row.attempts}</td><td>{row.contacted}<small>{pct(row.contacted,row.total)}</small></td><td>{row.appointments}<small>{pct(row.appointments,row.total)}</small></td><td>{row.attended}<small>{pct(row.attended,row.appointments)}</small></td><td>{row.demo}</td><td>{row.application}</td><td><b>{row.sale}</b></td><td><strong>{pct(row.sale,row.total)}</strong></td></tr>)}</tbody></table></div></div>
    </>}
    <style>{CSS}</style>
  </section>;
}

const CSS=`.database-followup{display:grid;gap:14px;color:#10254a}.db-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:22px 26px;border-radius:18px;background:linear-gradient(120deg,#112b58,#2862d2);color:white}.db-hero span,.db-title span,.db-analysis-head span{display:flex;align-items:center;gap:6px;font-size:9px;font-weight:900;letter-spacing:.12em;color:#8fb7ff}.db-hero h2{margin:5px 0 3px;font-size:24px}.db-hero p,.db-analysis-head p{margin:0;font-size:11px;color:#dbeafe}.db-hero-kpis{display:flex;gap:12px}.db-hero-kpis b{display:grid;min-width:115px;padding:10px 14px;border:1px solid #ffffff35;border-radius:12px;background:#ffffff12;font-size:22px}.db-hero-kpis small{font-size:8px;color:#dbeafe}.db-tabs{display:flex;gap:7px;padding:6px;border-radius:12px;background:#e8eef7}.db-tabs button{display:flex;align-items:center;gap:6px;padding:9px 14px;border:0;border-radius:9px;background:transparent;color:#60728c;font-weight:800;cursor:pointer}.db-tabs button.active{background:#fff;color:#1555bf;box-shadow:0 2px 8px #1e3a5f18}.db-grid{display:grid;gap:14px}.db-grid.two{grid-template-columns:1fr 1fr}.db-grid .wide{grid-column:1/-1}.db-card{overflow:hidden;border:1px solid #d4e0ef;border-radius:15px;background:#fff}.db-title{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-bottom:1px solid #e4eaf2}.db-title h3,.db-analysis-head h3{margin:3px 0 0;font-size:17px}.db-form{display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:16px 18px}.db-form label,.db-toolbar label,.db-analysis-head label{display:grid;gap:5px;color:#53657d;font-size:9px;font-weight:900;text-transform:uppercase}.db-form input,.db-form select,.db-toolbar input,.db-toolbar select,.db-analysis-head select,.db-pinbar input,.db-pinbar select,.db-table select,.db-table input,.db-table textarea,.db-call-row input,.db-call-row select{min-height:36px;padding:8px 10px;border:1px solid #cfdbea;border-radius:8px;background:#fff;color:#18345f;font:inherit}.db-form .wide{grid-column:1/-1}.primary,.secondary,.mini,.db-pinbar button{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:9px 12px;border:0;border-radius:8px;background:#2764dc;color:#fff;font-weight:800;cursor:pointer}.secondary{border:1px solid #c8d6e8;background:#fff;color:#244a7f}.mini{padding:6px 8px;font-size:9px}.db-note{margin:0;padding:0 18px 16px;color:#718299;font-size:9px;line-height:1.5}.db-base-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;padding:14px}.db-base-list button{display:grid;gap:4px;padding:12px;border:1px solid #d7e2ef;border-radius:10px;background:#f8fbff;color:#173661;text-align:left;cursor:pointer}.db-base-list span,.db-base-list small{font-size:9px;color:#718299}.db-toolbar{display:flex;align-items:end;gap:10px;padding:12px 14px;border:1px solid #d4e0ef;border-radius:13px;background:#fff}.db-toolbar label{min-width:180px}.db-toolbar .grow{flex:1}.db-pinbar{display:flex;align-items:center;gap:9px;padding:10px 14px;border:1px solid #f0d487;border-radius:11px;background:#fff9e8;color:#785500}.db-pinbar input,.db-pinbar select{min-width:180px}.db-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.db-summary b{display:grid;padding:13px 15px;border:1px solid #d5e1f0;border-radius:12px;background:#fff;font-size:21px}.db-summary small{margin-top:3px;color:#6f8198;font-size:8px}.db-table-wrap{overflow:auto;border:1px solid #d5e0ed;border-radius:13px;background:#fff}.db-table{width:100%;min-width:1200px;border-collapse:collapse}.db-table th{padding:10px;background:#edf3fb;color:#526780;font-size:8px;text-align:left;text-transform:uppercase}.db-table td{padding:10px;border-top:1px solid #e2e9f2;vertical-align:top;font-size:10px}.db-table td>span,.db-table td>small{display:block;margin-top:4px;color:#718299;font-size:8px}.db-table td select,.db-table td input,.db-table textarea{display:block;width:100%;min-width:150px;margin-bottom:5px;font-size:9px}.db-table textarea{min-height:84px;resize:vertical}.db-check{display:flex!important;align-items:center;gap:5px;margin:0 0 5px;color:#304764!important;font-size:9px!important;font-weight:700!important;text-transform:none!important}.db-check input{width:auto!important;min-width:0!important;min-height:0!important;margin:0!important}.db-flags{display:grid;grid-template-columns:1fr 1fr;gap:3px}.db-call-row td{background:#eef5ff}.db-call-row td>div{display:grid;grid-template-columns:150px 160px 190px 1fr auto;align-items:center;gap:8px}.db-empty{padding:30px;text-align:center;color:#7b8ca2}.db-analysis-head{display:flex;align-items:end;justify-content:space-between;gap:20px;padding:18px 20px;border-radius:14px;background:#102c59;color:#fff}.db-analysis-head label{color:#cde0ff}.db-funnel{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.db-funnel>div{position:relative;overflow:hidden;display:grid;gap:4px;padding:14px 15px;border:1px solid #d5e1ef;border-radius:12px;background:#fff}.db-funnel span{font-size:9px;font-weight:900;color:#60748d;text-transform:uppercase}.db-funnel b{font-size:24px}.db-funnel i{height:6px;border-radius:6px;background:#2a67df}.db-funnel small{color:#75869c;font-size:8px}.db-table.analysis{min-width:900px}.db-table.analysis td{text-align:center;vertical-align:middle}.db-table.analysis td:first-child{text-align:left}.db-table.analysis small{display:block;color:#73849a}.db-table.analysis strong{color:#0d8a4d}.primary:disabled,.secondary:disabled,.mini:disabled{opacity:.45;cursor:not-allowed}@media(max-width:1050px){.db-grid.two{grid-template-columns:1fr}.db-hero,.db-toolbar,.db-pinbar{align-items:stretch;flex-direction:column}.db-summary,.db-funnel{grid-template-columns:repeat(2,1fr)}.db-hero-kpis{width:100%}.db-hero-kpis b{flex:1}.db-call-row td>div{grid-template-columns:1fr}}`;
