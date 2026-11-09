import { adminSupabase } from '@/lib/supabase';
import { createHash } from 'node:crypto';

const LINK_KEY='sales-appointments-v1';
const normalize=(value:any)=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase();
const json=(body:any,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});
const parseStored=(value:any):any=>{if(Array.isArray(value)||value&&typeof value==='object')return value;try{return JSON.parse(String(value||'[]'));}catch{return[];}};
const clean=(value:any,max=180)=>String(value||'').trim().slice(0,max);

async function validToken(admin:any,token:string){
  if(!token||token.length<32)return false;
  const hash=createHash('sha256').update(token).digest('hex');
  const {data}=await admin.from('funnel_public_links').select('token_hash,active,expires_at').eq('link_key',LINK_KEY).maybeSingle();
  return Boolean(data?.active&&data.token_hash===hash&&(!data.expires_at||new Date(data.expires_at)>new Date()));
}

async function catalog(admin:any){
  const {data}=await admin.from('funnel_storage').select('storage_key,value').in('storage_key',['funnel-kpi-v2-branches','funnel-kpi-v2-teams']).eq('scope','shared').is('owner_id',null);
  const byKey=new Map<string,any>((data||[]).map((row:any)=>[row.storage_key,parseStored(row.value)]));
  const branches=(byKey.get('funnel-kpi-v2-branches')||[]).filter((row:any)=>row?.active!==false).map((row:any)=>String(row.name||'').trim()).filter(Boolean);
  const branchSet=new Set(branches.map(normalize));
  const teams=(byKey.get('funnel-kpi-v2-teams')||[]).filter((team:any)=>!team?.inactiveManager&&branchSet.has(normalize(team?.sucursal))).map((team:any)=>{const inactive=new Set((team.inactiveVendors||[]).map(normalize));return{branch:clean(team.sucursal),manager:clean(team.manager),advisors:(team.vendors||[]).map((name:any)=>clean(name)).filter((name:string)=>name&&!inactive.has(normalize(name)))};}).filter((team:any)=>team.branch&&team.manager&&team.advisors.length);
  return{branches,teams};
}

export async function GET(request:Request){
  try{const admin=adminSupabase(),token=new URL(request.url).searchParams.get('token')||'';if(!await validToken(admin,token))return json({error:'El enlace no es válido, fue reemplazado o ya venció.'},403);return json(await catalog(admin));}catch(error:any){return json({error:error?.message||'No fue posible abrir el registro.'},500);}
}

export async function POST(request:Request){
  try{
    const admin=adminSupabase(),body=await request.json().catch(()=>({}));if(body.website)return json({ok:true});
    if(!await validToken(admin,String(body.token||'')))return json({error:'El enlace no es válido o ya venció.'},403);
    const branch=clean(body.branch),manager=clean(body.manager),advisor=clean(body.advisor),clientName=clean(body.clientName),phone=clean(body.phone,30),email=clean(body.email,180),vehicleInterest=clean(body.vehicleInterest),notes=clean(body.notes,1000),appointmentAt=new Date(body.appointmentAt);
    if(!branch||!manager||!advisor||!clientName||!phone||Number.isNaN(appointmentAt.valueOf()))return json({error:'Completa sucursal, gerente, asesor, cliente, teléfono y fecha de cita.'},400);
    const min=Date.now()-24*3600000,max=Date.now()+366*86400000;if(appointmentAt.valueOf()<min||appointmentAt.valueOf()>max)return json({error:'La fecha de la cita está fuera del rango permitido.'},400);
    const available=await catalog(admin),team=available.teams.find((row:any)=>normalize(row.branch)===normalize(branch)&&normalize(row.manager)===normalize(manager)&&row.advisors.some((name:string)=>normalize(name)===normalize(advisor)));
    if(!team)return json({error:'El asesor seleccionado ya no está activo en esa sucursal.'},400);
    const {data,error}=await admin.from('funnel_sales_appointments').insert({appointment_at:appointmentAt.toISOString(),branch,manager,advisor,client_name:clientName,phone,email,vehicle_interest:vehicleInterest,notes,status:'scheduled'}).select('id,appointment_at').single();
    if(error)return json({error:`No fue posible guardar la cita: ${error.message}`},500);
    return json({ok:true,id:data.id,appointmentAt:data.appointment_at},201);
  }catch(error:any){return json({error:error?.message||'No fue posible registrar la cita.'},500);}
}
