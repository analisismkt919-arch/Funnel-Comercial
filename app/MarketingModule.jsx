'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Boxes, Car, Download, Lightbulb, Plus, Save, Search, Sparkles, Target, TrendingUp, Upload, Users } from 'lucide-react';

const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ALL_BRANCHES='Todas las sucursales';
const TORO_MODELS=['Aveo','Cheyenne','Groove','S10','Trax','Captiva','Tornado Van','Captiva Híbrida','Onix','Spark EUV','Colorado','Montana','Silverado','Tracker','Suburban','Tahoe','Traverse','Equinox EV','Blazer','Blazer EV','Express Max'];
const CHS_MODELS=['Encore','Lyriq','Optiq','Yukon','Escalade','Acadia','Escalade IQ','Canyon','Sierra','Terrain','Envista','Enclave','Envision','Hummer'];
const key=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toUpperCase();
const periodLabel=value=>{const [year,month]=String(value||'').split('-');return month?`${MONTHS[Number(month)-1]} ${year}`:value;};
const previousYearPeriod=value=>{const [year,month]=String(value||'').split('-');return `${Number(year)-1}-${month}`;};
const pct=(value,digits=1)=>Number.isFinite(value)?`${value.toFixed(digits)}%`:'Sin base';
const normalizedHeader=value=>key(value).replace(/\s+/g,' ');
const fieldValue=(row,names)=>{
  const aliases=new Set(names.map(normalizedHeader));
  const entry=Object.entries(row||{}).find(([name])=>aliases.has(normalizedHeader(name)));
  return entry?.[1];
};
const cleanNumber=value=>Math.max(0,Number(String(value??0).replace(/[$,%\s]/g,'').replace(/,/g,''))||0);
const parsePeriod=row=>{
  const explicit=String(fieldValue(row,['Periodo','Period'])||'').trim();
  const match=explicit.match(/((?:19|20)\d{2})[-\s/]?(0?[1-9]|1[0-2])/) || explicit.match(/(0?[1-9]|1[0-2])[-\s/]?((?:19|20)\d{2})/);
  if(match){
    const year=match[1].length===4?match[1]:match[2];
    const month=match[1].length===4?match[2]:match[1];
    return `${year}-${String(Number(month)).padStart(2,'0')}`;
  }
  const year=Number(fieldValue(row,['Año','Anio','Year']));
  const rawMonth=fieldValue(row,['Mes','Month']);
  const monthNumber=Number(rawMonth)||MONTHS.findIndex(name=>key(name)===key(rawMonth))+1;
  return year&&monthNumber>=1&&monthNumber<=12?`${year}-${String(monthNumber).padStart(2,'0')}`:'';
};
const marketingRecordId=(period,brand,branch,model)=>`marketing-${period}-${brand}-${key(branch)}-${key(model)}`.toLowerCase().replace(/[^a-z0-9]+/g,'-');
const canonicalModel=(value,catalog)=>{
  const source=key(String(value||'').replace(/\b(19|20)\d{2}\b/g,''));
  if(!source)return '';
  const candidates=[...catalog].sort((a,b)=>key(b).length-key(a).length);
  const found=candidates.find(model=>source===key(model)||source.includes(key(model))||key(model).includes(source));
  return found||String(value).trim();
};
const branchIsChs=(name,catalog)=>{
  const branch=catalog.find(item=>key(item.name)===key(name));
  return key(branch?.brand)==='CHS'||key(name).startsWith('CHS');
};
const strategyFor=row=>{
  if(row.target<=0&&row.inventory>0)return {tone:'watch',label:'Definir meta',detail:'Hay inventario disponible sin objetivo comercial.'};
  if(row.inventory<=0&&row.target>row.sales)return {tone:'critical',label:'Reponer inventario',detail:'La meta supera la disponibilidad actual.'};
  if(row.prospects<=0&&row.inventory>0)return {tone:'critical',label:'Generar demanda',detail:'Existe inventario, pero no hay prospectos registrados.'};
  if(row.prospects>0&&row.conversion<10)return {tone:'critical',label:'Mejorar conversión',detail:'La demanda existe; hay que revisar calidad y seguimiento.'};
  if(row.target>0&&row.sales>=row.target)return {tone:'good',label:'Sostener',detail:'La meta está alcanzada; protege inventario y rentabilidad.'};
  if(row.target>0&&row.inventory>row.target*1.5&&row.attainment<50)return {tone:'watch',label:'Acelerar salida',detail:'Inventario alto frente al avance de ventas.'};
  return {tone:'watch',label:'Impulsar cierre',detail:'Activa campaña, seguimiento y oferta sobre este modelo.'};
};

