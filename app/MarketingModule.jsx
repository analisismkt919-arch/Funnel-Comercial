'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Boxes, Car, Download, Eye, Lightbulb, Plus, Save, Search, Sparkles, Target, Trash2, TrendingUp, Upload, Users, WalletCards } from 'lucide-react';

const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const ALL_BRANCHES='Todas las sucursales';
const TORO_MODELS=['Aveo','Cheyenne','Groove','S10','Trax','Captiva','Tornado Van','Captiva Híbrida','Onix','Spark EUV','Colorado','Montana','Silverado','Tracker','Suburban','Tahoe','Traverse','Equinox EV','Blazer','Blazer EV','Express Max'];
const CHS_MODELS=['Encore','Lyriq','Optiq','Yukon','Escalade','Acadia','Escalade IQ','Canyon','Sierra','Terrain','Envista','Enclave','Envision','Hummer'];
const COMPETITOR_SEED=[
  {focus:'Aveo / Onix',segment:'Subcompactos',competitors:['Nissan Versa','MG5','Kia K3','Suzuki Dzire']},
  {focus:'Captiva',segment:'SUV compacta',competitors:['Ford Territory','Hyundai Tucson','MG RX9','Kia Sportage / Seltos','Mazda CX-30','Nissan X-Trail']},
  {focus:'Trax / Groove / Tracker',segment:'SUV subcompacta',competitors:['Renault Koleos','Nissan Kicks','Kia Seltos','Volkswagen Tiguan','Renault Kardian','Hyundai Creta']},
  {focus:'Blazer / Traverse',segment:'SUV mediana',competitors:['Jetour T2 i-DM','Mitsubishi Outlander','JAC 8']},
  {focus:'Tornado Van',segment:'Van comercial',competitors:['Renault Kangoo','Peugeot Partner Maxi']},
  {focus:'S10 / Colorado',segment:'Pick-up mediana',competitors:['RAM 1200','Nissan Frontier','JAC Frison T5','Mitsubishi L200']},
  {focus:'Silverado / Cheyenne',segment:'Pick-up grande',competitors:['RAM 1500','Ford Lobo Platinum','Ford Maverick','Ford F-150']}
].flatMap((group,index)=>group.competitors.map((competitor,position)=>({id:`ppt-${index}-${position}`,focus:group.focus,segment:group.segment,competitor,ourOffer:'',competitorOffer:'',notes:'',updatedAt:''})));
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
const resultCampaignName=row=>String(row?.linkedCampaign||row?.campaignName||row?.campaign||row?.rawName||'').trim();
const campaignKey=value=>key(value).replace(/\b(19|20)\d{2}\b/g,'').replace(/\b(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g,'').trim();
const campaignMatches=(left,right)=>{const a=campaignKey(left),b=campaignKey(right);return Boolean(a&&b&&(a===b||a.includes(b)||b.includes(a)));};
const closureItems=record=>(record?.apvs||[]).flatMap(apv=>['Propios'].flatMap(source=>(apv?.[`closureLinks${source}`]||[]).map(link=>({campaign:link?.campaign||'',unit:link?.purchasedUnit||'',quantity:Math.max(1,Number(link?.quantity)||1),branch:apv?.branch||apv?.sucursal||'',manager:apv?.manager||apv?.gerente||'',apv:apv?.apv||apv?.asesor||''}))));
const strategyFor=row=>{
  if(row.target<=0&&row.inventory>0)return {tone:'watch',label:'Definir meta',detail:'Hay inventario disponible sin objetivo comercial.'};
  if(row.inventory<=0&&row.target>row.sales)return {tone:'critical',label:'Reponer inventario',detail:'La meta supera la disponibilidad actual.'};
  if(row.prospects<=0&&row.inventory>0)return {tone:'critical',label:'Generar demanda',detail:'Existe inventario, pero no hay prospectos registrados.'};
  if(row.prospects>0&&row.conversion<10)return {tone:'critical',label:'Mejorar conversión',detail:'La demanda existe; hay que revisar calidad y seguimiento.'};
  if(row.target>0&&row.sales>=row.target)return {tone:'good',label:'Sostener',detail:'La meta está alcanzada; protege inventario y rentabilidad.'};
  if(row.target>0&&row.inventory>row.target*1.5&&row.attainment<50)return {tone:'watch',label:'Acelerar salida',detail:'Inventario alto frente al avance de ventas.'};
  return {tone:'watch',label:'Impulsar cierre',detail:'Activa campaña, seguimiento y oferta sobre este modelo.'};
};

export default function MarketingModule({data={records:[]},persistData,inventoryData={records:[]},geoData={sales:[]},bdcRecords=[],branchCatalog=[],selectedMonth,canCapture=false,showToast}){
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
  const [activeTab,setActiveTab]=useState('planning');
  const [competitors,setCompetitors]=useState(()=>Array.isArray(data?.competitors)&&data.competitors.length?data.competitors:COMPETITOR_SEED);
  const [newCompetitor,setNewCompetitor]=useState({focus:'',segment:'',competitor:''});
  const fileInputRef=useRef(null);
  useEffect(()=>{if(selectedMonth&&!period)setPeriod(selectedMonth);},[selectedMonth,period]);
  useEffect(()=>{setCompetitors(Array.isArray(data?.competitors)&&data.competitors.length?data.competitors:COMPETITOR_SEED);},[data?.competitors]);
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
      await persistData({...data,records:[...untouched,...current]});showToast?.('Prospectos y metas de Marketing guardados para todos los usuarios.','success');
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
      await persistData({...data,records:[...merged,...importedById.values()]});
      const first=valid[0];setPeriod(first.period);setBrand(first.brand);setBranch(first.branch);
      showToast?.(`${importedById.size} registros de Marketing actualizados${errors.length?`; ${errors.length} filas omitidas`:''}.`,'success');
    }catch(error){showToast?.(error?.message||'No fue posible importar la plantilla de Marketing.','error');}finally{setImporting(false);}
  };
  const priorities=rows.filter(row=>row.strategy.tone==='critical').sort((a,b)=>(b.target-b.sales)-(a.target-a.sales)).slice(0,4);
  const strengths=rows.filter(row=>row.strategy.tone==='good').sort((a,b)=>b.attainment-a.attainment).slice(0,4);

  const campaignAnalysis=useMemo(()=>{
    const selected=(bdcRecords||[]).filter(record=>record?.period===period);
    const branchAllowed=value=>branch===ALL_BRANCHES||key(value)===key(branch);
    const configured=selected.flatMap(record=>(record?.campaigns||[]).filter(item=>key(item?.source||item?.origin)==='PROPIOS'&&key(item?.brand||'TORO')===brand&&branchAllowed(item?.branch)).map(item=>({name:item?.campaign||'',branch:item?.branch||'',assigned:Number(item?.quantity)||0,budget:(Number(item?.budgetInitial)||0)+(Number(item?.budgetAdditional)||0)})));
    const results=selected.flatMap(record=>(record?.campaignResults||[]).filter(item=>key(item?.origin||item?.source)==='PROPIOS'&&key(item?.brand||'TORO')===brand&&((item?.branches||[]).length===0||branch===ALL_BRANCHES||(item.branches||[]).some(branchAllowed))));
    const closures=selected.flatMap(closureItems).filter(item=>branchAllowed(item.branch));
    const names=[...new Map([...configured.map(item=>item.name),...results.map(resultCampaignName),...closures.map(item=>item.campaign)].filter(Boolean).map(name=>[campaignKey(name),name])).values()];
    return names.map(name=>{
      const cfg=configured.filter(item=>campaignMatches(item.name,name));
      const meta=results.filter(item=>campaignMatches(resultCampaignName(item),name));
      const closed=closures.filter(item=>campaignMatches(item.campaign,name));
      const leads=meta.filter(item=>key(item?.resultType||item?.resultIndicator).includes('LEAD')&&!key(item?.resultType||item?.resultIndicator).includes('CONVERS')).reduce((sum,item)=>sum+(Number(item?.results)||0),0);
      const conversations=meta.filter(item=>key(item?.resultType||item?.resultIndicator).includes('CONVERS')||key(item?.resultType||item?.resultIndicator).includes('MENSAJ')).reduce((sum,item)=>sum+(Number(item?.results)||0),0);
      const assigned=cfg.reduce((sum,item)=>sum+item.assigned,0);
      const demand=leads+conversations||assigned;
      const spend=meta.reduce((sum,item)=>sum+(Number(item?.spend)||0),0);
      const impressions=meta.reduce((sum,item)=>sum+(Number(item?.impressions)||0),0);
      const clicks=meta.reduce((sum,item)=>sum+(Number(item?.clicks)||0),0);
      const closureCount=closed.reduce((sum,item)=>sum+item.quantity,0);
      const model=catalog.find(item=>key(name).includes(key(item)))||'';
      const modelRow=rows.find(item=>key(item.model)===key(model));
      const conversion=demand?closureCount/demand*100:NaN;
      let status='Completar datos',tone='neutral',action='Captura inversión y resultados para evaluar rentabilidad.';
      if(spend>0&&demand===0){status='Revisar inversión';tone='critical';action='Hay gasto sin demanda atribuida; valida configuración, formulario y medición.';}
      else if(demand>0&&closureCount===0){status='Optimizar';tone='watch';action='La campaña genera interés pero aún no cierres; revisa calidad, oferta y seguimiento BDC.';}
      else if(closureCount>0&&conversion>=2){status='Escalar';tone='good';action='Conserva la campaña y aumenta inversión gradualmente sin perder costo por cierre.';}
      else if(closureCount>0){status='Sostener y probar';tone='watch';action='Ya convierte; prueba creativos y audiencias antes de ampliar presupuesto.';}
      if(modelRow?.inventory>0&&demand===0){status='Activar demanda';tone='critical';action=`${modelRow.inventory} unidades en inventario sin demanda atribuida a esta campaña.`;}
      return {name,model:model||'Sin unidad identificada',assigned,budget:cfg.reduce((sum,item)=>sum+item.budget,0),leads,conversations,demand,spend,impressions,clicks,closures:closureCount,units:[...new Set(closed.map(item=>item.unit).filter(Boolean))],cpl:demand?spend/demand:NaN,costPerClose:closureCount?spend/closureCount:NaN,conversion,status,tone,action,inventory:modelRow?.inventory||0,sales:modelRow?.sales||0,target:modelRow?.target||0};
    }).sort((a,b)=>b.spend-a.spend||b.demand-a.demand);
  },[bdcRecords,period,branch,brand,catalog,rows]);
  const campaignSummary=useMemo(()=>campaignAnalysis.reduce((acc,row)=>({campaigns:acc.campaigns+1,demand:acc.demand+row.demand,spend:acc.spend+row.spend,closures:acc.closures+row.closures,impressions:acc.impressions+row.impressions}),{campaigns:0,demand:0,spend:0,closures:0,impressions:0}),[campaignAnalysis]);
  const campaignPriorities=useMemo(()=>campaignAnalysis.filter(row=>row.tone!=='good').slice(0,4),[campaignAnalysis]);
  const saveCompetitors=async()=>{
    setSaving(true);try{const stamped=competitors.map(row=>({...row,updatedAt:new Date().toISOString()}));await persistData({...data,competitors:stamped});showToast?.('Matriz competitiva guardada para todos los usuarios.','success');}catch(error){showToast?.(error?.message||'No fue posible guardar la matriz competitiva.','error');}finally{setSaving(false);}
  };
  const updateCompetitor=(id,field,value)=>setCompetitors(current=>current.map(row=>row.id===id?{...row,[field]:value}:row));
  const addCompetitor=()=>{if(!newCompetitor.focus.trim()||!newCompetitor.competitor.trim())return;setCompetitors(current=>[...current,{id:`competitor-${Date.now()}`,...newCompetitor,ourOffer:'',competitorOffer:'',notes:'',updatedAt:''}]);setNewCompetitor({focus:'',segment:'',competitor:''});};
  const competitorGroups=useMemo(()=>[...new Map(competitors.map(row=>[key(row.focus),row.focus])).values()].map(focus=>({focus,rows:competitors.filter(row=>key(row.focus)===key(focus))})),[competitors]);

  return <div className="marketing-module"><style>{CSS}</style>
    <section className="marketing-hero"><div><span><Sparkles size={14}/> INTELIGENCIA PARA MARKETING</span><h1>Demanda, inventario y ventas por modelo</h1><p>Convierte disponibilidad, prospectos y ventas históricas en decisiones de campaña.</p></div><div className="marketing-hero-kpi"><small>Periodo analizado</small><strong>{periodLabel(period)}</strong><em>{brand==='CHS'?'Buick · GMC · Cadillac':'Chevrolet Toro'}</em></div></section>
    <nav className="marketing-tabs"><button className={activeTab==='planning'?'active':''} onClick={()=>setActiveTab('planning')}><Target size={15}/> Planeación por modelo</button><button className={activeTab==='campaigns'?'active':''} onClick={()=>setActiveTab('campaigns')}><BarChart3 size={15}/> Campañas propias</button><button className={activeTab==='competition'?'active':''} onClick={()=>setActiveTab('competition')}><Eye size={15}/> Competencia</button></nav>
    <section className="marketing-filters"><label><span>Periodo</span><select value={period} onChange={e=>setPeriod(e.target.value)}>{periods.map(value=><option key={value} value={value}>{periodLabel(value)}</option>)}</select></label><label><span>Marca</span><select value={brand} onChange={e=>setBrand(e.target.value)}><option value="TORO">Chevrolet Toro</option><option value="CHS">CHS · Buick, GMC y Cadillac</option></select></label><label><span>Sucursal</span><select value={branch} onChange={e=>setBranch(e.target.value)}><option>{ALL_BRANCHES}</option>{brandBranches.map(item=><option key={item.id||item.name}>{item.name}</option>)}</select></label><label className="marketing-search"><span>Buscar modelo</span><div><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Ej. Aveo, Sierra…"/></div></label></section>
    {activeTab==='planning'&&<>
    {canCapture&&<section className="marketing-import"><div><span className="eyebrow">ACTUALIZACIÓN MASIVA</span><strong>Plantilla mensual de prospectos y metas</strong><small>Descarga el catálogo vigente, actualízalo y vuelve a importarlo. Las coincidencias se reemplazan automáticamente.</small></div><div className="marketing-import-actions"><button className="secondary" onClick={downloadTemplate}><Download size={15}/> Descargar plantilla</button><button onClick={()=>fileInputRef.current?.click()} disabled={importing}><Upload size={15}/>{importing?'Importando…':'Importar Excel'}</button><input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls" onChange={importTemplate}/></div></section>}
    <section className="marketing-kpis"><article><Users/><span>Prospectos</span><strong>{summary.prospects.toLocaleString('es-MX')}</strong><small>Captura de Marketing</small></article><article><Boxes/><span>Inventario actual</span><strong>{summary.inventory.toLocaleString('es-MX')}</strong><small>Último corte disponible</small></article><article><Car/><span>Ventas del periodo</span><strong>{summary.sales.toLocaleString('es-MX')}</strong><small>{periodLabel(period)}</small></article><article><TrendingUp/><span>Conversión</span><strong>{pct(summary.conversion)}</strong><small>Ventas ÷ prospectos</small></article><article><Target/><span>Avance de meta</span><strong>{pct(summary.attainment)}</strong><small>{summary.sales} de {summary.target} ventas</small></article></section>
    <section className="marketing-panel"><header><div><span className="eyebrow">MATRIZ DE DECISIÓN</span><h2>Desempeño comercial por unidad</h2><p>Las ventas provienen de Geointeligencia y el inventario del módulo de Inventarios. Prospectos y metas se capturan aquí.</p></div>{canCapture&&<button onClick={save} disabled={saving}><Save size={15}/>{saving?'Guardando…':'Guardar prospectos y metas'}</button>}</header>
      {canCapture&&<div className="marketing-add"><input value={customModel} onChange={e=>setCustomModel(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addModel()} placeholder="Agregar otro modelo"/><button onClick={addModel}><Plus size={15}/> Agregar</button>{branch===ALL_BRANCHES&&<small>La captura se guardará como consolidado de todas las sucursales.</small>}</div>}
      <div className="marketing-table"><table><thead><tr><th>Unidad</th><th>Prospectos</th><th>Inventario actual</th><th>Ventas<br/>{periodLabel(period)}</th><th>Conversión</th><th>Ventas<br/>{periodLabel(previousYearPeriod(period))}</th><th>Variación anual</th><th>Meta ventas</th><th>Avance</th><th>Brecha</th><th>Recomendación</th></tr></thead><tbody>{rows.map(row=><tr key={key(row.model)}><td><strong>{row.model}</strong></td><td>{canCapture?<input type="number" min="0" value={draft[key(row.model)]?.prospects??0} onChange={e=>update(row.model,'prospects',e.target.value)}/>:row.prospects}</td><td>{row.inventory}</td><td><b>{row.sales}</b></td><td>{pct(row.conversion)}</td><td>{row.prior}</td><td><span className={`delta ${Number.isFinite(row.annual)?row.annual>=0?'up':'down':'neutral'}`}>{Number.isFinite(row.annual)?`${row.annual>=0?'↑':'↓'} ${Math.abs(row.annual).toFixed(1)}%`:'Sin base'}</span></td><td>{canCapture?<input type="number" min="0" value={draft[key(row.model)]?.target??0} onChange={e=>update(row.model,'target',e.target.value)}/>:row.target}</td><td>{pct(row.attainment,0)}</td><td className={row.target-row.sales>0?'negative':'positive'}>{row.target?`${row.sales-row.target>=0?'+':''}${row.sales-row.target}`:'—'}</td><td><span className={`strategy ${row.strategy.tone}`}>{row.strategy.label}</span><small className="strategy-detail">{row.strategy.detail}</small></td></tr>)}</tbody><tfoot><tr><td>TOTAL</td><td>{summary.prospects}</td><td>{summary.inventory}</td><td>{summary.sales}</td><td>{pct(summary.conversion)}</td><td>{summary.prior}</td><td>{summary.prior?pct((summary.sales/summary.prior-1)*100):'Sin base'}</td><td>{summary.target}</td><td>{pct(summary.attainment,0)}</td><td>{summary.target?summary.sales-summary.target:'—'}</td><td>Lectura consolidada</td></tr></tfoot></table></div>
    </section>
    <section className="marketing-intelligence"><header><Lightbulb/><div><span className="eyebrow">LECTURA ESTRATÉGICA</span><h2>¿Dónde hace falta trabajar?</h2></div></header><div className="marketing-intel-grid"><article className="critical"><h3>Prioridad de campaña</h3>{priorities.length?priorities.map(row=><div key={row.model}><strong>{row.model}</strong><span>{row.strategy.label}</span><small>{row.strategy.detail}</small></div>):<p>No hay modelos en alerta crítica con la información disponible.</p>}</article><article className="good"><h3>Modelos para sostener</h3>{strengths.length?strengths.map(row=><div key={row.model}><strong>{row.model}</strong><span>{pct(row.attainment,0)} de meta</span><small>{row.sales} ventas · {row.inventory} en inventario</small></div>):<p>Aún no hay modelos con meta alcanzada.</p>}</article><article><h3>Regla ejecutiva</h3><p><b>Inventario sin prospectos:</b> activar generación de demanda.</p><p><b>Prospectos sin ventas:</b> corregir conversión, oferta y seguimiento.</p><p><b>Venta sin inventario:</b> revisar reposición o redistribución.</p><p><b>Meta alcanzada:</b> sostener inversión rentable y cuidar disponibilidad.</p></article></div></section>
    </>}
    {activeTab==='campaigns'&&<section className="marketing-campaigns">
      <header className="section-title"><div><span className="eyebrow">INTELIGENCIA DE INVERSIÓN · BDC</span><h2>Rentabilidad de campañas propias</h2><p>Relaciona Meta Ads, campañas creadas, cierres trazados, inventario y ventas del modelo. Los datos se leen directamente de BDC y no se duplican.</p></div><span className="scope-chip">{periodLabel(period)} · {branch}</span></header>
      <div className="campaign-kpis"><article><BarChart3/><small>Campañas evaluadas</small><strong>{campaignSummary.campaigns}</strong></article><article><Users/><small>Leads y conversaciones</small><strong>{campaignSummary.demand.toLocaleString('es-MX')}</strong></article><article><WalletCards/><small>Inversión real</small><strong>{campaignSummary.spend.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0})}</strong></article><article><Car/><small>Cierres atribuidos</small><strong>{campaignSummary.closures}</strong></article><article><Target/><small>Conversión a cierre</small><strong>{pct(campaignSummary.demand?campaignSummary.closures/campaignSummary.demand*100:NaN)}</strong></article></div>
      <div className="campaign-layout"><div className="campaign-table"><table><thead><tr><th>Campaña</th><th>Unidad de enfoque</th><th>Demanda</th><th>Inversión</th><th>CPL</th><th>Cierres</th><th>Costo por cierre</th><th>Conversión</th><th>Decisión</th></tr></thead><tbody>{campaignAnalysis.length?campaignAnalysis.map(row=><tr key={campaignKey(row.name)}><td><strong>{row.name}</strong><small>{row.leads} formularios · {row.conversations} conversaciones</small></td><td><b>{row.model}</b><small>{row.inventory} inventario · {row.sales}/{row.target||'—'} ventas/meta</small></td><td>{row.demand}</td><td>{row.spend.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0})}</td><td>{Number.isFinite(row.cpl)?row.cpl.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}):'—'}</td><td><b>{row.closures}</b>{row.units.length>0&&<small>Compraron: {row.units.join(', ')}</small>}</td><td>{Number.isFinite(row.costPerClose)?row.costPerClose.toLocaleString('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}):'—'}</td><td>{pct(row.conversion)}</td><td><span className={`strategy ${row.tone}`}>{row.status}</span><small>{row.action}</small></td></tr>):<tr><td colSpan="9" className="empty-state">No hay campañas propias vinculadas a {periodLabel(period)} con estos filtros.</td></tr>}</tbody></table></div>
      <aside className="investment-panel"><span className="eyebrow">RECOMENDACIÓN DE PRESUPUESTO</span><h3>¿Dónde invertir primero?</h3>{campaignPriorities.length?campaignPriorities.map((row,index)=><article key={row.name}><i>{index+1}</i><div><strong>{row.name}</strong><small>{row.action}</small><em>{row.model} · {row.demand} contactos · {row.closures} cierres</em></div></article>):<p>No hay alertas de inversión. Las campañas con datos suficientes muestran desempeño sano.</p>}<div className="investment-rule"><b>Orden sugerido</b><span>1. Escalar campañas que ya cierran.</span><span>2. Corregir seguimiento donde hay demanda sin ventas.</span><span>3. Activar modelos con inventario pero sin prospectos.</span><span>4. Pausar gasto sin resultados atribuibles.</span></div></aside></div>
    </section>}
    {activeTab==='competition'&&<section className="marketing-competition">
      <header className="section-title"><div><span className="eyebrow">VIGILANCIA COMPETITIVA</span><h2>Unidades de enfoque y competencia primaria</h2><p>Matriz construida a partir del PowerPoint compartido. Registra la oferta propia, la oferta rival y el aprendizaje para la siguiente campaña.</p></div>{canCapture&&<button onClick={saveCompetitors} disabled={saving}><Save size={15}/>{saving?'Guardando…':'Guardar análisis'}</button>}</header>
      <div className="competition-summary"><article><strong>{competitorGroups.length}</strong><span>grupos de enfoque</span></article><article><strong>{competitors.length}</strong><span>competidores primarios</span></article><article><strong>{competitors.filter(row=>row.competitorOffer).length}</strong><span>ofertas rivales documentadas</span></article><article><strong>{competitors.filter(row=>row.ourOffer).length}</strong><span>ofertas propias documentadas</span></article></div>
      {canCapture&&<div className="competitor-add"><input placeholder="Unidad de enfoque" value={newCompetitor.focus} onChange={e=>setNewCompetitor(current=>({...current,focus:e.target.value}))}/><input placeholder="Segmento" value={newCompetitor.segment} onChange={e=>setNewCompetitor(current=>({...current,segment:e.target.value}))}/><input placeholder="Competidor primario" value={newCompetitor.competitor} onChange={e=>setNewCompetitor(current=>({...current,competitor:e.target.value}))}/><button onClick={addCompetitor}><Plus size={15}/> Agregar relación</button></div>}
      <div className="competition-groups">{competitorGroups.map(group=><article className="competition-group" key={group.focus}><header><div><span>UNIDAD DE ENFOQUE</span><h3>{group.focus}</h3><small>{group.rows[0]?.segment||'Segmento por definir'} · {group.rows.length} competidores</small></div><Car/></header><div className="competition-grid">{group.rows.map(row=><div className="competitor-card" key={row.id}><div className="competitor-name"><div><small>Competencia primaria</small><strong>{row.competitor}</strong></div>{canCapture&&<button title="Eliminar relación" onClick={()=>setCompetitors(current=>current.filter(item=>item.id!==row.id))}><Trash2 size={14}/></button>}</div><label><span>Nuestra oferta / mensaje</span>{canCapture?<textarea value={row.ourOffer||''} onChange={e=>updateCompetitor(row.id,'ourOffer',e.target.value)} placeholder="Precio, bono, mensualidad, diferenciador…"/>:<p>{row.ourOffer||'Sin captura'}</p>}</label><label><span>Oferta observada del competidor</span>{canCapture?<textarea value={row.competitorOffer||''} onChange={e=>updateCompetitor(row.id,'competitorOffer',e.target.value)} placeholder="Promoción, precio, tasa, vigencia…"/>:<p>{row.competitorOffer||'Sin captura'}</p>}</label><label><span>Aprendizaje y respuesta recomendada</span>{canCapture?<textarea value={row.notes||''} onChange={e=>updateCompetitor(row.id,'notes',e.target.value)} placeholder="Cómo complementar la estrategia…"/>:<p>{row.notes||'Sin captura'}</p>}</label></div>)}</div></article>)}</div>
      <div className="competition-guide"><Lightbulb/><div><strong>Cómo usar esta información</strong><p>Contrasta la oferta rival con el desempeño de campañas propias: si una unidad tiene inventario, baja demanda y un competidor con oferta agresiva, ajusta el mensaje y prueba presupuesto; si la campaña ya genera cierres, protege el diferenciador y escala de forma controlada.</p></div></div>
    </section>}
  </div>;
}

