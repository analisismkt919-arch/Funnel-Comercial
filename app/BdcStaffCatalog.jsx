'use client';

import React,{useMemo,useState} from 'react';
import {Check,Plus,Power,Users} from 'lucide-react';

const clean=value=>String(value||'').trim();
const key=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();

export default function BdcStaffCatalog({staff=[],branches=[],persistStaff,showToast}){
  const activeBranches=useMemo(()=>branches.filter(row=>row.active!==false).sort((a,b)=>(a.order??999)-(b.order??999)),[branches]);
  const managers=staff.filter(row=>row.type==='manager');
  const [form,setForm]=useState({type:'advisor',name:'',managerId:'',branches:[]});
  const toggleBranch=name=>setForm(current=>({...current,branches:current.branches.includes(name)?current.branches.filter(value=>value!==name):[...current.branches,name]}));
  const save=async()=>{
    const name=clean(form.name);
    if(!name)return showToast('Escribe el nombre del integrante BDC.','error');
    if(form.type==='advisor'&&!form.managerId)return showToast('Selecciona el gerente BDC responsable.','error');
    if(!form.branches.length)return showToast('Selecciona por lo menos una sucursal de cobertura.','error');
    if(staff.some(row=>key(row.name)===key(name)&&row.type===form.type&&row.active!==false))return showToast('Ese integrante BDC ya está activo.','error');
    const next=[...staff,{id:`bdc-staff-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,type:form.type,name,managerId:form.type==='advisor'?form.managerId:'',branches:[...new Set(form.branches)],active:true,createdAt:new Date().toISOString()}];
    await persistStaff(next);
    setForm({type:'advisor',name:'',managerId:'',branches:[]});
    showToast(`${name} fue agregado al catálogo BDC.`);
  };
  const toggleActive=async row=>{await persistStaff(staff.map(item=>item.id===row.id?{...item,active:item.active===false}:item));showToast(`${row.name} ${row.active===false?'fue reactivado':'fue dado de baja'}. El histórico se conserva.`);};
  const managerName=id=>managers.find(row=>row.id===id)?.name||'Sin gerente';
  return <section className="bdc-staff-catalog">
    <style>{`.bdc-staff-catalog{margin-top:18px;border:1px solid #d8e3f0;border-radius:16px;background:#fff;overflow:hidden}.bdc-staff-head{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;background:linear-gradient(120deg,#0f2f64,#245bc4);color:#fff}.bdc-staff-head h2{margin:3px 0 0;font-size:18px}.bdc-staff-head span{color:#bfdbfe;font-size:9px;font-weight:900;text-transform:uppercase}.bdc-staff-head strong{font-size:24px}.bdc-staff-form{display:grid;grid-template-columns:170px minmax(210px,1fr) minmax(210px,1fr);gap:12px;padding:18px;border-bottom:1px solid #e2e8f0}.bdc-staff-form label{display:grid;gap:5px;color:#64748b;font-size:9px;font-weight:900;text-transform:uppercase}.bdc-staff-form input,.bdc-staff-form select{height:39px;border:1px solid #cbd5e1;border-radius:9px;padding:0 10px;background:#fff}.bdc-staff-branches{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px}.bdc-staff-branches button{padding:7px 10px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#475569;cursor:pointer}.bdc-staff-branches button.active{border-color:#2563eb;background:#dbeafe;color:#1d4ed8;font-weight:900}.bdc-staff-actions{grid-column:1/-1;display:flex;justify-content:flex-end}.bdc-staff-actions button{display:flex;align-items:center;gap:7px;padding:10px 15px;border:0;border-radius:9px;background:#2563eb;color:#fff;font-weight:900;cursor:pointer}.bdc-staff-list{display:grid;gap:8px;padding:14px}.bdc-staff-row{display:grid;grid-template-columns:1.2fr 1fr 2fr auto;align-items:center;gap:12px;padding:12px 14px;border:1px solid #e2e8f0;border-radius:11px}.bdc-staff-row.inactive{opacity:.55;background:#f8fafc}.bdc-staff-row strong,.bdc-staff-row small{display:block}.bdc-staff-row small{margin-top:3px;color:#64748b}.bdc-staff-row button{display:flex;align-items:center;gap:6px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;cursor:pointer}@media(max-width:800px){.bdc-staff-form,.bdc-staff-row{grid-template-columns:1fr}.bdc-staff-branches,.bdc-staff-actions{grid-column:auto}}`}</style>
    <header className="bdc-staff-head"><div><span><Users size={13}/> Estructura especializada</span><h2>Gerentes y asesores BDC</h2></div><strong>{staff.filter(row=>row.active!==false).length}</strong></header>
    <div className="bdc-staff-form"><label>Tipo<select value={form.type} onChange={event=>setForm(current=>({...current,type:event.target.value,managerId:''}))}><option value="advisor">Asesor BDC</option><option value="manager">Gerente BDC</option></select></label><label>Nombre<input value={form.name} onChange={event=>setForm(current=>({...current,name:event.target.value}))} placeholder="Nombre completo"/></label>{form.type==='advisor'?<label>Gerente responsable<select value={form.managerId} onChange={event=>setForm(current=>({...current,managerId:event.target.value}))}><option value="">Selecciona</option>{managers.filter(row=>row.active!==false).map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>:<div/>}<div className="bdc-staff-branches"><button type="button" className={form.branches.length===activeBranches.length&&activeBranches.length?'active':''} onClick={()=>setForm(current=>({...current,branches:current.branches.length===activeBranches.length?[]:activeBranches.map(branch=>branch.name)}))}><Check size={11}/> Todas las sucursales</button>{activeBranches.map(branch=><button type="button" key={branch.id||branch.name} className={form.branches.includes(branch.name)?'active':''} onClick={()=>toggleBranch(branch.name)}>{form.branches.includes(branch.name)&&<Check size={11}/>} {branch.name}</button>)}</div><div className="bdc-staff-actions"><button type="button" onClick={save}><Plus size={15}/> Agregar al catálogo BDC</button></div></div>
    <div className="bdc-staff-list">{[...staff].sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name,'es')).map(row=><article className={`bdc-staff-row ${row.active===false?'inactive':''}`} key={row.id}><div><strong>{row.name}</strong><small>{row.type==='manager'?'Gerente BDC':'Asesor BDC'}</small></div><div><strong>{row.type==='advisor'?managerName(row.managerId):'Responsable de equipo'}</strong><small>Jefatura</small></div><div><strong>{(row.branches||[]).join(', ')||'Sin cobertura'}</strong><small>Sucursales asignadas</small></div><button type="button" onClick={()=>toggleActive(row)}><Power size={13}/> {row.active===false?'Reactivar':'Dar de baja'}</button></article>)}</div>
  </section>;
}