export default function MarketingModule({data={records:[]},persistData,inventoryData={records:[]},geoData={sales:[]},branchCatalog=[],selectedMonth,canCapture=false,showToast}){
  const activeBranches=useMemo(()=>branchCatalog.filter(item=>item?.active!==false&&key(item?.type)!=='SEMINUEVOS'),[branchCatalog]);
  const periods=useMemo(()=>{
    const values=new Set([selectedMonth,...(data.records||[]).map(row=>row.period),...(inventoryData.records||[]).map(row=>row.period),...(geoData?.sales||[]).map(row=>String(row.fecha||'').slice(0,7))].filter(value=>/^\d{4}-\d{2}$/.test(value)));
    const now=new Date();values.add(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`);
    return [...values].sort().reverse();
  },[data,inventoryData,geoData,selectedMonth]);
  const [period,setPeriod]=useState(selectedMonth||periods[0]||'');
  const [brand,setBrand]=useState('TORO');
  const [branch,setBranch]=useState(ALL_BRANCHES);
  const [search,setSearch]=useState('');
  const [draft,setDraft]=useState({});
  const [customModel,setCustomModel]=useState('');
  const [extraModels,setExtraModels]=useState([]);
  const [saving,setSaving]=useState(false);
  const [importing,setImporting]=useState(false);
  const fileInputRef=useRef(null);
  useEffect(()=>{if(selectedMonth&&!period)setPeriod(selectedMonth);},[selectedMonth,period]);
  const brandBranches=useMemo(()=>activeBranches.filter(item=>brand==='CHS'?branchIsChs(item.name,activeBranches):!branchIsChs(item.name,activeBranches)),[activeBranches,brand]);
  useEffect(()=>{if(branch!==ALL_BRANCHES&&!brandBranches.some(item=>key(item.name)===key(branch)))setBranch(ALL_BRANCHES);},[brand,brandBranches,branch]);

  const catalog=brand==='CHS'?CHS_MODELS:TORO_MODELS;
  const discoveredModels=useMemo(()=>{
    const values=[...catalog,...extraModels];
    (inventoryData.records||[]).forEach(row=>{if(brand==='CHS'?branchIsChs(row.branch,activeBranches):!branchIsChs(row.branch,activeBranches))values.push(canonicalModel(row.model,catalog));});
    (geoData?.sales||[]).forEach(row=>{if(brand==='CHS'?branchIsChs(row.sucursal,activeBranches):!branchIsChs(row.sucursal,activeBranches))values.push(canonicalModel(row.modelo,catalog));});
    (data.records||[]).filter(row=>row.brand===brand).forEach(row=>values.push(row.model));
    return [...new Map(values.filter(Boolean).map(value=>[key(value),value])).values()];
  },[brand,catalog,inventoryData,geoData,data,activeBranches,extraModels]);

  const scopedManual=useMemo(()=>{
    const rows=(data.records||[]).filter(row=>row.period===period&&row.brand===brand);
    const exact=rows.filter(row=>key(row.branch)===key(branch));
    if(branch!==ALL_BRANCHES||exact.length)return exact;
    const grouped=new Map();
    rows.forEach(row=>{const model=canonicalModel(row.model,catalog);const current=grouped.get(key(model))||{model,prospects:0,target:0};current.prospects+=Number(row.prospects)||0;current.target+=Number(row.target)||0;grouped.set(key(model),current);});
    return [...grouped.values()];
  },[data,period,brand,branch,catalog]);
  useEffect(()=>{
    const next={};scopedManual.forEach(row=>{next[key(row.model)]={prospects:Number(row.prospects)||0,target:Number(row.target)||0};});setDraft(next);
  },[scopedManual]);

  const branchMatches=name=>branch===ALL_BRANCHES
    ? key(name)===key(ALL_BRANCHES)||brandBranches.some(item=>key(item.name)===key(name))
    : key(name)===key(branch);
  const inventoryByModel=useMemo(()=>{
    let eligible=(inventoryData.records||[]).filter(row=>row.period<=period&&branchMatches(row.branch));
    if(branch===ALL_BRANCHES){
      const consolidated=eligible.filter(row=>key(row.branch)===key(ALL_BRANCHES));
      if(consolidated.length)eligible=consolidated;
    }
    const latestByBranch=new Map();eligible.forEach(row=>{const id=key(row.branch);if(!latestByBranch.has(id)||row.period>latestByBranch.get(id))latestByBranch.set(id,row.period);});
    const latest=eligible.filter(row=>row.period===latestByBranch.get(key(row.branch)));
    const grouped=new Map();latest.forEach(row=>{const model=canonicalModel(row.model,catalog);grouped.set(key(model),(grouped.get(key(model))||0)+(Number(row.quantity)||0));});return grouped;
  },[inventoryData,period,branch,brandBranches,catalog]);
  const salesMap=useMemo(()=>{
    const current=new Map(),previous=new Map(),previousPeriod=previousYearPeriod(period);
    (geoData?.sales||[]).forEach(row=>{
      if(!branchMatches(row.sucursal))return;
      const rowPeriod=String(row.fecha||'').slice(0,7);if(rowPeriod!==period&&rowPeriod!==previousPeriod)return;
      const model=canonicalModel(row.modelo,catalog),map=rowPeriod===period?current:previous;map.set(key(model),(map.get(key(model))||0)+1);
    });return {current,previous};
  },[geoData,period,branch,brandBranches,catalog]);
  const rows=useMemo(()=>discoveredModels.map(model=>{
    const manual=draft[key(model)]||{prospects:0,target:0},sales=salesMap.current.get(key(model))||0,prior=salesMap.previous.get(key(model))||0,inventory=inventoryByModel.get(key(model))||0;
    const conversion=manual.prospects>0?sales/manual.prospects*100:NaN,attainment=manual.target>0?sales/manual.target*100:NaN,annual=prior>0?(sales/prior-1)*100:NaN;
    const row={model,prospects:Number(manual.prospects)||0,target:Number(manual.target)||0,sales,prior,inventory,conversion,attainment,annual};return {...row,strategy:strategyFor(row)};
  }).filter(row=>!search||key(row.model).includes(key(search))),[discoveredModels,draft,salesMap,inventoryByModel,search]);
  const summary=useMemo(()=>{
    const total=rows.reduce((acc,row)=>({prospects:acc.prospects+row.prospects,inventory:acc.inventory+row.inventory,sales:acc.sales+row.sales,prior:acc.prior+row.prior,target:acc.target+row.target}),{prospects:0,inventory:0,sales:0,prior:0,target:0});
    return {...total,conversion:total.prospects?total.sales/total.prospects*100:NaN,attainment:total.target?total.sales/total.target*100:NaN};
  },[rows]);
  const update=(model,field,value)=>setDraft(current=>({...current,[key(model)]:{prospects:Number(current[key(model)]?.prospects)||0,target:Number(current[key(model)]?.target)||0,[field]:Math.max(0,Number(value)||0)}}));
  const addModel=()=>{const clean=customModel.trim();if(!clean)return;setExtraModels(current=>current.some(item=>key(item)===key(clean))?current:[...current,clean]);setDraft(current=>({...current,[key(clean)]:current[key(clean)]||{prospects:0,target:0}}));setCustomModel('');};
  const save=async()=>{
    setSaving(true);try{
      const scopeKey=`${period}|${brand}|${key(branch)}`;
      const untouched=(data.records||[]).filter(row=>`${row.period}|${row.brand}|${key(row.branch)}`!==scopeKey);
      const current=discoveredModels.map(model=>({id:marketingRecordId(period,brand,branch,model),period,brand,branch,model,prospects:Number(draft[key(model)]?.prospects)||0,target:Number(draft[key(model)]?.target)||0,updatedAt:new Date().toISOString()}));
      await persistData({records:[...untouched,...current]});showToast?.('Prospectos y metas de Marketing guardados para todos los usuarios.','success');
    }catch(error){showToast?.(error?.message||'No fue posible guardar Marketing.','error');}finally{setSaving(false);}
  };
  const downloadTemplate=async()=>{
    try{
      const XLSX=await import('xlsx');
      const [year,month]=period.split('-');
      const templateRows=discoveredModels.map(model=>({Año:Number(year),Mes:MONTHS[Number(month)-1],Periodo:period,Marca:brand,Sucursal:branch,Unidad:model,Prospectos:Number(draft[key(model)]?.prospects)||0,'Meta ventas':Number(draft[key(model)]?.target)||0}));
      const book=XLSX.utils.book_new();
      const sheet=XLSX.utils.json_to_sheet(templateRows);
      sheet['!cols']=[{wch:10},{wch:15},{wch:12},{wch:12},{wch:24},{wch:28},{wch:14},{wch:16}];
      XLSX.utils.book_append_sheet(book,sheet,'Marketing');
      const instructions=[
        ['PLANTILLA DE ACTUALIZACIÓN DE MARKETING'],
        ['Use una fila por periodo, marca, sucursal y unidad.'],
        ['Sucursal puede ser una sucursal específica o "Todas las sucursales" para un dato consolidado.'],
        ['La importación reemplaza Prospectos y Meta ventas si ya existe la misma combinación; no duplica registros.'],
        ['No modifique los encabezados de la hoja Marketing. Inventario y ventas se toman automáticamente de la plataforma.']
      ];
      const instructionSheet=XLSX.utils.aoa_to_sheet(instructions);instructionSheet['!cols']=[{wch:115}];
      XLSX.utils.book_append_sheet(book,instructionSheet,'Instrucciones');
      const maxRows=Math.max(brandBranches.length+1,discoveredModels.length);
      const catalogRows=Array.from({length:maxRows},(_,index)=>({Sucursales:index===0?ALL_BRANCHES:brandBranches[index-1]?.name||'',Modelos:discoveredModels[index]||''}));
      const catalogSheet=XLSX.utils.json_to_sheet(catalogRows);catalogSheet['!cols']=[{wch:30},{wch:30}];
      XLSX.utils.book_append_sheet(book,catalogSheet,'Catalogos');
      XLSX.writeFile(book,`Plantilla_Marketing_${period}_${brand}.xlsx`);
    }catch(error){showToast?.(error?.message||'No fue posible generar la plantilla.','error');}
  };
  const importTemplate=async event=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    setImporting(true);
    try{
      const XLSX=await import('xlsx');
      const book=XLSX.read(await file.arrayBuffer(),{type:'array',cellDates:true});
      const sheet=book.Sheets.Marketing||book.Sheets[book.SheetNames[0]];
      const source=XLSX.utils.sheet_to_json(sheet,{defval:''});
      const valid=[],errors=[];
      source.forEach((row,index)=>{
        const rowPeriod=parsePeriod(row);
        const rowBrand=key(fieldValue(row,['Marca','Brand']));
        const rawBranch=String(fieldValue(row,['Sucursal','Branch'])||'').trim();
        const rawModel=String(fieldValue(row,['Unidad','Modelo','Model'])||'').trim();
        const allowedBrand=rowBrand==='TORO'||rowBrand==='CHS';
        const branchesForBrand=activeBranches.filter(item=>rowBrand==='CHS'?branchIsChs(item.name,activeBranches):!branchIsChs(item.name,activeBranches));
        const canonicalBranch=key(rawBranch)===key(ALL_BRANCHES)?ALL_BRANCHES:branchesForBrand.find(item=>key(item.name)===key(rawBranch))?.name;
        const modelCatalog=rowBrand==='CHS'?CHS_MODELS:TORO_MODELS;
        const model=canonicalModel(rawModel,modelCatalog);
        if(!rowPeriod||!allowedBrand||!canonicalBranch||!model){errors.push(index+2);return;}
        valid.push({id:marketingRecordId(rowPeriod,rowBrand,canonicalBranch,model),period:rowPeriod,brand:rowBrand,branch:canonicalBranch,model,prospects:cleanNumber(fieldValue(row,['Prospectos','Leads'])),target:cleanNumber(fieldValue(row,['Meta ventas','Meta de ventas','Target'])),updatedAt:new Date().toISOString()});
      });
      if(!valid.length)throw new Error('No se encontraron filas válidas. Revisa periodo, marca, sucursal y unidad.');
      const importedById=new Map(valid.map(row=>[row.id,row]));
      const merged=(data.records||[]).filter(row=>!importedById.has(row.id));
      await persistData({records:[...merged,...importedById.values()]});
      const first=valid[0];setPeriod(first.period);setBrand(first.brand);setBranch(first.branch);
      showToast?.(`${importedById.size} registros de Marketing actualizados${errors.length?`; ${errors.length} filas omitidas`:''}.`,'success');
    }catch(error){showToast?.(error?.message||'No fue posible importar la plantilla de Marketing.','error');}finally{setImporting(false);}
  };
  const priorities=rows.filter(row=>row.strategy.tone==='critical').sort((a,b)=>(b.target-b.sales)-(a.target-a.sales)).slice(0,4);
  const strengths=rows.filter(row=>row.strategy.tone==='good').sort((a,b)=>b.attainment-a.attainment).slice(0,4);

  return <div className="marketing-module"><style>{CSS}</style>
    <section className="marketing-hero"><div><span><Sparkles size={14}/> INTELIGENCIA PARA MARKETING</span><h1>Demanda, inventario y ventas por modelo</h1><p>Convierte disponibilidad, prospectos y ventas históricas en decisiones de campaña.</p></div><div className="marketing-hero-kpi"><small>Periodo analizado</small><strong>{periodLabel(period)}</strong><em>{brand==='CHS'?'Buick · GMC · Cadillac':'Chevrolet Toro'}</em></div></section>
    <section className="marketing-filters"><label><span>Periodo</span><select value={period} onChange={e=>setPeriod(e.target.value)}>{periods.map(value=><option key={value} value={value}>{periodLabel(value)}</option>)}</select></label><label><span>Marca</span><select value={brand} onChange={e=>setBrand(e.target.value)}><option value="TORO">Chevrolet Toro</option><option value="CHS">CHS · Buick, GMC y Cadillac</option></select></label><label><span>Sucursal</span><select value={branch} onChange={e=>setBranch(e.target.value)}><option>{ALL_BRANCHES}</option>{brandBranches.map(item=><option key={item.id||item.name}>{item.name}</option>)}</select></label><label className="marketing-search"><span>Buscar modelo</span><div><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ej. Aveo, Sierra…"/></div></label></section>
    {canCapture&&<section className="marketing-import"><div><span className="eyebrow">ACTUALIZACIÓN MASIVA</span><strong>Plantilla mensual de prospectos y metas</strong><small>Descarga el catálogo vigente, actualízalo y vuelve a importarlo. Las coincidencias se reemplazan automáticamente.</small></div><div className="marketing-import-actions"><button className="secondary" onClick={downloadTemplate}><Download size={15}/> Descargar plantilla</button><button onClick={()=>fileInputRef.current?.click()} disabled={importing}><Upload size={15}/>{importing?'Importando…':'Importar Excel'}</button><input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={importTemplate}/></div></section>}
    <section className="marketing-kpis"><article><Users/><span>Prospectos</span><strong>{summary.prospects.toLocaleString('es-MX')}</strong><small>Captura de Marketing</small></article><article><Boxes/><span>Inventario actual</span><strong>{summary.inventory.toLocaleString('es-MX')}</strong><small>Último corte disponible</small></article><article><Car/><span>Ventas del periodo</span><strong>{summary.sales.toLocaleString('es-MX')}</strong><small>{periodLabel(period)}</small></article><article><TrendingUp/><span>Conversión</span><strong>{pct(summary.conversion)}</strong><small>Ventas ÷ prospectos</small></article><article><Target/><span>Avance de meta</span><strong>{pct(summary.attainment)}</strong><small>{summary.sales} de {summary.target} ventas</small></article></section>
    <section className="marketing-panel"><header><div><span className="eyebrow">MATRIZ DE DECISIÓN</span><h2>Desempeño comercial por unidad</h2><p>Las ventas provienen de Geointeligencia y el inventario del módulo de Inventarios. Prospectos y metas se capturan aquí.</p></div>{canCapture&&<button onClick={save} disabled={saving}><Save size={15}/>{saving?'Guardando…':'Guardar prospectos y metas'}</button>}</header>
      {canCapture&&<div className="marketing-add"><input value={customModel} onChange={e=>setCustomModel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addModel()} placeholder="Agregar otro modelo"/><button onClick={addModel}><Plus size={15}/> Agregar</button>{branch===ALL_BRANCHES&&<small>La captura se guardará como consolidado de todas las sucursales.</small>}</div>}
      <div className="marketing-table"><table><thead><tr><th>Unidad</th><th>Prospectos</th><th>Inventario actual</th><th>Ventas<br/>{periodLabel(period)}</th><th>Conversión</th><th>Ventas<br/>{periodLabel(previousYearPeriod(period))}</th><th>Variación anual</th><th>Meta ventas</th><th>Avance</th><th>Brecha</th><th>Recomendación</th></tr></thead><tbody>{rows.map(row=><tr key={key(row.model)}><td><strong>{row.model}</strong></td><td>{canCapture?<input type="number" min="0" value={draft[key(row.model)]?.prospects??0} onChange={e=>update(row.model,'prospects',e.target.value)}/>:row.prospects}</td><td>{row.inventory}</td><td><b>{row.sales}</b></td><td>{pct(row.conversion)}</td><td>{row.prior}</td><td><span className={`delta ${Number.isFinite(row.annual)?row.annual>=0?'up':'down':'neutral'}`}>{Number.isFinite(row.annual)?`${row.annual>=0?'↑':'↓'} ${Math.abs(row.annual).toFixed(1)}%`:'Sin base'}</span></td><td>{canCapture?<input type="number" min="0" value={draft[key(row.model)]?.target??0} onChange={e=>update(row.model,'target',e.target.value)}/>:row.target}</td><td>{pct(row.attainment,0)}</td><td className={row.target-row.sales>0?'negative':'positive'}>{row.target?`${row.sales-row.target>=0?'+':''}${row.sales-row.target}`:'—'}</td><td><span className={`strategy ${row.strategy.tone}`}>{row.strategy.label}</span><small className="strategy-detail">{row.strategy.detail}</small></td></tr>)}</tbody><tfoot><tr><td>TOTAL</td><td>{summary.prospects}</td><td>{summary.inventory}</td><td>{summary.sales}</td><td>{pct(summary.conversion)}</td><td>{summary.prior}</td><td>{summary.prior?pct((summary.sales/summary.prior-1)*100):'Sin base'}</td><td>{summary.target}</td><td>{pct(summary.attainment,0)}</td><td>{summary.target?summary.sales-summary.target:'—'}</td><td>Lectura consolidada</td></tr></tfoot></table></div>
    </section>
    <section className="marketing-intelligence"><header><Lightbulb/><div><span className="eyebrow">LECTURA ESTRATÉGICA</span><h2>¿Dónde hace falta trabajar?</h2></div></header><div className="marketing-intel-grid"><article className="critical"><h3>Prioridad de campaña</h3>{priorities.length?priorities.map(row=><div key={row.model}><strong>{row.model}</strong><span>{row.strategy.label}</span><small>{row.strategy.detail}</small></div>):<p>No hay modelos en alerta crítica con la información disponible.</p>}</article><article className="good"><h3>Modelos para sostener</h3>{strengths.length?strengths.map(row=><div key={row.model}><strong>{row.model}</strong><span>{pct(row.attainment,0)} de meta</span><small>{row.sales} ventas · {row.inventory} en inventario</small></div>):<p>Aún no hay modelos con meta alcanzada.</p>}</article><article><h3>Regla ejecutiva</h3><p><b>Inventario sin prospectos:</b> activar generación de demanda.</p><p><b>Prospectos sin ventas:</b> corregir conversión, oferta y seguimiento.</p><p><b>Venta sin inventario:</b> revisar reposición o redistribución.</p><p><b>Meta alcanzada:</b> sostener inversión rentable y cuidar disponibilidad.</p></article></div></section>
  </div>;
}

const CSS=`
.marketing-module{display:grid;gap:15px;color:#102b57}.marketing-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:25px 28px;border-radius:20px;color:#fff;background:linear-gradient(120deg,#102b57,#19498f 62%,#2868dc);box-shadow:0 18px 38px rgba(16,43,87,.15)}.marketing-hero>div>span,.eyebrow{display:flex;align-items:center;gap:7px;color:#86b2ff;font-size:10px;font-weight:900;letter-spacing:.12em}.marketing-hero h1{margin:7px 0 5px;font-size:25px}.marketing-hero p{margin:0;color:#dbe8ff;font-size:12px}.marketing-hero-kpi{min-width:210px;padding:15px 18px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.1)}.marketing-hero-kpi small,.marketing-hero-kpi em{display:block;color:#dbe8ff;font-size:10px}.marketing-hero-kpi strong{display:block;margin:5px 0;font-size:20px}.marketing-hero-kpi em{font-style:normal}.marketing-filters{display:grid;grid-template-columns:.7fr 1fr 1fr 1.2fr;gap:10px;padding:13px 15px;border:1px solid #d8e2ef;border-radius:14px;background:#fff}.marketing-filters label{display:grid;gap:5px}.marketing-filters label>span{color:#74859e;font-size:9px;font-weight:900;text-transform:uppercase}.marketing-filters select,.marketing-filters input,.marketing-add input,.marketing-table input{height:38px;border:1px solid #d5dfeb;border-radius:9px;background:#fff;padding:0 10px;color:#102b57;font-weight:700}.marketing-search div{display:flex;align-items:center;gap:7px;height:38px;padding:0 10px;border:1px solid #d5dfeb;border-radius:9px}.marketing-search input{width:100%;height:auto;border:0;padding:0;outline:0}.marketing-import{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 17px;border:1px solid #bfd3fb;border-radius:14px;background:linear-gradient(90deg,#f5f9ff,#eef5ff)}.marketing-import>div:first-child{display:grid;gap:4px}.marketing-import strong{font-size:13px}.marketing-import small{color:#687b96;font-size:9px}.marketing-import-actions{display:flex;gap:8px}.marketing-import button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 14px;border:1px solid #2865df;border-radius:9px;background:#2865df;color:#fff;font-weight:900;cursor:pointer}.marketing-import button.secondary{background:#fff;color:#2458ba}.marketing-import button:disabled{cursor:wait;opacity:.65}.marketing-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.marketing-kpis article{position:relative;padding:15px;border:1px solid #dbe4ef;border-top:3px solid #2865df;border-radius:13px;background:#fff}.marketing-kpis svg{position:absolute;right:13px;top:13px;color:#8aa9df}.marketing-kpis span{display:block;color:#73849d;font-size:9px;font-weight:900;text-transform:uppercase}.marketing-kpis strong{display:block;margin:8px 0 3px;font-size:23px}.marketing-kpis small{color:#8594a9;font-size:9px}.marketing-panel,.marketing-intelligence{overflow:hidden;border:1px solid #d9e3ef;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,39,77,.05)}.marketing-panel>header,.marketing-intelligence>header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 19px;border-bottom:1px solid #dce5f0}.marketing-panel h2,.marketing-intelligence h2{margin:4px 0 0;font-size:17px}.marketing-panel header p{margin:5px 0 0;color:#7889a1;font-size:10px}.marketing-panel header button,.marketing-add button{display:flex;align-items:center;gap:7px;height:38px;border:0;border-radius:9px;background:#2865df;color:#fff;padding:0 14px;font-weight:900;cursor:pointer}.marketing-add{display:flex;align-items:center;gap:8px;padding:10px 18px;background:#f7faff}.marketing-add input{width:260px}.marketing-add small{margin-left:auto;color:#7b8ba0}.marketing-table{overflow:auto;max-height:650px}.marketing-table table{width:100%;min-width:1270px;border-collapse:collapse}.marketing-table th{position:sticky;top:0;z-index:2;padding:10px 9px;background:#edf3fa;color:#61738e;font-size:8px;letter-spacing:.05em;text-align:center;text-transform:uppercase}.marketing-table th:first-child,.marketing-table td:first-child{text-align:left}.marketing-table td{padding:9px;border-top:1px solid #e0e7f0;text-align:center;font-size:11px}.marketing-table tbody tr:hover{background:#f8fbff}.marketing-table input{width:74px;height:32px;text-align:center}.marketing-table tfoot{position:sticky;bottom:0;background:#eaf2ff;font-weight:900}.delta,.strategy{display:inline-flex;justify-content:center;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900}.delta.up,.strategy.good{color:#087443;background:#dcf8e9}.delta.down,.strategy.critical{color:#c42332;background:#fee3e3}.delta.neutral,.strategy.watch{color:#9b6500;background:#fff0c9}.strategy-detail{display:block;max-width:170px;margin:4px auto 0;color:#7b8ba0;font-size:8px}.negative{color:#dc2638;font-weight:900}.positive{color:#079755;font-weight:900}.marketing-intelligence>header{justify-content:flex-start}.marketing-intelligence>header>svg{color:#2865df}.marketing-intel-grid{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:12px;padding:15px}.marketing-intel-grid article{padding:15px;border:1px solid #dce5ef;border-top:3px solid #2865df;border-radius:12px}.marketing-intel-grid article.critical{border-top-color:#ef4444}.marketing-intel-grid article.good{border-top-color:#22c55e}.marketing-intel-grid h3{margin:0 0 10px;font-size:13px}.marketing-intel-grid article>div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 0;border-top:1px solid #e5eaf1}.marketing-intel-grid article>div small{grid-column:1/-1;color:#7889a1}.marketing-intel-grid p{color:#61738d;font-size:10px;line-height:1.5}
@media(max-width:1050px){.marketing-filters{grid-template-columns:repeat(2,1fr)}.marketing-kpis{grid-template-columns:repeat(3,1fr)}.marketing-intel-grid{grid-template-columns:1fr}}
@media(max-width:650px){.marketing-hero{align-items:stretch;flex-direction:column}.marketing-hero-kpi{min-width:0}.marketing-filters,.marketing-kpis{grid-template-columns:1fr}.marketing-import{align-items:stretch;flex-direction:column}.marketing-import-actions{display:grid;grid-template-columns:1fr}.marketing-panel>header{align-items:flex-start;flex-direction:column}.marketing-add{align-items:stretch;flex-direction:column}.marketing-add input{width:100%}.marketing-add small{margin:0}}
`;