const CSS=`
.marketing-module{display:grid;gap:15px;color:#102b57}.marketing-hero{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:25px 28px;border-radius:20px;color:#fff;background:linear-gradient(120deg,#102b57,#19498f 62%,#2868dc);box-shadow:0 18px 38px rgba(16,43,87,.15)}.marketing-hero>div>span,.eyebrow{display:flex;align-items:center;gap:7px;color:#86b2ff;font-size:10px;font-weight:900;letter-spacing:.12em}.marketing-hero h1{margin:7px 0 5px;font-size:25px}.marketing-hero p{margin:0;color:#dbe8ff;font-size:12px}.marketing-hero-kpi{min-width:210px;padding:15px 18px;border:1px solid rgba(255,255,255,.2);border-radius:14px;background:rgba(255,255,255,.1)}.marketing-hero-kpi small,.marketing-hero-kpi em{display:block;color:#dbe8ff;font-size:10px}.marketing-hero-kpi strong{display:block;margin:5px 0;font-size:20px}.marketing-hero-kpi em{font-style:normal}.marketing-tabs{display:flex;gap:5px;width:max-content;padding:5px;border-radius:12px;background:#e8eef7}.marketing-tabs button{display:flex;align-items:center;gap:7px;padding:9px 13px;border:0;border-radius:8px;background:transparent;color:#61738c;font-weight:900;cursor:pointer}.marketing-tabs button.active{background:#fff;color:#1454c5;box-shadow:0 3px 10px rgba(19,52,100,.12)}.marketing-filters{display:grid;grid-template-columns:.7fr 1fr 1fr 1.2fr;gap:10px;padding:13px 15px;border:1px solid #d8e2ef;border-radius:14px;background:#fff}.marketing-filters label{display:grid;gap:5px}.marketing-filters label>span{color:#74859e;font-size:9px;font-weight:900;text-transform:uppercase}.marketing-filters select,.marketing-filters input,.marketing-add input,.marketing-table input{height:38px;border:1px solid #d5dfeb;border-radius:9px;background:#fff;padding:0 10px;color:#102b57;font-weight:700}.marketing-search div{display:flex;align-items:center;gap:7px;height:38px;padding:0 10px;border:1px solid #d5dfeb;border-radius:9px}.marketing-search input{width:100%;height:auto;border:0;padding:0;outline:0}.marketing-import{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 17px;border:1px solid #bfd3fb;border-radius:14px;background:linear-gradient(90deg,#f5f9ff,#eef5ff)}.marketing-import>div:first-child{display:grid;gap:4px}.marketing-import strong{font-size:13px}.marketing-import small{color:#687b96;font-size:9px}.marketing-import-actions{display:flex;gap:8px}.marketing-import button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:38px;padding:0 14px;border:1px solid #2865df;border-radius:9px;background:#2865df;color:#fff;font-weight:900;cursor:pointer}.marketing-import button.secondary{background:#fff;color:#2458ba}.marketing-import button:disabled{cursor:wait;opacity:.65}.marketing-kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.marketing-kpis article{position:relative;padding:15px;border:1px solid #dbe4ef;border-top:3px solid #2865df;border-radius:13px;background:#fff}.marketing-kpis svg{position:absolute;right:13px;top:13px;color:#8aa9df}.marketing-kpis span{display:block;color:#73849d;font-size:9px;font-weight:900;text-transform:uppercase}.marketing-kpis strong{display:block;margin:8px 0 3px;font-size:23px}.marketing-kpis small{color:#8594a9;font-size:9px}.marketing-panel,.marketing-intelligence{overflow:hidden;border:1px solid #d9e3ef;border-radius:16px;background:#fff;box-shadow:0 10px 28px rgba(15,39,77,.05)}.marketing-panel>header,.marketing-intelligence>header{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:17px 19px;border-bottom:1px solid #dce5f0}.marketing-panel h2,.marketing-intelligence h2{margin:4px 0 0;font-size:17px}.marketing-panel header p{margin:5px 0 0;color:#7889a1;font-size:10px}.marketing-panel header button,.marketing-add button{display:flex;align-items:center;gap:7px;height:38px;border:0;border-radius:9px;background:#2865df;color:#fff;padding:0 14px;font-weight:900;cursor:pointer}.marketing-add{display:flex;align-items:center;gap:8px;padding:10px 18px;background:#f7faff}.marketing-add input{width:260px}.marketing-add small{margin-left:auto;color:#7b8ba0}.marketing-table{overflow:auto;max-height:650px}.marketing-table table{width:100%;min-width:1270px;border-collapse:collapse}.marketing-table th{position:sticky;top:0;z-index:2;padding:10px 9px;background:#edf3fa;color:#61738e;font-size:8px;letter-spacing:.05em;text-align:center;text-transform:uppercase}.marketing-table th:first-child,.marketing-table td:first-child{text-align:left}.marketing-table td{padding:9px;border-top:1px solid #e0e7f0;text-align:center;font-size:11px}.marketing-table tbody tr:hover{background:#f8fbff}.marketing-table input{width:74px;height:32px;text-align:center}.marketing-table tfoot{position:sticky;bottom:0;background:#eaf2ff;font-weight:900}.delta,.strategy{display:inline-flex;justify-content:center;padding:4px 7px;border-radius:999px;font-size:8px;font-weight:900}.delta.up,.strategy.good{color:#087443;background:#dcf8e9}.delta.down,.strategy.critical{color:#c42332;background:#fee3e3}.delta.neutral,.strategy.neutral{color:#68778d;background:#edf2f7}.strategy.watch{color:#9b6500;background:#fff0c9}.strategy-detail{display:block;max-width:170px;margin:4px auto 0;color:#7b8ba0;font-size:8px}.negative{color:#dc2638;font-weight:900}.positive{color:#079755;font-weight:900}.marketing-intelligence>header{justify-content:flex-start}.marketing-intelligence>header>svg{color:#2865df}.marketing-intel-grid{display:grid;grid-template-columns:1fr 1fr 1.15fr;gap:12px;padding:15px}.marketing-intel-grid article{padding:15px;border:1px solid #dce5ef;border-top:3px solid #2865df;border-radius:12px}.marketing-intel-grid article.critical{border-top-color:#ef4444}.marketing-intel-grid article.good{border-top-color:#22c55e}.marketing-intel-grid h3{margin:0 0 10px;font-size:13px}.marketing-intel-grid article>div{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:8px 0;border-top:1px solid #e5eaf1}.marketing-intel-grid article>div small{grid-column:1/-1;color:#7889a1}.marketing-intel-grid p{color:#61738d;font-size:10px;line-height:1.5}.marketing-campaigns,.marketing-competition{display:grid;gap:14px}.section-title{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding:19px 21px;border:1px solid #d9e3ef;border-radius:15px;background:#fff}.section-title h2{margin:5px 0;font-size:19px}.section-title p{max-width:860px;margin:0;color:#6d7f98;font-size:10px;line-height:1.5}.section-title>button,.competitor-add button{display:flex;align-items:center;gap:7px;min-height:38px;padding:0 14px;border:0;border-radius:9px;background:#2865df;color:#fff;font-weight:900;cursor:pointer}.scope-chip{padding:7px 10px;border-radius:999px;background:#eaf2ff;color:#285ebc;font-size:9px;font-weight:900}.campaign-kpis,.competition-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.campaign-kpis article,.competition-summary article{position:relative;padding:14px 15px;border:1px solid #dbe4ef;border-radius:12px;background:#fff}.campaign-kpis svg{position:absolute;right:12px;top:12px;color:#8aa9df}.campaign-kpis small,.competition-summary span{display:block;color:#73849d;font-size:9px;font-weight:900;text-transform:uppercase}.campaign-kpis strong,.competition-summary strong{display:block;margin-top:7px;font-size:21px}.campaign-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:13px}.campaign-table{overflow:auto;max-height:650px;border:1px solid #dce5ef;border-radius:14px;background:#fff}.campaign-table table{width:100%;min-width:1120px;border-collapse:collapse}.campaign-table th{position:sticky;top:0;padding:10px 8px;background:#edf3fa;color:#667993;font-size:8px;text-align:center;text-transform:uppercase}.campaign-table td{padding:10px 8px;border-top:1px solid #e0e7f0;text-align:center;font-size:10px}.campaign-table td:first-child,.campaign-table td:nth-child(2),.campaign-table td:last-child{text-align:left}.campaign-table td small{display:block;max-width:210px;margin-top:4px;color:#7789a1;font-size:8px;line-height:1.4}.empty-state{padding:35px!important;text-align:center!important;color:#8291a7}.investment-panel{padding:17px;border:1px solid #cbdcf8;border-radius:14px;background:linear-gradient(150deg,#f8fbff,#edf4ff)}.investment-panel h3{margin:6px 0 12px;font-size:16px}.investment-panel>article{display:flex;gap:10px;padding:11px 0;border-top:1px solid #d7e3f3}.investment-panel i{display:grid;place-items:center;flex:0 0 25px;height:25px;border-radius:8px;background:#2865df;color:#fff;font-style:normal;font-weight:900}.investment-panel article div{display:grid;gap:3px}.investment-panel small,.investment-panel em{color:#687b94;font-size:8px;line-height:1.4}.investment-panel em{font-style:normal;font-weight:800}.investment-rule{display:grid;gap:5px;margin-top:12px;padding:12px;border-radius:10px;background:#fff;font-size:9px}.investment-rule b{margin-bottom:3px}.competition-summary{grid-template-columns:repeat(4,1fr)}.competitor-add{display:grid;grid-template-columns:1fr 1fr 1.3fr auto;gap:8px;padding:12px;border:1px solid #d7e2ef;border-radius:13px;background:#fff}.competitor-add input{min-width:0;height:38px;padding:0 10px;border:1px solid #d4deeb;border-radius:8px}.competition-groups{display:grid;gap:13px}.competition-group{overflow:hidden;border:1px solid #d9e3ef;border-radius:15px;background:#fff}.competition-group>header{display:flex;align-items:center;justify-content:space-between;padding:14px 17px;background:linear-gradient(90deg,#eef5ff,#f8fbff)}.competition-group header span{color:#7e91ae;font-size:8px;font-weight:900;letter-spacing:.1em}.competition-group h3{margin:3px 0;font-size:16px}.competition-group header small{color:#647791}.competition-group header svg{color:#2865df}.competition-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:12px}.competitor-card{display:grid;gap:9px;padding:13px;border:1px solid #dce5ef;border-radius:11px}.competitor-name{display:flex;align-items:center;justify-content:space-between}.competitor-name small,.competitor-card label>span{display:block;color:#7a8da8;font-size:8px;font-weight:900;text-transform:uppercase}.competitor-name strong{display:block;margin-top:3px;font-size:13px}.competitor-name button{display:grid;place-items:center;width:30px;height:30px;border:1px solid #f2c9cf;border-radius:8px;background:#fff;color:#dc3345;cursor:pointer}.competitor-card label{display:grid;gap:4px}.competitor-card textarea{min-height:55px;resize:vertical;padding:8px;border:1px solid #d6e0ec;border-radius:8px;color:#102b57;font:inherit;font-size:10px}.competitor-card label p{min-height:30px;margin:0;padding:8px;border-radius:8px;background:#f5f8fc;color:#576b88;font-size:10px}.competition-guide{display:flex;gap:12px;padding:16px;border:1px solid #bcd2fa;border-radius:13px;background:#edf5ff}.competition-guide svg{flex:0 0 auto;color:#2865df}.competition-guide strong{font-size:12px}.competition-guide p{margin:4px 0 0;color:#5c708d;font-size:10px;line-height:1.55}
@media(max-width:1050px){.marketing-filters{grid-template-columns:repeat(2,1fr)}.marketing-kpis{grid-template-columns:repeat(3,1fr)}.marketing-intel-grid{grid-template-columns:1fr}}
@media(max-width:650px){.marketing-hero{align-items:stretch;flex-direction:column}.marketing-hero-kpi{min-width:0}.marketing-filters,.marketing-kpis{grid-template-columns:1fr}.marketing-import{align-items:stretch;flex-direction:column}.marketing-import-actions{display:grid;grid-template-columns:1fr}.marketing-panel>header{align-items:flex-start;flex-direction:column}.marketing-add{align-items:stretch;flex-direction:column}.marketing-add input{width:100%}.marketing-add small{margin:0}}
`;
