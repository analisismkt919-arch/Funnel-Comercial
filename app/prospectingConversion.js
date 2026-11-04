const text=value=>String(value??'').trim();
const key=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toUpperCase();
const phone=value=>{const digits=text(value).replace(/\D/g,'');return digits.length>=10?digits.slice(-10):'';};
const email=value=>text(value).toLowerCase();
const first=(row,names)=>names.map(name=>row?.[name]).find(value=>text(value))||'';
const dateOf=(row,names)=>text(first(row,names)).slice(0,10);
const daysBetween=(a,b)=>{const start=new Date(`${a}T12:00:00`),end=new Date(`${b}T12:00:00`);return Number.isFinite(start.getTime())&&Number.isFinite(end.getTime())?Math.round((end-start)/86400000):null;};
const median=values=>{const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;};
const interestedUnit=row=>text(first(row,['vehicle1','vehicleInterest','unitInterest','modelInterest','unidadInteres']));

export async function hashIdentifier(type,value){
  const normalized=type==='phone'?phone(value):email(value);
  if(!normalized)return'';
  const bytes=new TextEncoder().encode(`CR3:${type}:${normalized}`),digest=await globalThis.crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function attachProspectingHashes(rows=[]){
  return Promise.all(rows.map(async row=>{
    const phoneHash=await hashIdentifier('phone',row.__phone),emailHash=await hashIdentifier('email',row.__email);
    return {...row,phoneHash,emailHash,personHash:phoneHash||emailHash||''};
  }));
}

const DEFINITIONS=[
  ['demo','Demo','demoDrives',['exitAt','date']],
  ['application','Solicitud','gmApplications',['date']],
  ['appraisal','Avalúo','appraisals',['date']],
  ['tradeIn','Toma','tradeIns',['date']],
  ['insurance','Seguro','insurancePolicies',['contractDate','date']],
  ['delivery','Entrega','deliveryOperations',['actualDate','scheduledDate','invoiceDate','date']],
];

async function eventFrom(row,stage,label,dateKeys){
  const phones=[first(row,['phone','telefono','clientPhone','clientMobilePhone','mobilePhone','mobile','celular','homePhone','clientHomePhone','clientPhone','clientMobilePhone']),row?.officePhone,row?.clientOfficePhone,row?.contactMobilePhone,row?.contactHomePhone,row?.clientPhone].map(phone).filter(Boolean);
  const emails=[first(row,['email','correo','clientEmail','contactEmail'])].map(email).filter(Boolean);
  const phoneHashes=await Promise.all([...new Set(phones)].map(value=>hashIdentifier('phone',value))),emailHashes=await Promise.all([...new Set(emails)].map(value=>hashIdentifier('email',value)));
  return {id:`${stage}:${row?.id||Math.random()}`,stage,label,date:dateOf(row,dateKeys),branch:first(row,['branch','sucursal','agency']),unit:first(row,['modelDescription','unit','vehicle','model','unitInterest','autoInteres','vehiculoCompro']),manager:first(row,['manager','gerente']),apv:first(row,['vendor','salesperson','vendedor','apv']),phoneHashes:phoneHashes.filter(Boolean),emailHashes:emailHashes.filter(Boolean)};
}

function bdcRows(records=[]){
  return records.flatMap(record=>(record.appointments||[]).flatMap(row=>{
    const base={...row,branch:row.sucursal||row.branch},events=[['bdcAppointment','Cita BDC',row.fechaCita||row.fechaLead]];
    if(['SI','SÍ','CONFIRMADA','CONFIRMADO'].includes(key(row.confirmacion)))events.push(['confirmation','Confirmación',row.fechaCita]);
    if(['SI','SÍ','EFECTIVA','EFECTIVO'].includes(key(row.asistio)))events.push(['effective','Cita efectiva',row.fechaCita]);
    if(['SI','SÍ'].includes(key(row.solicitud)))events.push(['application','Solicitud',row.fechaCita]);
    if(text(row.factura)||text(row.vehiculoCompro))events.push(['sale','Cierre BDC',row.fechaVenta||row.fechaCita]);
    return events.map(([stage,label,date])=>({...base,__stage:stage,__label:label,__date:date}));
  }));
}

function groupPerformance(journeys,getter){
  const map=new Map();
  journeys.forEach(row=>{const label=text(getter(row))||'Sin clasificar',id=key(label),item=map.get(id)||{label,prospects:0,demo:0,application:0,appraisal:0,tradeIn:0,sale:0,delivery:0,matched:0};item.prospects++;if(row.matched)item.matched++;['demo','application','appraisal','tradeIn','sale','delivery'].forEach(stage=>{if(row.stages[stage])item[stage]++;});map.set(id,item);});
  return [...map.values()].map(row=>({...row,demoRate:row.prospects?row.demo/row.prospects*100:0,applicationRate:row.prospects?row.application/row.prospects*100:0,saleRate:row.prospects?row.sale/row.prospects*100:0,deliveryRate:row.prospects?row.delivery/row.prospects*100:0})).sort((a,b)=>b.prospects-a.prospects);
}

export async function buildProspectingConversion({prospects=[],resultsData={},bdcRecords=[],salesData={},inventoryData={},periods=[]}={}){
  const operational=await Promise.all(DEFINITIONS.flatMap(([stage,label,source,dateKeys])=>(resultsData?.[source]||[]).map(row=>eventFrom(row,stage,label,dateKeys))));
  const bdc=await Promise.all(bdcRows(bdcRecords).map(row=>eventFrom(row,row.__stage,row.__label,['__date'])));
  const sales=await Promise.all((salesData?.records||[]).filter(row=>key(row.status)!=='CANCELADA').map(row=>eventFrom(row,'sale','Venta',['date'])));
  const events=[...operational,...bdc,...sales].filter(row=>row.phoneHashes.length||row.emailHashes.length);
  const index=new Map();events.forEach(event=>[...event.phoneHashes,...event.emailHashes].forEach(hash=>{const list=index.get(hash)||[];list.push(event);index.set(hash,list);}));
  const cohorts=new Map();
  prospects.filter(row=>row.personHash||row.phoneHash||row.emailHash).forEach(row=>{const id=row.personHash||row.phoneHash||row.emailHash,item=cohorts.get(id);if(!item||String(row.date).localeCompare(String(item.date))<0)cohorts.set(id,{...row,cohortId:id});});
  const journeys=[...cohorts.values()].map(prospect=>{
    const candidates=[...new Set([...(index.get(prospect.phoneHash)||[]),...(index.get(prospect.emailHash)||[])])].filter(event=>{const days=daysBetween(prospect.date,event.date);return days===null||days>=-1&&days<=365;}).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
    const stages={};candidates.forEach(event=>{if(!stages[event.stage])stages[event.stage]=event;});
    const firstOutcome=candidates.find(event=>['demo','application','appraisal','tradeIn','sale','delivery'].includes(event.stage));
    return {...prospect,events:candidates,stages,matched:Boolean(candidates.length),daysToFirst:firstOutcome?daysBetween(prospect.date,firstOutcome.date):null,daysToSale:stages.sale?daysBetween(prospect.date,stages.sale.date):null};
  });
  const count=stage=>journeys.filter(row=>row.stages[stage]).length,total=journeys.length,recordTotal=prospects.length,matched=journeys.filter(row=>row.matched).length;
  const stageRows=[['records','Registros importados',recordTotal],['prospect','Personas trazables',total],['demo','Demos',count('demo')],['application','Solicitudes',count('application')],['appraisal','Avalúos',count('appraisal')],['tradeIn','Tomas',count('tradeIn')],['sale','Ventas',count('sale')],['delivery','Entregas',count('delivery')]].map(([stage,label,value],index,array)=>({stage,label,value,rate:recordTotal?value/recordTotal*100:0,stepRate:index?value/(array[index-1][2]||1)*100:100}));
  const opening=(inventoryData?.openingRecords||[]).filter(row=>!periods.length||periods.includes(row.period));
  const inventoryRows=opening.length?opening:(inventoryData?.records||[]).filter(row=>!periods.length||periods.includes(row.period));
  const inventoryMap=new Map();inventoryRows.forEach(row=>{const id=key(row.model);inventoryMap.set(id,(inventoryMap.get(id)||0)+(Number(row.quantity)||1));});
  const salesMap=new Map();salesData?.records?.filter(row=>!periods.length||periods.includes(text(row.date).slice(0,7))).forEach(row=>{const id=key(row.modelDescription||row.unit||row.model);salesMap.set(id,(salesMap.get(id)||0)+1);});
  const demandMap=new Map();prospects.forEach(row=>{const model=interestedUnit(row);if(!model)return;const id=key(model),item=demandMap.get(id)||{label:model,prospects:0};item.prospects++;demandMap.set(id,item);});
  const demand=[...demandMap.entries()].map(([id,row])=>({...row,inventory:inventoryMap.get(id)||0,sales:salesMap.get(id)||0,prospectsPerUnit:(inventoryMap.get(id)||0)?row.prospects/(inventoryMap.get(id)||1):null})).sort((a,b)=>b.prospects-a.prospects);
  const salesAttribution=journeys.filter(row=>row.stages.sale).map(row=>({prospectDate:row.date,saleDate:row.stages.sale.date,branch:row.branch,manager:row.manager,apv:row.apv,type:row.type,mediumCategory:row.mediumCategory,source:row.medium,interestedUnit:interestedUnit(row),soldUnit:row.stages.sale.unit,daysToSale:row.daysToSale}));
  const freshUpJourneys=journeys.filter(row=>key(row.type)==='FRESH UP'),freshUpSales=salesAttribution.filter(row=>key(row.type)==='FRESH UP');
  const freshUp={total:freshUpJourneys.length,matched:freshUpJourneys.filter(row=>row.matched).length,demos:freshUpJourneys.filter(row=>row.stages.demo).length,applications:freshUpJourneys.filter(row=>row.stages.application).length,sales:freshUpJourneys.filter(row=>row.stages.sale).length,deliveries:freshUpJourneys.filter(row=>row.stages.delivery).length,bySource:groupPerformance(freshUpJourneys,row=>row.medium),byBranch:groupPerformance(freshUpJourneys,row=>row.branch),byVehicle:groupPerformance(freshUpJourneys,row=>interestedUnit(row)),byDay:groupPerformance(freshUpJourneys,row=>row.day),byHour:groupPerformance(freshUpJourneys,row=>row.hourBlock),salesAttribution:freshUpSales,medianSale:median(freshUpJourneys.map(row=>row.daysToSale))};
  return {journeys,events,recordTotal,total,matched,unmatched:total-matched,matchRate:total?matched/total*100:0,stageRows,byMedium:groupPerformance(journeys,row=>row.mediumCategory),bySource:groupPerformance(journeys,row=>row.medium),byType:groupPerformance(journeys,row=>row.type),byBranch:groupPerformance(journeys,row=>row.branch),byVehicle:groupPerformance(journeys,row=>interestedUnit(row)),salesAttribution,freshUp,medianFirst:median(journeys.map(row=>row.daysToFirst)),medianSale:median(journeys.map(row=>row.daysToSale)),demand};
}
