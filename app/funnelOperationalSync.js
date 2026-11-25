const text=value=>String(value??'').trim();
const key=value=>text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,' ').trim().toUpperCase();
const day=value=>text(value).slice(0,10);
const month=value=>day(value).slice(0,7);

const sourceField={PISO:'freshUp',CALLE:'calle','FAN PAGE':'fanpageApv',REACTIVACIONES:'reactivaciones',LLAMADAS:'llamadas'};
const fields=['llamadas','freshUp','calle','reactivaciones','fanpageApv','citasLeadIt','citasFbToro','demos','solicitudes','avaluos','tomas','seguros','ventasSeminuevos','ventasLeadIt','ventasFb','ventasFanpageApv','ventasTotales','entregas'];
const zeros=()=>Object.fromEntries(fields.map(field=>[field,0]));
const identity=(record,field,date)=>`${month(date)}||${key(record.branch||record.sucursal)}||${key(record.vendor||record.advisor||record.apv||record.otherVendor)}`;
const owner=record=>text(record.vendor||record.advisor||record.apv||record.otherVendor);

function event(record,field,dateValue,source){
  const date=day(dateValue),branch=text(record?.branch||record?.sucursal),vendor=owner(record);
  if(!date||!branch||!vendor)return null;
  return {id:`${source}:${record?.id||`${date}-${branch}-${vendor}`}`,source,field,date,month:month(date),sucursal:branch,manager:text(record?.manager)||'SIN ASIGNAR',vendor};
}

export function operationalFunnelEvents(checkInData={},fiData={}){
  const events=[];
  (checkInData?.records||[]).forEach(record=>{
    const field=sourceField[key(record.source)];const next=field&&event({...record,vendor:record.advisor||record.vendor},field,record.createdAt,'checkin');if(next)events.push(next);
  });
  (fiData?.gmApplications||[]).forEach(record=>{const next=event(record,'solicitudes',record.date,'solicitud');if(next)events.push(next);});
  (fiData?.demoDrives||[]).forEach(record=>{const next=event(record,'demos',record.exitAt||record.date,'demo');if(next)events.push(next);});
  (fiData?.appraisals||[]).forEach(record=>{const next=event(record,'avaluos',record.date,'avaluo');if(next)events.push(next);});
  (fiData?.tradeIns||[]).forEach(record=>{if(key(record.subject||'TOMA')!=='TOMA')return;const next=event(record,'tomas',record.date,'toma');if(next)events.push(next);});
  (fiData?.insurancePolicies||[]).forEach(record=>{const next=event(record,'seguros',record.contractDate||record.date,'seguro');if(next)events.push(next);});
  (fiData?.deliveryOperations||[]).forEach(record=>{if(key(record.status)!=='ENTREGADA'||!record.actualDate)return;const next=event(record,'entregas',record.actualDate,'entrega');if(next)events.push(next);});
  return events;
}

// Los campos automáticos sustituyen el valor importado solo cuando existe una
// captura auditable para ese mismo mes, sucursal, APV y campo. Las ventas se
// mantienen exclusivamente desde Funnel/Excel hasta su futura integración.
export function mergeOperationalMetricsIntoFunnel(records=[],checkInData={},fiData={}){
  const events=operationalFunnelEvents(checkInData,fiData),byOwner=new Map();
  events.forEach(item=>{const eventKey=`${item.month}||${key(item.sucursal)}||${key(item.vendor)}`,entry=byOwner.get(eventKey)||{fields:new Set()};entry.fields.add(item.field);byOwner.set(eventKey,entry);});
  const adjusted=(records||[]).map(record=>{
    const eventKey=`${record.month||''}||${key(record.sucursal)}||${key(record.vendor)}`,entry=byOwner.get(eventKey);
    if(!entry)return record;
    const next={...record,operationalSync:true};entry.fields.forEach(field=>{next[field]=0;});return next;
  });
  const dailyRows=events.map(item=>({id:`operational-sync-${item.id}`,...zeros(),sucursal:item.sucursal,month:item.month,manager:item.manager,vendor:item.vendor,[item.field]:1,operationalSync:true,operationalDate:item.date,operationalSource:item.source}));
  return [...adjusted,...dailyRows];
}

export function filterOperationalDayRange(records=[],start='',end=''){
  if(!start||!end)return records;
  return (records||[]).filter(record=>record.operationalSync&&record.operationalDate&&record.operationalDate>=start&&record.operationalDate<=end);
}

export const operationalFields=fields;
