const strip=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

export const normalizePersonName=value=>strip(value).toUpperCase().replace(/\b(SR|SRA|SRTA|LIC|ING|DR|DRA)\.?\b/g,' ').replace(/[^A-Z0-9Ñ ]/g,' ').replace(/\s+/g,' ').trim();
export const normalizePhone=value=>{const digits=String(value??'').replace(/\D/g,'');return digits.length>=10?digits.slice(-10):'';};
export const normalizeEmail=value=>String(value??'').trim().toLowerCase();
export const normalizeVin=value=>String(value??'').toUpperCase().replace(/[^A-Z0-9]/g,'');
export const isValidVin=value=>/^[A-HJ-NPR-Z0-9]{17}$/.test(normalizeVin(value));

const first=(row,keys)=>keys.map(key=>row?.[key]).find(value=>String(value??'').trim())||'';
const SOURCE_DEFINITIONS=[
  ['gmApplications','Solicitudes GM','date'],
  ['demoDrives','Demostraciones','exitAt'],
  ['appraisals','Avalúos','date'],
  ['tradeIns','Tomas','date'],
  ['insurancePolicies','Seguros','contractDate'],
  ['deliveryOperations','Entregas','actualDate'],
];

const makeEvent=(row,source,label,dateKey)=>{
  const name=first(row,['client','cliente','customer','clientName','name','nombre']);
  const phones=[first(row,['phone','telefono','clientPhone','mobilePhone','mobile','celular','homePhone']),row?.officePhone].map(normalizePhone).filter(Boolean);
  const email=normalizeEmail(first(row,['email','correo','clientEmail']));
  const vin=normalizeVin(first(row,['vin','unitVin','serie','serieCompleta','serial']));
  return {id:`${source}:${row?.id||Math.random()}`,source,label,row,name,normalizedName:normalizePersonName(name),phones:[...new Set(phones)],email,vin,date:String(row?.[dateKey]||row?.date||row?.createdAt||'').slice(0,10),branch:first(row,['branch','sucursal','agency']),unit:first(row,['unit','vehicle','model','unitInterest','autoInteres','vehiculoCompro']),status:first(row,['status','outcome','bought'])};
};

const positive=value=>['SI','SÍ','CONFIRMADA','CONFIRMADO','EFECTIVA','EFECTIVO'].includes(strip(value).trim().toUpperCase());
const bdcEvent=(row,record,source,label,date,status)=>makeEvent({...row,date,branch:row.sucursal||row.branch,status,_bdcPeriod:record.period},source,label,'date');

export function buildTraceability(data={},inventoryData={},bdcRecords=[]){
  const operationalEvents=SOURCE_DEFINITIONS.flatMap(([source,label,dateKey])=>(Array.isArray(data?.[source])?data[source]:[]).map(row=>makeEvent(row,source,label,dateKey)));
  const bdcEvents=(bdcRecords||[]).flatMap(record=>(record.appointments||[]).flatMap(row=>{
    const stages=[
      bdcEvent(row,record,'bdcLead','BDC · Lead',row.fechaLead||`${record.period||''}-01`,'LEAD'),
      bdcEvent(row,record,'bdcAppointment','BDC · Cita',row.fechaCita||row.fechaLead,'CITA AGENDADA'),
    ];
    if(positive(row.confirmacion))stages.push(bdcEvent(row,record,'bdcConfirmation','BDC · Confirmación',row.fechaCita,'CONFIRMADA'));
    if(positive(row.asistio))stages.push(bdcEvent(row,record,'bdcEffective','BDC · Efectiva',row.fechaCita,'EFECTIVA'));
    if(positive(row.solicitud))stages.push(bdcEvent(row,record,'bdcApplication','BDC · Solicitud',row.fechaCita,'SOLICITUD'));
    if(String(row.factura||'').trim()||String(row.vehiculoCompro||'').trim())stages.push(bdcEvent({...row,unit:row.vehiculoCompro||row.autoInteres},record,'bdcClosure','BDC · Cierre',row.fechaVenta||row.fechaCita,'CIERRE'));
    return stages;
  }));
  const events=[...operationalEvents,...bdcEvents];
  const parent=events.map((_,index)=>index);
  const find=index=>parent[index]===index?index:(parent[index]=find(parent[index]));
  const union=(a,b)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent[rb]=ra;};
  const exactKeys=new Map();
  events.forEach((event,index)=>{
    const keys=[...event.phones.map(value=>`P:${value}`),event.email&&`E:${event.email}`].filter(Boolean);
    keys.forEach(key=>{if(exactKeys.has(key))union(index,exactKeys.get(key));else exactKeys.set(key,index);});
  });
  const nameOnlyGroups=new Map();
  events.forEach((event,index)=>{if(!event.normalizedName)return;const list=nameOnlyGroups.get(event.normalizedName)||[];list.push(index);nameOnlyGroups.set(event.normalizedName,list);});
  const customers=new Map();
  events.forEach((event,index)=>{const root=find(index),list=customers.get(root)||[];list.push(event);customers.set(root,list);});
  const customerJourneys=[...customers.values()].map(items=>{
    const ordered=[...items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));
    const names=[...new Set(items.map(item=>item.name).filter(Boolean))];
    const phones=[...new Set(items.flatMap(item=>item.phones))];
    const emails=[...new Set(items.map(item=>item.email).filter(Boolean))];
    const sources=[...new Set(ordered.map(item=>item.label))];
    const modules=[...new Set(ordered.map(item=>item.source.startsWith('bdc')?'BDC':item.label))];
    return {id:ordered[0]?.id,names,phones,emails,sources,modules,events:ordered,firstDate:ordered[0]?.date||'',lastDate:ordered.at(-1)?.date||'',confidence:phones.length||emails.length?'ALTA':'SIN IDENTIFICADOR'};
  }).sort((a,b)=>b.events.length-a.events.length||(b.lastDate||'').localeCompare(a.lastDate||''));
  const possibleNameMatches=[...nameOnlyGroups.entries()].flatMap(([name,indexes])=>{
    const roots=[...new Set(indexes.map(find))];if(roots.length<2)return[];
    return [{name,groups:roots.length,events:indexes.map(index=>events[index]),reason:'Mismo nombre normalizado, sin teléfono o correo coincidente'}];
  });

  const inventoryEvents=(Array.isArray(inventoryData?.records)?inventoryData.records:[]).map(row=>({id:`inventory:${row.id}`,source:'inventory',label:'Inventario',row,vin:normalizeVin(row.unitId),date:`${row.period||''}-01`,branch:row.branch||'',unit:row.model||'',status:'EN INVENTARIO'}));
  const allVehicleEvents=[...inventoryEvents,...events.filter(event=>event.vin)];
  const vehicles=new Map();
  allVehicleEvents.forEach(event=>{if(!event.vin)return;const list=vehicles.get(event.vin)||[];list.push(event);vehicles.set(event.vin,list);});
  const vehicleJourneys=[...vehicles.entries()].map(([vin,items])=>{const ordered=[...items].sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));return{vin,validVin:isValidVin(vin),events:ordered,sources:[...new Set(ordered.map(item=>item.label))],unit:items.map(item=>item.unit).find(Boolean)||'',branch:items.map(item=>item.branch).find(Boolean)||''};}).sort((a,b)=>b.events.length-a.events.length||a.vin.localeCompare(b.vin));
  const appraisals=Array.isArray(data?.appraisals)?data.appraisals:[];
  const appraisalVins=new Set(appraisals.map(row=>normalizeVin(row.vin)).filter(isValidVin));
  const tradeIns=Array.isArray(data?.tradeIns)?data.tradeIns:[];
  const tradeInsWithoutAppraisal=tradeIns.filter(row=>!appraisalVins.has(normalizeVin(row.vin)));
  const deliveries=Array.isArray(data?.deliveryOperations)?data.deliveryOperations:[];
  const deliveredVins=new Set(deliveries.filter(row=>String(row.status||'').toUpperCase()==='ENTREGADA'||row.actualDate).map(row=>normalizeVin(row.vin)).filter(isValidVin));
  const inventoryRows=Array.isArray(inventoryData?.records)?inventoryData.records:[];
  const retiredInventory=inventoryRows.filter(row=>deliveredVins.has(normalizeVin(row.unitId)));
  const inventoryWithoutVin=inventoryRows.filter(row=>!isValidVin(row.unitId));
  return {events,bdcEvents,customerJourneys,possibleNameMatches,vehicleJourneys,tradeInsWithoutAppraisal,deliveredVins,retiredInventory,inventoryWithoutVin};
}

export function findAppraisalByVin(vin,appraisals=[]){const key=normalizeVin(vin);return isValidVin(key)?appraisals.find(row=>normalizeVin(row.vin)===key)||null:null;}
